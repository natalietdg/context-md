import { 
  Controller, 
  Post, 
  Get, 
  Put, 
  Body, 
  Param, 
  UseGuards, 
  Request, 
  UseInterceptors, 
  UploadedFile,
  BadRequestException,
  Query
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConsultationService } from './consultation.service';
import { CreateConsultationDto, UpdateConsultationDto, LockConsultationDto } from './dto';

@Controller('consultation')
@UseGuards(AuthGuard('jwt'))
export class ConsultationController {
  constructor(private consultationService: ConsultationService) {}

  @Post()
  @UseInterceptors(FileInterceptor('audio'))
  async createConsultation(
    @Body() createConsultationDto: CreateConsultationDto,
    @UploadedFile() audioFile: Express.Multer.File,
    @Request() req,
  ) {
    if (!audioFile) {
      throw new BadRequestException('Audio file is required');
    }

    const requestInfo = {
      userId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      sessionId: req.sessionID,
    };

    return this.consultationService.createConsultation(
      createConsultationDto,
      audioFile.buffer,
      requestInfo,
    );
  }

  @Get(':id')
  async getConsultation(@Param('id') id: string) {
    return this.consultationService.getConsultation(id);
  }

  @Put(':id')
  async updateConsultation(
    @Param('id') id: string,
    @Body() updateDto: UpdateConsultationDto,
    @Request() req,
  ) {
    const requestInfo = {
      userId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      sessionId: req.sessionID,
    };

    return this.consultationService.updateConsultation(id, updateDto, requestInfo);
  }

  @Put('lock')
  async lockConsultation(
    @Body() lockDto: LockConsultationDto,
    @Request() req,
  ) {
    const requestInfo = {
      userId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      sessionId: req.sessionID,
    };

    return this.consultationService.lockConsultation(lockDto, requestInfo);
  }

  @Get(':id/status')
  async getProcessingStatus(@Param('id') id: string) {
    return this.consultationService.getConsultationProcessingStatus(id);
  }

  @Put(':id/audio')
  @UseInterceptors(FileInterceptor('audio'))
  async uploadConsultationAudio(
    @Param('id') id: string,
    @UploadedFile() audioFile: Express.Multer.File,
    @Request() req,
  ) {
    if (!audioFile) {
      throw new BadRequestException('Audio file is required');
    }

    const requestInfo = {
      userId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      sessionId: req.sessionID,
    };

    return this.consultationService.uploadConsultationAudio(id, audioFile.buffer, requestInfo);
  }

  @Get('patient/:patientId')
  async getPatientConsultations(@Param('patientId') patientId: string) {
    return this.consultationService.getPatientConsultations(patientId);
  }

  @Get('doctor/:doctorId')
  async getDoctorConsultations(@Param('doctorId') doctorId: string) {
    return this.consultationService.getDoctorConsultations(doctorId);
  }

  @Get()
  async getConsultationsByDateRange(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('doctorId') doctorId?: string,
    @Query('patientId') patientId?: string,
  ) {
    return this.consultationService.getConsultationsByDateRange(
      new Date(startDate),
      new Date(endDate),
      doctorId,
      patientId,
    );
  }
}
