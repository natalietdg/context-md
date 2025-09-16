import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment, Consultation, Doctor, Patient, Report, AppointmentStatus, UserType } from '../entities';
import { AuditService } from '../shared/audit.service';

export interface DashboardStats {
  totalAppointments: number;
  todayAppointments: number;
  completedConsultations: number;
  pendingReports: number;
  criticalAlerts: number;
}

export interface UpcomingAppointment {
  appointment: Appointment;
  patient: Patient;
  hasHistory: boolean;
  lastConsultation?: Date;
  criticalFlags: string[];
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    @InjectRepository(Consultation)
    private consultationRepository: Repository<Consultation>,
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    @InjectRepository(Report)
    private reportRepository: Repository<Report>,
    private auditService: AuditService,
  ) {}

  async getDoctorDashboard(
    doctorId: string,
    requestInfo: { userId: string; ipAddress?: string; userAgent?: string; sessionId?: string }
  ): Promise<{
    stats: DashboardStats;
    upcomingAppointments: UpcomingAppointment[];
    recentConsultations: Consultation[];
    criticalAlerts: any[];
  }> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // Get dashboard statistics
    const stats = await this.getDashboardStats(doctorId, startOfDay, endOfDay);

    // Get upcoming appointments for the next 7 days
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const upcomingAppointments = await this.getUpcomingAppointments(doctorId, today, nextWeek);

    // Get recent consultations (last 10)
    const recentConsultations = await this.consultationRepository.find({
      where: { doctor_id: doctorId },
      relations: ['patient', 'reports'],
      order: { consultation_date: 'DESC' },
      take: 10,
    });

    // Get critical alerts
    const criticalAlerts = await this.getCriticalAlerts(doctorId);

    // Log audit trail
    await this.auditService.log(
      requestInfo.userId,
      UserType.DOCTOR,
      'VIEW_DASHBOARD',
      'dashboard',
      doctorId,
      { 
        upcoming_appointments: upcomingAppointments.length,
        critical_alerts: criticalAlerts.length 
      },
      requestInfo.ipAddress,
      requestInfo.userAgent,
      requestInfo.sessionId,
    );

    return {
      stats,
      upcomingAppointments,
      recentConsultations,
      criticalAlerts,
    };
  }

  private async getDashboardStats(
    doctorId: string,
    startOfDay: Date,
    endOfDay: Date
  ): Promise<DashboardStats> {
    // Total appointments for doctor
    const totalAppointments = await this.appointmentRepository.count({
      where: { doctor_id: doctorId },
    });

    // Today's appointments
    const todayAppointments = await this.appointmentRepository
      .createQueryBuilder('appointment')
      .where('appointment.doctor_id = :doctorId', { doctorId })
      .andWhere('appointment.scheduled_at >= :startOfDay', { startOfDay })
      .andWhere('appointment.scheduled_at < :endOfDay', { endOfDay })
      .getCount();

    // Completed consultations
    const completedConsultations = await this.consultationRepository.count({
      where: { doctor_id: doctorId },
    });

    // Pending reports (consultations without reports)
    const consultationsWithoutReports = await this.consultationRepository
      .createQueryBuilder('consultation')
      .leftJoin('consultation.reports', 'report')
      .where('consultation.doctor_id = :doctorId', { doctorId })
      .andWhere('report.id IS NULL')
      .getCount();

    // Critical alerts (reports with red flags or medication conflicts)
    const criticalAlerts = await this.reportRepository
      .createQueryBuilder('report')
      .leftJoin('report.consultation', 'consultation')
      .where('consultation.doctor_id = :doctorId', { doctorId })
      .andWhere('(report.red_flags IS NOT NULL OR report.medication_conflicts IS NOT NULL)')
      .getCount();

    return {
      totalAppointments,
      todayAppointments,
      completedConsultations,
      pendingReports: consultationsWithoutReports,
      criticalAlerts,
    };
  }

  private async getUpcomingAppointments(
    doctorId: string,
    startDate: Date,
    endDate: Date
  ): Promise<UpcomingAppointment[]> {
    const appointments = await this.appointmentRepository
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.patient', 'patient')
      .where('appointment.doctor_id = :doctorId', { doctorId })
      .andWhere('appointment.scheduled_at >= :startDate', { startDate })
      .andWhere('appointment.scheduled_at < :endDate', { endDate })
      .andWhere('appointment.status = :status', { status: AppointmentStatus.SCHEDULED })
      .orderBy('appointment.scheduled_at', 'ASC')
      .getMany();

    const upcomingAppointments: UpcomingAppointment[] = [];

    for (const appointment of appointments) {
      // Check if patient has consultation history
      const lastConsultation = await this.consultationRepository.findOne({
        where: { patient_id: appointment.patient_id },
        order: { consultation_date: 'DESC' },
      });

      // Get critical flags for this patient
      const criticalFlags = await this.getPatientCriticalFlags(appointment.patient_id);

      upcomingAppointments.push({
        appointment,
        patient: appointment.patient,
        hasHistory: !!lastConsultation,
        lastConsultation: lastConsultation?.consultation_date,
        criticalFlags,
      });
    }

    return upcomingAppointments;
  }

  private async getPatientCriticalFlags(patientId: string): Promise<string[]> {
    const flags: string[] = [];

    // Get patient info
    const patient = await this.patientRepository.findOne({
      where: { id: patientId },
    });

    if (patient?.allergies) {
      flags.push(`Allergies: ${patient.allergies}`);
    }

    // Get latest report for red flags and conflicts
    const latestReport = await this.reportRepository
      .createQueryBuilder('report')
      .leftJoin('report.consultation', 'consultation')
      .where('consultation.patient_id = :patientId', { patientId })
      .orderBy('consultation.consultation_date', 'DESC')
      .getOne();

    if (latestReport) {
      if (latestReport.red_flags) {
        const redFlags = Array.isArray(latestReport.red_flags) 
          ? latestReport.red_flags 
          : [latestReport.red_flags];
        flags.push(...redFlags);
      }

      if (latestReport.medication_conflicts) {
        const conflicts = Array.isArray(latestReport.medication_conflicts) 
          ? latestReport.medication_conflicts 
          : [latestReport.medication_conflicts];
        flags.push(...conflicts);
      }
    }

    return flags;
  }

  private async getCriticalAlerts(doctorId: string): Promise<any[]> {
    const alerts = await this.reportRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.consultation', 'consultation')
      .leftJoinAndSelect('consultation.patient', 'patient')
      .where('consultation.doctor_id = :doctorId', { doctorId })
      .andWhere('(report.red_flags IS NOT NULL OR report.medication_conflicts IS NOT NULL)')
      .orderBy('report.created_at', 'DESC')
      .take(20)
      .getMany();

    return alerts.map(report => ({
      id: report.id,
      patient: report.consultation.patient,
      consultation_date: report.consultation.consultation_date,
      red_flags: report.red_flags,
      medication_conflicts: report.medication_conflicts,
      created_at: report.created_at,
    }));
  }

  async updateAppointmentStatus(
    appointmentId: string,
    status: AppointmentStatus,
    requestInfo: { userId: string; ipAddress?: string; userAgent?: string; sessionId?: string }
  ): Promise<Appointment> {
    const appointment = await this.appointmentRepository.findOne({
      where: { id: appointmentId },
      relations: ['patient', 'doctor'],
    });

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    const previousStatus = appointment.status;
    appointment.status = status;

    const updatedAppointment = await this.appointmentRepository.save(appointment);

    // Log audit trail
    await this.auditService.log(
      requestInfo.userId,
      UserType.DOCTOR,
      'UPDATE_APPOINTMENT_STATUS',
      'appointment',
      appointmentId,
      { previous_status: previousStatus, new_status: status },
      requestInfo.ipAddress,
      requestInfo.userAgent,
      requestInfo.sessionId,
    );

    this.logger.log(`Appointment ${appointmentId} status updated from ${previousStatus} to ${status}`);
    return updatedAppointment;
  }

  async createAppointment(
    patientId: string,
    doctorId: string,
    scheduledAt: Date,
    durationMinutes: number = 30,
    appointmentType: string = 'consultation',
    notes?: string,
    requestInfo?: { userId: string; ipAddress?: string; userAgent?: string; sessionId?: string }
  ): Promise<Appointment> {
    const appointment = this.appointmentRepository.create({
      patient_id: patientId,
      doctor_id: doctorId,
      scheduled_at: scheduledAt,
      duration_minutes: durationMinutes,
      appointment_type: appointmentType,
      notes,
      status: AppointmentStatus.SCHEDULED,
    });

    const savedAppointment = await this.appointmentRepository.save(appointment);

    // Log audit trail
    if (requestInfo) {
      await this.auditService.log(
        requestInfo.userId,
        UserType.DOCTOR,
        'CREATE_APPOINTMENT',
        'appointment',
        savedAppointment.id,
        { patient_id: patientId, doctor_id: doctorId, scheduled_at: scheduledAt },
        requestInfo.ipAddress,
        requestInfo.userAgent,
        requestInfo.sessionId,
      );
    }

    this.logger.log(`Appointment created: ${savedAppointment.id} for patient ${patientId}`);
    return savedAppointment;
  }
}
