import { Controller, Get, UseGuards, Req, Query } from '@nestjs/common';
import { PatientService } from './patient.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('patients')
@UseGuards(AuthGuard('jwt'))
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  @Get()
  async getAllPatients(@Req() req: any, @Query('search') search?: string) {
    if (search && search.trim()) {
      return this.patientService.searchPatients(search.trim(), req);
    }
    return this.patientService.getAllPatients(req);
  }
}
