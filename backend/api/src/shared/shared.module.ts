import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { S3Service } from './s3.service';
import { AuditService } from './audit.service';
import { SpeechProcessingService } from './speech-processing.service';
import { AuditLog } from '../entities';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([AuditLog]),
  ],
  providers: [S3Service, AuditService, SpeechProcessingService],
  exports: [S3Service, AuditService, SpeechProcessingService],
})
export class SharedModule {}
