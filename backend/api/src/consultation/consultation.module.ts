import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsultationService } from './consultation.service';
import { ConsultationController } from './consultation.controller';
import { Consultation, Doctor, Patient, Consent, Report, Appointment, AuditLog } from '../entities';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Consultation, Doctor, Patient, Consent, Report, Appointment, AuditLog]),
    SharedModule,
  ],
  providers: [ConsultationService],
  controllers: [ConsultationController],
  exports: [ConsultationService],
})
export class ConsultationModule {}
