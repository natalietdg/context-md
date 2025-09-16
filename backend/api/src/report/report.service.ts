import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report, Consultation, Doctor, Patient, UserType } from '../entities';
import { AuditService } from '../shared/audit.service';
import { SeaLionService, ReportGenerationResult } from '../shared/sea-lion.service';
import { CreateReportDto, UpdateReportDto } from './dto';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    @InjectRepository(Report)
    private reportRepository: Repository<Report>,
    @InjectRepository(Consultation)
    private consultationRepository: Repository<Consultation>,
    private auditService: AuditService,
    private seaLionService: SeaLionService,
  ) {}

  async generateReport(
    createReportDto: CreateReportDto,
    requestInfo: { userId: string; ipAddress?: string; userAgent?: string; sessionId?: string }
  ): Promise<Report> {
    const { consultation_id, target_language } = createReportDto;

    // Get consultation with patient data
    const consultation = await this.consultationRepository.findOne({
      where: { id: consultation_id },
      relations: ['patient', 'doctor'],
    });

    if (!consultation) {
      throw new NotFoundException('Consultation not found');
    }

    if (!consultation.transcript_eng) {
      throw new BadRequestException('English transcript not available for report generation');
    }

    // Check if report already exists
    const existingReport = await this.reportRepository.findOne({
      where: { consultation_id },
    });

    if (existingReport) {
      throw new BadRequestException('Report already exists for this consultation');
    }

    try {
      const startTime = Date.now();

      // Generate medical report using SEA-LION
      const reportResult: ReportGenerationResult = await this.seaLionService.generateMedicalReport(
        consultation.transcript_eng,
        consultation.patient.medical_history,
        consultation.patient.medication,
        consultation.patient.allergies
      );

      // Translate to target language if specified
      let translatedReport = null;
      if (target_language && target_language !== 'en') {
        translatedReport = await this.seaLionService.translateReport(
          reportResult.report,
          target_language
        );
      }

      // Create report record
      const report = this.reportRepository.create({
        consultation_id,
        report_eng: reportResult.report,
        report_other_lang: translatedReport,
        target_language: target_language || null,
        ai_model_version: reportResult.model_version,
        confidence_score: reportResult.confidence_score,
        medication_conflicts: reportResult.report.conflicts.length > 0 ? reportResult.report.conflicts : null,
        red_flags: reportResult.report.red_flags.length > 0 ? reportResult.report.red_flags : null,
        processing_time_ms: reportResult.processing_time_ms,
      });

      const savedReport = await this.reportRepository.save(report);

      // Log audit trail
      await this.auditService.log(
        requestInfo.userId,
        UserType.DOCTOR,
        'GENERATE_REPORT',
        'report',
        savedReport.id,
        { consultation_id, target_language, confidence_score: reportResult.confidence_score },
        requestInfo.ipAddress,
        requestInfo.userAgent,
        requestInfo.sessionId,
      );

      this.logger.log(`Report generated: ${savedReport.id} for consultation ${consultation_id}`);
      return savedReport;
    } catch (error) {
      this.logger.error('Failed to generate report:', error);
      throw new BadRequestException(`Failed to generate report: ${error.message}`);
    }
  }

  async getReport(id: string): Promise<Report> {
    const report = await this.reportRepository.findOne({
      where: { id },
      relations: ['consultation', 'consultation.patient', 'consultation.doctor'],
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return report;
  }

  async getReportByConsultation(consultationId: string): Promise<Report> {
    const report = await this.reportRepository.findOne({
      where: { consultation_id: consultationId },
      relations: ['consultation', 'consultation.patient', 'consultation.doctor'],
    });

    if (!report) {
      throw new NotFoundException('Report not found for this consultation');
    }

    return report;
  }

  async updateReport(
    id: string,
    updateDto: UpdateReportDto,
    requestInfo: { userId: string; ipAddress?: string; userAgent?: string; sessionId?: string }
  ): Promise<Report> {
    const report = await this.getReport(id);

    // Check if consultation is locked
    if (report.consultation.is_locked) {
      throw new BadRequestException('Cannot modify report - consultation is locked');
    }

    Object.assign(report, updateDto);
    const updatedReport = await this.reportRepository.save(report);

    // Log audit trail
    await this.auditService.log(
      requestInfo.userId,
      UserType.DOCTOR,
      'UPDATE_REPORT',
      'report',
      id,
      updateDto,
      requestInfo.ipAddress,
      requestInfo.userAgent,
      requestInfo.sessionId,
    );

    return updatedReport;
  }

  async getPatientReports(patientId: string): Promise<Report[]> {
    return this.reportRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.consultation', 'consultation')
      .leftJoinAndSelect('consultation.doctor', 'doctor')
      .where('consultation.patient_id = :patientId', { patientId })
      .orderBy('consultation.consultation_date', 'DESC')
      .getMany();
  }

  async getDoctorReports(doctorId: string): Promise<Report[]> {
    return this.reportRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.consultation', 'consultation')
      .leftJoinAndSelect('consultation.patient', 'patient')
      .where('consultation.doctor_id = :doctorId', { doctorId })
      .orderBy('consultation.consultation_date', 'DESC')
      .getMany();
  }

  async getReportsWithConflicts(): Promise<Report[]> {
    return this.reportRepository
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.consultation', 'consultation')
      .leftJoinAndSelect('consultation.patient', 'patient')
      .leftJoinAndSelect('consultation.doctor', 'doctor')
      .where('report.medication_conflicts IS NOT NULL')
      .orWhere('report.red_flags IS NOT NULL')
      .orderBy('report.created_at', 'DESC')
      .getMany();
  }

  async regenerateReport(
    reportId: string,
    targetLanguage?: string,
    requestInfo?: { userId: string; ipAddress?: string; userAgent?: string; sessionId?: string }
  ): Promise<Report> {
    const existingReport = await this.getReport(reportId);
    
    // Generate new report
    const reportResult = await this.seaLionService.generateMedicalReport(
      existingReport.consultation.transcript_eng,
      existingReport.consultation.patient.medical_history,
      existingReport.consultation.patient.medication,
      existingReport.consultation.patient.allergies
    );

    // Translate if needed
    let translatedReport = null;
    if (targetLanguage && targetLanguage !== 'en') {
      translatedReport = await this.seaLionService.translateReport(
        reportResult.report,
        targetLanguage
      );
    }

    // Update existing report
    existingReport.report_eng = reportResult.report;
    existingReport.report_other_lang = translatedReport;
    existingReport.target_language = targetLanguage || null;
    existingReport.ai_model_version = reportResult.model_version;
    existingReport.confidence_score = reportResult.confidence_score;
    existingReport.medication_conflicts = reportResult.report.conflicts.length > 0 ? reportResult.report.conflicts : null;
    existingReport.red_flags = reportResult.report.red_flags.length > 0 ? reportResult.report.red_flags : null;
    existingReport.processing_time_ms = reportResult.processing_time_ms;

    const updatedReport = await this.reportRepository.save(existingReport);

    // Log audit trail
    if (requestInfo) {
      await this.auditService.log(
        requestInfo.userId,
        UserType.DOCTOR,
        'REGENERATE_REPORT',
        'report',
        reportId,
        { target_language: targetLanguage },
        requestInfo.ipAddress,
        requestInfo.userAgent,
        requestInfo.sessionId,
      );
    }

    this.logger.log(`Report regenerated: ${reportId}`);
    return updatedReport;
  }

  async getAllReports(
    requestInfo: { userId: string; ipAddress?: string; userAgent?: string; sessionId?: string }
  ): Promise<Report[]> {
    const reports = await this.reportRepository.find({
      relations: ['consultation', 'consultation.patient', 'consultation.doctor'],
      order: { created_at: 'DESC' },
    });

    // Log audit trail
    if (requestInfo) {
      await this.auditService.log(
        requestInfo.userId,
        UserType.DOCTOR,
        'VIEW_ALL_REPORTS',
        'report',
        null,
        { count: reports.length },
        requestInfo.ipAddress,
        requestInfo.userAgent,
        requestInfo.sessionId,
      );
    }

    this.logger.log(`Retrieved ${reports.length} reports`);
    return reports;
  }
}
