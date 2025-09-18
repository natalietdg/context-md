#!/usr/bin/env python3
"""
Comprehensive Audio Processing Pipeline

This pipeline orchestrates the complete workflow:
1. Download audio from S3 using aws.s3_downloader
2. Transcribe audio using WhisperX to generate lean JSON
3. Translate transcript using SeaLion translator
4. Extract clinical information using LLM-based extractor

Usage:
    python pipeline.py s3://bucket/audio.mp3
    python pipeline.py audio_file.m4a --local
    python pipeline.py --help
"""

import os
import sys
import argparse
import json
import time
from pathlib import Path
from typing import Dict, Any, Optional, Tuple

print("🔍 DEBUG: Starting pipeline.py")
print(f"🔍 DEBUG: Python version: {sys.version}")
print(f"🔍 DEBUG: Current working directory: {os.getcwd()}")
print(f"🔍 DEBUG: Script location: {__file__}")

# Add project directories to Python path
project_root = Path(__file__).parent
print(f"🔍 DEBUG: Project root: {project_root}")

sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "aws"))
sys.path.insert(0, str(project_root / "whisperX"))
sys.path.insert(0, str(project_root / "sealion"))
sys.path.insert(0, str(project_root / "clinical_extractor_llm"))

print(f"🔍 DEBUG: Python path: {sys.path[:6]}")  # Show first 6 entries

# Import pipeline components
print("🔍 DEBUG: Attempting imports...")
try:
    print("🔍 DEBUG: Importing S3AudioDownloader...")
    from aws.s3_downloader import S3AudioDownloader
    print("✅ DEBUG: S3AudioDownloader imported successfully")
    
    print("🔍 DEBUG: Importing WhisperXTranscriber...")
    from whisperX.whisperx_transcriber import WhisperXTranscriber
    print("✅ DEBUG: WhisperXTranscriber imported successfully")
    
    print("🔍 DEBUG: Importing SEALionTranslator...")
    from sealion.translator import SEALionTranslator
    print("✅ DEBUG: SEALionTranslator imported successfully")
    
    print("🔍 DEBUG: Importing ClinicalExtractorLLM...")
    from clinical_extractor_llm.extractor import ClinicalExtractorLLM
    print("✅ DEBUG: ClinicalExtractorLLM imported successfully")
    
except ImportError as e:
    print(f"❌ Import error: {e}")
    print(f"🔍 DEBUG: Failed import details: {type(e).__name__}: {str(e)}")
    print("Make sure all required dependencies are installed.")
    import traceback
    traceback.print_exc()
    sys.exit(1)


class AudioProcessingPipeline:
    """Complete audio processing pipeline from S3 to clinical extraction"""
    
    def __init__(self, 
                 aws_region: Optional[str] = None,
                 cache_dir: Optional[str] = None,
                 sealion_api_key: Optional[str] = None,
                 hf_token: Optional[str] = None,
                 clinical_model: str = "Qwen/Qwen2.5-3B-Instruct"):
        """
        Initialize the pipeline with optional configuration
        
        Args:
            aws_region: AWS region for S3 access
            cache_dir: Directory for caching downloaded files
            sealion_api_key: SEA-LION API key for translation
            hf_token: HuggingFace token for speaker diarization
            clinical_model: Model name/path for clinical extraction
        """
        print("🚀 Initializing Audio Processing Pipeline...")
        
        # Set up cache directory
        if not cache_dir:
            cache_dir = project_root / "audio_cache"
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)
        
        # Set up output directories (aligned with WhisperX structure)
        self.output_dir = project_root / "outputs"
        self.transcripts_dir = self.output_dir / "00_transcripts"
        self.lean_dir = self.output_dir / "01_transcripts_lean"
        self.translated_dir = self.output_dir / "02_translated"
        self.clinical_dir = self.output_dir / "03_clinical_extraction"
        
        # Create translation and clinical directories (WhisperX creates its own)
        for dir_path in [self.translated_dir, self.clinical_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)
        
        # Initialize components
        try:
            self.s3_downloader = S3AudioDownloader(region=aws_region, cache_dir=str(self.cache_dir))
            print("✅ S3 downloader initialized")
        except Exception as e:
            print(f"⚠️  S3 downloader initialization failed: {e}")
            self.s3_downloader = None
        
        try:
            self.whisperx = WhisperXTranscriber(
                cache_dir=str(self.cache_dir)
            )
            print("✅ WhisperX transcriber initialized")
        except Exception as e:
            print(f"❌ WhisperX initialization failed: {e}")
            raise
        
        try:
            self.translator = SEALionTranslator(api_key=sealion_api_key)
            print("✅ SEA-LION translator initialized")
        except Exception as e:
            print(f"⚠️  SEA-LION translator initialization failed: {e}")
            self.translator = None
        
        try:
            self.clinical_extractor = ClinicalExtractorLLM(model_name=clinical_model)
            print(f"✅ Clinical extractor initialized with model: {clinical_model}")
        except Exception as e:
            print(f"❌ Clinical extractor initialization failed: {e}")
            raise
        
        # Store tokens for later use
        self.hf_token = hf_token
        
        print("🎯 Pipeline ready!")
    
    def download_audio(self, s3_path: str) -> str:
        """
        Download audio from S3
        
        Args:
            s3_path: S3 path or URI to audio file
            
        Returns:
            Local path to downloaded audio file
        """
        if not self.s3_downloader:
            raise RuntimeError("S3 downloader not available. Check AWS credentials.")
        
        print(f"\n📥 Step 1: Downloading audio from S3...")
        print(f"🎵 Source: {s3_path}")
        
        try:
            local_path = self.s3_downloader.download_audio_file(s3_path, use_cache=True)
            print(f"✅ Audio downloaded to: {local_path}")
            return local_path
        except Exception as e:
            print(f"❌ Download failed: {e}")
            raise
    
    def transcribe_audio(self, audio_path: str, 
                        language: str = "auto",
                        model_size: str = "based",
                        min_speakers: Optional[int] = None,
                        max_speakers: Optional[int] = None) -> Tuple[str, str]:
        """
        Transcribe audio using WhisperX
        
        Args:
            audio_path: Path to local audio file
            language: Language code (auto, en, ms, zh, etc.)
            model_size: WhisperX model size
            min_speakers: Minimum number of speakers for diarization
            max_speakers: Maximum number of speakers for diarization
            
        Returns:
            Tuple of (raw_transcript_path, lean_transcript_path)
        """
        print(f"\n🎙️ Step 2: Transcribing audio with WhisperX...")
        print(f"🎯 Audio: {Path(audio_path).name}")
        print(f"🗣️ Language: {language}")
        print(f"🤖 Model: {model_size}")
        
        try:
            # Perform transcription and diarization
            result, filename = self.whisperx.transcribe_and_diarize(
                audio_input=audio_path,
                language=language,
                hf_token=self.hf_token,
                model_size=model_size,
                min_speakers=min_speakers,
                max_speakers=max_speakers
            )
            
            # Save results
            raw_output_file, lean_output_file = self.whisperx.save_results(result, filename)
            
            print(f"✅ Transcription completed")
            print(f"📄 Raw transcript: {raw_output_file}")
            print(f"📄 Lean transcript: {lean_output_file}")
            
            return str(raw_output_file), str(lean_output_file)
            
        except Exception as e:
            print(f"❌ Transcription failed: {e}")
            raise
    
    def translate_transcript(self, lean_transcript_path: str) -> str:
        """
        Translate transcript using SEA-LION
        
        Args:
            lean_transcript_path: Path to lean transcript JSON file
            
        Returns:
            Path to translated JSON file
        """
        if not self.translator:
            print("⚠️  SEA-LION translator not available. Skipping translation...")
            return lean_transcript_path
        
        print(f"\n🌍 Step 3: Translating transcript with SEA-LION...")
        print(f"📄 Input: {Path(lean_transcript_path).name}")
        
        try:
            # Read lean transcript
            with open(lean_transcript_path, 'r', encoding='utf-8') as f:
                transcript_data = json.load(f)
            
            # Check if translation is needed
            if self.translator.should_skip_translation(transcript_data):
                print("✅ Content already in English, skipping translation")
                return lean_transcript_path
            
            # Translate the transcript
            translated_data = self.translator.translate_json(transcript_data)
            
            # Save translated result
            input_filename = Path(lean_transcript_path).stem
            translated_filename = f"{input_filename}_translated.json"
            translated_path = self.translated_dir / translated_filename
            
            with open(translated_path, 'w', encoding='utf-8') as f:
                json.dump(translated_data, f, indent=2, ensure_ascii=False)
            
            print(f"✅ Translation completed")
            print(f"📄 Translated transcript: {translated_path}")
            
            return str(translated_path)
            
        except Exception as e:
            print(f"❌ Translation failed: {e}")
            raise
    
    def extract_clinical_info(self, translated_path: str) -> str:
        """
        Extract clinical information using LLM
        
        Args:
            translated_path: Path to translated transcript JSON file
            
        Returns:
            Path to clinical extraction JSON file
        """
        print(f"\n🏥 Step 4: Extracting clinical information...")
        print(f"📄 Input: {Path(translated_path).name}")
        
        try:
            # Read translated transcript
            with open(translated_path, 'r', encoding='utf-8') as f:
                transcript_data = json.load(f)
            
            # Extract clinical information using the initialized extractor
            clinical_result = self.clinical_extractor.extract_clinical_info(transcript_data)
            
            # Add metadata
            clinical_result['_metadata'] = {
                'source_file': Path(translated_path).name,
                'model_used': self.clinical_extractor.model_name,
                'extraction_method': 'llm',
                'pipeline_version': '1.0'
            }
            
            # Save clinical extraction result
            input_filename = Path(translated_path).stem.replace('_translated', '')
            clinical_filename = f"{input_filename}_clinical.json"
            clinical_path = self.clinical_dir / clinical_filename
            
            with open(clinical_path, 'w', encoding='utf-8') as f:
                json.dump(clinical_result, f, indent=2, ensure_ascii=False)
            
            print(f"✅ Clinical extraction completed")
            print(f"📄 Clinical data: {clinical_path}")
            
            # Show summary
            if clinical_result.get('summary'):
                print(f"📋 Summary: {clinical_result['summary']}")
            
            return str(clinical_path)
        except Exception as e:
            print(f"❌ Clinical extraction failed: {e}")
            raise
    
    def process_audio(self, 
                     audio_input: str,
                     language: str = "auto",
                     model_size: str = "base",
                     min_speakers: Optional[int] = None,
                     max_speakers: Optional[int] = None,
                     skip_translation: bool = False,
                     skip_clinical: bool = False) -> Dict[str, Any]:
        """
        Process audio through the complete pipeline
        
        Args:
            audio_input: S3 URI/path or local file path
            language: Language for transcription
            model_size: WhisperX model size
            min_speakers: Minimum speakers for diarization
            max_speakers: Maximum speakers for diarization
            skip_translation: Skip translation step
            skip_clinical: Skip clinical extraction step
            
        Returns:
            Dictionary with paths to all generated files
        """
        start_time = time.time()
        results = {}
        
        print("🎬 Starting complete audio processing pipeline...")
        print(f"🎵 Input: {audio_input}")
        print(f"🔧 Settings: language={language}, model={model_size}")
        if min_speakers or max_speakers:
            print(f"👥 Speakers: {min_speakers or 'auto'}-{max_speakers or 'auto'}")
        print("=" * 60)
        
        try:
            print("🔍 DEBUG: Starting pipeline steps...")
            
            # Step 1: Download audio (if S3 path)
            print("🔍 DEBUG: Step 1 - Audio handling")
            if audio_input.startswith('s3://') or (not Path(audio_input).exists() and self.s3_downloader):
                print(f"🔍 DEBUG: Downloading from S3: {audio_input}")
                audio_path = self.download_audio(audio_input)
                results['downloaded_audio'] = audio_path
                print(f"🔍 DEBUG: Downloaded to: {audio_path}")
            else:
                audio_path = audio_input
                print(f"🔍 DEBUG: Using local audio file: {audio_path}")
                print(f"📁 Using local audio file: {audio_path}")
                if not Path(audio_path).exists():
                    print(f"🔍 DEBUG: File does not exist: {audio_path}")
                    raise FileNotFoundError(f"Audio file not found: {audio_path}")
                print(f"🔍 DEBUG: File exists, size: {Path(audio_path).stat().st_size} bytes")
            
            # Step 2: Transcribe audio
            print("🔍 DEBUG: Step 2 - Transcription")
            print(f"🔍 DEBUG: Calling transcribe_audio with: {audio_path}, {language}, {model_size}")
            try:
                raw_transcript, lean_transcript = self.transcribe_audio(
                    audio_path, language, model_size, min_speakers, max_speakers
                )
                print(f"🔍 DEBUG: Transcription completed successfully")
                print(f"🔍 DEBUG: Raw transcript: {raw_transcript}")
                print(f"🔍 DEBUG: Lean transcript: {lean_transcript}")
                results['raw_transcript'] = raw_transcript
                results['lean_transcript'] = lean_transcript
            except Exception as e:
                print(f"🔍 DEBUG: Transcription failed with error: {e}")
                import traceback
                traceback.print_exc()
                raise
            
            # Step 3: Translate transcript (optional)
            print("🔍 DEBUG: Step 3 - Translation")
            if not skip_translation:
                print(f"🔍 DEBUG: Starting translation of: {lean_transcript}")
                try:
                    translated_transcript = self.translate_transcript(lean_transcript)
                    print(f"🔍 DEBUG: Translation completed: {translated_transcript}")
                    results['translated_transcript'] = translated_transcript
                except Exception as e:
                    print(f"🔍 DEBUG: Translation failed with error: {e}")
                    import traceback
                    traceback.print_exc()
                    raise
            else:
                print("🔍 DEBUG: Skipping translation step")
                print("\n⏭️  Skipping translation step")
                translated_transcript = lean_transcript
            
            # Step 4: Extract clinical information (optional)
            print("🔍 DEBUG: Step 4 - Clinical extraction")
            if not skip_clinical:
                print(f"🔍 DEBUG: Starting clinical extraction of: {translated_transcript}")
                try:
                    clinical_result = self.extract_clinical_info(translated_transcript)
                    print(f"🔍 DEBUG: Clinical extraction completed: {clinical_result}")
                    results['clinical_extraction'] = clinical_result
                except Exception as e:
                    print(f"🔍 DEBUG: Clinical extraction failed with error: {e}")
                    import traceback
                    traceback.print_exc()
                    raise
            else:
                print("🔍 DEBUG: Skipping clinical extraction step")
                print("\n⏭️  Skipping clinical extraction step")
            
            # Pipeline completed successfully
            elapsed_time = time.time() - start_time
            print("\n" + "=" * 60)
            print("🎉 Pipeline completed successfully!")
            print(f"⏱️  Total processing time: {elapsed_time:.1f} seconds")
            
            print("\n📁 Generated files:")
            for step, path in results.items():
                print(f"   {step}: {Path(path).name}")
            
            return results
            
        except Exception as e:
            elapsed_time = time.time() - start_time
            print(f"\n❌ Pipeline failed after {elapsed_time:.1f} seconds: {e}")
            raise


def main():
    """Command line interface"""
    parser = argparse.ArgumentParser(
        description='Complete audio processing pipeline from S3 to clinical extraction',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Process S3 audio with auto-detection
  python pipeline.py s3://bucket/consultation.m4a
  
  # Process local audio with specific settings
  python pipeline.py audio.wav --language en --model-size base
  
  # With speaker diarization
  python pipeline.py audio.m4a --min-speakers 2 --max-speakers 4
  
  # Skip translation for English audio
  python pipeline.py audio.wav --skip-translation
  
  # Translation only (skip clinical extraction)
  python pipeline.py audio.m4a --skip-clinical
  
  # Use different model for clinical extraction
  python pipeline.py audio.m4a --clinical-model microsoft/DialoGPT-medium
  
  # Use local model path
  python pipeline.py audio.m4a --clinical-model /path/to/local/model

Environment Variables:
  AWS_ACCESS_KEY_ID      - AWS access key
  AWS_SECRET_ACCESS_KEY  - AWS secret key
  AWS_DEFAULT_REGION     - AWS region
  SEALION_API_KEY        - SEA-LION API key
  HF_TOKEN               - HuggingFace token for diarization
        """
    )
    
    # Input file
    parser.add_argument(
        'audio_input',
        help='Audio file (S3 URI, S3 path, or local file path)'
    )
    
    # Transcription options
    parser.add_argument(
        '--language', '-l',
        default='auto',
        help='Language code (auto, en, ms, zh, etc.) - default: auto-detect'
    )
    
    parser.add_argument(
        '--model-size', '-m',
        choices=['tiny', 'base', 'small', 'medium', 'large-v1', 'large-v2', 'large-v3'],
        default='base',
        help='WhisperX model size (default: large-v2)'
    )
    
    # Diarization options
    parser.add_argument(
        '--min-speakers',
        type=int,
        help='Minimum number of speakers for diarization'
    )
    
    parser.add_argument(
        '--max-speakers',
        type=int,
        help='Maximum number of speakers for diarization'
    )
    
    # Pipeline options
    parser.add_argument(
        '--skip-translation',
        action='store_true',
        help='Skip translation step (for English audio)'
    )
    
    parser.add_argument(
        '--skip-clinical',
        action='store_true',
        help='Skip clinical extraction step'
    )
    
    # Configuration options
    parser.add_argument(
        '--cache-dir',
        help='Directory for caching downloaded files'
    )
    
    parser.add_argument(
        '--aws-region',
        help='AWS region (default: from AWS_DEFAULT_REGION env var)'
    )
    
    parser.add_argument(
        '--sealion-api-key',
        help='SEA-LION API key (default: from SEALION_API_KEY env var)'
    )
    
    parser.add_argument(
        '--hf-token',
        help='HuggingFace token (default: from HF_TOKEN env var)'
    )
    
    parser.add_argument(
        '--clinical-model',
        default='Qwen/Qwen2.5-3B-Instruct',
        help='Model name/path for clinical extraction (default: Qwen/Qwen2.5-3B-Instruct)'
    )
    
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose output'
    )
    
    args = parser.parse_args()
    
    # Get tokens from environment if not provided
    hf_token = args.hf_token or os.getenv('HF_TOKEN')
    sealion_api_key = args.sealion_api_key or os.getenv('SEALION_API_KEY')
    
    if args.verbose:
        print("🔧 Configuration:")
        print(f"  Audio input: {args.audio_input}")
        print(f"  Language: {args.language}")
        print(f"  Model size: {args.model_size}")
        print(f"  Min speakers: {args.min_speakers or 'Auto'}")
        print(f"  Max speakers: {args.max_speakers or 'Auto'}")
        print(f"  Cache dir: {args.cache_dir or 'Default'}")
        print(f"  AWS region: {args.aws_region or 'From environment'}")
        print(f"  HF token: {'Set' if hf_token else 'Not set'}")
        print(f"  SEA-LION API key: {'Set' if sealion_api_key else 'Not set'}")
        print(f"  Clinical model: {args.clinical_model}")
        print()
    
    try:
        # Create pipeline
        print("🚀 Initializing pipeline...")
        pipeline = AudioProcessingPipeline(
            aws_region=args.aws_region,
            cache_dir=args.cache_dir,
            sealion_api_key=sealion_api_key,
            hf_token=hf_token,
            clinical_model=args.clinical_model
        )
        
        # Process audio
        results = pipeline.process_audio(
            audio_input=args.audio_input,
            language=args.language,
            model_size=args.model_size,
            min_speakers=args.min_speakers,
            max_speakers=args.max_speakers,
            skip_translation=args.skip_translation,
            skip_clinical=args.skip_clinical
        )
        
        # Show final results
        if 'clinical_extraction' in results:
            print(f"\n🎯 Final clinical extraction available at:")
            print(f"   {results['clinical_extraction']}")
        
    except KeyboardInterrupt:
        print("\n⏹️ Processing interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Pipeline failed: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main() 