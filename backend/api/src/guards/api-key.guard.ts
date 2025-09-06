import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { headers: Record<string, string | undefined> }>();

    const required = process.env.API_KEY_REQUIRED === 'true';
    if (!required) return true;

    const allowed = (process.env.ALLOWED_API_KEYS || '')
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);

    const provided = req.headers['x-api-key'] as string | undefined;

    if (!provided || !allowed.includes(provided)) {
      throw new UnauthorizedException('Invalid or missing API key');
    }

    return true;
  }
}
