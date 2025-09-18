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

@Injectable()
export class SocketService {
  private readonly logger = new Logger(SocketService.name);
  private io: IOServer;

  constructor() {
    // Get the global io instance set in main.ts
    this.io = (global as any).io;
  }

  /**
   * Send processing update to clients listening for a specific job
   */
  sendProcessingUpdate(update: ProcessingUpdate): void {
    if (!this.io) {
      this.logger.warn('Socket.IO server not initialized');
      return;
    }

    const room = `processing-${update.jobId}`;
    this.io.to(room).emit('processing-update', update);
    
    this.logger.log(`Sent processing update to room ${room}: ${update.stage} - ${update.message}`);
  }

  /**
   * Send model status update to all connected clients
   */
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
    this.logger.log(`Sent model status update: ${status.status}`);
  }

  /**
   * Send general notification to all clients
   */
  sendNotification(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    if (!this.io) {
      this.logger.warn('Socket.IO server not initialized');
      return;
    }

    this.io.emit('notification', { message, type, timestamp: new Date().toISOString() });
    this.logger.log(`Sent notification: ${type} - ${message}`);
  }

  /**
   * Get number of connected clients
   */
  getConnectedClientsCount(): number {
    if (!this.io) return 0;
    return this.io.engine.clientsCount;
  }

  /**
   * Get clients in a specific room
   */
  getClientsInRoom(room: string): number {
    if (!this.io) return 0;
    const roomClients = this.io.sockets.adapter.rooms.get(room);
    return roomClients ? roomClients.size : 0;
  }
}
