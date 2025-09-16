import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { Doctor } from '../entities/doctor.entity';
import { Patient } from '../entities/patient.entity';
import { User } from '../entities/user.entity';
import { Consultation } from '../entities/consultation.entity';
import { Report } from '../entities/report.entity';
import { Consent } from '../entities/consent.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Doctor, Patient, User, Consent, Consultation, Report])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
