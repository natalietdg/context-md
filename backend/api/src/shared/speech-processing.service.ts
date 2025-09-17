import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';

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

    const repoRoot = this.resolveRepoRoot();
    const pipelinePath = this.resolvePipelinePath(repoRoot);
    const pythonBin = process.env.PYTHON_BIN || path.join(repoRoot, 'venv/bin/python');

    // Run pipeline with translation but skip clinical extraction for speed/cost
    await new Promise<void>((resolve, reject) => {
      const args = [pipelinePath, audioPath, '--skip-clinical'];
      // Use existing environment variables from .env
      const pipelineEnv = {
        ...process.env,
      };
      const child = spawn(pythonBin, args, { cwd: repoRoot, env: pipelineEnv });
      let stderr = '';
      child.stderr.on('data', (d) => {
        stderr += d.toString();
        try { this.logger.debug(`[pipeline] ${d.toString().trim()}`); } catch {}
      });
      child.on('close', (code) => {
        if (code === 0) return resolve();
        reject(new Error(`pipeline.py exited with code ${code}: ${stderr}`));
      });
    });

    // Parse latest outputs created after 'start'
    const leanDir = path.join(repoRoot, 'outputs', '01_transcripts_lean');
    const translatedDir = path.join(repoRoot, 'outputs', '02_translated');

    const pickLatestAfter = async (dir: string): Promise<string | null> => {
      try {
        const files = await fs.promises.readdir(dir);
        const jsons = files.filter(f => f.endsWith('.json'));
        let best: { file: string; mtime: number } | null = null;
        for (const f of jsons) {
          const p = path.join(dir, f);
          const st = await fs.promises.stat(p);
          const mt = st.mtimeMs;
          if (mt >= start && (!best || mt > best.mtime)) best = { file: p, mtime: mt };
        }
        return best ? best.file : null;
      } catch { return null; }
    };

    const leanFile = await pickLatestAfter(leanDir);
    const translatedFile = await pickLatestAfter(translatedDir);

    let rawTranscript = '';
    let englishTranscript = '';
    let detectedLanguage: string | undefined = undefined;

    if (leanFile) {
      try {
        const data = JSON.parse(await fs.promises.readFile(leanFile, 'utf-8'));
        if (Array.isArray(data?.turns)) {
          rawTranscript = data.turns.map((t: any) => (t?.text || '')).join(' ').trim();
        } else if (typeof data?.text === 'string') {
          rawTranscript = data.text;
        }
        if (Array.isArray(data?.languages_detected) && data.languages_detected.length > 0) {
          detectedLanguage = data.languages_detected[0];
        }
      } catch (e) {
        this.logger.warn(`Failed to parse lean transcript ${leanFile}: ${String(e)}`);
      }
    }

    if (translatedFile) {
      try {
        const data = JSON.parse(await fs.promises.readFile(translatedFile, 'utf-8'));
        if (Array.isArray(data?.turns)) {
          englishTranscript = data.turns.map((t: any) => (t?.text || '')).join(' ').trim();
        } else if (typeof data?.text === 'string') {
          englishTranscript = data.text;
        }
      } catch (e) {
        this.logger.warn(`Failed to parse translated transcript ${translatedFile}: ${String(e)}`);
      }
    }

    // Cleanup temp
    try { await fs.promises.unlink(audioPath); await fs.promises.rmdir(tmpBase); } catch {}

    return {
      text: rawTranscript || '[Transcription empty]',
      confidence: englishTranscript ? 0.9 : 0.8,
      language_detected: detectedLanguage || 'auto',
      english: englishTranscript || rawTranscript || '',
      english_confidence: englishTranscript ? 0.9 : 0.8,
    };
  }

  private async transcribeAudio(audioBuffer: Buffer, language: string): Promise<{
    text: string;
    confidence: number;
    language_detected: string;
    english?: string;
    english_confidence?: number;
  }> {
    try {
      const whisperXEndpoint = process.env.WHISPERX_ENDPOINT;

      // CLI fallback: if no endpoint configured or explicitly set to 'cli'
      if (!whisperXEndpoint || whisperXEndpoint.toLowerCase() === 'cli') {
        // Use CLI pipeline for transcription and translation
        this.logger.log('Using CLI pipeline for transcription');
        return await this.runPipelineCli(audioBuffer);
      }

      // HTTP mode: Use WhisperX service
      
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
