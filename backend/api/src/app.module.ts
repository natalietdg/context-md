import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { AnalyzeController } from './controllers/analyze.controller';
import { AnalyzeService } from './services/analyze.service';
import { RateLimitMiddleware } from './middleware/rate-limit.middleware';

@Module({
  imports: [],
  controllers: [AnalyzeController],
  providers: [AnalyzeService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RateLimitMiddleware)
      .forRoutes(AnalyzeController);
  }
}
