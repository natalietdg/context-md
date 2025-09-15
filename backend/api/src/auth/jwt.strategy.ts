import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService, JwtPayload } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'contextmd-secret-key',
    });
  }

  async validate(payload: JwtPayload) {
    let user;
    
    if (payload.role === 'doctor') {
      user = await this.authService.findDoctorById(payload.sub);
    } else {
      user = await this.authService.findPatientById(payload.sub);
    }

    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      name: payload.name,
    };
  }
}
