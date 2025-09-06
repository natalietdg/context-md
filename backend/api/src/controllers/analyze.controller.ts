import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AnalyzeService } from '../services/analyze.service';
import { ApiKeyGuard } from '../guards/api-key.guard';

interface AnalyzeDto {
  transcript: string;
  language: string;
  outputLanguage: string;
}

@Controller('analyze')
export class AnalyzeController {
  constructor(private readonly analyzeService: AnalyzeService) {}

  @UseGuards(ApiKeyGuard)
  @Post('structured')
  async structured(@Body() body: AnalyzeDto) {
    const { transcript, language, outputLanguage } = body;
    return this.analyzeService.analyzeStructured({ transcript, language, outputLanguage });
  }

  @UseGuards(ApiKeyGuard)
  @Post('summary')
  async summary(@Body() body: AnalyzeDto) {
    const { transcript, language, outputLanguage } = body;
    return this.analyzeService.analyzeSummary({ transcript, language, outputLanguage });
  }
}
