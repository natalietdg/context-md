import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';

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

      // Step 2: Translate raw transcript to English if needed (or reuse CLI translation)
      let englishTranscript: { text: string; confidence: number };
      if (rawTranscript.english) {
        englishTranscript = {
          text: rawTranscript.english,
          confidence: rawTranscript.english_confidence ?? rawTranscript.confidence ?? 0.8,
        };
      } else {
        englishTranscript = await this.translateToEnglish(
          rawTranscript.text,
          rawTranscript.language_detected || language
        );
      }

      const processingTime = Date.now() - startTime;

      return {
        raw_transcript: rawTranscript.text,
        english_transcript: englishTranscript.text,
        confidence_score: Math.min(rawTranscript.confidence ?? 0.8, englishTranscript.confidence ?? 0.8),
        processing_time_ms: processingTime,
        language_detected: rawTranscript.language_detected,
      };
    } catch (error: any) {
      this.logger.error('Speech processing failed:', error);
      throw new Error(`Speech processing failed: ${error?.message}`);
    }
  
  }

  // --- CLI fallback helpers ---
  private resolveRepoRoot(): string {
    // Try current working directory first (root when running start:prod)
    const cwd = process.cwd();
    if (fs.existsSync(path.join(cwd, 'pipeline.py'))) return cwd;
    // If running from backend/api, go up two levels
    const upTwo = path.resolve(cwd, '..', '..');
    if (fs.existsSync(path.join(upTwo, 'pipeline.py'))) return upTwo;
    // As a last resort, use relative to compiled dist directory
    const fromDist = path.resolve(__dirname, '..', '..', '..', '..');
    if (fs.existsSync(path.join(fromDist, 'pipeline.py'))) return fromDist;
    return cwd; // fallback to cwd
  }

  private resolvePipelinePath(repoRoot: string): string {
    const candidate = path.join(repoRoot, 'pipeline.py');
    return candidate;
  }

  private async runPipelineCli(audioBuffer: Buffer): Promise<{
    text: string;
    confidence: number;
    language_detected: string;
    english?: string;
    english_confidence?: number;
  }> {
    const start = Date.now();
    // Write audio to a temp file
    const tmpBase = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ctxmd-'));
    const audioPath = path.join(tmpBase, `audio_${Date.now()}.wav`);
    await fs.promises.writeFile(audioPath, audioBuffer);

    try {
      const pythonBin = path.join(process.cwd(), '..', '..', 'venv', 'bin', 'python3');
      const pipelinePath = path.join(process.cwd(), '..', '..', 'pipeline.py');
      
      this.logger.log(`Running pipeline: ${pythonBin} ${pipelinePath} ${audioPath}`);
      
      const result = await new Promise<string>((resolve, reject) => {
        execFile(
          pythonBin,
          [pipelinePath, audioPath],
          {
            env: {
              ...process.env,
              SEALION_API_KEY: process.env.SEALION_API_KEY,
            },
          },
          (err, stdout, stderr) => {
            if (err) {
              this.logger.error('Pipeline execution error:', err);
              this.logger.error('Pipeline stderr:', stderr);
              reject(new Error(`Pipeline failed: ${err.message}`));
            } else {
              this.logger.log('Pipeline stdout:', stdout);
              resolve(stdout);
            }
          }
        );
      });

      this.logger.log(`Pipeline completed in ${Date.now() - start}ms`);
      
      // Parse the output files
      const outputDir = path.join(tmpBase, 'outputs');
      
      // Find the actual files (glob pattern)
      const transcriptFiles = await fs.promises.readdir(path.join(outputDir, '01_transcripts_lean')).catch(() => []);
      const translatedFiles = await fs.promises.readdir(path.join(outputDir, '02_translated')).catch(() => []);
      
      let transcriptData = null;
      let translatedData = null;
      
      if (transcriptFiles.length > 0) {
        const transcriptContent = await fs.promises.readFile(
          path.join(outputDir, '01_transcripts_lean', transcriptFiles[0]), 
          'utf-8'
        );
        transcriptData = JSON.parse(transcriptContent);
      }
      
      if (translatedFiles.length > 0) {
        const translatedContent = await fs.promises.readFile(
          path.join(outputDir, '02_translated', translatedFiles[0]), 
          'utf-8'
        );
        translatedData = JSON.parse(translatedContent);
      }

      return {
        text: transcriptData?.transcript || '[No transcript generated]',
        confidence: transcriptData?.confidence || 0.0,
        language_detected: transcriptData?.language || 'unknown',
        english: translatedData?.english_translation || undefined,
        english_confidence: translatedData?.translation_confidence || undefined,
      };

    } finally {
      // Clean up temp files
      await fs.promises.rm(tmpBase, { recursive: true, force: true }).catch(() => {});
    }
  }

  private async transcribeAudio(audioBuffer: Buffer, language: string): Promise<{
    text: string;
    confidence: number;
    language_detected: string;
    english?: string;
    english_confidence?: number;
  }> {
    try {
      // Always use CLI pipeline
      this.logger.log('Using CLI pipeline for transcription');
      return await this.runPipelineCli(audioBuffer);
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
      // Use SEA-LION API for translation - but endpoint doesn't exist, so fallback to original text
      const seaLionEndpoint = process.env.SEALION_ENDPOINT;
      
      if (!seaLionEndpoint) {
        this.logger.warn('SEALION_ENDPOINT not configured, returning original text');
        return {
          text: rawTranscript,
          confidence: 0.7,
        };
      }
      
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
