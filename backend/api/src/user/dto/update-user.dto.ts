import { IsEmail, IsString, IsEnum, IsUUID, MinLength, IsOptional, IsBoolean } from 'class-validator';
import { ProfileType } from '../../entities/user.entity';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()

  profile_id?: string;

  @IsOptional()
  @IsEnum(ProfileType)
  profile_type?: ProfileType;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UserResponseDto {
  id: string;
  email: string;
  profile_id: string;
  profile_type: ProfileType;
  is_active: boolean;
  last_login?: Date;
  failed_login_attempts: number;
  locked_until?: Date;
  created_at: Date;
  updated_at: Date;
}
