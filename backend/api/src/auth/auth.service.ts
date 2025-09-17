import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Doctor, Patient, User, ProfileType } from '../entities';
import { LoginDto, RegisterDoctorDto } from './dto';
import * as crypto from 'crypto';

const ENCRYPTION_KEY = (() => {
  const key = process.env.DB_ENCRYPTION_KEY || 'dev-key-32-chars-long-change-me!!';
  // Ensure key is exactly 32 bytes for AES-256
  if (Buffer.from(key).length !== 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DB_ENCRYPTION_KEY must be exactly 32 characters/bytes for AES-256');
    }
    // Pad or truncate dev key to 32 bytes
    return key.padEnd(32, '0').substring(0, 32);
  }
  return key;
})();

const ALGORITHM = 'aes-256-cbc'
export interface JwtPayload {
  sub: string;
  email: string;
  role: 'doctor' | 'patient';
  name: string;
}

function encryptDeterministic(text) {
  const hash = crypto.createHash('sha256').update(text + ENCRYPTION_KEY).digest();
  const iv = hash.slice(0, 16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText: string): string {
  if (!encryptedText || !encryptedText.includes(':')) {
    return encryptedText || '';
  }

  const parts = encryptedText.split(':');
  if (parts.length !== 2) {
    return encryptedText;
  }

  try {
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    return encryptedText;
  }
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
  ) { }

  async validateUser(email: string, password: string, role: 'doctor' | 'patient') {
  
    // Find all users with the specified role
    const users = await this.userRepository.find({
      where: {
        profile_type: role === 'doctor' ? ProfileType.DOCTOR : ProfileType.PATIENT,
        is_active: true,
      }
    });
    // Find user with matching email (encrypt input email for comparison)
    let matchingUser: any = null;
    // const encryptedInputEmail = encryptDeterministic(email);
    for (const user of users) {
      // Compare against encrypted email stored in _email field
      if (user.email === email) {
        matchingUser = user;
        break;
      }
    }
    // Check if user exists and password matches
    if (!matchingUser || !matchingUser.password_hash || matchingUser.password_hash !== password) {
      return null;
    }
    // const compared = await encryptDeterministic(password)
    if (matchingUser && matchingUser.password_hash === password) {
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
