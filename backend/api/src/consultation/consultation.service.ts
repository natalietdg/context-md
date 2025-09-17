import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Consultation, Doctor, Patient, Consent, ProcessingStatus, UserType, AppointmentStatus } from '../entities';
import { S3Service } from '../shared/s3.service';
import { AuditService } from '../shared/audit.service';
import { SpeechProcessingService } from '../shared/speech-processing.service';
import { CreateConsultationDto, UpdateConsultationDto, LockConsultationDto } from './dto';

@Injectable()
export class ConsultationService {
  private readonly logger = new Logger(ConsultationService.name);

  constructor(
    @InjectRepository(Consultation)
    private consultationRepository: Repository<Consultation>,
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    @InjectRepository(Consent)
    private consentRepository: Repository<Consent>,
    private s3Service: S3Service,
    private auditService: AuditService,
    private speechProcessingService: SpeechProcessingService,
  ) {}

  async createConsultation(
    createConsultationDto: CreateConsultationDto,
    requestInfo: { userId: string; ipAddress?: string; userAgent?: string; sessionId?: string }
  ): Promise<Consultation> {
    const { patient_id, doctor_id, consent_id, consultation_date } = createConsultationDto;

    // Verify doctor and patient exist
    const doctor = await this.doctorRepository.findOne({ where: { id: doctor_id } });
    const patient = await this.patientRepository.findOne({ where: { id: patient_id } });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    // Verify consent if provided
    if (consent_id) {
      const consent = await this.consentRepository.findOne({ where: { id: consent_id } });
      if (!consent) {
        throw new NotFoundException('Consent not found');
      }
    }

    try {
      // Generate placeholder S3 key for live recording
      const s3Key = this.s3Service.generateFileKey('consultation', patient_id);
      const placeholderUrl = `https://${process.env.AUDIO_S3_BUCKET || 'transcribe-audio-b1'}.s3.${process.env.AWS_DEFAULT_REGION || 'ap-northeast-2'}.amazonaws.com/${s3Key}`;
      
      // Create consultation record with placeholder audio link for live recording
      const consultation = this.consultationRepository.create({
        patient_id,
        doctor_id,
        consent_id,
        aws_audio_link: placeholderUrl,
        consultation_date: consultation_date ? new Date(consultation_date) : new Date(),
        processing_status: ProcessingStatus.PENDING, // Will be updated when live recording completes
      });

      const savedConsultation = await this.consultationRepository.save(consultation);

      // Log audit trail
      await this.auditService.log(
        requestInfo.userId,
        UserType.DOCTOR,
        'CREATE_CONSULTATION',
        'consultation',
        savedConsultation.id,
        { patient_id, doctor_id, consent_id },
        requestInfo.ipAddress,
        requestInfo.userAgent,
        requestInfo.sessionId,
      );

      // Start async audio processing for transcription and translation
      this.processConsultationAudioFromS3(savedConsultation.id);

      this.logger.log(`Consultation created: ${savedConsultation.id} for patient ${patient_id}`);
      return savedConsultation;
    } catch (error) {
      this.logger.error('Failed to create consultation:', error);
      throw new BadRequestException(`Failed to create consultation: ${error.message}`);
    }
  }


  async getConsultation(id: string): Promise<Consultation> {
    const consultation = await this.consultationRepository.findOne({
      where: { id },
      relations: ['patient', 'doctor', 'consent', 'reports'],
    });

    if (!consultation) {
      throw new NotFoundException('Consultation not found');
    }

    return consultation;
  }

  async updateConsultation(
    id: string,
    updateDto: UpdateConsultationDto,
    requestInfo: { userId: string; ipAddress?: string; userAgent?: string; sessionId?: string }
  ): Promise<Consultation> {
    const consultation = await this.getConsultation(id);

    // Check if consultation is locked
    if (consultation.is_locked) {
      throw new BadRequestException('Consultation is locked and cannot be modified');
    }

    Object.assign(consultation, updateDto);
    const updatedConsultation = await this.consultationRepository.save(consultation);

    // Log audit trail
    await this.auditService.log(
      requestInfo.userId,
      UserType.DOCTOR,
      'UPDATE_CONSULTATION',
      'consultation',
      id,
      updateDto,
      requestInfo.ipAddress,
      requestInfo.userAgent,
      requestInfo.sessionId,
    );

    return updatedConsultation;
  }

  async uploadConsultationAudio(
    consultationId: string,
    audioFile: Buffer,
    requestInfo: { userId: string; ipAddress?: string; userAgent?: string; sessionId?: string }
  ): Promise<Consultation> {
    const consultation = await this.getConsultation(consultationId);

    if (consultation.is_locked) {
      throw new BadRequestException('Consultation is locked and cannot be modified');
    }

    try {
      // Generate S3 key and upload audio
      const s3Key = this.s3Service.generateFileKey('consultation', consultation.patient_id);
      const uploadResult = await this.s3Service.uploadFile(
        audioFile,
        s3Key,
        'audio/wav',
        {
          patientId: consultation.patient_id,
          doctorId: consultation.doctor_id,
          type: 'consultation',
        }
      );

      // Update consultation fields and reset status
      consultation.aws_audio_link = uploadResult.url;
      consultation.file_size = uploadResult.size;
      consultation.processing_status = ProcessingStatus.PENDING;

      const saved = await this.consultationRepository.save(consultation);

      // Log audit trail
      await this.auditService.log(
        requestInfo.userId,
        UserType.DOCTOR,
        'UPLOAD_CONSULTATION_AUDIO',
        'consultation',
        consultationId,
        { patient_id: consultation.patient_id, doctor_id: consultation.doctor_id },
        requestInfo.ipAddress,
        requestInfo.userAgent,
        requestInfo.sessionId,
      );


      this.logger.log(`Consultation audio uploaded for ${consultationId}`);
      return saved;
    } catch (error) {
      this.logger.error(`Failed to upload consultation audio for ${consultationId}:`, error);
      throw new BadRequestException(`Failed to upload consultation audio: ${error.message}`);
    }
  }

  async lockConsultation(
    lockDto: LockConsultationDto,
    requestInfo: { userId: string; ipAddress?: string; userAgent?: string; sessionId?: string }
  ): Promise<Consultation> {
    const { consultation_id, lock } = lockDto;
    const consultation = await this.getConsultation(consultation_id);

    consultation.is_locked = lock;
    if (lock) {
      consultation.locked_at = new Date();
      consultation.locked_by = requestInfo.userId;
    } else {
      consultation.locked_at = null;
      consultation.locked_by = null;
    }

    const updatedConsultation = await this.consultationRepository.save(consultation);

    // Log audit trail
    await this.auditService.log(
      requestInfo.userId,
      UserType.DOCTOR,
      lock ? 'LOCK_CONSULTATION' : 'UNLOCK_CONSULTATION',
      'consultation',
      consultation_id,
      { locked: lock },
      requestInfo.ipAddress,
      requestInfo.userAgent,
      requestInfo.sessionId,
    );

    this.logger.log(`Consultation ${lock ? 'locked' : 'unlocked'}: ${consultation_id} by ${requestInfo.userId}`);
    return updatedConsultation;
  }

  async getPatientConsultations(patientId: string): Promise<Consultation[]> {
    return this.consultationRepository.find({
      where: { patient_id: patientId },
      relations: ['doctor', 'reports'],
      order: { consultation_date: 'DESC' },
    });
  }

  async getDoctorConsultations(doctorId: string): Promise<Consultation[]> {
    return this.consultationRepository.find({
      where: { doctor_id: doctorId },
      relations: ['patient', 'reports'],
      order: { consultation_date: 'DESC' },
    });
  }

  async getConsultationsByDateRange(
    startDate: Date,
    endDate: Date,
    doctorId?: string,
    patientId?: string
  ): Promise<Consultation[]> {
    const query = this.consultationRepository.createQueryBuilder('consultation')
      .leftJoinAndSelect('consultation.patient', 'patient')
      .leftJoinAndSelect('consultation.doctor', 'doctor')
      .leftJoinAndSelect('consultation.reports', 'reports')
      .where('consultation.consultation_date BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });

    if (doctorId) {
      query.andWhere('consultation.doctor_id = :doctorId', { doctorId });
    }

    if (patientId) {
      query.andWhere('consultation.patient_id = :patientId', { patientId });
    }

    return query
      .orderBy('consultation.consultation_date', 'DESC')
      .getMany();
  }

  async getConsultationProcessingStatus(id: string): Promise<{ status: ProcessingStatus; progress?: number }> {
    const consultation = await this.consultationRepository.findOne({
      where: { id },
      select: ['processing_status', 'transcript_raw', 'transcript_eng'],
    });

    if (!consultation) {
      throw new NotFoundException('Consultation not found');
    }

    let progress = 0;
    if (consultation.processing_status === ProcessingStatus.PROCESSING) {
      progress = 50; // Rough estimate
    } else if (consultation.processing_status === ProcessingStatus.COMPLETED) {
      progress = 100;
    }

    return {
      status: consultation.processing_status,
      progress,
    };
  }

  private async processConsultationAudioFromS3(consultationId: string): Promise<void> {
    try {
      // Update status to processing
      await this.consultationRepository.update(consultationId, {
        processing_status: ProcessingStatus.PROCESSING,
      });

      const consultation = await this.getConsultation(consultationId);
      
      // Download audio from S3
      const audioBuffer = await this.s3Service.downloadFile(consultation.aws_audio_link);
      
      // Process audio through speech pipeline
      const transcriptionResult = await this.speechProcessingService.processAudio(audioBuffer);

      // Update consultation with transcripts
      await this.consultationRepository.update(consultationId, {
        transcript_raw: transcriptionResult.raw_transcript,
        transcript_eng: transcriptionResult.english_transcript,
        processing_status: ProcessingStatus.COMPLETED,
      });

      this.logger.log(`Audio processing completed for consultation ${consultationId}`);
    } catch (error) {
      this.logger.error(`Audio processing failed for consultation ${consultationId}:`, error);
      
      // Update status to failed
      await this.consultationRepository.update(consultationId, {
        processing_status: ProcessingStatus.FAILED,
      });
    }
  }
}
