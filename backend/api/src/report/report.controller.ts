import { 
  Controller, 
  Post, 
  Get, 
  Put, 
  Body, 
  Param, 
  UseGuards, 
  Request, 
  Query
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReportService } from './report.service';
import { CreateReportDto, UpdateReportDto } from './dto';

@Controller('report')
@UseGuards(AuthGuard('jwt'))
export class ReportController {
  constructor(private reportService: ReportService) {}

  @Post()
  async generateReport(
    @Body() createReportDto: CreateReportDto,
    @Request() req,
  ) {
    const requestInfo = {
      userId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      sessionId: req.sessionID,
    };

    return this.reportService.generateReport(createReportDto, requestInfo);
  }

  @Get(':id')
  async getReport(@Param('id') id: string) {
    return this.reportService.getReport(id);
  }

  @Get('consultation/:consultationId')
  async getReportByConsultation(@Param('consultationId') consultationId: string) {
    return this.reportService.getReportByConsultation(consultationId);
  }

  @Put(':id')
  async updateReport(
    @Param('id') id: string,
    @Body() updateDto: UpdateReportDto,
    @Request() req,
  ) {
    const requestInfo = {
      userId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      sessionId: req.sessionID,
    };

    return this.reportService.updateReport(id, updateDto, requestInfo);
  }

  @Post(':id/regenerate')
  async regenerateReport(
    @Param('id') reportId: string,
    @Body('target_language') targetLanguage?: string,
    @Request() req?,
  ) {
    const requestInfo = {
      userId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      sessionId: req.sessionID,
    };

    return this.reportService.regenerateReport(reportId, targetLanguage, requestInfo);
  }

  @Get('patient/:patientId')
  async getPatientReports(@Param('patientId') patientId: string) {
    return this.reportService.getPatientReports(patientId);
  }

  @Get('doctor/:doctorId')
  async getDoctorReports(@Param('doctorId') doctorId: string) {
    return this.reportService.getDoctorReports(doctorId);
  }

  @Get('conflicts/all')
  async getReportsWithConflicts() {
    return this.reportService.getReportsWithConflicts();
  }

  @Get('all')
  async getAllReports(@Request() req) {
    const requestInfo = {
      userId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      sessionId: req.sessionID,
    };
    return this.reportService.getAllReports(requestInfo);
  }
}
