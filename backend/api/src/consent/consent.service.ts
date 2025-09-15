import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Consent, ConsentReplayLog, Doctor, Patient, ConsentStatus, ReplayRole, UserType } from '../entities';
import { S3Service } from '../shared/s3.service';
import { AuditService } from '../shared/audit.service';
import { CreateConsentDto, ReplayConsentDto } from './dto';

@Injectable()
export class ConsentService {
  private readonly logger = new Logger(ConsentService.name);

  constructor(
    @InjectRepository(Consent)
    private consentRepository: Repository<Consent>,
    @InjectRepository(ConsentReplayLog)
    private replayLogRepository: Repository<ConsentReplayLog>,
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    private s3Service: S3Service,
    private auditService: AuditService,
  ) {}

  async createConsent(
    createConsentDto: CreateConsentDto,
    audioFile: Buffer,
    requestInfo: { userId: string; ipAddress?: string; userAgent?: string; sessionId?: string }
  ): Promise<Consent> {
    const { patient_id, doctor_id, consent_text, expires_at } = createConsentDto;

    // Verify doctor and patient exist
    const doctor = await this.doctorRepository.findOne({ where: { id: doctor_id } });
    const patient = await this.patientRepository.findOne({ where: { id: patient_id } });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    try {
      // Generate S3 key and upload audio
      const s3Key = this.s3Service.generateFileKey('consent', patient_id);
      const uploadResult = await this.s3Service.uploadFile(
        audioFile,
        s3Key,
        'audio/wav',
        {
          patientId: patient_id,
          doctorId: doctor_id,
          type: 'consent',
        }
      );

      // Create consent record
      const consent = this.consentRepository.create({
        patient_id,
        doctor_id,
        aws_audio_link: uploadResult.url,
        consent_hash: uploadResult.hash,
        file_size: uploadResult.size,
        consent_text,
        expires_at: expires_at ? new Date(expires_at) : null,
        status: ConsentStatus.ACTIVE,
      });

      const savedConsent = await this.consentRepository.save(consent);

      // Log audit trail
      await this.auditService.log(
        requestInfo.userId,
        UserType.DOCTOR,
        'CREATE_CONSENT',
        'consent',
        savedConsent.id,
        { patient_id, doctor_id },
        requestInfo.ipAddress,
        requestInfo.userAgent,
        requestInfo.sessionId,
      );

      this.logger.log(`Consent created: ${savedConsent.id} for patient ${patient_id}`);
      return savedConsent;
    } catch (error) {
      this.logger.error('Failed to create consent:', error);
      throw new BadRequestException(`Failed to create consent: ${error.message}`);
    }
  }

  async getConsent(id: string): Promise<Consent> {
    const consent = await this.consentRepository.findOne({
      where: { id },
      relations: ['patient', 'doctor'],
    });

    if (!consent) {
      throw new NotFoundException('Consent not found');
    }

    return consent;
  }

  async replayConsent(
    replayDto: ReplayConsentDto,
    requestInfo: { userId: string; ipAddress?: string; userAgent?: string; sessionId?: string }
  ): Promise<{ signedUrl: string; disclaimer: string }> {
    const { consent_id, role, purpose } = replayDto;

    const consent = await this.getConsent(consent_id);

    // Verify consent is still active
    if (consent.status !== ConsentStatus.ACTIVE) {
      throw new BadRequestException('Consent is not active');
    }

    // Check expiry
    if (consent.expires_at && new Date() > consent.expires_at) {
      throw new BadRequestException('Consent has expired');
    }

    // Verify file integrity
    const s3Key = consent.aws_audio_link.split('/').slice(-4).join('/'); // Extract key from URL
    const isIntegrityValid = await this.s3Service.verifyFileIntegrity(s3Key, consent.consent_hash);
    
    if (!isIntegrityValid) {
      this.logger.error(`File integrity check failed for consent ${consent_id}`);
      throw new BadRequestException('File integrity verification failed');
    }

    // Generate signed URL for download
    const signedUrl = await this.s3Service.getSignedDownloadUrl(s3Key, 3600); // 1 hour expiry

    // Log the replay
    const replayLog = this.replayLogRepository.create({
      consent_id,
      replayed_by: requestInfo.userId,
      role,
      purpose,
      ip_address: requestInfo.ipAddress,
      user_agent: requestInfo.userAgent,
      session_id: requestInfo.sessionId,
    });

    await this.replayLogRepository.save(replayLog);

    // Log audit trail
    await this.auditService.log(
      requestInfo.userId,
      role === ReplayRole.DOCTOR ? UserType.DOCTOR : 
      role === ReplayRole.PATIENT ? UserType.PATIENT : UserType.ADMIN,
      'REPLAY_CONSENT',
      'consent',
      consent_id,
      { role, purpose },
      requestInfo.ipAddress,
      requestInfo.userAgent,
      requestInfo.sessionId,
    );

    this.logger.log(`Consent replayed: ${consent_id} by ${role} ${requestInfo.userId}`);

    return {
      signedUrl,
      disclaimer: 'All consent replays are logged in the audit trail.',
    };
  }

  async getConsentReplayLogs(consentId: string): Promise<ConsentReplayLog[]> {
    return this.replayLogRepository.find({
      where: { consent_id: consentId },
      order: { replayed_at: 'DESC' },
    });
  }

  async getPatientConsents(patientId: string): Promise<Consent[]> {
    return this.consentRepository.find({
      where: { patient_id: patientId },
      relations: ['doctor'],
      order: { created_at: 'DESC' },
    });
  }

  async getDoctorConsents(doctorId: string): Promise<Consent[]> {
    return this.consentRepository.find({
      where: { doctor_id: doctorId },
      relations: ['patient'],
      order: { created_at: 'DESC' },
    });
  }

  async revokeConsent(
    consentId: string,
    requestInfo: { userId: string; ipAddress?: string; userAgent?: string; sessionId?: string }
  ): Promise<Consent> {
    const consent = await this.getConsent(consentId);

    consent.status = ConsentStatus.REVOKED;
    const updatedConsent = await this.consentRepository.save(consent);

    // Log audit trail
    await this.auditService.log(
      requestInfo.userId,
      UserType.DOCTOR,
      'REVOKE_CONSENT',
      'consent',
      consentId,
      { previous_status: ConsentStatus.ACTIVE },
      requestInfo.ipAddress,
      requestInfo.userAgent,
      requestInfo.sessionId,
    );

    this.logger.log(`Consent revoked: ${consentId} by ${requestInfo.userId}`);
    return updatedConsent;
  }
}
