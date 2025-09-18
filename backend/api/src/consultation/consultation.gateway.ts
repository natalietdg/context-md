import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/consultation',
})
export class ConsultationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ConsultationGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Emit processing status updates
  emitProcessingUpdate(consultationId: string, status: string, progress?: number, message?: string) {
    this.server.emit('processing_update', {
      consultationId,
      status,
      progress,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  // Emit when processing is complete
  emitProcessingComplete(consultationId: string, result: any) {
    this.server.emit('processing_complete', {
      consultationId,
      result,
      timestamp: new Date().toISOString(),
    });
  }

  // Emit processing errors
  emitProcessingError(consultationId: string, error: string) {
    this.server.emit('processing_error', {
      consultationId,
      error,
      timestamp: new Date().toISOString(),
    });
  }

  // Emit model loading status
  emitModelStatus(status: 'loading' | 'ready' | 'error', details?: any) {
    this.server.emit('model_status', {
      status,
      details,
      timestamp: new Date().toISOString(),
    });
  }
}
