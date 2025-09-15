import { Controller, Post, Body, UseGuards, Get, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDoctorDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('register/doctor')
  async registerDoctor(@Body() registerDto: RegisterDoctorDto) {
    return this.authService.registerDoctor(registerDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('refresh')
  async refreshToken(@Request() req) {
    // For now, just return the current user info
    // In production, you might want to issue a new token
    return {
      user: req.user,
      message: 'Token is still valid'
    };
  }
}
