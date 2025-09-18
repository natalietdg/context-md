#!/usr/bin/env python3
"""
Persistent Python Pipeline Server

This server preloads all ML models and processes audio transcription jobs
via JSON-line communication over stdin/stdout. Eliminates cold start delays.

Usage:
    python3 pipeline_server.py

Communication Protocol:
    Input (stdin):  {"cmd": "run", "job_id": "123", "audio_path": "/path/to/audio.wav"}
    Output (stdout): {"job_id": "123", "status": "done", "result": {...}}
"""

import sys
import json
import time
import uuid
import traceback
import threading
from threading import Event
from typing import Dict, Any, Optional
from pathlib import Path
import os
from contextlib import redirect_stdout

# Disable colored output to prevent ANSI escape sequences
os.environ['NO_COLOR'] = '1'
os.environ['ANSI_COLORS_DISABLED'] = '1'
os.environ['FORCE_COLOR'] = '0'

# Add project directories to Python path
project_root = Path(__file__).parent.resolve()
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "aws"))
sys.path.insert(0, str(project_root / "whisperX"))
sys.path.insert(0, str(project_root / "sealion"))
sys.path.insert(0, str(project_root / "clinical_extractor_llm"))

# Global variables for non-blocking startup with immediate health response
models = {"whisperx": None, "translator": None, "clinical": None, "s3": None}
models_lock = threading.Lock()
models_ready_event = threading.Event()
models_loading_errors = []

def log(message: str):
    """Log to stderr for debugging"""
    print(f"[PIPELINE] {message}", file=sys.stderr, flush=True)

def load_models():
    """Load and initialize all ML models"""
    log("Starting model loading...")
    loaded_models = {}

    # Helper to append thread-safely to errors
    def note_error(msg: str):
        with models_lock:
            models_loading_errors.append(msg)
        log(msg)

    # WhisperX
    try:
        log("Loading WhisperX...")
        from whisperX.whisperx_transcriber import WhisperXTranscriber
        loaded_models['whisperx'] = WhisperXTranscriber(cache_dir=str(project_root / "audio_cache"))
        log("✅ WhisperX loaded successfully")
    except Exception as e:
        msg = f"❌ WhisperX loading failed: {e}"
        note_error(msg)
        loaded_models['whisperx'] = None

    # SEA-LION translator
    try:
        log("Loading SEA-LION translator...")
        from sealion.translator import SEALionTranslator
        sealion_api_key = os.getenv('SEALION_API_KEY')
        if sealion_api_key:
            loaded_models['translator'] = SEALionTranslator(api_key=sealion_api_key)
            log("✅ SEA-LION translator loaded successfully")
        else:
            log("⚠️ SEALION_API_KEY not set, translator disabled")
            loaded_models['translator'] = None
    except Exception as e:
        msg = f"❌ SEA-LION translator loading failed: {e}"
        note_error(msg)
        loaded_models['translator'] = None

    # Clinical extractor
    try:
        log("Loading Clinical Extractor...")
        from clinical_extractor_llm.extractor import ClinicalExtractorLLM
        loaded_models['clinical'] = ClinicalExtractorLLM(model_name=os.getenv("CLINICAL_MODEL_NAME", "microsoft/DialoGPT-medium"))
        log("✅ Clinical Extractor loaded successfully")
    except Exception as e:
        msg = f"❌ Clinical Extractor loading failed: {e}"
        note_error(msg)
        loaded_models['clinical'] = None

    # S3 downloader
    try:
        log("Loading S3 downloader...")
        from aws.s3_downloader import S3AudioDownloader
        loaded_models['s3'] = S3AudioDownloader(cache_dir=str(project_root / "audio_cache"))
        log("✅ S3 downloader loaded successfully")
    except Exception as e:
        msg = f"❌ S3 downloader loading failed: {e}"
        note_error(msg)
        loaded_models['s3'] = None

    log("Model loading completed")
    return loaded_models

def run_pipeline(models: Dict[str, Any], audio_input: str, job_id: str, skip_translation: bool = False, skip_clinical: bool = True) -> Dict[str, Any]:
    """Run the complete audio processing pipeline"""
    log(f"Processing job {job_id}: {audio_input}")

    try:
        # Set up directories
        output_dir = project_root / "outputs"
        transcripts_dir = output_dir / "01_transcripts_lean"
        translated_dir = output_dir / "02_translated"
        clinical_dir = output_dir / "03_clinical_extraction"

        for dir_path in [transcripts_dir, translated_dir, clinical_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)

        # Step 1: Handle audio input (S3 or local)
        if isinstance(audio_input, str) and audio_input.startswith('s3://') and models.get('s3'):
            log(f"Downloading from S3: {audio_input}")
            audio_path = models['s3'].download_audio_file(audio_input, use_cache=True)
        else:
            audio_path = audio_input
            if not Path(audio_path).exists():
                raise FileNotFoundError(f"Audio file not found: {audio_path}")

        log(f"Processing audio file: {audio_path}")

        # Step 2: Transcribe with WhisperX (use safe adapter for multiple transcriber APIs)
        if not models.get('whisperx'):
            raise RuntimeError("WhisperX not available")

        log("Starting transcription...")
        transcriber = models['whisperx']
        raw_transcript = None
        lean_transcript = None

        # Try transcribe_audio (common wrapper)
        if hasattr(transcriber, 'transcribe_audio'):
            try:
                raw_transcript, lean_transcript = transcriber.transcribe_audio(
                    audio_path=audio_path,
                    language="auto",
                    model_size=os.getenv('WHISPER_MODEL_SIZE', "small"),
                    min_speakers=None,
                    max_speakers=None
                )
            except TypeError:
                # fallback if signature differs
                result = transcriber.transcribe_audio(audio_path)
                # attempt to normalize
                if isinstance(result, tuple) and len(result) >= 2:
                    raw_transcript, lean_transcript = result[0], result[1]
                else:
                    raw_transcript = result
                    lean_transcript = result

        # Try transcribe_and_diarize (WhisperX native style)
        elif hasattr(transcriber, 'transcribe_and_diarize'):
            result = None
            basename = None
            try:
                # many implementations accept audio_file argument
                result, basename = transcriber.transcribe_and_diarize(
                    audio_file=audio_path,
                    language="auto",
                    hf_token=os.getenv('HF_TOKEN'),
                    model_size=os.getenv('WHISPER_MODEL_SIZE', "small"),
                    min_speakers=None,
                    max_speakers=None
                )
            except TypeError:
                # try alternate param name
                result, basename = transcriber.transcribe_and_diarize(audio_path)
            # Try to persist results via transcriber.save_results if available
            raw_path = None
            lean_path = None
            if result is not None:
                if hasattr(transcriber, 'save_results'):
                    try:
                        raw_path, lean_path = transcriber.save_results(result, basename or Path(audio_path).name)
                    except Exception as e:
                        log(f"save_results failed (non-fatal): {e}")
                # Normalize outputs
                raw_transcript = raw_path or json.dumps(result)
                lean_transcript = lean_path or raw_transcript

        # Last resort: generic transcribe() or transcribe_file()
        elif hasattr(transcriber, 'transcribe'):
            try:
                result = transcriber.transcribe(audio_path)
                if isinstance(result, tuple) and len(result) >= 2:
                    raw_transcript, lean_transcript = result[0], result[1]
                else:
                    raw_transcript = result
                    lean_transcript = result
            except Exception as e:
                raise RuntimeError(f"Transcription failed using transcribe(): {e}")

        else:
            raise RuntimeError("WhisperX transcriber does not expose a supported transcription method. Expected one of: transcribe_audio, transcribe_and_diarize, transcribe.")

        # Validate outputs
        if raw_transcript is None or lean_transcript is None:
            raise RuntimeError("Transcription produced no output")

        log(f"Transcription completed: {lean_transcript}")

        # Step 3: Translate (optional and skippable)
        translated_transcript = lean_transcript
        if not skip_translation and models.get('translator'):
            try:
                log("Starting translation...")
                with redirect_stdout(sys.stderr):
                    # If we have a path on disk, use transcript file translation
                    if isinstance(lean_transcript, str) and Path(lean_transcript).exists():
                        translated_transcript = models['translator'].translate_transcript(lean_transcript)
                    else:
                        # If it's JSON-like, use JSON translators; else fallback to text
                        try:
                            parsed = json.loads(lean_transcript) if isinstance(lean_transcript, str) else lean_transcript
                        except Exception:
                            parsed = None
                        if isinstance(parsed, dict):
                            translated_transcript = models['translator'].translate_json(parsed)
                        elif isinstance(lean_transcript, str):
                            translated_transcript = models['translator'].translate_text(lean_transcript)
                        else:
                            translated_transcript = lean_transcript
                log(f"Translation completed: {translated_transcript}")
            except Exception as e:
                log(f"Translation failed, using original: {e}")
        else:
            if skip_translation:
                log("Skipping translation step (skip_translation=True)")

        # Step 4: Clinical extraction (optional and skippable)
        clinical_result = None
        if not skip_clinical and models.get('clinical'):
            try:
                log("Starting clinical extraction...")
                with redirect_stdout(sys.stderr):
                    # If translator returned a path string, try to open; otherwise pass object
                    transcript_data = None
                    if isinstance(translated_transcript, str) and Path(translated_transcript).exists():
                        with open(translated_transcript, 'r', encoding='utf-8') as f:
                            transcript_data = json.load(f)
                    else:
                        # assume translated_transcript is JSON-like string or dict
                        try:
                            transcript_data = json.loads(translated_transcript)
                        except Exception:
                            transcript_data = translated_transcript

                    clinical_result = models['clinical'].extract_clinical_info(transcript_data)
                    # Save clinical result
                    input_filename = Path(translated_transcript if isinstance(translated_transcript, str) else "transcript").stem.replace('_translated', '')
                    clinical_filename = f"{input_filename}_clinical_{int(time.time())}.json"
                    clinical_path = clinical_dir / clinical_filename
                    with open(clinical_path, 'w', encoding='utf-8') as f:
                        json.dump(clinical_result, f, indent=2, ensure_ascii=False)
                log(f"Clinical extraction completed: {clinical_path}")
            except Exception as e:
                log(f"Clinical extraction failed: {e}")
        else:
            if skip_clinical:
                log("Skipping clinical extraction step (skip_clinical=True)")

        # Return results
        result = {
            "success": True,
            "raw_transcript": str(raw_transcript),
            "lean_transcript": str(lean_transcript),
            "translated_transcript": str(translated_transcript),
            "clinical_extraction": str(clinical_result) if clinical_result else None,
            "processing_time": time.time()
        }

        log(f"Pipeline completed successfully for job {job_id}")
        return result

    except Exception as e:
        log(f"Pipeline failed for job {job_id}: {e}")
        return {
            "success": False,
            "error": str(e),
            "trace": traceback.format_exc()
        }

def background_load_and_warmup():
    """Load and warm up models in background thread"""
    global models
    try:
        log("BACKGROUND: Starting model loading...")
        loaded = load_models()  # existing function returns dict
        with models_lock:
            models.update(loaded)
        log("BACKGROUND: Models loaded, starting warmup...")
        # do warmup (existing warmup_models)
        try:
            warmup_models(models)
        except Exception as e:
            log(f"Warmup failed: {e}")
        models_ready_event.set()
        log("Background model load completed")
        
        # Send health status after models are loaded
        try:
            send_response({
                "status": "ok",
                "ready": models_ready_event.is_set(),
                "models_loaded": {
                    "whisperx": models.get('whisperx') is not None,
                    "translator": models.get('translator') is not None,
                    "clinical": models.get('clinical') is not None,
                    "s3": models.get('s3') is not None
                },
                "models_initialization_done": models_ready_event.is_set(),
                "model_errors": list(models_loading_errors)
            })
        except Exception as e:
            log(f"Failed to send health status: {e}")
    except Exception as e:
        with models_lock:
            models_loading_errors.append(str(e))
        log(f"Background model load failed: {e}")
        models_ready_event.set()

def warmup_models(models: Dict[str, Any]):
    """Warm up models with dummy data to trigger JIT compilation"""
    log("Starting model warmup...")

    try:
        # Warmup WhisperX with a short dummy audio where possible
        if models.get('whisperx'):
            log("Warming up WhisperX model...")
            try:
                import numpy as np
                dummy_audio = np.random.randn(16000).astype(np.float32)
                tx = models['whisperx']
                # try common warmup entrypoints safely
                if hasattr(tx, 'transcribe'):
                    try:
                        tx.transcribe(dummy_audio)
                        log("WhisperX warmup completed via transcribe(dummy_audio)")
                    except Exception:
                        pass
                if hasattr(tx, 'transcribe_audio'):
                    try:
                        # if transcribe_audio expects a path, skip; else try
                        tx.transcribe_audio(dummy_audio)
                        log("WhisperX warmup completed via transcribe_audio(dummy_audio)")
                    except Exception:
                        pass
                # We don't fail warmup if none of these work
            except Exception as e:
                log(f"WhisperX warmup failed (non-critical): {e}")

        # Warmup clinical extractor (skip heavy inference to avoid noise/logs)
        if models.get('clinical'):
            log("Warming up clinical extractor (skipping heavy inference)...")
            try:
                ce = models['clinical']
                # Optionally touch a lightweight method if available
                if hasattr(ce, 'create_extraction_prompt'):
                    with redirect_stdout(sys.stderr):
                        ce.create_extraction_prompt("Warmup prompt: patient complains of cough.")
                log("Clinical extractor warmup completed (no inference)")
            except Exception as e:
                log(f"Clinical extractor warmup skipped/failed (non-critical): {e}")

        # Warmup translator (use safe text translation, redirect prints to stderr)
        if models.get('translator'):
            log("Warming up translator...")
            try:
                tr = models['translator']
                if hasattr(tr, 'translate_text'):
                    with redirect_stdout(sys.stderr):
                        tr.translate_text("Hello world")
                log("Translator warmup attempted")
            except Exception as e:
                log(f"Translator warmup failed (non-critical): {e}")

        log("Model warmup completed (attempted)")

    except Exception as e:
        log(f"Model warmup failed: {e}")
        # Don't raise - warmup failures are non-critical

def send_response(msg: Dict[str, Any]):
    """Send JSON response to stdout"""
    try:
        sys.stdout.write(json.dumps(msg, separators=(",", ":")) + "\n")
        sys.stdout.flush()
    except Exception as e:
        log(f"Error sending response: {e}")

def process_command(models: Dict[str, Any], line: str):
    """Process a single command from stdin"""
    try:
        req = json.loads(line)
        cmd = req.get("cmd")

        if cmd == "run":
            # if models not loaded yet, still accept job but queue or run (your run_pipeline will error if models missing)
            job_id = req.get("job_id") or str(uuid.uuid4())
            audio_input = req.get("audio_path") or req.get("audio_s3_path")
            if not audio_input:
                send_response({"job_id": job_id, "status": "failed", "error": "Missing audio_path or audio_s3_path"})
                return
            # Respect optional skip flags (default: skip clinical)
            skip_translation = bool(req.get("skip_translation", False))
            skip_clinical = bool(req.get("skip_clinical", True))
            result = run_pipeline(models, audio_input, job_id, skip_translation=skip_translation, skip_clinical=skip_clinical)
            if result.get("success"):
                send_response({"job_id": job_id, "status": "done", "result": result})
            else:
                send_response({"job_id": job_id, "status": "failed", "error": result.get("error", "Unknown error"), "trace": result.get("trace")})
            return

        if cmd == "health":
            send_response({
                "status": "ok",
                # ready is true only after background initialization completes
                "ready": models_ready_event.is_set(),
                "models_loaded": {
                    "whisperx": models.get('whisperx') is not None,
                    "translator": models.get('translator') is not None,
                    "clinical": models.get('clinical') is not None,
                    "s3": models.get('s3') is not None
                },
                "models_initialization_done": models_ready_event.is_set(),
                "model_errors": list(models_loading_errors)
            })
            return

        send_response({"status": "error", "error": f"Unknown command: {cmd}"})
    except Exception as e:
        send_response({"status": "error", "error": str(e), "trace": traceback.format_exc()})

def main():
    """Main server loop"""
    log("Pipeline server starting (health available immediately)...")

    # start background model loader (non-blocking)
    bg = threading.Thread(target=background_load_and_warmup, daemon=True)
    bg.start()

    log("Pipeline server ready - listening for commands on stdin")

    # Main command loop remains -- but update health path to report model status
    try:
        for raw_line in sys.stdin:
            line = raw_line.strip()
            if not line:
                continue

            # health handling will use the global models mapping
            process_command(models, line)
    except KeyboardInterrupt:
        log("Pipeline server shutting down...")
    except Exception as e:
        log(f"Pipeline server error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
