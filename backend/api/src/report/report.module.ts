import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';
import { Report, Consultation, Doctor, Patient, AuditLog } from '../entities';
import { AuditService } from '../shared/audit.service';
import { SeaLionService } from '../shared/sea-lion.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Report, Consultation, Doctor, Patient, AuditLog]),
    HttpModule,
  ],
  providers: [ReportService, AuditService, SeaLionService],
  controllers: [ReportController],
  exports: [ReportService],
})
export class ReportModule {}
