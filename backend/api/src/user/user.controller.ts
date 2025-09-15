import { Controller, Get, Post, Body, Patch, Param, Delete, HttpStatus, HttpCode, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto, CreateDoctorWithUserDto, CreatePatientWithUserDto, LoginDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProfileType } from '../entities/user.entity';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @Public()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createUserDto: CreateUserDto) {
    return {
      success: true,
      message: 'User created successfully',
      data: await this.userService.createUser(createUserDto),
    };
  }

  @Post('doctor')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  async createDoctorWithUser(@Body() createDoctorDto: CreateDoctorWithUserDto) {
    const result = await this.userService.createDoctorWithUser(createDoctorDto);
    return {
      success: true,
      message: 'Doctor and user account created successfully',
      data: result,
    };
  }

  @Post('patient')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  async createPatientWithUser(@Body() createPatientDto: CreatePatientWithUserDto) {
    const result = await this.userService.createPatientWithUser(createPatientDto);
    return {
      success: true,
      message: 'Patient and user account created successfully',
      data: result,
    };
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    const result = await this.userService.login(loginDto);
    return {
      success: true,
      message: 'Login successful',
      data: result,
    };
  }

  @Get()
  @Roles(ProfileType.DOCTOR)
  async findAll() {
    return {
      success: true,
      message: 'Users retrieved successfully',
      data: await this.userService.findAll(),
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return {
      success: true,
      message: 'User retrieved successfully',
      data: await this.userService.findOne(id),
    };
  }

  @Get(':id/profile')
  async getUserWithProfile(@Param('id') id: string) {
    return {
      success: true,
      message: 'User with profile retrieved successfully',
      data: await this.userService.getUserWithProfile(id),
    };
  }

  @Patch(':id')
  @Roles(ProfileType.DOCTOR)
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return {
      success: true,
      message: 'User updated successfully',
      data: await this.userService.update(id, updateUserDto),
    };
  }

  @Delete(':id')
  @Roles(ProfileType.DOCTOR)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    await this.userService.remove(id);
    return {
      success: true,
      message: 'User deactivated successfully',
    };
  }
}

// Additional controller for quick data seeding/testing
@Controller('seed')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SeedController {
  constructor(private readonly userService: UserService) {}

  @Post('sample-doctor')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  async createSampleDoctor() {
    const sampleDoctor = {
      email: 'dr.smith@contextmd.com',
      password: 'SecurePass123!',
      name: 'Dr. John Smith',
      employee_id: 'DOC001',
      department: 'Cardiology',
    };

    const result = await this.userService.createDoctorWithUser(sampleDoctor);
    return {
      success: true,
      message: 'Sample doctor created successfully',
      data: result,
    };
  }

  @Post('sample-patient')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  async createSamplePatient() {
    const samplePatient = {
      email: 'jane.doe@email.com',
      password: 'SecurePass123!',
      name: 'Jane Doe',
      nric: 'S1234567A',
      phone: '+65 9123 4567',
      allergies: 'Penicillin, Shellfish',
      medication: 'Lisinopril 10mg daily',
      medical_history: 'Hypertension, Type 2 Diabetes',
    };

    const result = await this.userService.createPatientWithUser(samplePatient);
    return {
      success: true,
      message: 'Sample patient created successfully',
      data: result,
    };
  }

  @Post('bulk-doctors')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  async createBulkDoctors() {
    const doctors = [
      {
        email: 'dr.wilson@contextmd.com',
        password: 'SecurePass123!',
        name: 'Dr. Sarah Wilson',
        employee_id: 'DOC002',
        department: 'Pediatrics',
      },
      {
        email: 'dr.chen@contextmd.com',
        password: 'SecurePass123!',
        name: 'Dr. Michael Chen',
        employee_id: 'DOC003',
        department: 'Orthopedics',
      },
      {
        email: 'dr.patel@contextmd.com',
        password: 'SecurePass123!',
        name: 'Dr. Priya Patel',
        employee_id: 'DOC004',
        department: 'Neurology',
      },
    ];

    const results = [];
    for (const doctor of doctors) {
      try {
        const result = await this.userService.createDoctorWithUser(doctor);
        results.push(result);
      } catch (error) {
        results.push({ error: error.message, doctor: doctor.name });
      }
    }

    return {
      success: true,
      message: 'Bulk doctors creation completed',
      data: results,
    };
  }

  @Post('bulk-patients')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  async createBulkPatients() {
    const patients = [
      {
        email: 'alice.tan@email.com',
        password: 'SecurePass123!',
        name: 'Alice Tan',
        nric: 'S2345678B',
        phone: '+65 9234 5678',
        allergies: 'None known',
        medication: 'Metformin 500mg twice daily',
        medical_history: 'Type 2 Diabetes',
      },
      {
        email: 'bob.lim@email.com',
        password: 'SecurePass123!',
        name: 'Bob Lim',
        nric: 'S3456789C',
        phone: '+65 9345 6789',
        allergies: 'Aspirin',
        medication: 'Amlodipine 5mg daily',
        medical_history: 'Hypertension, Hyperlipidemia',
      },
      {
        email: 'carol.wong@email.com',
        password: 'SecurePass123!',
        name: 'Carol Wong',
        nric: 'S4567890D',
        phone: '+65 9456 7890',
        allergies: 'Latex, Iodine',
        medication: 'Levothyroxine 50mcg daily',
        medical_history: 'Hypothyroidism',
      },
    ];

    const results = [];
    for (const patient of patients) {
      try {
        const result = await this.userService.createPatientWithUser(patient);
        results.push(result);
      } catch (error) {
        results.push({ error: error.message, patient: patient.name });
      }
    }

    return {
      success: true,
      message: 'Bulk patients creation completed',
      data: results,
    };
  }
}
