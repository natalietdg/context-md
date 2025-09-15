import { IsEmail, IsString, IsEnum, MinLength, IsOptional } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEnum(['doctor', 'patient'])
  role: 'doctor' | 'patient';
}

export class RegisterDoctorDto {
  @IsString()
  name: string;

  @IsString()
  employee_id: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
