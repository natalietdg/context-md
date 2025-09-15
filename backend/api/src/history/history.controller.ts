import { 
  Controller, 
  Get, 
  Param, 
  UseGuards, 
  Request, 
  Query
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { HistoryService } from './history.service';

@Controller('history')
@UseGuards(AuthGuard('jwt'))
export class HistoryController {
  constructor(private historyService: HistoryService) {}

  @Get('patient/:patientId')
  async getPatientHistory(
    @Param('patientId') patientId: string,
    @Request() req,
  ) {
    const requestInfo = {
      userId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      sessionId: req.sessionID,
    };

    return this.historyService.getPatientHistory(patientId, requestInfo);
  }

  @Get('doctor/:doctorId/patients')
  async getDoctorPatients(
    @Param('doctorId') doctorId: string,
    @Request() req,
  ) {
    const requestInfo = {
      userId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      sessionId: req.sessionID,
    };

    return this.historyService.getDoctorPatients(doctorId, requestInfo);
  }

  @Get('patient/:patientId/handover')
  async getHandoverSummary(
    @Param('patientId') patientId: string,
    @Request() req,
  ) {
    const requestInfo = {
      userId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      sessionId: req.sessionID,
    };

    return this.historyService.getHandoverSummary(patientId, requestInfo);
  }

  @Get('patient/:patientId/search')
  async searchPatientHistory(
    @Param('patientId') patientId: string,
    @Query('q') searchTerm: string,
    @Request() req,
  ) {
    const requestInfo = {
      userId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      sessionId: req.sessionID,
    };

    return this.historyService.searchPatientHistory(patientId, searchTerm, requestInfo);
  }
}
