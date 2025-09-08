#!/usr/bin/env python3
"""
WhisperX Transcriber

Transcribes and diarizes audio files using WhisperX.
Supports English, Malay, and Chinese languages with speaker diarization.
"""

import os
import sys
import json
import time
from pathlib import Path
from typing import Optional, Dict, Any, List

# Optional .env support - load from project root
try:
    from dotenv import load_dotenv
    import os
    # Find project root (parent of whisperX folder)
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_path = os.path.join(project_root, '.env')
    load_dotenv(env_path)
except ImportError:
    pass

from audio_processor import AudioProcessor


class WhisperXTranscriber:
    """WhisperX transcriber with diarization support"""
    
    SUPPORTED_LANGUAGES = {
        'auto': None,  # Automatic detection
        'en': 'en',    # English
        'ms': 'ms',    # Malay 
        'zh': 'zh'     # Chinese
    }
    
    def __init__(self, device: str = "auto", compute_type: str = "auto"):
        """Initialize WhisperX transcriber"""
        self.device = self._get_device(device)
        self.compute_type = self._get_compute_type(compute_type, self.device)
        self.model = None
        self.align_model = None
        self.diarize_model = None
        self.audio_processor = AudioProcessor()
        
        print(f"🚀 Initializing WhisperX transcriber on device: {self.device}")
        self._load_whisperx()
    
    def _get_device(self, device: str) -> str:
        """Determine the best device to use"""
        if device != "auto":
            return device
        
        try:
            import torch
            if torch.cuda.is_available():
                return "cuda"
        except ImportError:
            pass
        
        return "cpu"
    
    def _get_compute_type(self, compute_type: str, device: str) -> str:
        """Determine the best compute type for the device"""
        if compute_type != "auto":
            return compute_type
        
        # Auto-select based on device
        if device == "cuda":
            return "float16"  # GPU supports float16
        else:
            return "int8"     # CPU works better with int8
    
    def _load_whisperx(self):
        """Load WhisperX library"""
        try:
            global whisperx
            import whisperx
            print("✅ WhisperX library loaded successfully")
        except ImportError as e:
            print("❌ WhisperX not found. Please install it with:")
            print("   pip install git+https://github.com/m-bain/whisperx.git")
            sys.exit(1)
    
    def load_model(self, model_size: str = "base"):
        """Load WhisperX model"""
        try:
            print(f"📦 Loading WhisperX model: {model_size}")
            self.model = whisperx.load_model(
                model_size, 
                device=self.device, 
                compute_type=self.compute_type
            )
            print("✅ WhisperX model loaded successfully")
        except Exception as e:
            print(f"❌ Failed to load WhisperX model: {e}")
            sys.exit(1)
    
    def load_alignment_model(self, language: str):
        """Load alignment model for precise word-level timestamps"""
        try:
            print(f"📦 Loading alignment model for language: {language}")
            self.align_model, self.metadata = whisperx.load_align_model(
                language_code=language, 
                device=self.device
            )
            print("✅ Alignment model loaded successfully")
        except Exception as e:
            print(f"⚠️  Could not load alignment model: {e}")
            self.align_model = None
            self.metadata = None
    
    def load_diarization_model(self, hf_token: Optional[str] = None):
        """Load speaker diarization model"""
        try:
            # Check for HuggingFace token
            token = hf_token or os.getenv('HF_TOKEN')
            if not token:
                print("⚠️  No HuggingFace token found. Speaker diarization will be skipped.")
                print("   Set HF_TOKEN environment variable or pass --hf-token argument")
                return
            
            print("📦 Loading speaker diarization model")
            from pyannote.audio import Pipeline
            self.diarize_model = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1", 
                use_auth_token=token
            )
            # Move to correct device
            if self.device == "cuda":
                import torch
                self.diarize_model.to(torch.device("cuda"))
            print("✅ Diarization model loaded successfully")
        except Exception as e:
            print(f"⚠️  Could not load diarization model: {e}")
            print("   Make sure to accept the license at: https://hf.co/pyannote/speaker-diarization-3.1")
            self.diarize_model = None
    
    def transcribe_audio(self, audio_path: str, language: str = "auto", 
                        batch_size: int = 16) -> Dict[str, Any]:
        """Transcribe audio file"""
        if not self.model:
            print("❌ Model not loaded. Call load_model() first.")
            return {}
        
        try:
            # Preprocess audio to optimal format (mono 16kHz WAV)
            processed_audio_path = self.audio_processor.preprocess_for_whisperx(audio_path)
            
            print(f"🎵 Loading processed audio: {processed_audio_path}")
            audio = whisperx.load_audio(processed_audio_path)
            
            print("🗣️  Transcribing audio...")
            if language == "auto":
                result = self.model.transcribe(audio, batch_size=batch_size)
                detected_language = result.get("language", "en")
                print(f"🌍 Detected language: {detected_language}")
            else:
                result = self.model.transcribe(
                    audio, 
                    batch_size=batch_size,
                    language=language
                )
                detected_language = language
            
            print("✅ Transcription completed")
            return result, detected_language, processed_audio_path
            
        except Exception as e:
            print(f"❌ Transcription failed: {e}")
            return {}, "en", audio_path
    
    def align_transcript(self, segments: List[Dict], audio_path: str, language: str):
        """Align transcript for word-level timestamps"""
        if not self.align_model:
            print("⚠️  Alignment model not loaded, skipping alignment")
            return segments
        
        try:
            print("⏰ Aligning transcript for word-level timestamps...")
            audio = whisperx.load_audio(audio_path)
            result = whisperx.align(
                segments, 
                self.align_model, 
                self.metadata, 
                audio, 
                self.device, 
                return_char_alignments=False
            )
            print("✅ Alignment completed")
            return result["segments"]
        except Exception as e:
            print(f"⚠️  Alignment failed: {e}")
            return segments
    
    def diarize_speakers(self, audio_path: str, min_speakers: int = 1, 
                        max_speakers: int = 10) -> Optional[Dict]:
        """Perform speaker diarization"""
        if not self.diarize_model:
            print("⚠️  Diarization model not loaded, skipping speaker diarization")
            return None
        
        try:
            print("👥 Performing speaker diarization...")
            # Use pyannote.audio pipeline directly
            diarize_segments = self.diarize_model(
                audio_path,
                min_speakers=min_speakers,
                max_speakers=max_speakers
            )
            print("✅ Speaker diarization completed")
            return diarize_segments
        except Exception as e:
            print(f"⚠️  Speaker diarization failed: {e}")
            return None
    
    def assign_speakers(self, segments: List[Dict], diarize_segments):
        """Assign speakers to transcript segments"""
        if not diarize_segments:
            return segments
        
        try:
            print("🏷️  Assigning speakers to transcript...")
            
            # Try WhisperX API first
            try:
                result = whisperx.assign_word_speakers(diarize_segments, segments)
                if result and "segments" in result:
                    print("✅ Speaker assignment completed (WhisperX API)")
                    return result["segments"]
            except Exception as e:
                print(f"   WhisperX API failed: {e}")
            
            # Fall back to manual assignment
            print("   Using manual speaker assignment...")
            return self._manual_assign_speakers(segments, diarize_segments)
            
        except Exception as e:
            print(f"⚠️  Speaker assignment failed: {e}")
            print("   Continuing without speaker labels...")
            return segments
    
    def _manual_assign_speakers(self, segments: List[Dict], diarize_segments):
        """Manually assign speakers based on timestamp overlap"""
        try:
            # Extract speaker timeline from diarization
            speaker_timeline = []
            if hasattr(diarize_segments, 'itertracks'):
                for turn, _, speaker in diarize_segments.itertracks(yield_label=True):
                    speaker_timeline.append({
                        'start': float(turn.start),
                        'end': float(turn.end),
                        'speaker': str(speaker)
                    })
            
            print(f"   Found {len(speaker_timeline)} speaker segments")
            
            # Assign speakers to transcript segments
            for segment in segments:
                segment_start = segment.get('start', 0)
                segment_end = segment.get('end', segment_start)
                
                # Find overlapping speaker
                best_speaker = None
                best_overlap = 0
                
                for speaker_seg in speaker_timeline:
                    # Calculate overlap
                    overlap_start = max(segment_start, speaker_seg['start'])
                    overlap_end = min(segment_end, speaker_seg['end'])
                    overlap = max(0, overlap_end - overlap_start)
                    
                    if overlap > best_overlap:
                        best_overlap = overlap
                        best_speaker = speaker_seg['speaker']
                
                # Assign speaker if found
                if best_speaker:
                    segment['speaker'] = best_speaker
            
            speakers_found = set(seg.get('speaker') for seg in segments if seg.get('speaker'))
            print(f"   Assigned speakers: {', '.join(speakers_found) if speakers_found else 'None'}")
            print("✅ Manual speaker assignment completed")
            
            return segments
            
        except Exception as e:
            print(f"   Manual assignment failed: {e}")
            return segments
    
    def save_results(self, result: Dict, audio_path: str, output_dir: str):
        """Save transcription results"""
        # Create output directory
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Generate base filename
        base_name = Path(audio_path).stem
        timestamp = int(time.time())
        
        # Save JSON result
        json_file = output_path / f"{base_name}_whisperx_{timestamp}.json"
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f"💾 Saved full result: {json_file}")
        
        # Save plain text transcript
        txt_file = output_path / f"{base_name}_transcript_{timestamp}.txt"
        with open(txt_file, 'w', encoding='utf-8') as f:
            if 'segments' in result:
                for segment in result['segments']:
                    if 'speaker' in segment:
                        f.write(f"[{segment['speaker']}]: {segment['text']}\n")
                    else:
                        f.write(f"{segment['text']}\n")
            else:
                f.write(result.get('text', ''))
        print(f"💾 Saved transcript: {txt_file}")
        
        # Save speaker-separated transcript if speakers detected
        if 'segments' in result and any('speaker' in seg for seg in result['segments']):
            speakers_file = output_path / f"{base_name}_speakers_{timestamp}.txt"
            with open(speakers_file, 'w', encoding='utf-8') as f:
                current_speaker = None
                for segment in result['segments']:
                    speaker = segment.get('speaker', 'Unknown')
                    if speaker != current_speaker:
                        f.write(f"\n--- Speaker {speaker} ---\n")
                        current_speaker = speaker
                    f.write(f"{segment['text']}\n")
            print(f"💾 Saved speaker-separated transcript: {speakers_file}")
    
    def process_audio_file(self, audio_path: str, language: str = "auto",
                          model_size: str = "base", enable_diarization: bool = True,
                          min_speakers: int = 1, max_speakers: int = 10,
                          batch_size: int = 16, hf_token: Optional[str] = None,
                          output_dir: Optional[str] = None) -> Dict[str, Any]:
        """Main method to process audio file with WhisperX"""
        
        print(f"🎵 Processing audio file: {audio_path}")
        print(f"📝 Language: {language}")
        print(f"🎯 Model size: {model_size}")
        print(f"👥 Diarization enabled: {enable_diarization}")
        
        # Set default output directory
        if not output_dir:
            output_dir = os.path.join(os.path.dirname(__file__), "transcript_output")
        
        # Load main model
        self.load_model(model_size)
        
        # Transcribe audio
        result, detected_language, processed_audio_path = self.transcribe_audio(
            audio_path, language, batch_size
        )
        
        if not result or 'segments' not in result:
            print("❌ No transcription results obtained")
            return {}
        
        segments = result['segments']
        
        # Load alignment model and align transcript
        self.load_alignment_model(detected_language)
        segments = self.align_transcript(segments, processed_audio_path, detected_language)
        
        # Perform speaker diarization if enabled
        if enable_diarization:
            self.load_diarization_model(hf_token)
            diarize_segments = self.diarize_speakers(
                processed_audio_path, min_speakers, max_speakers
            )
            segments = self.assign_speakers(segments, diarize_segments)
        
        # Update result with processed segments
        result['segments'] = segments
        result['detected_language'] = detected_language
        
        # Save results
        self.save_results(result, audio_path, output_dir)
        
        print("🎉 Audio processing completed!")
        return result


def main():
    """Main entry point for command line usage"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Transcribe and diarize audio files using WhisperX'
    )
    parser.add_argument(
        'audio_path',
        help='Path to audio file or S3 URI'
    )
    parser.add_argument(
        '--language', '-l',
        choices=['auto', 'en', 'ms', 'zh'],
        default='auto',
        help='Audio language (default: auto-detect)'
    )
    parser.add_argument(
        '--model-size', '-m',
        choices=['tiny', 'base', 'small', 'medium', 'large-v1', 'large-v2', 'large-v3'],
        default='base',
        help='WhisperX model size (default: base)'
    )
    parser.add_argument(
        '--device',
        choices=['auto', 'cpu', 'cuda'],
        default='auto',
        help='Device to use (default: auto)'
    )
    parser.add_argument(
        '--disable-diarization',
        action='store_true',
        help='Disable speaker diarization'
    )
    parser.add_argument(
        '--min-speakers',
        type=int,
        default=1,
        help='Minimum number of speakers (default: 1)'
    )
    parser.add_argument(
        '--max-speakers',
        type=int,
        default=10,
        help='Maximum number of speakers (default: 10)'
    )
    parser.add_argument(
        '--batch-size',
        type=int,
        default=16,
        help='Batch size for processing (default: 16)'
    )
    parser.add_argument(
        '--hf-token',
        help='HuggingFace token for diarization model'
    )
    parser.add_argument(
        '--output-dir', '-o',
        help='Output directory for results'
    )
    
    args = parser.parse_args()
    
    # Create transcriber
    transcriber = WhisperXTranscriber(
        device=args.device,
        compute_type="float16"
    )
    
    # Process audio file
    transcriber.process_audio_file(
        audio_path=args.audio_path,
        language=args.language,
        model_size=args.model_size,
        enable_diarization=not args.disable_diarization,
        min_speakers=args.min_speakers,
        max_speakers=args.max_speakers,
        batch_size=args.batch_size,
        hf_token=args.hf_token,
        output_dir=args.output_dir
    )


if __name__ == '__main__':
    main() 