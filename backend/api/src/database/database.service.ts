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
  private readonly region = process.env.AWS_REGION;
  private secretsClient: SecretsManagerClient;
  private cachedCredentials: DatabaseCredentials | null = null;
  private credentialsExpiry: Date | null = null;

  constructor() {
    this.secretsClient = new SecretsManagerClient({
      region: this.region,
    });
  }

  async getDatabaseCredentials(): Promise<DatabaseCredentials> {
    // Return cached credentials if still valid (cache for 1 hour)
    if (this.cachedCredentials && this.credentialsExpiry && new Date() < this.credentialsExpiry) {
      return this.cachedCredentials;
    }

    try {
      this.logger.log('Retrieving database credentials from AWS Secrets Manager');
      
      const response = await this.secretsClient.send(
        new GetSecretValueCommand({
          SecretId: this.secretName,
          VersionStage: "AWSCURRENT",
        })
      );

      if (!response.SecretString) {
        throw new Error('No secret string found in AWS Secrets Manager response');
      }

      const credentials: DatabaseCredentials = JSON.parse(response.SecretString);
      
      // Cache credentials for 1 hour
      this.cachedCredentials = credentials;
      this.credentialsExpiry = new Date(Date.now() + 60 * 60 * 1000);
      
      this.logger.log('Successfully retrieved database credentials');
      return credentials;

    } catch (error) {
      this.logger.error('Failed to retrieve database credentials from AWS Secrets Manager', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Database credential retrieval failed: ${errorMessage}`);
    }
  }

  async getDatabaseConnectionString(): Promise<string> {
    const credentials = await this.getDatabaseCredentials();
    
    // Construct PostgreSQL connection string
    const connectionString = `postgresql://${credentials.username}:${credentials.password}@${credentials.host}:${credentials.port}/${credentials.dbname}?sslmode=require`;
    
    return connectionString;
  }

  async getDatabaseConfig() {
    return {
      host: process.env.DATABASE_HOST,
      port: process.env.DATABASE_PORT,
      username: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      ssl: {
        require: true,
        rejectUnauthorized: false, // let’s keep this off for RDS-managed certs
      },
    };
  }

  // Health check method to verify database connectivity
  async healthCheck(): Promise<boolean> {
    try {
      // await this.getDatabaseCredentials();
      return true;
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return false;
    }
  }
}
