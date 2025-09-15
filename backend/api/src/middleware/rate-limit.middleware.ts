import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

const MAX_REQUESTS_PER_MINUTE = 20;

const requestLog = new Map<string, number[]>(); // IP -> timestamps array

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const clientIP = (req.headers['x-forwarded-for'] as string) || req.ip || 'unknown';

    if (!requestLog.has(clientIP)) requestLog.set(clientIP, []);

    const now = Date.now();
    const oneMinuteAgo = now - 60_000;

    const recent = (requestLog.get(clientIP) || []).filter((t) => t > oneMinuteAgo);
    if (recent.length >= MAX_REQUESTS_PER_MINUTE) {
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }

    recent.push(now);
    requestLog.set(clientIP, recent);

    next();
  }
}
