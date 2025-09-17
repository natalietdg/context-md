import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.S3_BUCKET_REGION || 'ap-northeast-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
    console.log({s3Client: this.s3Client})
    this.bucketName = process.env.AUDIO_S3_BUCKET || 'transcribe-audio-b1';
  }

  async uploadFile(
    file: Buffer,
    key: string,
    contentType: string = 'audio/wav',
    metadata?: Record<string, string>
  ): Promise<{ url: string; hash: string; size: number }> {

    const url = `https://${this.bucketName}.s3.${process.env.S3_BUCKET_REGION || 'ap-northeast-2'}.amazonaws.com/${key}`;
    
      // Generate tamper-evident hash
      const hash = crypto.createHash('sha256').update(file).digest('hex');
      
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file,
        ContentType: contentType,
        Metadata: {
          ...metadata,
          hash,
          uploadedAt: new Date().toISOString(),
        },
      });
    
    try {
      await this.s3Client.send(command);
      
      this.logger.log(`File uploaded successfully: ${key}`);
      
      return {
        url,
        hash,
        size: file.length,
      };
    } catch (error) {
      this.logger.error(`Failed to upload file ${key}:`, error);
      throw new Error(`S3 upload failed: ${error.message} ${url} ${command}`);
    }
  }

  async getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
      return signedUrl;
    } catch (error) {
      this.logger.error(`Failed to generate signed URL for ${key}:`, error);
      throw new Error(`Failed to generate download URL: ${error.message}`);
    }
  }

  async verifyFileIntegrity(key: string, expectedHash: string): Promise<boolean> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      const body = await response.Body.transformToByteArray();
      const actualHash = crypto.createHash('sha256').update(body).digest('hex');

      return actualHash === expectedHash;
    } catch (error) {
      this.logger.error(`Failed to verify file integrity for ${key}:`, error);
      return false;
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`File deleted successfully: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file ${key}:`, error);
      throw new Error(`S3 delete failed: ${error.message}`);
    }
  }

  generateFileKey(type: 'consent' | 'consultation', userId: string, timestamp?: Date): string {
    const date = timestamp || new Date();
    const dateStr = date.toISOString().split('T')[0];
    const timeStr = date.getTime();
    const randomId = crypto.randomBytes(8).toString('hex');
    
    return `${type}/${dateStr}/${userId}/${timeStr}_${randomId}.wav`;
  }
}
