import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { S3Service } from './s3.service';
import { AuditService } from './audit.service';
import { SpeechProcessingService } from './speech-processing.service';
import { SeaLionService } from './sea-lion.service';
import { PythonWorkerService } from './python-worker.service';
import { AuditLog } from '../entities/audit-log.entity';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([AuditLog]),
  ],
  providers: [
    S3Service,
    AuditService,
    SpeechProcessingService,
    SeaLionService,
    PythonWorkerService,
  ],
  exports: [
    S3Service,
    AuditService,
    SpeechProcessingService,
    SeaLionService,
    PythonWorkerService,
  ],
})
export class SharedModule {}
