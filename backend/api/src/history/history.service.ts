import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Consultation, Report, Doctor, Patient, UserType } from '../entities';
import { AuditService } from '../shared/audit.service';

export interface PatientHistoryEntry {
  consultation: Consultation;
  report?: Report;
  isCurrent: boolean;
  hasConflicts: boolean;
  redFlags: string[];
}

export interface PatientHistorySummary {
  patient: Patient;
  consultations: PatientHistoryEntry[];
  totalConsultations: number;
  latestConsultation?: Consultation;
  medicationConflicts: string[];
  chronicConditions: string[];
  allergies: string[];
  currentMedications: string[];
}

@Injectable()
export class HistoryService {
  private readonly logger = new Logger(HistoryService.name);

  constructor(
    @InjectRepository(Consultation)
    private consultationRepository: Repository<Consultation>,
    @InjectRepository(Report)
    private reportRepository: Repository<Report>,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    private auditService: AuditService,
  ) {}

  async getPatientHistory(
    patientId: string,
    requestInfo: { userId: string; ipAddress?: string; userAgent?: string; sessionId?: string }
  ): Promise<PatientHistorySummary> {
    const patient = await this.patientRepository.findOne({
      where: { id: patientId },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    // Get all consultations with reports
    const consultations = await this.consultationRepository.find({
      where: { patient_id: patientId },
      relations: ['doctor', 'reports'],
      order: { consultation_date: 'DESC' },
    });

    // Get all reports for analysis
    const reports = await this.reportRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.consultation', 'consultation')
      .where('consultation.patient_id = :patientId', { patientId })
      .orderBy('consultation.consultation_date', 'DESC')
      .getMany();

    // Process history entries
    const historyEntries: PatientHistoryEntry[] = consultations.map((consultation, index) => {
      const report = reports.find(r => r.consultation_id === consultation.id);
      const isCurrent = index === 0; // Most recent consultation
      
      const hasConflicts = report?.medication_conflicts ? 
        (Array.isArray(report.medication_conflicts) ? report.medication_conflicts.length > 0 : true) : false;
      
      const redFlags = report?.red_flags ? 
        (Array.isArray(report.red_flags) ? report.red_flags : [report.red_flags]) : [];

      return {
        consultation,
        report,
        isCurrent,
        hasConflicts,
        redFlags,
      };
    });

    // Analyze medication conflicts across all reports
    const allMedicationConflicts = this.extractMedicationConflicts(reports);
    
    // Extract chronic conditions from medical history and reports
    const chronicConditions = this.extractChronicConditions(patient.medical_history, reports);

    // Parse allergies and current medications
    const allergies = patient.allergies ? patient.allergies.split(',').map(a => a.trim()) : [];
    const currentMedications = patient.medication ? patient.medication.split(',').map(m => m.trim()) : [];

    // Log audit trail
    await this.auditService.log(
      requestInfo.userId,
      UserType.DOCTOR,
      'VIEW_PATIENT_HISTORY',
      'patient',
      patientId,
      { total_consultations: consultations.length },
      requestInfo.ipAddress,
      requestInfo.userAgent,
      requestInfo.sessionId,
    );

    return {
      patient,
      consultations: historyEntries,
      totalConsultations: consultations.length,
      latestConsultation: consultations[0] || null,
      medicationConflicts: allMedicationConflicts,
      chronicConditions,
      allergies,
      currentMedications,
    };
  }

  async getDoctorPatients(
    doctorId: string,
    requestInfo: { userId: string; ipAddress?: string; userAgent?: string; sessionId?: string }
  ): Promise<{ patient: Patient; latestConsultation: Consultation; hasConflicts: boolean }[]> {
    const doctor = await this.doctorRepository.findOne({
      where: { id: doctorId },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    // Get unique patients for this doctor with their latest consultations
    const consultations = await this.consultationRepository
      .createQueryBuilder('consultation')
      .leftJoinAndSelect('consultation.patient', 'patient')
      .leftJoinAndSelect('consultation.reports', 'reports')
      .where('consultation.doctor_id = :doctorId', { doctorId })
      .orderBy('consultation.consultation_date', 'DESC')
      .getMany();

    // Group by patient and get latest consultation for each
    const patientMap = new Map();
    
    for (const consultation of consultations) {
      if (!patientMap.has(consultation.patient_id)) {
        const hasConflicts = consultation.reports?.some(report => 
          report.medication_conflicts && 
          (Array.isArray(report.medication_conflicts) ? report.medication_conflicts.length > 0 : true)
        ) || false;

        patientMap.set(consultation.patient_id, {
          patient: consultation.patient,
          latestConsultation: consultation,
          hasConflicts,
        });
      }
    }

    // Log audit trail
    await this.auditService.log(
      requestInfo.userId,
      UserType.DOCTOR,
      'VIEW_DOCTOR_PATIENTS',
      'doctor',
      doctorId,
      { patient_count: patientMap.size },
      requestInfo.ipAddress,
      requestInfo.userAgent,
      requestInfo.sessionId,
    );

    return Array.from(patientMap.values());
  }

  async getHandoverSummary(
    patientId: string,
    requestInfo: { userId: string; ipAddress?: string; userAgent?: string; sessionId?: string }
  ): Promise<{
    patient: Patient;
    currentConsultation: Consultation;
    currentReport?: Report;
    previousConsultations: Consultation[];
    criticalAlerts: string[];
    medicationChanges: string[];
    followUpRequired: string[];
  }> {
    const patientHistory = await this.getPatientHistory(patientId, requestInfo);
    
    if (patientHistory.consultations.length === 0) {
      throw new NotFoundException('No consultations found for patient');
    }

    const currentEntry = patientHistory.consultations[0];
    const previousConsultations = patientHistory.consultations.slice(1).map(entry => entry.consultation);

    // Generate critical alerts
    const criticalAlerts: string[] = [];
    
    // Add red flags from current report
    if (currentEntry.redFlags.length > 0) {
      criticalAlerts.push(...currentEntry.redFlags);
    }

    // Add medication conflicts
    if (currentEntry.hasConflicts && currentEntry.report?.medication_conflicts) {
      const conflicts = Array.isArray(currentEntry.report.medication_conflicts) 
        ? currentEntry.report.medication_conflicts 
        : [currentEntry.report.medication_conflicts];
      criticalAlerts.push(...conflicts);
    }

    // Add allergy alerts
    if (patientHistory.allergies.length > 0) {
      criticalAlerts.push(`Patient allergies: ${patientHistory.allergies.join(', ')}`);
    }

    // Analyze medication changes
    const medicationChanges = this.analyzeMedicationChanges(patientHistory.consultations);

    // Extract follow-up requirements
    const followUpRequired = this.extractFollowUpRequirements(currentEntry.report);

    // Log audit trail
    await this.auditService.log(
      requestInfo.userId,
      UserType.DOCTOR,
      'VIEW_HANDOVER_SUMMARY',
      'patient',
      patientId,
      { 
        critical_alerts_count: criticalAlerts.length,
        medication_changes_count: medicationChanges.length 
      },
      requestInfo.ipAddress,
      requestInfo.userAgent,
      requestInfo.sessionId,
    );

    return {
      patient: patientHistory.patient,
      currentConsultation: currentEntry.consultation,
      currentReport: currentEntry.report,
      previousConsultations,
      criticalAlerts,
      medicationChanges,
      followUpRequired,
    };
  }

  private extractMedicationConflicts(reports: Report[]): string[] {
    const conflicts: string[] = [];
    
    for (const report of reports) {
      if (report.medication_conflicts) {
        if (Array.isArray(report.medication_conflicts)) {
          conflicts.push(...report.medication_conflicts);
        } else {
          conflicts.push(report.medication_conflicts);
        }
      }
    }

    // Remove duplicates
    return [...new Set(conflicts)];
  }

  private extractChronicConditions(medicalHistory: string, reports: Report[]): string[] {
    const conditions: string[] = [];

    // Extract from medical history
    if (medicalHistory) {
      const commonConditions = [
        'diabetes', 'hypertension', 'asthma', 'copd', 'heart disease',
        'kidney disease', 'liver disease', 'arthritis', 'depression',
        'anxiety', 'cancer', 'stroke', 'epilepsy'
      ];

      const historyLower = medicalHistory.toLowerCase();
      for (const condition of commonConditions) {
        if (historyLower.includes(condition)) {
          conditions.push(condition);
        }
      }
    }

    // Extract from report diagnoses
    for (const report of reports) {
      if (report.report_eng?.diagnosis) {
        const diagnoses = Array.isArray(report.report_eng.diagnosis) 
          ? report.report_eng.diagnosis 
          : [report.report_eng.diagnosis];
        
        conditions.push(...diagnoses);
      }
    }

    // Remove duplicates and return
    return [...new Set(conditions)];
  }

  private analyzeMedicationChanges(consultations: PatientHistoryEntry[]): string[] {
    const changes: string[] = [];

    if (consultations.length < 2) {
      return changes;
    }

    const current = consultations[0];
    const previous = consultations[1];

    if (!current.report?.report_eng?.medications || !previous.report?.report_eng?.medications) {
      return changes;
    }

    const currentMeds = Array.isArray(current.report.report_eng.medications) 
      ? current.report.report_eng.medications 
      : [current.report.report_eng.medications];

    const previousMeds = Array.isArray(previous.report.report_eng.medications) 
      ? previous.report.report_eng.medications 
      : [previous.report.report_eng.medications];

    // Find new medications
    const newMeds = currentMeds.filter(med => !previousMeds.includes(med));
    const discontinuedMeds = previousMeds.filter(med => !currentMeds.includes(med));

    if (newMeds.length > 0) {
      changes.push(`New medications: ${newMeds.join(', ')}`);
    }

    if (discontinuedMeds.length > 0) {
      changes.push(`Discontinued medications: ${discontinuedMeds.join(', ')}`);
    }

    return changes;
  }

  private extractFollowUpRequirements(report?: Report): string[] {
    if (!report?.report_eng?.follow_up) {
      return [];
    }

    return Array.isArray(report.report_eng.follow_up) 
      ? report.report_eng.follow_up 
      : [report.report_eng.follow_up];
  }

  async searchPatientHistory(
    patientId: string,
    searchTerm: string,
    requestInfo: { userId: string; ipAddress?: string; userAgent?: string; sessionId?: string }
  ): Promise<PatientHistoryEntry[]> {
    const consultations = await this.consultationRepository
      .createQueryBuilder('consultation')
      .leftJoinAndSelect('consultation.doctor', 'doctor')
      .leftJoinAndSelect('consultation.reports', 'reports')
      .where('consultation.patient_id = :patientId', { patientId })
      .andWhere(
        '(consultation.transcript_raw ILIKE :searchTerm OR consultation.transcript_eng ILIKE :searchTerm OR reports.report_eng::text ILIKE :searchTerm)',
        { searchTerm: `%${searchTerm}%` }
      )
      .orderBy('consultation.consultation_date', 'DESC')
      .getMany();

    const historyEntries: PatientHistoryEntry[] = consultations.map(consultation => {
      const report = consultation.reports?.[0];
      const hasConflicts = report?.medication_conflicts ? 
        (Array.isArray(report.medication_conflicts) ? report.medication_conflicts.length > 0 : true) : false;
      
      const redFlags = report?.red_flags ? 
        (Array.isArray(report.red_flags) ? report.red_flags : [report.red_flags]) : [];

      return {
        consultation,
        report,
        isCurrent: false,
        hasConflicts,
        redFlags,
      };
    });

    // Log audit trail
    await this.auditService.log(
      requestInfo.userId,
      UserType.DOCTOR,
      'SEARCH_PATIENT_HISTORY',
      'patient',
      patientId,
      { search_term: searchTerm, results_count: historyEntries.length },
      requestInfo.ipAddress,
      requestInfo.userAgent,
      requestInfo.sessionId,
    );

    return historyEntries;
  }
}
