import { IsUUID, IsString, IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator';

export class CreateReportDto {
  @IsUUID()
  consultation_id: string;

  @IsOptional()
  @IsString()
  target_language?: string;
}

export class UpdateReportDto {
  @IsOptional()
  report_eng?: any;

  @IsOptional()
  report_other_lang?: any;

  @IsOptional()
  @IsString()
  target_language?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence_score?: number;
}
