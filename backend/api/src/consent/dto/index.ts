import { IsUUID, IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ReplayRole } from '../../entities';

export class CreateConsentDto {
  @IsUUID()
  patient_id: string;

  @IsUUID()
  doctor_id: string;

  @IsOptional()
  @IsString()
  consent_text?: string;

  @IsOptional()
  @IsDateString()
  expires_at?: string;
}

export class ReplayConsentDto {
  @IsUUID()
  consent_id: string;

  @IsEnum(ReplayRole)
  role: ReplayRole;

  @IsOptional()
  @IsString()
  purpose?: string;
}
