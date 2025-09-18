#!/usr/bin/env python3
"""
WhisperX Transcriber
Transcribes and diarizes audio files using WhisperX with S3 integration.
Based on standard WhisperX workflow with speaker diarization.
"""

import os
import sys
import json
import time
import gc
import shutil
from pathlib import Path
from typing import Optional, Dict, Any, Tuple

# ensure repo root is importable (for aws.s3_downloader)
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

from aws.s3_downloader import S3AudioDownloader

# Optional .env support - load from project root
try:
    from dotenv import load_dotenv
    env_path = project_root / '.env'
    load_dotenv(env_path)
except Exception:
    # it's OK if dotenv is not installed
    pass

try:
    import whisperx
    import torch
    print("✅ WhisperX and PyTorch loaded successfully")
except ImportError as e:
    print(f"❌ Required libraries not found: {e}")
    print("Please install with: pip install git+https://github.com/m-bain/whisperx.git torch")
    sys.exit(1)


class WhisperXTranscriber:
    """WhisperX transcriber with S3 integration and speaker diarization"""

    def __init__(self, device: str = "auto", compute_type: str = "auto", cache_dir: str = None):
        """
        Initialize WhisperX transcriber
        """
        self.device = self._get_device(device)
        self.compute_type = self._get_compute_type(compute_type)
        self.batch_size = 16  # Default batch size

        # Initialize S3 downloader
        if cache_dir is None:
            cache_dir = str(project_root / "audio_cache")
        self.s3_downloader = S3AudioDownloader(cache_dir=cache_dir)

        # Output directories for transcripts - using project outputs structure
        self.output_dir = project_root / "outputs" / "00_transcripts"
        self.output_dir_lean = project_root / "outputs" / "01_transcripts_lean"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.output_dir_lean.mkdir(parents=True, exist_ok=True)

        print(f"🚀 WhisperX Transcriber initialized")
        print(f"   Device: {self.device}")
        print(f"   Compute type: {self.compute_type}")
        print(f"   Cache directory: {cache_dir}")
        print(f"   Output directory: {self.output_dir}")

    def _get_device(self, device: str) -> str:
        """Determine the best device to use"""
        if device != "auto":
            return device

        try:
            if torch.cuda.is_available():
                print("🔥 CUDA available, using GPU")
                return "cuda"
        except Exception:
            pass
        print("💻 Using CPU")
        return "cpu"

    def _get_compute_type(self, compute_type: str) -> str:
        """Determine the best compute type"""
        if compute_type != "auto":
            return compute_type
        if self.device == "cuda":
            return "float16"
        else:
            return "int8"

    def _get_audio_path(self, audio_input: str) -> str:
        """
        Get local audio file path, downloading from S3 if necessary
        """
        # Check if it's a local file that exists
        if os.path.exists(audio_input):
            print(f"📁 Using local file: {audio_input}")
            return audio_input

        # Assume it's an S3 path/URI and download it
        print(f"☁️ Downloading from S3: {audio_input}")
        try:
            local_path = self.s3_downloader.download_audio_file(audio_input)
            print(f"✅ Downloaded to: {local_path}")
            return local_path
        except Exception as e:
            print(f"❌ Failed to download audio file: {e}")
            raise

    def transcribe_and_diarize(
        self,
        audio_input: str,
        language: str = "auto",
        hf_token: Optional[str] = None,
        model_size: str = "large-v2",
        min_speakers: Optional[int] = None,
        max_speakers: Optional[int] = None
    ) -> Tuple[Dict[str, Any], str]:
        """Transcribe and diarize audio with ffmpeg fallback handling"""

        # Check ffmpeg
        if not shutil.which('ffmpeg'):
            raise RuntimeError(
                "ffmpeg is required for audio processing but not found. "
                "Install ffmpeg on the instance (apt/yum) or provide static binary."
            )

        # Get local audio file path (handles s3 URIs)
        audio_file = self._get_audio_path(audio_input)

        print(f"\n🎵 Processing audio: {audio_file}")
        print(f"🤖 Model: {model_size}")
        print(f"🌍 Language: {language}")
        print(f"⚙️ Device: {self.device}, Compute type: {self.compute_type}")

        # 1. Transcribe with WhisperX
        print("\n📝 Step 1: Loading WhisperX model and transcribing...")
        model = whisperx.load_model(model_size, device=self.device, compute_type=self.compute_type)

        # whisperx.load_audio expects a file path or URL depending on version
        audio = whisperx.load_audio(str(audio_file))

        if language == "auto":
            result = model.transcribe(audio, batch_size=self.batch_size)
            detected_language = result.get("language", "en")
            print("✅ Initial transcription completed (auto-detect)")
            print(f"🌍 Detected language: {detected_language}")
        else:
            result = model.transcribe(audio, batch_size=self.batch_size, language=language)
            detected_language = language
            print("✅ Initial transcription completed")
            print(f"🌍 Using specified language: {detected_language}")

        # Optionally free model if using GPU and memory is tight
        try:
            if self.device == "cuda":
                del model
                gc.collect()
                torch.cuda.empty_cache()
        except Exception:
            pass

        # 2. Align whisper output (optional, wrapped in try/except)
        print("\n⏰ Step 2: Loading alignment model and aligning...")
        try:
            model_a, metadata = whisperx.load_align_model(language_code=detected_language, device=self.device)
            result = whisperx.align(result["segments"], model_a, metadata, audio, self.device, return_char_alignments=False)
            print("✅ Alignment completed")
            try:
                if self.device == "cuda":
                    del model_a
                    gc.collect()
                    torch.cuda.empty_cache()
            except Exception:
                pass
        except Exception as e:
            print(f"⚠️ Alignment failed: {e}")
            print("Continuing without alignment...")

        # 3. Assign speaker labels (optional)
        if hf_token:
            print("\n👥 Step 3: Loading diarization model and assigning speakers...")
            try:
                # whisperx/pyannote interface changes across versions; this is best-effort and wrapped
                diarize_model = whisperx.diarize.DiarizationPipeline(use_auth_token=hf_token, device=self.device)
                diarize_kwargs = {}
                if min_speakers is not None:
                    diarize_kwargs['min_speakers'] = min_speakers
                if max_speakers is not None:
                    diarize_kwargs['max_speakers'] = max_speakers

                diarize_segments = diarize_model(str(audio_file), **diarize_kwargs)
                result = whisperx.assign_word_speakers(diarize_segments, result)
                print("✅ Speaker diarization completed")
            except Exception as e:
                print(f"⚠️ Speaker diarization failed: {e}")
                print("Continuing without speaker labels...")
        else:
            print("\n⚠️ No HuggingFace token provided, skipping speaker diarization")

        # Update detection info
        result['language'] = detected_language
        result['detected_language'] = detected_language

        return result, os.path.basename(audio_file)

    def extract_clean_format(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Extract clean format from WhisperX results"""
        # Extract unique languages
        languages = set()
        
        # Add main language if available
        if 'language' in result:
            languages.add(result['language'])
        if 'detected_language' in result:
            languages.add(result['detected_language'])
        
        # Process segments to create turns
        turns = []
        turn_id = 1
        current_speaker = None
        current_text_parts = []
        
        # Process segments
        for segment in result.get('segments', []):
            segment_text = segment.get('text', '').strip()
            if not segment_text:
                continue
            
            # Get speaker from words if available
            segment_speaker = None
            words = segment.get('words', [])
            
            if words:
                # Find the most common speaker in this segment
                speaker_counts = {}
                for word in words:
                    if 'speaker' in word and word['speaker']:
                        speaker = word['speaker']
                        speaker_counts[speaker] = speaker_counts.get(speaker, 0) + 1
                
                if speaker_counts:
                    # Use the most frequent speaker in this segment
                    segment_speaker = max(speaker_counts.items(), key=lambda x: x[1])[0]
            
            # If no speaker detected, use a default
            if not segment_speaker:
                segment_speaker = "SPEAKER_UNKNOWN"
            
            # Check if this is a new turn (different speaker)
            if segment_speaker != current_speaker:
                # Save previous turn if exists
                if current_speaker is not None and current_text_parts:
                    turns.append({
                        "turn_id": turn_id,
                        "speaker": current_speaker,
                        "text": " ".join(current_text_parts).strip()
                    })
                    turn_id += 1
                
                # Start new turn
                current_speaker = segment_speaker
                current_text_parts = [segment_text]
            else:
                # Same speaker, append to current turn
                current_text_parts.append(segment_text)
        
        # Don't forget the last turn
        if current_speaker is not None and current_text_parts:
            turns.append({
                "turn_id": turn_id,
                "speaker": current_speaker,
                "text": " ".join(current_text_parts).strip()
            })
        
        # Convert to sorted list for consistent output
        languages_list = sorted(list(languages)) if languages else ["unknown"]
        
        return {
            "languages_detected": languages_list,
            "turns": turns
        }
    
    def save_results(self, result: Dict[str, Any], base_filename: str):
        """Save transcription results to both raw and lean JSON formats"""
        import time
        import json
        
        # Generate timestamped filename
        timestamp = int(time.time())
        base_name = Path(base_filename).stem
        
        # File paths for both formats
        raw_json_file = self.output_dir / f"{base_name}_whisperx_{timestamp}.json"
        lean_json_file = self.output_dir_lean / f"{base_name}_lean_{timestamp}.json"
        
        try:
            # Save raw JSON result (existing format)
            with open(raw_json_file, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            print(f"\n💾 Raw results saved to: {raw_json_file}")
            
            # Extract and save clean format
            clean_result = self.extract_clean_format(result)
            with open(lean_json_file, 'w', encoding='utf-8') as f:
                json.dump(clean_result, f, indent=2, ensure_ascii=False)
            print(f"💾 Clean results saved to: {lean_json_file}")
            
            # Print summary
            if 'segments' in result:
                total_segments = len(result['segments'])
                speakers = set()
                total_text = []
                
                # Extract speakers from segments
                for segment in result['segments']:
                    words = segment.get('words', [])
                    for word in words:
                        if 'speaker' in word and word['speaker']:
                            speakers.add(word['speaker'])
                    total_text.append(segment.get('text', ''))
                
                print(f"\n📊 Summary:")
                print(f"   Segments: {total_segments}")
                print(f"   Speakers: {len(speakers)} ({', '.join(sorted(speakers)) if speakers else 'None'})")
                print(f"   Language: {result.get('language', 'Unknown')}")
                print(f"   Turns: {len(clean_result['turns'])}")
                print(f"   Languages detected: {clean_result['languages_detected']}")
                print(f"   Total text length: {len(' '.join(total_text))} characters")
            
            return str(raw_json_file), str(lean_json_file)
            
        except Exception as e:
            print(f"❌ Failed to save results: {e}")
            raise
