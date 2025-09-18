import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as dotenv from 'dotenv';
import { json as bodyJson, urlencoded } from 'express';
import { Logger } from '@nestjs/common';
import { createServer } from 'http';
import { Server as IOServer } from 'socket.io';
import { SocketService } from './shared/socket.service';

dotenv.config();

const logger = new Logger('Bootstrap');

const allowedOrigins = new Set<string>([
  'http://localhost:3000',
  'https://contextmd.netlify.app',
  'https://contextmd.net',
  'https://www.contextmd.net',
  'https://d12pwir1jq0uw0.cloudfront.net',
  'https://api.contextmd.net',
]);

async function bootstrap() {
  // create app
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.use(helmet());

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['authorization', 'Authorization', 'x-client-info', 'apikey', 'content-type', 'Content-Type', 'x-api-key'],
    credentials: true,
  });

  // body limits
  app.use(bodyJson({ limit: '50kb' }));
  app.use(urlencoded({ extended: true, limit: '50kb' }));

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
  const host = process.env.HOST || '0.0.0.0';

  // listen (log and handle bind errors)
  try {
    await app.listen(port, host);
    logger.log(`Nest application listening on ${host}:${port}`);
  } catch (err) {
    logger.error(`Failed to listen on ${host}:${port}: ${(err as Error).message}`);
    process.exit(1);
  }

  // attach Socket.IO to the same server created by Nest
  const httpServer = app.getHttpServer(); // reuse existing server - avoids creating a second listener
  const io = new IOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    logger.log(`Socket.IO client connected: ${socket.id}`);

    socket.on('disconnect', (reason) => {
      logger.log(`Socket.IO client disconnected: ${socket.id} (${reason})`);
    });

    socket.on('join-processing', (jobId: string) => {
      socket.join(`processing-${jobId}`);
      logger.log(`Socket ${socket.id} joined processing-${jobId}`);
    });
  });

  // register io in the SocketService
  try {
    const socketService = app.get(SocketService);
    if (socketService && typeof (socketService as any).setIo === 'function') {
      (socketService as any).setIo(io);
      logger.log('SocketService.setIo(io) invoked successfully');
    } else {
      logger.warn('SocketService does not expose setIo(io) — ensure it reads global.io or add setIo method');
      // fallback for older code:
      (global as any).io = io;
    }
  } catch (err) {
    logger.warn('Could not set io on SocketService: ' + (err as Error).message);
    (global as any).io = io;
  }

  // graceful shutdown wiring
  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal} - shutting down`);
    try {
      io.close();
    } catch (e) {
      logger.warn('Error closing io: ' + (e as Error).message);
    }
    try {
      await app.close();
    } catch (e) {
      logger.warn('Error closing app: ' + (e as Error).message);
    }
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  logger.log(`API + Socket.IO ready at http://${host}:${port}`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to bootstrap Nest app', err);
  process.exit(1);
});
