import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { Doctor } from '../entities/doctor.entity';
import { Patient } from '../entities/patient.entity';
import { User } from '../entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Doctor, Patient, User])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
