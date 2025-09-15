import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Controller('database')
export class DatabaseController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get('health')
  async healthCheck() {
    const isHealthy = await this.databaseService.healthCheck();
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'AWS RDS via Secrets Manager'
    };
  }

  // @Get('config')
  // async getConfig() {
  //   try {
  //     const config = await this.databaseService.getDatabaseConfig();
  //     // Return config without sensitive data
  //     return {
  //       host: config.host,
  //       port: config.port,
  //       database: config.database,
  //       ssl: config.ssl,
  //       status: 'connected'
  //     };
  //   } catch (error) {
  //     return {
  //       status: 'error',
  //       message: error instanceof Error ? error.message : 'Unknown error'
  //     };
  //   }
  // }
}
