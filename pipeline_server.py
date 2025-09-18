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

# Add project directories to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "aws"))
sys.path.insert(0, str(project_root / "whisperX"))
sys.path.insert(0, str(project_root / "sealion"))
sys.path.insert(0, str(project_root / "clinical_extractor_llm"))

# Global variables for non-blocking startup
_models: Dict[str, Any] = {}
_models_ready = Event()

def log(message: str):
    """Log to stderr for debugging"""
    print(f"[PIPELINE] {message}", file=sys.stderr, flush=True)

def load_models():
    """Load and initialize all ML models"""
    log("Starting model loading...")
    
    models = {}
    
    try:
        # Import and initialize WhisperX
        log("Loading WhisperX...")
        from whisperX.whisperx_transcriber import WhisperXTranscriber
        models['whisperx'] = WhisperXTranscriber(cache_dir=str(project_root / "audio_cache"))
        log("✅ WhisperX loaded successfully")
    except Exception as e:
        log(f"❌ WhisperX loading failed: {e}")
        models['whisperx'] = None
    
    try:
        # Import and initialize SEA-LION translator
        log("Loading SEA-LION translator...")
        from sealion.translator import SEALionTranslator
        sealion_api_key = os.getenv('SEALION_API_KEY')
        if sealion_api_key:
            models['translator'] = SEALionTranslator(api_key=sealion_api_key)
            log("✅ SEA-LION translator loaded successfully")
        else:
            log("⚠️ SEALION_API_KEY not set, translator disabled")
            models['translator'] = None
    except Exception as e:
        log(f"❌ SEA-LION translator loading failed: {e}")
        models['translator'] = None
    
    try:
        # Import and initialize Clinical Extractor
        log("Loading Clinical Extractor...")
        from clinical_extractor_llm.extractor import ClinicalExtractorLLM
        models['clinical'] = ClinicalExtractorLLM(model_name="microsoft/DialoGPT-medium")
        log("✅ Clinical Extractor loaded successfully")
    except Exception as e:
        log(f"❌ Clinical Extractor loading failed: {e}")
        models['clinical'] = None
    
    try:
        # Import S3 downloader
        log("Loading S3 downloader...")
        from aws.s3_downloader import S3AudioDownloader
        models['s3'] = S3AudioDownloader(cache_dir=str(project_root / "audio_cache"))
        log("✅ S3 downloader loaded successfully")
    except Exception as e:
        log(f"❌ S3 downloader loading failed: {e}")
        models['s3'] = None
    
    log("Model loading completed")
    return models

def run_pipeline(models: Dict[str, Any], audio_input: str, job_id: str) -> Dict[str, Any]:
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
        if audio_input.startswith('s3://') and models['s3']:
            log(f"Downloading from S3: {audio_input}")
            audio_path = models['s3'].download_audio_file(audio_input, use_cache=True)
        else:
            audio_path = audio_input
            if not Path(audio_path).exists():
                raise FileNotFoundError(f"Audio file not found: {audio_path}")
        
        log(f"Processing audio file: {audio_path}")
        
        # Step 2: Transcribe with WhisperX
        if not models['whisperx']:
            raise RuntimeError("WhisperX not available")
        
        log("Starting transcription...")
        raw_transcript, lean_transcript = models['whisperx'].transcribe_audio(
            audio_path=audio_path,
            language="auto",
            model_size="base",
            min_speakers=None,
            max_speakers=None
        )
        log(f"Transcription completed: {lean_transcript}")
        
        # Step 3: Translate (optional)
        translated_transcript = lean_transcript
        if models['translator']:
            try:
                log("Starting translation...")
                translated_transcript = models['translator'].translate_transcript(lean_transcript)
                log(f"Translation completed: {translated_transcript}")
            except Exception as e:
                log(f"Translation failed, using original: {e}")
        
        # Step 4: Clinical extraction (optional)
        clinical_result = None
        if models['clinical']:
            try:
                log("Starting clinical extraction...")
                # Read the translated transcript file
                with open(translated_transcript, 'r', encoding='utf-8') as f:
                    transcript_data = json.load(f)
                
                clinical_result = models['clinical'].extract_clinical_info(transcript_data)
                
                # Save clinical result
                input_filename = Path(translated_transcript).stem.replace('_translated', '')
                clinical_filename = f"{input_filename}_clinical.json"
                clinical_path = clinical_dir / clinical_filename
                
                with open(clinical_path, 'w', encoding='utf-8') as f:
                    json.dump(clinical_result, f, indent=2, ensure_ascii=False)
                
                log(f"Clinical extraction completed: {clinical_path}")
            except Exception as e:
                log(f"Clinical extraction failed: {e}")
        
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

def _background_load_and_warmup():
    """Load and warm up models in background thread"""
    global _models
    try:
        log("BACKGROUND: Starting model loading...")
        _models = load_models()              # may take a while
        log("BACKGROUND: Models loaded, starting warmup...")
        warmup_models(_models)               # may JIT; may take a while
        _models_ready.set()
        log("BACKGROUND: models loaded and warmed up")
    except Exception as e:
        log(f"BACKGROUND: model load/warmup failed: {e}")
        # keep _models as whatever loaded (possibly partial)
        _models_ready.set()  # set anyway to avoid indefinite waiting

def warmup_models(models: Dict[str, Any]):
    """Warm up models with dummy data to trigger JIT compilation"""
    log("Starting model warmup...")
    
    try:
        # Warmup WhisperX with a short dummy audio
        if models.get('whisperx'):
            log("Warming up WhisperX model...")
            import numpy as np
            # Create 1 second of dummy audio (16kHz)
            dummy_audio = np.random.randn(16000).astype(np.float32)
            try:
                result = models['whisperx'].transcribe(dummy_audio, batch_size=1)
                log("WhisperX warmup completed")
            except Exception as e:
                log(f"WhisperX warmup failed (non-critical): {e}")
        
        # Warmup clinical extractor
        if models.get('clinical'):
            log("Warming up clinical extractor...")
            try:
                dummy_text = "Patient presents with mild symptoms."
                result = models['clinical'].extract_clinical_info(dummy_text)
                log("Clinical extractor warmup completed")
            except Exception as e:
                log(f"Clinical extractor warmup failed (non-critical): {e}")
        
        # Warmup translator
        if models.get('translator'):
            log("Warming up translator...")
            try:
                dummy_text = "Hello world"
                result = models['translator'].translate(dummy_text, source_lang='en', target_lang='zh')
                log("Translator warmup completed")
            except Exception as e:
                log(f"Translator warmup failed (non-critical): {e}")
        
        log("Model warmup completed successfully")
        
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
            result = run_pipeline(models, audio_input, job_id)
            if result.get("success"):
                send_response({"job_id": job_id, "status": "done", "result": result})
            else:
                send_response({"job_id": job_id, "status": "failed", "error": result.get("error", "Unknown error"), "trace": result.get("trace")})
            return

        if cmd == "health":
            send_response({
                "status": "ok",
                "ready": _models_ready.is_set(),
                "models_loaded": {
                    "whisperx": bool(_models.get('whisperx')),
                    "translator": bool(_models.get('translator')),
                    "clinical": bool(_models.get('clinical')),
                    "s3": bool(_models.get('s3')),
                }
            })
            return

        send_response({"status": "error", "error": f"Unknown command: {cmd}"})
    except Exception as e:
        send_response({"status": "error", "error": str(e), "trace": traceback.format_exc()})

def main():
    """Main server loop"""
    log("Pipeline server starting (non-blocking load)...")

    # launch background loader immediately, do NOT block
    loader = threading.Thread(target=_background_load_and_warmup, daemon=True)
    loader.start()

    log("Pipeline server listening for commands on stdin")
    # use the same command loop, but use global _models
    try:
        for raw_line in sys.stdin:
            line = raw_line.strip()
            if not line:
                continue
            process_command(_models, line)
    except KeyboardInterrupt:
        log("Pipeline server shutting down...")
    except Exception as e:
        log(f"Pipeline server error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
