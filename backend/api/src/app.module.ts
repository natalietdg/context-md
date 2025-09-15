import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { MulterModule } from '@nestjs/platform-express';

// Import all modules
import { AuthModule } from './auth/auth.module';
import { ConsentModule } from './consent/consent.module';
import { ConsultationModule } from './consultation/consultation.module';
import { ReportModule } from './report/report.module';
import { HistoryModule } from './history/history.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { UserModule } from './user/user.module';

// Import entities
import * as entities from './entities';

// Legacy controllers and services
import { AnalyzeController } from './controllers/analyze.controller';
import { AnalyzeService } from './services/analyze.service';
import { DatabaseService } from './services/database.service';
import { DatabaseController } from './controllers/database.controller';
import { RateLimitMiddleware } from './middleware/rate-limit.middleware';
import { SecurityMiddleware } from './middleware/security.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    HttpModule.register({
      timeout: 60000,
      maxRedirects: 5,
    }),
    MulterModule.register({
      dest: './uploads',
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit for audio files
      },
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT ?? '5432'),
      username: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || '',
      database: process.env.DATABASE_NAME || 'contextmd',
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
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV === 'development',
      ssl: false,
    }),
    // New modules
    UserModule,
    AuthModule,
    ConsentModule,
    ConsultationModule,
    ReportModule,
    HistoryModule,
    DashboardModule,
  ],
  controllers: [AnalyzeController, DatabaseController],
  providers: [AnalyzeService, DatabaseService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SecurityMiddleware)
      .forRoutes('*')
      .apply(RateLimitMiddleware)
      .forRoutes(AnalyzeController);
  }
}
