import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { UserController, SeedController } from './user.controller';
import { User } from '../entities/user.entity';
import { Doctor } from '../entities/doctor.entity';
import { Patient } from '../entities/patient.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Doctor, Patient])
  ],
  controllers: [UserController, SeedController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
