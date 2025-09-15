import { IsUUID, IsString, IsOptional, IsEnum, IsDateString, IsBoolean } from 'class-validator';
import { ProcessingStatus } from '../../entities';

export class CreateConsultationDto {
  @IsUUID()
  patient_id: string;

  @IsUUID()
  doctor_id: string;

  @IsUUID()
  @IsOptional()
  consent_id?: string;

  @IsOptional()
  @IsDateString()
  consultation_date?: string;
}

export class UpdateConsultationDto {
  @IsOptional()
  @IsString()
  transcript_raw?: string;

  @IsOptional()
  @IsString()
  transcript_eng?: string;

  @IsOptional()
  @IsEnum(ProcessingStatus)
  processing_status?: ProcessingStatus;
}

export class LockConsultationDto {
  @IsUUID()
  consultation_id: string;

  @IsBoolean()
  @IsOptional()
  lock?: boolean = true;
}
