import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Doctor, Patient, User, ProfileType } from '../entities';
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
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string, role: 'doctor' | 'patient') {
    // Find all users with the specified role
    const users = await this.userRepository.find({
      where: { 
        profile_type: role === 'doctor' ? ProfileType.DOCTOR : ProfileType.PATIENT,
        is_active: true 
      }
    });

    // Find user with matching email (need to decrypt each to compare)
    let matchingUser = null;
    for (const user of users) {
      if (user.email === email) {
        matchingUser = user;
        break;
      }
    }

    // Check if user exists and password matches
    if (matchingUser && await bcrypt.compare(password, matchingUser.password_hash)) {
      // Get the profile entity (doctor or patient)
      let profile;
      if (role === 'doctor') {
        profile = await this.doctorRepository.findOne({ where: { id: matchingUser.profile_id } });
      } else {
        profile = await this.patientRepository.findOne({ where: { id: matchingUser.profile_id } });
      }

      return {
        id: matchingUser.profile_id,
        email: matchingUser.email,
        role,
        name: profile?.name,
        employee_id: profile?.employee_id,
        department: profile?.department,
      };
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
          employee_id: user.employee_id,
          department: user.department 
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

    // Create new doctor
    const doctor = this.doctorRepository.create({
      name,
      employee_id,
      department,
      email,
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
