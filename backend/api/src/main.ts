import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as dotenv from 'dotenv';
import { json as bodyJson, urlencoded } from 'express';

dotenv.config();

// Debug: Log database connection info
console.log('DATABASE_HOST:', process.env.DATABASE_HOST);
console.log('DATABASE_SSL:', process.env.DATABASE_SSL);
console.log('ENVIRONMENT:', process.env.ENVIRONMENT);

// const ALLOWED_ORIGINS = new Set<string>([
//   'https://contextmd.netlify.app',
//   'http://localhost:3000',
// ]);

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Security headers
  app.use(helmet());

  // CORS
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      // if (ALLOWED_ORIGINS.has(origin)) return callback(null, true);
      // default allow the production site
      if( origin === 'http://localhost:3000') return callback(null, true);
      if (origin === 'https://contextmd.netlify.app') return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['authorization', 'Authorization', 'x-client-info', 'apikey', 'content-type', 'Content-Type', 'x-api-key'],
    credentials: false,
  });

  // Body size limits (50KB)
  app.use(bodyJson({ limit: '50kb' }));
  app.use(urlencoded({ extended: true, limit: '50kb' }));

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Nest API listening on http://localhost:${port}`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to bootstrap Nest app', err);
  process.exit(1);
});
