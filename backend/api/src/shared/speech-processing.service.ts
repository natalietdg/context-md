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
    const repoRoot = process.env.REPO_ROOT || path.resolve(__dirname, '..', '..', '..', '..');
    return repoRoot;
  }

  private resolvePipelinePath(): string {
    const pipelinePath = process.env.PIPELINE_PATH || path.join(this.resolveRepoRoot(), 'pipeline.py');
    return pipelinePath;
  }

  private resolvePythonBin(): string {
    const pythonBin = process.env.VENV_PYTHON || path.join(this.resolveRepoRoot(), 'venv', 'bin', 'python3');
    return pythonBin;
  }

  private async runPipelineCli(audioBuffer: Buffer): Promise<{
    text: string;
    confidence: number;
    language_detected: string;
    english?: string;
    english_confidence?: number;
  }> {
    const start = Date.now();
    this.logger.log('🔍 DEBUG: Starting runPipelineCli');
    this.logger.log(`🔍 DEBUG: Audio buffer size: ${audioBuffer.length} bytes`);
    
    // Write audio to a temp file
    const tmpBase = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ctxmd-'));
    const audioPath = path.join(tmpBase, `audio_${Date.now()}.wav`);
    this.logger.log(`🔍 DEBUG: Temp directory: ${tmpBase}`);
    this.logger.log(`🔍 DEBUG: Audio file path: ${audioPath}`);
    
    await fs.promises.writeFile(audioPath, audioBuffer);
    this.logger.log(`🔍 DEBUG: Audio file written successfully`);

    try {
      const pythonBin = this.resolvePythonBin();
      const pipelinePath = this.resolvePipelinePath();
      
      this.logger.log(`🔍 DEBUG: Python binary: ${pythonBin}`);
      this.logger.log(`🔍 DEBUG: Pipeline path: ${pipelinePath}`);
      this.logger.log(`🔍 DEBUG: SEALION_API_KEY set: ${process.env.SEALION_API_KEY ? 'Yes' : 'No'}`);
      this.logger.log(`🔍 DEBUG: Environment variables: NODE_ENV=${process.env.NODE_ENV}, DB_ENCRYPTION_KEY=${process.env.DB_ENCRYPTION_KEY ? 'Set' : 'Not set'}`);
      
      this.logger.log(`Running pipeline: ${pythonBin} ${pipelinePath} ${audioPath}`);
      
      const result = await new Promise<string>((resolve, reject) => {
        this.logger.log('🔍 DEBUG: Starting execFile...');
        const child = execFile(
          pythonBin,
          [pipelinePath, audioPath],
          {
            env: {
              ...process.env,
              SEALION_API_KEY: process.env.SEALION_API_KEY,
            },
            timeout: 600000, // 10 minute timeout for model downloads
          },
          (err, stdout, stderr) => {
            this.logger.log('🔍 DEBUG: execFile callback triggered');
            if (err) {
              this.logger.error('🔍 DEBUG: Pipeline execution error details:');
              this.logger.error(`🔍 DEBUG: Error code: ${err.code}`);
              this.logger.error(`🔍 DEBUG: Error signal: ${err.signal}`);
              this.logger.error(`🔍 DEBUG: Error message: ${err.message}`);
              this.logger.error('Pipeline execution error:', err);
              this.logger.error('Pipeline stderr:', stderr);
              this.logger.log('Pipeline stdout (on error):', stdout);
              reject(new Error(`Pipeline failed: ${err.message}`));
            } else {
              this.logger.log('🔍 DEBUG: Pipeline executed successfully');
              this.logger.log('Pipeline stdout:', stdout);
              if (stderr) {
                this.logger.log('Pipeline stderr (non-error):', stderr);
              }
              resolve(stdout);
            }
          }
        );
        
        this.logger.log(`🔍 DEBUG: Child process PID: ${child.pid}`);
        
        // Log child process events
        child.on('spawn', () => {
          this.logger.log('🔍 DEBUG: Child process spawned successfully');
        });
        
        child.on('error', (err) => {
          this.logger.error('🔍 DEBUG: Child process error:', err);
        });
        
        child.on('exit', (code, signal) => {
          this.logger.log(`🔍 DEBUG: Child process exited with code: ${code}, signal: ${signal}`);
        });
      });

      this.logger.log(`🔍 DEBUG: Pipeline completed in ${Date.now() - start}ms`);
      this.logger.log(`Pipeline completed in ${Date.now() - start}ms`);
      
      // Parse the output files
      const outputDir = path.join(tmpBase, 'outputs');
      this.logger.log(`🔍 DEBUG: Looking for output files in: ${outputDir}`);
      
      // Check if output directory exists
      try {
        const outputDirExists = await fs.promises.access(outputDir).then(() => true).catch(() => false);
        this.logger.log(`🔍 DEBUG: Output directory exists: ${outputDirExists}`);
        
        if (outputDirExists) {
          const outputContents = await fs.promises.readdir(outputDir);
          this.logger.log(`🔍 DEBUG: Output directory contents: ${JSON.stringify(outputContents)}`);
        }
      } catch (e) {
        this.logger.error(`🔍 DEBUG: Error checking output directory: ${e}`);
      }
      
      // Find the actual files (glob pattern)
      const transcriptDir = path.join(outputDir, '01_transcripts_lean');
      const translatedDir = path.join(outputDir, '02_translated');
      
      this.logger.log(`🔍 DEBUG: Checking transcript directory: ${transcriptDir}`);
      this.logger.log(`🔍 DEBUG: Checking translated directory: ${translatedDir}`);
      
      const transcriptFiles = await fs.promises.readdir(transcriptDir).catch((err) => {
        this.logger.error(`🔍 DEBUG: Error reading transcript directory: ${err.message}`);
        return [];
      });
      const translatedFiles = await fs.promises.readdir(translatedDir).catch((err) => {
        this.logger.error(`🔍 DEBUG: Error reading translated directory: ${err.message}`);
        return [];
      });
      
      this.logger.log(`🔍 DEBUG: Found transcript files: ${JSON.stringify(transcriptFiles)}`);
      this.logger.log(`🔍 DEBUG: Found translated files: ${JSON.stringify(translatedFiles)}`);
      
      let transcriptData = null;
      let translatedData = null;
      
      if (transcriptFiles.length > 0) {
        const transcriptFilePath = path.join(transcriptDir, transcriptFiles[0]);
        this.logger.log(`🔍 DEBUG: Reading transcript file: ${transcriptFilePath}`);
        try {
          const transcriptContent = await fs.promises.readFile(transcriptFilePath, 'utf-8');
          this.logger.log(`🔍 DEBUG: Transcript content length: ${transcriptContent.length}`);
          transcriptData = JSON.parse(transcriptContent);
          this.logger.log(`🔍 DEBUG: Parsed transcript data keys: ${Object.keys(transcriptData)}`);
        } catch (e) {
          this.logger.error(`🔍 DEBUG: Error reading/parsing transcript file: ${e}`);
        }
      }
      
      if (translatedFiles.length > 0) {
        const translatedFilePath = path.join(translatedDir, translatedFiles[0]);
        this.logger.log(`🔍 DEBUG: Reading translated file: ${translatedFilePath}`);
        try {
          const translatedContent = await fs.promises.readFile(translatedFilePath, 'utf-8');
          this.logger.log(`🔍 DEBUG: Translated content length: ${translatedContent.length}`);
          translatedData = JSON.parse(translatedContent);
          this.logger.log(`🔍 DEBUG: Parsed translated data keys: ${Object.keys(translatedData)}`);
        } catch (e) {
          this.logger.error(`🔍 DEBUG: Error reading/parsing translated file: ${e}`);
        }
      }

      const endResult = {
        text: transcriptData?.transcript || '[No transcript generated]',
        confidence: transcriptData?.confidence || 0.0,
        language_detected: transcriptData?.language || 'unknown',
        english: translatedData?.english_translation || undefined,
        english_confidence: translatedData?.translation_confidence || undefined,
      };
      
      this.logger.log(`🔍 DEBUG: Final result: ${JSON.stringify(result)}`);
      return endResult;

    } finally {
      // Clean up temp files
      this.logger.log(`🔍 DEBUG: Cleaning up temp directory: ${tmpBase}`);
      await fs.promises.rm(tmpBase, { recursive: true, force: true }).catch((err) => {
        this.logger.error(`🔍 DEBUG: Error cleaning up temp files: ${err}`);
      });
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
