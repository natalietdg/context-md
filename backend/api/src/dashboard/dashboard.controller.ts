import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Body, 
  Param, 
  UseGuards, 
  Request
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DashboardService } from './dashboard.service';
import { AppointmentStatus } from '../entities';

@Controller('dashboard')
@UseGuards(AuthGuard('jwt'))
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('doctor/:doctorId')
  async getDoctorDashboard(
    @Param('doctorId') doctorId: string,
    @Request() req,
  ) {
    const requestInfo = {
      userId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      sessionId: req.sessionID,
    };

    return this.dashboardService.getDoctorDashboard(doctorId, requestInfo);
  }

  @Put('appointment/:appointmentId/status')
  async updateAppointmentStatus(
    @Param('appointmentId') appointmentId: string,
    @Body('status') status: AppointmentStatus,
    @Request() req,
  ) {
    const requestInfo = {
      userId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      sessionId: req.sessionID,
    };

    return this.dashboardService.updateAppointmentStatus(appointmentId, status, requestInfo);
  }

  @Post('appointment')
  async createAppointment(
    @Body() appointmentData: {
      patient_id: string;
      doctor_id: string;
      scheduled_at: string;
      duration_minutes?: number;
      appointment_type?: string;
      notes?: string;
    },
    @Request() req,
  ) {
    const requestInfo = {
      userId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      sessionId: req.sessionID,
    };

    return this.dashboardService.createAppointment(
      appointmentData.patient_id,
      appointmentData.doctor_id,
      new Date(appointmentData.scheduled_at),
      appointmentData.duration_minutes,
      appointmentData.appointment_type,
      appointmentData.notes,
      requestInfo,
    );
  }
}
