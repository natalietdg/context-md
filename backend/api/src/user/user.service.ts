import { Injectable, ConflictException, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { User, ProfileType } from '../entities/user.entity';
import { Doctor } from '../entities/doctor.entity';
import { Patient } from '../entities/patient.entity';
import { CreateUserDto, CreateDoctorWithUserDto, CreatePatientWithUserDto, LoginDto } from './dto/create-user.dto';
import { UpdateUserDto, UserResponseDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    private dataSource: DataSource,
  ) {}

  async createUser(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: createUserDto.email }
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(createUserDto.password, saltRounds);

    // Create user
    const user = this.userRepository.create({
      ...createUserDto,
      password_hash: hashedPassword,
    });

    const savedUser = await this.userRepository.save(user);
    return this.toUserResponse(savedUser);
  }

  async createDoctorWithUser(createDoctorDto: CreateDoctorWithUserDto): Promise<{ user: UserResponseDto; doctor: Doctor }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check if user already exists
      const existingUser = await queryRunner.manager.findOne(User, {
        where: { email: createDoctorDto.email }
      });

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      // Check if employee_id already exists
      const existingDoctor = await queryRunner.manager.findOne(Doctor, {
        where: { employee_id: createDoctorDto.employee_id }
      });

      if (existingDoctor) {
        throw new ConflictException('Doctor with this employee ID already exists');
      }

      // Create doctor first
      const doctor = queryRunner.manager.create(Doctor, {
        name: createDoctorDto.name,
        employee_id: createDoctorDto.employee_id,
        department: createDoctorDto.department,
        email: createDoctorDto.email, // Keep for legacy compatibility
        password_hash: 'deprecated', // Deprecated field
      });

      const savedDoctor = await queryRunner.manager.save(doctor);

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(createDoctorDto.password, saltRounds);

      // Create user
      const user = queryRunner.manager.create(User, {
        email: createDoctorDto.email,
        password_hash: hashedPassword,
        profile_id: savedDoctor.id,
        profile_type: ProfileType.DOCTOR,
      });

      const savedUser = await queryRunner.manager.save(user);

      await queryRunner.commitTransaction();

      return {
        user: this.toUserResponse(savedUser),
        doctor: savedDoctor,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async createPatientWithUser(createPatientDto: CreatePatientWithUserDto): Promise<{ user: UserResponseDto; patient: Patient }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check if user already exists
      const existingUser = await queryRunner.manager.findOne(User, {
        where: { email: createPatientDto.email }
      });

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      // Check if NRIC already exists (if provided)
      if (createPatientDto.nric) {
        const existingPatient = await queryRunner.manager.findOne(Patient, {
          where: { nric: createPatientDto.nric }
        });

        if (existingPatient) {
          throw new ConflictException('Patient with this NRIC already exists');
        }
      }

      // Create patient first
      const patient = queryRunner.manager.create(Patient, {
        name: createPatientDto.name,
        nric: createPatientDto.nric,
        phone: createPatientDto.phone,
        email: createPatientDto.email, // Keep for legacy compatibility
        allergies: createPatientDto.allergies,
        medication: createPatientDto.medication,
        medical_history: createPatientDto.medical_history,
      });

      const savedPatient = await queryRunner.manager.save(patient);

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(createPatientDto.password, saltRounds);

      // Create user
      const user = queryRunner.manager.create(User, {
        email: createPatientDto.email,
        password_hash: hashedPassword,
        profile_id: savedPatient.id,
        profile_type: ProfileType.PATIENT,
      });

      const savedUser = await queryRunner.manager.save(user);

      await queryRunner.commitTransaction();

      return {
        user: this.toUserResponse(savedUser),
        patient: savedPatient,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async login(loginDto: LoginDto): Promise<{ user: UserResponseDto; token: string; profile: Doctor | Patient }> {
    // Find user by email
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email }
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is locked
    if (user.isAccountLocked()) {
      throw new UnauthorizedException('Account is temporarily locked due to failed login attempts');
    }

    // Check if account is active
    if (!user.is_active) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password_hash);

    if (!isPasswordValid) {
      // Increment failed attempts
      user.incrementFailedAttempts();
      await this.userRepository.save(user);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on successful login
    user.resetFailedAttempts();
    await this.userRepository.save(user);

    // Get profile data
    let profile: Doctor | Patient;
    if (user.profile_type === ProfileType.DOCTOR) {
      profile = await this.doctorRepository.findOne({ where: { id: user.profile_id } });
    } else {
      profile = await this.patientRepository.findOne({ where: { id: user.profile_id } });
    }

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        profileType: user.profile_type,
        profileId: user.profile_id 
      },
      process.env.JWT_SECRET || 'default-secret-change-in-production',
      { expiresIn: '24h' }
    );

    return {
      user: this.toUserResponse(user),
      token,
      profile,
    };
  }

  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.userRepository.find();
    return users.map(user => this.toUserResponse(user));
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toUserResponse(user);
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Hash password if provided
    if (updateUserDto.password) {
      const saltRounds = 12;
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, saltRounds);
    }

    Object.assign(user, updateUserDto);
    const savedUser = await this.userRepository.save(user);
    return this.toUserResponse(savedUser);
  }

  async remove(id: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Soft delete by setting is_active to false
    user.is_active = false;
    await this.userRepository.save(user);
  }

  async getUserWithProfile(id: string): Promise<{ user: UserResponseDto; profile: Doctor | Patient }> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    let profile: Doctor | Patient;
    if (user.profile_type === ProfileType.DOCTOR) {
      profile = await this.doctorRepository.findOne({ where: { id: user.profile_id } });
    } else {
      profile = await this.patientRepository.findOne({ where: { id: user.profile_id } });
    }

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return {
      user: this.toUserResponse(user),
      profile,
    };
  }

  private toUserResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      profile_id: user.profile_id,
      profile_type: user.profile_type,
      is_active: user.is_active,
      last_login: user.last_login,
      failed_login_attempts: user.failed_login_attempts,
      locked_until: user.locked_until,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }
}
