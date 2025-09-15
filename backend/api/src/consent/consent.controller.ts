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
import { ConsentService } from './consent.service';
import { CreateConsentDto, ReplayConsentDto } from './dto';

@Controller('consent')
@UseGuards(AuthGuard('jwt'))
export class ConsentController {
  constructor(private consentService: ConsentService) {}

  @Post()
  @UseInterceptors(FileInterceptor('audio'))
  async createConsent(
    @Body() createConsentDto: CreateConsentDto,
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

    return this.consentService.createConsent(
      createConsentDto,
      audioFile.buffer,
      requestInfo,
    );
  }

  @Get(':id')
  async getConsent(@Param('id') id: string) {
    return this.consentService.getConsent(id);
  }

  @Post('replay')
  async replayConsent(
    @Body() replayDto: ReplayConsentDto,
    @Request() req,
  ) {
    const requestInfo = {
      userId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      sessionId: req.sessionID,
    };

    return this.consentService.replayConsent(replayDto, requestInfo);
  }

  @Get(':id/replay-logs')
  async getReplayLogs(@Param('id') consentId: string) {
    return this.consentService.getConsentReplayLogs(consentId);
  }

  @Get('patient/:patientId')
  async getPatientConsents(@Param('patientId') patientId: string) {
    return this.consentService.getPatientConsents(patientId);
  }

  @Get('doctor/:doctorId')
  async getDoctorConsents(@Param('doctorId') doctorId: string) {
    return this.consentService.getDoctorConsents(doctorId);
  }

  @Put(':id/revoke')
  async revokeConsent(
    @Param('id') consentId: string,
    @Request() req,
  ) {
    const requestInfo = {
      userId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      sessionId: req.sessionID,
    };

    return this.consentService.revokeConsent(consentId, requestInfo);
  }
}
