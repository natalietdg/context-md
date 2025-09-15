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
from pathlib import Path
from typing import Optional, Dict, Any

# Add parent directory to path to import s3_downloader
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from aws.s3_downloader import S3AudioDownloader

# Optional .env support - load from project root
try:
    from dotenv import load_dotenv
    project_root = Path(__file__).parent.parent
    env_path = project_root / '.env'
    load_dotenv(env_path)
except ImportError:
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
        
        Args:
            device: Device to use ('auto', 'cpu', 'cuda')
            compute_type: Compute type ('auto', 'float16', 'int8')
            cache_dir: Directory for caching downloaded audio files
        """
        self.device = self._get_device(device)
        self.compute_type = self._get_compute_type(compute_type)
        self.batch_size = 16  # Default batch size
        
        # Initialize S3 downloader
        if cache_dir is None:
            cache_dir = os.path.join(os.path.dirname(__file__), "..", "audio_cache")
        self.s3_downloader = S3AudioDownloader(cache_dir=cache_dir)
        
        # Output directory for transcripts
        self.output_dir = os.path.join(os.path.dirname(__file__), "transcript_output")
        Path(self.output_dir).mkdir(parents=True, exist_ok=True)
        
        print(f"🚀 WhisperX Transcriber initialized")
        print(f"   Device: {self.device}")
        print(f"   Compute type: {self.compute_type}")
        print(f"   Cache directory: {cache_dir}")
        print(f"   Output directory: {self.output_dir}")
    
    def _get_device(self, device: str) -> str:
        """Determine the best device to use"""
        if device != "auto":
            return device
        
        if torch.cuda.is_available():
            print("🔥 CUDA available, using GPU")
            return "cuda"
        else:
            print("💻 Using CPU")
            return "cpu"
    
    def _get_compute_type(self, compute_type: str) -> str:
        """Determine the best compute type"""
        if compute_type != "auto":
            return compute_type
        
        if self.device == "cuda":
            return "float16"  # GPU supports float16
        else:
            return "int8"     # CPU works better with int8
    
    def _get_audio_path(self, audio_input: str) -> str:
        """
        Get local audio file path, downloading from S3 if necessary
        
        Args:
            audio_input: Local file path or S3 URI/path
            
        Returns:
            Local file path to audio file
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
    
    def transcribe_and_diarize(self, audio_input: str, language: str = "auto", 
                              hf_token: Optional[str] = None, model_size: str = "large-v2", 
                              min_speakers: Optional[int] = None, max_speakers: Optional[int] = None) -> Dict[str, Any]:
        """
        Main transcription and diarization pipeline following the provided WhisperX code structure
        
        Args:
            audio_input: Local audio file path or S3 URI/path
            language: Language code ('auto', 'en', 'ms', 'zh', etc.) or 'auto' for detection
            hf_token: HuggingFace token for speaker diarization (YOUR_HF_TOKEN)
            model_size: WhisperX model size (default: large-v2)
            min_speakers: Minimum number of speakers (optional)
            max_speakers: Maximum number of speakers (optional)
            
        Returns:
            Dictionary containing transcription results with speaker labels
        """
        
        # Get local audio file path
        audio_file = self._get_audio_path(audio_input)
        
        print(f"\n🎵 Processing audio: {audio_file}")
        print(f"🤖 Model: {model_size}")
        print(f"🌍 Language: {language}")
        print(f"⚙️ Device: {self.device}, Compute type: {self.compute_type}")
        
        # 1. Transcribe with original whisper (batched)
        print("\n📝 Step 1: Loading WhisperX model and transcribing...")
        model = whisperx.load_model(model_size, self.device, compute_type=self.compute_type)
        
        audio = whisperx.load_audio(audio_file)
        
        # Transcribe with language specification
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
        
        # Optional: delete model if low on GPU resources
        if self.device == "cuda":
            del model
            gc.collect()
            torch.cuda.empty_cache()
        
        # 2. Align whisper output
        print("\n⏰ Step 2: Loading alignment model and aligning...")
        try:
            model_a, metadata = whisperx.load_align_model(language_code=detected_language, device=self.device)
            result = whisperx.align(result["segments"], model_a, metadata, audio, self.device, return_char_alignments=False)
            print("✅ Alignment completed")
            
            # Optional: delete alignment model if low on GPU resources  
            if self.device == "cuda":
                del model_a
                gc.collect()
                torch.cuda.empty_cache()
                
        except Exception as e:
            print(f"⚠️ Alignment failed: {e}")
            print("Continuing without alignment...")
        
        # 3. Assign speaker labels
        if hf_token:
            print("\n👥 Step 3: Loading diarization model and assigning speakers...")
            try:
                diarize_model = whisperx.diarize.DiarizationPipeline(use_auth_token=hf_token, device=self.device)
                
                # Add min/max number of speakers if known
                diarize_kwargs = {}
                if min_speakers is not None:
                    diarize_kwargs['min_speakers'] = min_speakers
                if max_speakers is not None:
                    diarize_kwargs['max_speakers'] = max_speakers
                
                diarize_segments = diarize_model(audio, **diarize_kwargs)
                
                result = whisperx.assign_word_speakers(diarize_segments, result)
                print("✅ Speaker diarization completed")
                
                # Print diarization info
                print("\n📊 Diarization Results:")
                speakers = set()
                for segment in result.get("segments", []):
                    if "speaker" in segment:
                        speakers.add(segment["speaker"])
                print(f"   Found {len(speakers)} speakers: {', '.join(sorted(speakers))}")
                
            except Exception as e:
                print(f"⚠️ Speaker diarization failed: {e}")
                print("Continuing without speaker labels...")
                print("Make sure to:")
                print("  1. Set valid HuggingFace token")
                print("  2. Accept license at: https://hf.co/pyannote/speaker-diarization-3.1")
        else:
            print("\n⚠️ No HuggingFace token provided, skipping speaker diarization")
            print("Set HF_TOKEN environment variable or pass --hf-token to enable diarization")
        
        # Update result with language info
        result['language'] = detected_language
        result['detected_language'] = detected_language
        
        return result, os.path.basename(audio_file)
    
    def save_results(self, result: Dict[str, Any], base_filename: str):
        """
        Save transcription results to JSON file in transcript_output directory
        
        Args:
            result: WhisperX transcription results
            base_filename: Base filename for output files
        """
        # Generate timestamped filename
        timestamp = int(time.time())
        base_name = Path(base_filename).stem
        
        # Save JSON result (following existing naming convention)
        json_file = Path(self.output_dir) / f"{base_name}_whisperx_{timestamp}.json"
        
        try:
            with open(json_file, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            print(f"\n💾 Results saved to: {json_file}")
            
            # Print summary
            if 'segments' in result:
                total_segments = len(result['segments'])
                speakers = set()
                total_text = []
                
                for segment in result['segments']:
                    if 'speaker' in segment:
                        speakers.add(segment['speaker'])
                    total_text.append(segment.get('text', ''))
                
                print(f"📊 Summary:")
                print(f"   Segments: {total_segments}")
                print(f"   Speakers: {len(speakers)} ({', '.join(sorted(speakers)) if speakers else 'None'})")
                print(f"   Language: {result.get('language', 'Unknown')}")
                print(f"   Total text length: {len(' '.join(total_text))} characters")
            
            return str(json_file)
            
        except Exception as e:
            print(f"❌ Failed to save results: {e}")
            raise


def main():
    """Command line interface"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Transcribe and diarize audio files using WhisperX with S3 integration'
    )
    parser.add_argument(
        'audio_input',
        help='Audio file path (local or S3 URI/path)'
    )
    parser.add_argument(
        '--language', '-l',
        default='auto',
        help='Language code (auto, en, ms, zh, etc.) - default: auto-detect'
    )
    parser.add_argument(
        '--hf-token',
        help='HuggingFace token for speaker diarization (or set HF_TOKEN env var)'
    )
    parser.add_argument(
        '--model-size', '-m',
        choices=['tiny', 'base', 'small', 'medium', 'large-v1', 'large-v2', 'large-v3'],
        default='large-v2',
        help='WhisperX model size (default: large-v2)'
    )
    parser.add_argument(
        '--device',
        choices=['auto', 'cpu', 'cuda'],
        default='auto',
        help='Device to use (default: auto)'
    )
    parser.add_argument(
        '--compute-type',
        choices=['auto', 'float16', 'int8'],
        default='auto',
        help='Compute type (default: auto)'
    )
    parser.add_argument(
        '--min-speakers',
        type=int,
        help='Minimum number of speakers'
    )
    parser.add_argument(
        '--max-speakers', 
        type=int,
        help='Maximum number of speakers'
    )
    parser.add_argument(
        '--cache-dir', '-c',
        help='Cache directory for downloaded audio files'
    )
    
    args = parser.parse_args()
    
    # Get HF token from argument or environment
    hf_token = args.hf_token or os.getenv('HF_TOKEN')
    
    try:
        # Create transcriber
        transcriber = WhisperXTranscriber(
            device=args.device,
            compute_type=args.compute_type,
            cache_dir=args.cache_dir
        )
        
        # Process audio
        result, filename = transcriber.transcribe_and_diarize(
            audio_input=args.audio_input,
            language=args.language,
            hf_token=hf_token,
            model_size=args.model_size,
            min_speakers=args.min_speakers,
            max_speakers=args.max_speakers
        )
        
        # Save results
        output_file = transcriber.save_results(result, filename)
        
        print(f"\n🎉 Transcription completed successfully!")
        print(f"📄 Results saved to: {output_file}")
        
    except KeyboardInterrupt:
        print("\n⏹️ Processing interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Processing failed: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main() 