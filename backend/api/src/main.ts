import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as dotenv from 'dotenv';
import { json as bodyJson, urlencoded } from 'express';
import { Logger } from '@nestjs/common';

dotenv.config();

// Debug: Log database connection info
console.log('DATABASE_HOST:', process.env.DATABASE_HOST);
console.log('DATABASE_SSL:', process.env.DATABASE_SSL);
console.log('ENVIRONMENT:', process.env.ENVIRONMENT);

const allowedOrigins = new Set([
  'http://localhost:3000',
  'https://contextmd.netlify.app',
  'https://contextmd.net',
  'https://www.contextmd.net',
  'https://d12pwir1jq0uw0.cloudfront.net',
  "https://api.contextmd.net"
]);

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, logger: new Logger() });

  // Security headers
  app.use(helmet());

  // CORS
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      // if (ALLOWED_ORIGINS.has(origin)) return callback(null, true);
      // default allow the production site
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['authorization', 'Authorization', 'x-client-info', 'apikey', 'content-type', 'Content-Type', 'x-api-key'],
    credentials: true,
  });

  // Body size limits (50KB)
  app.use(bodyJson({ limit: '50kb' }));
  app.use(urlencoded({ extended: true, limit: '50kb' }));

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Nest API listening on http://localhost:${port}`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to bootstrap Nest app', err);
  process.exit(1);
});
