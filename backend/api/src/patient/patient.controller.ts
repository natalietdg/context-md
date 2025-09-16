import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { PatientService } from './patient.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('patients')
@UseGuards(AuthGuard('jwt'))
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  @Get()
  async getAllPatients(@Req() req: any) {
    return this.patientService.getAllPatients(req);
  }
}
