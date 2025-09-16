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
import { AdminModule } from './admin/admin.module';

// Import entities
import * as entities from './entities';

// Legacy controllers and services
import { AnalyzeController } from './controllers/analyze.controller';
import { AnalyzeService } from './services/analyze.service';
import { RateLimitMiddleware } from './middleware/rate-limit.middleware';
import { SecurityMiddleware } from './middleware/security.middleware';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule.forRoot({ isGlobal: true }),
    HttpModule.register({
      timeout: 60000,
      maxRedirects: 5,
    }),
    MulterModule.register({
      dest: './uploads',
      limits: { fileSize: 100 * 1024 * 1024 },
    }),
    AdminModule,
    UserModule,
    AuthModule,
    ConsentModule,
    ConsultationModule,
    ReportModule,
    HistoryModule,
    DashboardModule,
  ],
  controllers: [AnalyzeController],
  providers: [AnalyzeService],
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

