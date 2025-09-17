#!/usr/bin/env python3
"""
Clinical Transcription Pipeline - Example Usage

This script demonstrates how to use the MERaLiONTranscriber to process
clinical consultation audio files with speaker diarization and transcription.

Requirements:
- HuggingFace token (set HF_TOKEN in .env file or use --hf-token parameter)
- Access to pyannote/speaker-diarization-3.1 model
- Audio file in m4a, wav, or mp3 format (local or S3 URI)

Usage:
    python example_usage.py --audio /path/to/audio.m4a
    python example_usage.py --audio s3://bucket/path/audio.m4a --s3-region ap-northeast-2

Output:
    Results are automatically saved to transcript_output/ folder
"""

import os
import sys
import argparse
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

from pipeline import MERaLiONTranscriber


def main():
    """Main example usage function."""
    parser = argparse.ArgumentParser(
        description='Clinical Transcription Pipeline Example',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    parser.add_argument(
        '--audio', '-a',
        required=True,
        help='Path to audio file or S3 URI (s3://bucket/path/file.ext). Supports m4a, wav, mp3 formats.'
    )
    
    parser.add_argument(
        '--hf-token', '-t',
        help='HuggingFace token (optional, defaults to HF_TOKEN environment variable)'
    )
    
# SEA-LION API key removed - now using MERaLiON for translation
    
    parser.add_argument(
        '--output', '-o',
        help='Output JSON file path (optional, defaults to audio_name_transcription.json)'
    )
    
    parser.add_argument(
        '--cache-dir', '-c',
        default='./audio_cache',
        help='Directory for audio cache (default: ./audio_cache)'
    )
    
    parser.add_argument(
        '--device',
        choices=['cpu', 'cuda', 'auto'],
        default='auto',
        help='Device to use for processing (default: auto)'
    )
    
    parser.add_argument(
        '--s3-region',
        help='AWS region for S3 downloads (default: AWS_DEFAULT_REGION env var)'
    )
    
    args = parser.parse_args()
    
    # Validate audio file (skip validation for S3 URIs)
    if not args.audio.startswith('s3://'):
        audio_path = Path(args.audio)
        if not audio_path.exists():
            print(f"❌ Audio file not found: {audio_path}")
            return 1
        
        if audio_path.suffix.lower() not in ['.m4a', '.wav', '.mp3']:
            print(f"⚠️  Audio format {audio_path.suffix} may not be supported. Supported formats: .m4a, .wav, .mp3")
    else:
        print(f"🌐 S3 URI detected: {args.audio}")
        # Basic S3 URI validation
        if not args.audio.count('/') >= 3:  # s3://bucket/path/file
            print("⚠️  S3 URI format should be: s3://bucket/path/file.ext")
    
    # Get HuggingFace token (from args or environment)
    hf_token = args.hf_token or os.getenv('HF_TOKEN')
    if not hf_token:
        print("❌ HuggingFace token required")
        print("   Set HF_TOKEN in .env file or use --hf-token parameter")
        print("   Get token from: https://huggingface.co/settings/tokens")
        print("   Make sure you have access to: pyannote/speaker-diarization-3.1")
        return 1
    
    print("✅ HuggingFace token loaded successfully")
    
# Translation now handled by MERaLiON - no external API key needed
    print("✅ Translation will be handled by MERaLiON model (no external API needed)")
    
    # Create transcript_output directory
    transcript_dir = Path("transcript_output")
    transcript_dir.mkdir(exist_ok=True)
    
    # Determine output path
    if args.output:
        output_path = Path(args.output)
    else:
        # Handle both local and S3 paths for default output naming
        if args.audio.startswith('s3://'):
            # Extract filename from S3 URI
            s3_filename = Path(args.audio.split('/')[-1]).stem
            output_path = transcript_dir / f"{s3_filename}_transcription.json"
        else:
            audio_path = Path(args.audio)
            output_path = transcript_dir / f"{audio_path.stem}_transcription.json"
    
    print(f"🎯 Processing audio file: {args.audio}")
    print(f"💾 Output will be saved to: {output_path}")
    
    try:
        # Initialize pipeline
        print("🚀 Initializing Clinical Transcription Pipeline...")
        pipeline = MERaLiONTranscriber(
            huggingface_token=hf_token,
            device=None if args.device == 'auto' else args.device,
            cache_dir=args.cache_dir,
            s3_region=args.s3_region
        )
        
        # Process audio file
        print("🔄 Processing audio file...")
        result = pipeline.process_audio_file(args.audio)
        
        # Save results
        # pipeline.save_result_to_json(result, str(output_path))
        
        # Print summary
        print("\n" + "="*60)
        print("📋 TRANSCRIPTION SUMMARY")
        print("="*60)
        print(f"🗣️  Total speakers: {result.speakers['total']}")
        print(f"👨‍⚕️ Doctor: {result.speakers['doctor']}")
        print(f"🤒 Patients: {', '.join(result.speakers['patients'])}")
        print(f"🌍 Original language: {result.original_language}")
        print(f"⏱️  Total duration: {result.summary['total_duration']:.1f} seconds")
        print(f"👨‍⚕️ Doctor speaking time: {result.summary['doctor_speaking_time']:.1f} seconds")
        print(f"🤒 Patient speaking time: {result.summary['patient_speaking_time']:.1f} seconds")
        # Processing time metadata removed
        print("⚡ Processing completed successfully")
        
        print(f"\n📄 Segments ({len(result.segments)}):")
        for i, segment in enumerate(result.segments[:5]):  # Show first 5 segments
            text_preview = segment.text['english'][:100] + "..." if len(segment.text['english']) > 100 else segment.text['english']
            print(f"  {i+1}. [{segment.speaker_id} - {segment.role}] {segment.start_time:.1f}s-{segment.end_time:.1f}s: {text_preview}")
        
        if len(result.segments) > 5:
            print(f"     ... and {len(result.segments) - 5} more segments")
        
        print(f"\n✅ Complete transcription saved to: {output_path}")
        
        return 0
        
    except KeyboardInterrupt:
        print("\n⛔ Processing interrupted by user")
        return 1
    except Exception as e:
        print(f"\n❌ Processing failed: {e}")
        logging.exception("Detailed error:")
        return 1


if __name__ == '__main__':
    sys.exit(main()) 