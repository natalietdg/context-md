import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { EventEmitter } from 'events';

interface Job {
  status: 'pending' | 'running' | 'done' | 'failed';
  result?: any;
  error?: string;
  trace?: string;
  timestamp: number;
}

interface PipelineResult {
  success: boolean;
  raw_transcript?: string;
  lean_transcript?: string;
  translated_transcript?: string;
  clinical_extraction?: string;
  processing_time?: number;
  error?: string;
  trace?: string;
}

@Injectable()
export class PythonWorkerService extends EventEmitter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PythonWorkerService.name);
  private proc: ChildProcess | null = null;
  private buffer = '';
  private jobs = new Map<string, Job>();
  private ready = false;
  private restartCount = 0;
  private readonly maxRestarts = 5;
  
  private readonly pythonBin: string;
  private readonly pipelineServerPath: string;

  constructor() {
    super();
    this.pythonBin = process.env.PYTHON_BIN || path.join(process.cwd(), '../../venv/bin/python3');
    this.pipelineServerPath = process.env.PIPELINE_SCRIPT || path.join(process.cwd(), '../../pipeline_server.py');
    
    this.logger.log(`Python path: ${this.pythonBin}`);
    this.logger.log(`Script path: ${this.pipelineServerPath}`);
  }

  async onModuleInit() {
    this.logger.log('Initializing Python worker service...');
    await this.start();
  }

  async onModuleDestroy() {
    this.logger.log('Shutting down Python worker service...');
    this.stop();
  }

  private async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.logger.log('Starting Python worker process...');
      
      try {
        const env = {
          ...process.env,
          PYTHONPATH: path.join(process.cwd(), '../..'),
          PYTHONUNBUFFERED: '1',
          SEALION_API_KEY: process.env.SEALION_API_KEY,
          DB_ENCRYPTION_KEY: process.env.DB_ENCRYPTION_KEY,
        };

        this.proc = spawn(this.pythonBin, [this.pipelineServerPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env,
          cwd: process.cwd(),
        });
        
        // Set encoding for proper text handling
        this.proc.stdout?.setEncoding('utf8');
        this.proc.stderr?.setEncoding('utf8');

        this.proc.stdout.on('data', (chunk: string) => this.handleMessage(chunk));
        this.proc.stderr?.on('data', (data) => {
          const message = data.toString().trim();
          if (message) {
            this.logger.log(`Python worker stderr: ${message}`);
          }
        });

        this.proc.on('spawn', () => {
          this.logger.log(`Python worker spawned with PID: ${this.proc?.pid}`);
          this.restartCount = 0;

          // Do not block startup for health event. Emit ready later when health arrives.
          resolve(); // treat process spawn as success for module init

          // Send health check, but don't fail fast if no response
          try {
            this.sendCommand({ cmd: 'health' });
            // Optionally: set a long timer to log a warning if no health response
            setTimeout(() => {
              if (!this.ready) {
                this.logger.warn('Python worker did not report models loaded after spawn');
              }
            }, 120000); // 2 minutes
          } catch (e) {
            this.logger.warn('Failed to send health check to Python worker', e);
          }
        });

        this.proc.on('error', (error) => {
          this.logger.error(`Python worker spawn error: ${error.message}`);
          reject(error);
        });

        this.proc.on('exit', (code, signal) => {
          this.logger.error(`Python worker exited: code=${code}, signal=${signal}`);
          this.ready = false;
          
          // Mark all pending jobs as failed
          for (const [jobId, job] of this.jobs.entries()) {
            if (job.status === 'pending' || job.status === 'running') {
              job.status = 'failed';
              job.error = 'Worker process crashed';
              this.emit('job', jobId, job);
            }
          }

          // Restart if not too many failures
          if (this.restartCount < this.maxRestarts) {
            this.restartCount++;
            this.logger.log(`Restarting Python worker (attempt ${this.restartCount}/${this.maxRestarts})...`);
            setTimeout(() => this.start(), 2000);
          } else {
            this.logger.error('Max restart attempts reached. Python worker disabled.');
            this.emit('error', new Error('Python worker failed permanently'));
          }
        });

      } catch (error) {
        this.logger.error(`Failed to start Python worker: ${error}`);
        reject(error);
      }
    });
  }

  private stop(): void {
    if (this.proc) {
      this.logger.log('Stopping Python worker process...');
      this.proc.kill('SIGTERM');
      
      // Force kill after 5 seconds
      setTimeout(() => {
        if (this.proc && !this.proc.killed) {
          this.logger.warn('Force killing Python worker process');
          this.proc.kill('SIGKILL');
        }
      }, 5000);
      
      this.proc = null;
    }
    this.ready = false;
  }

  private handleMessage(data: string) {
    const lines = data.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      try {
        const message = JSON.parse(line);
        
        if (message.job_id) {
          // Job result
          this.emit(`job:${message.job_id}`, message);
        } else {
          // Health or other status message
          this.logger.log('Python worker message:', message);
          
          if (message.status === 'ok') {
            const wasReady = this.ready;
            // Python server now always returns ready: true, but models_initialization_done indicates actual readiness
            this.ready = message.models_initialization_done === true;
            
            // Log model loading status
            if (message.models_loaded) {
              const loadedModels = Object.entries(message.models_loaded)
                .filter(([_, loaded]) => loaded)
                .map(([name, _]) => name);
              this.logger.log(`Python worker models loaded: ${loadedModels.join(', ')}`);
            }
            
            if (message.model_errors && message.model_errors.length > 0) {
              this.logger.warn(`Python worker model errors: ${message.model_errors.join(', ')}`);
            }
            
            // Emit ready event when models become ready for the first time
            if (!wasReady && this.ready) {
              this.emit('ready');
              this.logger.log('Python worker models fully initialized and ready');
            }
          }
        }
      } catch (error) {
        this.logger.warn('Failed to parse Python worker message:', line);
      }
    }
  }

  async sendCommand(command: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.proc || !this.proc.stdin) {
        reject(new Error('Python worker not available'));
        return;
      }
      
      const commandStr = JSON.stringify(command) + '\n';
      
      try {
        const success = this.proc.stdin.write(commandStr);
        if (!success) {
          // Handle backpressure - wait for drain event
          this.proc.stdin.once('drain', () => {
            resolve({ status: 'sent' });
          });
        } else {
          resolve({ status: 'sent' });
        }
      } catch (error) {
        // Retry logic for temporary unavailability
        setTimeout(() => {
          this.sendCommand(command).then(resolve).catch(reject);
        }, 100);
      }
    });
  }

  public isReady(): boolean {
    return this.ready && this.proc !== null && !this.proc.killed;
  }

  public async submitJob(audioPath: string): Promise<string> {
    if (!this.isReady()) {
      throw new Error('Python worker not ready');
    }

    const jobId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    
    // Create job record
    const job: Job = {
      status: 'pending',
      timestamp: Date.now()
    };
    this.jobs.set(jobId, job);

    // Send command to Python worker
    this.sendCommand({
      cmd: 'run',
      job_id: jobId,
      audio_path: audioPath
    });

    this.logger.log(`Submitted job ${jobId} for audio: ${audioPath}`);
    return jobId;
  }

  public getJobStatus(jobId: string): Job | null {
    return this.jobs.get(jobId) || null;
  }

  public async waitForJob(jobId: string, timeoutMs: number = 300000): Promise<PipelineResult> {
    return new Promise((resolve, reject) => {
      const job = this.jobs.get(jobId);
      if (!job) {
        reject(new Error(`Job ${jobId} not found`));
        return;
      }

      // If job is already complete
      if (job.status === 'done') {
        resolve(job.result);
        return;
      }
      
      if (job.status === 'failed') {
        reject(new Error(job.error || 'Job failed'));
        return;
      }

      // Set timeout
      const timeout = setTimeout(() => {
        reject(new Error(`Job ${jobId} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      // Listen for job completion
      const onJobUpdate = (updatedJobId: string, updatedJob: Job) => {
        if (updatedJobId === jobId) {
          clearTimeout(timeout);
          this.removeListener('job', onJobUpdate);
          
          if (updatedJob.status === 'done') {
            resolve(updatedJob.result);
          } else if (updatedJob.status === 'failed') {
            reject(new Error(updatedJob.error || 'Job failed'));
          }
        }
      };

      this.on('job', onJobUpdate);
    });
  }

  public cleanupOldJobs(maxAgeMs: number = 3600000): void {
    const now = Date.now();
    const toDelete: string[] = [];
    
    for (const [jobId, job] of this.jobs.entries()) {
      if (now - job.timestamp > maxAgeMs) {
        toDelete.push(jobId);
      }
    }
    
    for (const jobId of toDelete) {
      this.jobs.delete(jobId);
    }
    
    if (toDelete.length > 0) {
      this.logger.log(`Cleaned up ${toDelete.length} old jobs`);
    }
  }

  public getStats(): any {
    const stats = {
      ready: this.ready,
      totalJobs: this.jobs.size,
      restartCount: this.restartCount,
      pid: this.proc?.pid || null,
      jobsByStatus: {
        pending: 0,
        running: 0,
        done: 0,
        failed: 0
      }
    };

    for (const job of this.jobs.values()) {
      stats.jobsByStatus[job.status]++;
    }

    return stats;
  }
}
