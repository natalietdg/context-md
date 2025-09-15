import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    
    // Check for API key bypass
    const apiKey = this.extractApiKeyFromHeader(request);
    if (apiKey && this.validateApiKey(apiKey)) {
      // Set a mock user for API key access
      request.user = {
        userId: 'api-key-user',
        email: 'api@contextmd.com',
        profileType: 'doctor', // Give doctor privileges for testing
        profileId: 'api-key-profile'
      };
      return true;
    }

    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Access token or API key is required');
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-change-in-production');
      request.user = payload;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private extractApiKeyFromHeader(request: any): string | undefined {
    return request.headers['x-api-key'] || request.headers['api-key'];
  }

  private validateApiKey(apiKey: string): boolean {
    const validApiKey = process.env.API_KEY || 'contextmd-dev-api-key-2024';
    return apiKey === validApiKey;
  }
}
