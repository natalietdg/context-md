import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, UserType } from '../entities';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(
    userId: string,
    userType: UserType,
    action: string,
    resourceType?: string,
    resourceId?: string,
    details?: any,
    ipAddress?: string,
    userAgent?: string,
    sessionId?: string,
  ): Promise<void> {
    try {
      const auditEntry = this.auditLogRepository.create({
        user_id: userId,
        user_type: userType,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        details,
        ip_address: ipAddress,
        user_agent: userAgent,
        session_id: sessionId,
      });

      await this.auditLogRepository.save(auditEntry);
      this.logger.log(`Audit logged: ${userType} ${userId} performed ${action} on ${resourceType}:${resourceId}`);
    } catch (error) {
      this.logger.error('Failed to log audit entry:', error);
      // Don't throw error to avoid disrupting main operations
    }
  }

  async getAuditTrail(
    resourceType?: string,
    resourceId?: string,
    userId?: string,
    limit: number = 100,
  ): Promise<AuditLog[]> {
    const query = this.auditLogRepository.createQueryBuilder('audit');

    if (resourceType) {
      query.andWhere('audit.resource_type = :resourceType', { resourceType });
    }

    if (resourceId) {
      query.andWhere('audit.resource_id = :resourceId', { resourceId });
    }

    if (userId) {
      query.andWhere('audit.user_id = :userId', { userId });
    }

    return query
      .orderBy('audit.created_at', 'DESC')
      .limit(limit)
      .getMany();
  }
}
