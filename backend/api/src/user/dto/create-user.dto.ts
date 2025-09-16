import { IsEmail, IsString, IsEnum, IsUUID, MinLength, IsOptional } from 'class-validator';
import { ProfileType } from '../../entities/user.entity';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;


  profile_id: string;

  @IsEnum(ProfileType)
  profile_type: ProfileType;
}

export class CreateDoctorWithUserDto {
  // User fields
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  // Doctor fields
  @IsString()
  name: string;

  @IsString()
  employee_id: string;

  @IsString()
  department: string;
}

export class CreatePatientWithUserDto {
  // User fields
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  // Patient fields
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  nric?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  allergies?: string;

  @IsOptional()
  @IsString()
  medication?: string;

  @IsOptional()
  @IsString()
  medical_history?: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
