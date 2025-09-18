import { Injectable, Logger } from '@nestjs/common';
import { Server as IOServer } from 'socket.io';

export interface ProcessingUpdate {
  jobId: string;
  stage: 'transcription' | 'translation' | 'clinical_extraction' | 'completed' | 'error';
  progress: number; // 0-100
  message: string;
  data?: any;
  error?: string;
}

/**
 * SocketService: holds the socket.io server instance and provides helpers.
 * Use setIo(io) during bootstrap to inject the server.
 */
@Injectable()
export class SocketService {
  private readonly logger = new Logger(SocketService.name);
  private io?: IOServer;

  /** Called from main.ts after io is created */
  setIo(io: IOServer) {
    this.io = io;
    this.logger.log('Socket.IO instance set on SocketService');
  }

  sendProcessingUpdate(update: ProcessingUpdate): void {
    if (!this.io) {
      this.logger.warn('Socket.IO server not initialized');
      return;
    }
    const room = `processing-${update.jobId}`;
    this.io.to(room).emit('processing-update', update);
    this.logger.log(`Sent processing update to ${room}: ${update.stage} (${update.progress}%)`);
  }

  sendModelStatusUpdate(status: {
    status: 'loading' | 'ready' | 'error';
    details: Record<string, boolean>;
    essential_ready?: boolean;
    full_ready?: boolean;
  }): void {
    if (!this.io) {
      this.logger.warn('Socket.IO server not initialized');
      return;
    }
    this.io.emit('model-status', status);
    this.logger.log(`Sent model status: ${status.status}`);
  }

  sendNotification(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    if (!this.io) {
      this.logger.warn('Socket.IO server not initialized');
      return;
    }
    this.io.emit('notification', { message, type, timestamp: new Date().toISOString() });
    this.logger.log(`Sent notification: ${type} - ${message}`);
  }

  getConnectedClientsCount(): number {
    if (!this.io) return 0;
    return this.io.engine.clientsCount;
  }

  getClientsInRoom(room: string): number {
    if (!this.io) return 0;
    const r = this.io.sockets.adapter.rooms.get(room);
    return r ? r.size : 0;
  }
}
export default SocketService;
