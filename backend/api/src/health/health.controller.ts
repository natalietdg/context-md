import { Controller, Get } from '@nestjs/common';
import { PythonWorkerService } from '../shared/python-worker.service';

@Controller('health')
export class HealthController {
  constructor(private readonly pythonWorker: PythonWorkerService) {}

  @Get()
  getHealth() {
    // Always return 200 when Node app is up - keeps ELB happy
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      pid: process.pid,
    };
  }

  @Get('worker')
  getWorkerHealth() {
    // Return 200 only when Python worker is ready
    const isReady = this.pythonWorker.isReady();
    
    if (!isReady) {
      return {
        status: 'not_ready',
        ready: false,
        message: 'Python worker is loading models or not available',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      status: 'ready',
      ready: true,
      message: 'Python worker is ready for processing',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('deep')
  async getDeepHealth() {
    // Comprehensive health check including worker communication
    const baseHealth = this.getHealth();
    const workerHealth = this.getWorkerHealth();
    
    let workerCommunication = false;
    try {
      // Try to send a health command to verify communication
      await this.pythonWorker.sendCommand({ cmd: 'health' });
      workerCommunication = true;
    } catch (error) {
      // Communication failed
    }

    return {
      ...baseHealth,
      worker: {
        ...workerHealth,
        communication: workerCommunication,
      },
    };
  }
}
