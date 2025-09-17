import { IsUUID, IsString, IsOptional, IsEnum, IsDateString, IsBoolean, IsObject } from 'class-validator';
import { ProcessingStatus } from '../../entities';

export class CreateConsultationDto {

  patient_id: string;


  doctor_id: string;


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
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(ProcessingStatus)
  processing_status?: ProcessingStatus;
}

export class LockConsultationDto {

  consultation_id: string;

  @IsBoolean()
  @IsOptional()
  lock?: boolean = true;
}
