import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { DatabaseController } from './database.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as entities from '../entities';
import * as fs from 'fs';
import * as path from 'path';

// database.module.ts
@Module({
    imports: [
        TypeOrmModule.forRoot({
            type: 'postgres',
            host: process.env.DATABASE_HOST ?? '',
            port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
            username: process.env.DATABASE_USER ?? '',
            password: process.env.DATABASE_PASSWORD ?? '',
            database: process.env.DATABASE_NAME ?? 'contextmd',
            ssl: process.env.ENVIRONMENT === "production" ? {
                ca: fs.readFileSync(path.join(__dirname, '../rds-ca-2019-root.pem')).toString(),
                rejectUnauthorized: false,
            } : false,
            entities: [
                entities.User,
                entities.Doctor,
                entities.Patient,
                entities.Consent,
                entities.ConsentReplayLog,
                entities.Consultation,
                entities.Report,
                entities.Appointment,
                entities.AuditLog,
            ],
            synchronize: false,
        }),
    ],
    providers: [DatabaseService],
    controllers: [DatabaseController],
    exports: [DatabaseService, TypeOrmModule],
})
export class DatabaseModule { }

