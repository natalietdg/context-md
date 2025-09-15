import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsentService } from './consent.service';
import { ConsentController } from './consent.controller';
import { Consent, ConsentReplayLog, Doctor, Patient, AuditLog } from '../entities';
import { S3Service } from '../shared/s3.service';
import { AuditService } from '../shared/audit.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Consent, ConsentReplayLog, Doctor, Patient, AuditLog]),
  ],
  providers: [ConsentService, S3Service, AuditService],
  controllers: [ConsentController],
  exports: [ConsentService],
})
export class ConsentModule {}
