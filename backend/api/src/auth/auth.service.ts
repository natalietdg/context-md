import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Doctor, Patient } from '../entities';
import { LoginDto, RegisterDoctorDto } from './dto';

export interface JwtPayload {
  sub: string;
  email: string;
  role: 'doctor' | 'patient';
  name: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string, role: 'doctor' | 'patient') {
    let user;
    
    if (role === 'doctor') {
      user = await this.doctorRepository.findOne({ 
        where: { email, is_active: true } 
      });
    } else {
      user = await this.patientRepository.findOne({ 
        where: { email, is_active: true } 
      });
    }

    if (user && await bcrypt.compare(password, user.password_hash)) {
      const { password_hash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto) {
    const { email, password, role } = loginDto;
    
    const user = await this.validateUser(email, password, role);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role,
      name: user.name,
    };

    return {
      access_token: this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET
      }),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role,
        ...(role === 'doctor' && { 
          employee_id: (user as Doctor).employee_id,
          department: (user as Doctor).department 
        }),
      },
    };
  }

  async registerDoctor(registerDto: RegisterDoctorDto) {
    const { name, employee_id, department, email, password } = registerDto;

    // Check if doctor already exists
    const existingDoctor = await this.doctorRepository.findOne({
      where: [{ email }, { employee_id }],
    });

    if (existingDoctor) {
      throw new UnauthorizedException('Doctor with this email or employee ID already exists');
    }

    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Create new doctor
    const doctor = this.doctorRepository.create({
      name,
      employee_id,
      department,
      email,
      password_hash,
    });

    const savedDoctor = await this.doctorRepository.save(doctor);

    // Return login response
    const payload: JwtPayload = {
      sub: savedDoctor.id,
      email: savedDoctor.email,
      role: 'doctor',
      name: savedDoctor.name,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: savedDoctor.id,
        name: savedDoctor.name,
        email: savedDoctor.email,
        role: 'doctor' as const,
        employee_id: savedDoctor.employee_id,
        department: savedDoctor.department,
      },
    };
  }

  async findDoctorById(id: string): Promise<Doctor | null> {
    return this.doctorRepository.findOne({ 
      where: { id, is_active: true } 
    });
  }

  async findPatientById(id: string): Promise<Patient | null> {
    return this.patientRepository.findOne({ 
      where: { id, is_active: true } 
    });
  }
}
