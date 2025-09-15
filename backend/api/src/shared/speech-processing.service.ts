import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import FormData from 'form-data';

export interface TranscriptionResult {
  raw_transcript: string;
  english_transcript: string;
  confidence_score: number;
  processing_time_ms: number;
  language_detected?: string;
}

@Injectable()
export class SpeechProcessingService {
  private readonly logger = new Logger(SpeechProcessingService.name);

  constructor(private httpService: HttpService) {}

  async processAudio(audioBuffer: Buffer, language: string = 'auto'): Promise<TranscriptionResult> {
    const startTime = Date.now();

    try {
      // Step 1: Transcribe audio to raw (code-switched) text using MERaLiON/Whisper
      const rawTranscript = await this.transcribeAudio(audioBuffer, language);

      // Step 2: Translate raw transcript to English if needed
      const englishTranscript = await this.translateToEnglish(rawTranscript.text, language);

      const processingTime = Date.now() - startTime;

      return {
        raw_transcript: rawTranscript.text,
        english_transcript: englishTranscript.text,
        confidence_score: Math.min(rawTranscript.confidence, englishTranscript.confidence),
        processing_time_ms: processingTime,
        language_detected: rawTranscript.language_detected,
      };
    } catch (error: any) {
      this.logger.error('Speech processing failed:', error);
      throw new Error(`Speech processing failed: ${error?.message}`);
    }
  }

  private async transcribeAudio(audioBuffer: Buffer, language: string): Promise<{
    text: string;
    confidence: number;
    language_detected: string;
  }> {
    try {
      // Use existing WhisperX integration or MERaLiON API
      const whisperXEndpoint = process.env.WHISPERX_ENDPOINT || 'http://localhost:8000/transcribe';
      
      const formData = new FormData();
      formData.append('audio', audioBuffer, {
        filename: 'audio.wav',
        contentType: 'audio/wav',
      });
      formData.append('language', language);
      formData.append('model', 'large-v2');

      const response = await firstValueFrom(
        this.httpService.post(whisperXEndpoint, formData, {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${process.env.WHISPERX_API_KEY}`,
          },
          timeout: 300000, // 5 minutes timeout
        })
      );

      const result = response.data;
      
      return {
        text: result.transcript || result.text || '',
        confidence: result.confidence || 0.8,
        language_detected: result.language || language,
      };
    } catch (error) {
      this.logger.error('Transcription failed:', error);
      
      // Fallback: return empty transcript with low confidence
      return {
        text: '[Transcription failed - audio processing error]',
        confidence: 0.0,
        language_detected: language,
      };
    }
  }

  private async translateToEnglish(rawTranscript: string, sourceLanguage: string): Promise<{
    text: string;
    confidence: number;
  }> {
    // If already in English or empty, return as-is
    if (sourceLanguage === 'en' || !rawTranscript.trim()) {
      return {
        text: rawTranscript,
        confidence: 1.0,
      };
    }

    try {
      // Use SEA-LION API for translation
      const seaLionEndpoint = process.env.SEALION_ENDPOINT || 'https://api.sea-lion.ai/v1/translate';
      
      const response = await firstValueFrom(
        this.httpService.post(
          seaLionEndpoint,
          {
            text: rawTranscript,
            source_language: sourceLanguage,
            target_language: 'en',
            model: 'sea-lion-7b-instruct',
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.SEALION_API_KEY}`,
              'Content-Type': 'application/json',
            },
            timeout: 60000, // 1 minute timeout
          }
        )
      );

      const result = response.data;
      
      return {
        text: result.translated_text || result.text || rawTranscript,
        confidence: result.confidence || 0.8,
      };
    } catch (error) {
      this.logger.error('Translation failed:', error);
      
      // Fallback: return original text
      return {
        text: rawTranscript,
        confidence: 0.5,
      };
    }
  }

  async chunkAudio(audioBuffer: Buffer, chunkDurationSeconds: number = 30): Promise<Buffer[]> {
    // Simple chunking implementation
    // In production, you'd use a proper audio processing library like ffmpeg
    const chunks: Buffer[] = [];
    const bytesPerSecond = 16000 * 2; // Assuming 16kHz, 16-bit audio
    const chunkSize = bytesPerSecond * chunkDurationSeconds;
    
    for (let i = 0; i < audioBuffer.length; i += chunkSize) {
      const chunk = audioBuffer.slice(i, i + chunkSize);
      chunks.push(chunk);
    }
    
    return chunks;
  }

  async processAudioChunks(audioBuffer: Buffer, language: string = 'auto'): Promise<TranscriptionResult> {
    const chunks = await this.chunkAudio(audioBuffer);
    const results: TranscriptionResult[] = [];

    for (const chunk of chunks) {
      const result = await this.processAudio(chunk, language);
      results.push(result);
    }

    // Combine results
    const combinedRawTranscript = results.map(r => r.raw_transcript).join(' ');
    const combinedEnglishTranscript = results.map(r => r.english_transcript).join(' ');
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence_score, 0) / results.length;
    const totalProcessingTime = results.reduce((sum, r) => sum + r.processing_time_ms, 0);

    return {
      raw_transcript: combinedRawTranscript,
      english_transcript: combinedEnglishTranscript,
      confidence_score: avgConfidence,
      processing_time_ms: totalProcessingTime,
      language_detected: results[0]?.language_detected,
    };
  }
}
