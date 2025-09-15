#!/usr/bin/env python3
"""
WhisperX Main Entry Point

Command line interface for WhisperX transcription and diarization with S3 integration.
This is the main entry point that uses the WhisperXTranscriber class.
"""

import os
import sys
import argparse
from whisperx_transcriber import WhisperXTranscriber


def main():
    """Command line interface"""
    parser = argparse.ArgumentParser(
        description='Transcribe and diarize audio files using WhisperX with S3 integration',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic transcription
  python main.py audio.mp3
  
  # With specific language and model
  python main.py audio.mp3 --language en --model-size large-v3
  
  # With speaker diarization (requires HF token)
  python main.py audio.mp3 --hf-token your_hf_token --min-speakers 2 --max-speakers 4
  
  # Process from S3
  python main.py s3://bucket/audio.mp3 --cache-dir ./downloads

Environment Variables:
  HF_TOKEN - HuggingFace token for speaker diarization
        """
    )
    
    # Input file
    parser.add_argument(
        'audio_input',
        help='Audio file path (local or S3 URI/path)'
    )
    
    # Language options
    parser.add_argument(
        '--language', '-l',
        default='auto',
        help='Language code (auto, en, ms, zh, etc.) - default: auto-detect'
    )
    
    # Model options  
    parser.add_argument(
        '--model-size', '-m',
        choices=['tiny', 'base', 'small', 'medium', 'large-v1', 'large-v2', 'large-v3'],
        default='large-v2',
        help='WhisperX model size (default: large-v2)'
    )
    
    # Device options
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
    
    # Diarization options
    parser.add_argument(
        '--hf-token',
        help='HuggingFace token for speaker diarization (or set HF_TOKEN env var)'
    )
    
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
    
    # File handling
    parser.add_argument(
        '--cache-dir', '-c',
        help='Cache directory for downloaded audio files'
    )
    
    # Output options
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose output'
    )
    
    args = parser.parse_args()
    
    # Get HF token from argument or environment
    hf_token = args.hf_token or os.getenv('HF_TOKEN')
    
    if args.verbose:
        print("🔧 Configuration:")
        print(f"  Input: {args.audio_input}")
        print(f"  Language: {args.language}")
        print(f"  Model size: {args.model_size}")
        print(f"  Device: {args.device}")
        print(f"  Compute type: {args.compute_type}")
        print(f"  Diarization: {'Enabled' if hf_token else 'Disabled'}")
        if hf_token and args.min_speakers and args.max_speakers:
            print(f"  Speakers: {args.min_speakers}-{args.max_speakers}")
        print(f"  Cache dir: {args.cache_dir or 'Default'}")
        print()
    
    try:
        # Create transcriber
        print("🚀 Initializing WhisperX transcriber...")
        transcriber = WhisperXTranscriber(
            device=args.device,
            compute_type=args.compute_type,
            cache_dir=args.cache_dir
        )
        
        # Process audio
        print(f"🎯 Processing audio: {args.audio_input}")
        result, filename = transcriber.transcribe_and_diarize(
            audio_input=args.audio_input,
            language=args.language,
            hf_token=hf_token,
            model_size=args.model_size,
            min_speakers=args.min_speakers,
            max_speakers=args.max_speakers
        )
        
        # Save results
        print("💾 Saving results...")
        output_file = transcriber.save_results(result, filename)
        
        print(f"\n🎉 Transcription completed successfully!")
        print(f"📄 Results saved to: {output_file}")
        
        # Print summary if verbose
        if args.verbose and result:
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
        print("\n⏹️ Processing interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Processing failed: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main() 