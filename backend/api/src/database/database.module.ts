import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { DatabaseController } from './database.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as entities from '../entities';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log({ host: process.env.DATABASE_HOST});
console.log({ DATABASE_USER: process.env.DATABASE_USER});
console.log({ DATABASE_PASSWORD: process.env.DATABASE_PASSWORD});
console.log({ DATABASE_NAME: process.env.DATABASE_NAME});
console.log({ DATABASE_SSL: process.env.DATABASE_SSL});

// database.module.ts
@Module({
    imports: [
        TypeOrmModule.forRoot({
            type: 'postgres',
            host: process.env.DATABASE_HOST,
            port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
            username: process.env.DATABASE_USER,
            password: process.env.DATABASE_PASSWORD,
            database: process.env.DATABASE_NAME || 'contextmd',
            ssl: {
                ca: fs.readFileSync(path.join(__dirname, '../../rds-ca-2019-root.pem')).toString(),
                rejectUnauthorized: false,
            },
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

