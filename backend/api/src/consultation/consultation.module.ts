import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsultationController } from './consultation.controller';
import { ConsultationService } from './consultation.service';
import { ConsultationGateway } from './consultation.gateway';
import { Consultation, Doctor, Patient, Consent } from '../entities';
import { SharedModule } from '../shared/shared.module';
import { ReportModule } from '../report/report.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Consultation, Doctor, Patient, Consent]),
    SharedModule,
    ReportModule,
  ],
  controllers: [ConsultationController],
  providers: [ConsultationService, ConsultationGateway],
  exports: [ConsultationService, ConsultationGateway],
})
export class ConsultationModule {}
