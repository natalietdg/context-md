import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { Appointment, Consultation, Doctor, Patient, Report, AuditLog } from '../entities';
import { AuditService } from '../shared/audit.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment, Consultation, Doctor, Patient, Report, AuditLog]),
  ],
  providers: [DashboardService, AuditService],
  controllers: [DashboardController],
  exports: [DashboardService],
})
export class DashboardModule {}
