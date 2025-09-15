#!/usr/bin/env python3
"""
WhisperX Main Pipeline

Main script that orchestrates the complete pipeline:
1. Download audio files from S3
2. Transcribe and diarize using WhisperX
3. Save results to output directory

Supports English, Malay, and Chinese languages with speaker diarization.
"""

import os
import sys
import tempfile
import argparse
from pathlib import Path

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

# Add parent directory to path for aws module
sys.path.append(str(Path(__file__).parent.parent))
from aws.s3_downloader import S3AudioDownloader
from whisperx_transcriber import WhisperXTranscriber
from audio_processor import AudioProcessor


class WhisperXPipeline:
    """Complete pipeline for S3 audio processing with WhisperX"""
    
    def __init__(self, aws_region: str = None):
        """Initialize the pipeline"""
        self.downloader = S3AudioDownloader(region=aws_region)
        self.transcriber = None
        print("🚀 WhisperX Pipeline initialized")
    
    def process_s3_audio(self, s3_path: str, **kwargs):
        """Process audio file from S3"""
        
        # Extract parameters
        language = kwargs.get('language', 'auto')
        model_size = kwargs.get('model_size', 'base')
        device = kwargs.get('device', 'auto')
        enable_diarization = kwargs.get('enable_diarization', True)
        min_speakers = kwargs.get('min_speakers', 1)
        max_speakers = kwargs.get('max_speakers', 10)
        batch_size = kwargs.get('batch_size', 16)
        hf_token = kwargs.get('hf_token')
        output_dir = kwargs.get('output_dir')
        keep_audio = kwargs.get('keep_audio', False)
        
        print(f"🎯 Processing S3 audio: {s3_path}")
        
        # Step 1: Download audio from S3
        print("\n📥 Step 1: Downloading audio from S3...")
        temp_dir = tempfile.mkdtemp() if not keep_audio else None
        local_audio_path = self.downloader.download_audio_file(s3_path, temp_dir)
        
        try:
            # Step 2: Initialize transcriber
            print("\n🤖 Step 2: Initializing WhisperX transcriber...")
            self.transcriber = WhisperXTranscriber(device=device, compute_type="auto")
            
            # Step 3: Process with WhisperX
            print("\n🗣️  Step 3: Processing with WhisperX...")
            result = self.transcriber.process_audio_file(
                audio_path=local_audio_path,
                language=language,
                model_size=model_size,
                enable_diarization=enable_diarization,
                min_speakers=min_speakers,
                max_speakers=max_speakers,
                batch_size=batch_size,
                hf_token=hf_token,
                output_dir=output_dir
            )
            
            print("\n🎉 Pipeline completed successfully!")
            return result
            
        finally:
            # Clean up temporary files unless keeping audio
            if not keep_audio and temp_dir and os.path.exists(temp_dir):
                import shutil
                try:
                    shutil.rmtree(temp_dir)
                    print(f"🧹 Cleaned up temporary directory: {temp_dir}")
                except Exception as e:
                    print(f"⚠️  Could not clean up temporary directory: {e}")
    
    def process_local_audio(self, audio_path: str, **kwargs):
        """Process local audio file"""
        
        # Extract parameters
        language = kwargs.get('language', 'auto')
        model_size = kwargs.get('model_size', 'base')
        device = kwargs.get('device', 'auto')
        enable_diarization = kwargs.get('enable_diarization', True)
        min_speakers = kwargs.get('min_speakers', 1)
        max_speakers = kwargs.get('max_speakers', 10)
        batch_size = kwargs.get('batch_size', 16)
        hf_token = kwargs.get('hf_token')
        output_dir = kwargs.get('output_dir')
        
        print(f"🎯 Processing local audio: {audio_path}")
        
        # Verify file exists
        if not os.path.exists(audio_path):
            print(f"❌ Audio file not found: {audio_path}")
            sys.exit(1)
        
        # Initialize transcriber
        print("\n🤖 Initializing WhisperX transcriber...")
        self.transcriber = WhisperXTranscriber(device=device, compute_type="auto")
        
        # Process with WhisperX
        print("\n🗣️  Processing with WhisperX...")
        result = self.transcriber.process_audio_file(
            audio_path=audio_path,
            language=language,
            model_size=model_size,
            enable_diarization=enable_diarization,
            min_speakers=min_speakers,
            max_speakers=max_speakers,
            batch_size=batch_size,
            hf_token=hf_token,
            output_dir=output_dir
        )
        
        print("\n🎉 Processing completed successfully!")
        return result


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Process audio files with WhisperX transcription and diarization',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Process S3 audio with default settings
  python main.py s3://my-bucket/audio.mp3
  
  # Process with specific language and diarization
  python main.py audio.mp3 --language en --min-speakers 2 --max-speakers 4
  
  # Process with larger model and no diarization
  python main.py s3://bucket/file.wav --model-size large-v3 --disable-diarization
  
  # Process with HuggingFace token for diarization
  python main.py audio.mp3 --hf-token your_token_here

Environment Variables:
  AUDIO_S3_BUCKET    - Default S3 bucket for audio files
  AWS_DEFAULT_REGION - AWS region (default: ap-southeast-2)
  HF_TOKEN          - HuggingFace token for speaker diarization
        """
    )
    
    # Input file
    parser.add_argument(
        'audio_input',
        help='Audio file path (local file or S3 URI: s3://bucket/path/file.ext)'
    )
    
    # Language options
    parser.add_argument(
        '--language', '-l',
        choices=['auto', 'en', 'ms', 'zh'],
        default='auto',
        help='Audio language (default: auto-detect). en=English, ms=Malay, zh=Chinese'
    )
    
    # Model options
    parser.add_argument(
        '--model-size', '-m',
        choices=['tiny', 'base', 'small', 'medium', 'large-v1', 'large-v2', 'large-v3'],
        default='base',
        help='WhisperX model size (default: base). Larger models are more accurate but slower.'
    )
    
    # Device options
    parser.add_argument(
        '--device',
        choices=['auto', 'cpu', 'cuda'],
        default='auto',
        help='Processing device (default: auto). Use cuda for GPU acceleration if available.'
    )
    
    # Diarization options
    parser.add_argument(
        '--disable-diarization',
        action='store_true',
        help='Disable speaker diarization (identification of different speakers)'
    )
    
    parser.add_argument(
        '--min-speakers',
        type=int,
        default=1,
        help='Minimum number of speakers for diarization (default: 1)'
    )
    
    parser.add_argument(
        '--max-speakers',
        type=int,
        default=10,
        help='Maximum number of speakers for diarization (default: 10)'
    )
    
    # Processing options
    parser.add_argument(
        '--batch-size',
        type=int,
        default=16,
        help='Batch size for processing (default: 16). Lower values use less memory.'
    )
    
    # Authentication
    parser.add_argument(
        '--hf-token',
        help='HuggingFace token for diarization model access. Required for speaker diarization.'
    )
    
    # AWS options
    parser.add_argument(
        '--aws-region',
        help='AWS region (default: from AWS_DEFAULT_REGION env var or ap-southeast-2)'
    )
    
    # Output options
    parser.add_argument(
        '--output-dir', '-o',
        help='Output directory for results (default: ./whisperX/transcript_output)'
    )
    
    parser.add_argument(
        '--keep-audio',
        action='store_true',
        help='Keep downloaded audio files from S3 (default: delete after processing)'
    )
    
    # Verbose output
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose output'
    )
    
    args = parser.parse_args()
    
    # Determine if input is S3 URI or local file
    is_s3 = args.audio_input.startswith('s3://')
    
    if args.verbose:
        print("🔧 Configuration:")
        print(f"  Input: {args.audio_input} ({'S3' if is_s3 else 'Local'})")
        print(f"  Language: {args.language}")
        print(f"  Model size: {args.model_size}")
        print(f"  Device: {args.device}")
        print(f"  Diarization: {'Disabled' if args.disable_diarization else 'Enabled'}")
        if not args.disable_diarization:
            print(f"  Speakers: {args.min_speakers}-{args.max_speakers}")
        print(f"  Batch size: {args.batch_size}")
        print(f"  Output dir: {args.output_dir or 'Default'}")
        print()
    
    # Prepare parameters
    params = {
        'language': args.language,
        'model_size': args.model_size,
        'device': args.device,
        'enable_diarization': not args.disable_diarization,
        'min_speakers': args.min_speakers,
        'max_speakers': args.max_speakers,
        'batch_size': args.batch_size,
        'hf_token': args.hf_token,
        'output_dir': args.output_dir,
        'keep_audio': args.keep_audio
    }
    
    try:
        # Initialize pipeline
        pipeline = WhisperXPipeline(aws_region=args.aws_region)
        
        # Process audio
        if is_s3:
            result = pipeline.process_s3_audio(args.audio_input, **params)
        else:
            result = pipeline.process_local_audio(args.audio_input, **params)
        
        # Print summary
        if result and args.verbose:
            print(f"\n📊 Results Summary:")
            print(f"  Detected language: {result.get('detected_language', 'Unknown')}")
            if 'segments' in result:
                total_segments = len(result['segments'])
                speakers = set()
                for seg in result['segments']:
                    if 'speaker' in seg:
                        speakers.add(seg['speaker'])
                print(f"  Total segments: {total_segments}")
                if speakers:
                    print(f"  Detected speakers: {', '.join(sorted(speakers))}")
        
    except KeyboardInterrupt:
        print("\n❌ Process interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Pipeline failed: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main() 