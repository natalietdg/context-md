import { Injectable, Logger } from '@nestjs/common';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

interface DatabaseCredentials {
  username: string;
  password: string;
  engine: string;
  host: string;
  port: number;
  dbname: string;
  dbInstanceIdentifier: string;
}

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly secretName = process.env.AWS_SECRET_NAME || "your-rds-secret-name";
  private readonly region = process.env.AWS_REGION || 'ap-southeast-1';
  private secretsClient: SecretsManagerClient;
  private cachedCredentials: DatabaseCredentials | null = null;
  private credentialsExpiry: Date | null = null;

  constructor() {
    this.secretsClient = new SecretsManagerClient({
      region: this.region,
    });
  }

  // async getDatabaseCredentials(): Promise<DatabaseCredentials> {
  //   // Return cached credentials if still valid (cache for 1 hour)
  //   if (this.cachedCredentials && this.credentialsExpiry && new Date() < this.credentialsExpiry) {
  //     return this.cachedCredentials;
  //   }

  //   try {
  //     this.logger.log('Retrieving database credentials from AWS Secrets Manager');
      
  //     const response = await this.secretsClient.send(
  //       new GetSecretValueCommand({
  //         SecretId: this.secretName,
  //         VersionStage: "AWSCURRENT",
  //       })
  //     );

  //     if (!response.SecretString) {
  //       throw new Error('No secret string found in AWS Secrets Manager response');
  //     }

  //     const credentials: DatabaseCredentials = JSON.parse(response.SecretString);
      
  //     // Cache credentials for 1 hour
  //     this.cachedCredentials = credentials;
  //     this.credentialsExpiry = new Date(Date.now() + 60 * 60 * 1000);
      
  //     this.logger.log('Successfully retrieved database credentials');
  //     return credentials;

  //   } catch (error) {
  //     this.logger.error('Failed to retrieve database credentials from AWS Secrets Manager', error);
  //     const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  //     throw new Error(`Database credential retrieval failed: ${errorMessage}`);
  //   }
  // }

  // async getDatabaseConnectionString(): Promise<string> {
  //   const credentials = await this.getDatabaseCredentials();
    
  //   // Construct PostgreSQL connection string
  //   const connectionString = `postgresql://${credentials.username}:${credentials.password}@${credentials.host}:${credentials.port}/${credentials.dbname}?sslmode=require`;
    
  //   return connectionString;
  // }

  // async getDatabaseConfig() {
  //   // Always use SSL for production (RDS supports SSL). For RDS-managed certs we typically
  //   // do not ship a CA bundle; instruct pg to require SSL but not reject due to unknown CA.
  //   // If you prefer strict validation, attach the RDS CA and set rejectUnauthorized: true.
  //   return {
  //     host: process.env.DATABASE_HOST,
  //     port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  //     username: process.env.DATABASE_USER,
  //     password: process.env.DATABASE_PASSWORD,
  //     database: process.env.DATABASE_NAME,
  //     ssl: {
  //       require: true,
  //       rejectUnauthorized: false, // let’s keep this off for RDS-managed certs
  //     },
  //   };
  // }

  // Health check method to verify database connectivity
  async healthCheck(): Promise<boolean> {
    try {
      // Test basic database connection with a simple query
      const { Client } = require('pg');
      const client = new Client({
        host: process.env.DATABASE_HOST,
        port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
        user: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_NAME || 'contextmd',
        ssl: process.env.DATABASE_SSL === 'true' ? {
          rejectUnauthorized: false,
        } : false,
      });

      await client.connect();
      const result = await client.query('SELECT 1 as test');
      await client.end();
      this.logger.log(result.rows);
      this.logger.log('Database connection test successful');
      return result.rows[0].test === 1;
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return false;
    }
  }
}
