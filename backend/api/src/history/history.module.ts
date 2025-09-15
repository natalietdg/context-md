import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HistoryService } from './history.service';
import { HistoryController } from './history.controller';
import { Consultation, Report, Doctor, Patient, Consent, AuditLog } from '../entities';
import { AuditService } from '../shared/audit.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Consultation, Report, Doctor, Patient, Consent, AuditLog]),
  ],
  providers: [HistoryService, AuditService],
  controllers: [HistoryController],
  exports: [HistoryService],
})
export class HistoryModule {}
