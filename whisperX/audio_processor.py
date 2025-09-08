#!/usr/bin/env python3
"""
Audio Preprocessor for WhisperX

Converts audio files to the optimal format for WhisperX:
- Mono channel (single channel)
- 16kHz sample rate
- WAV format
- 16-bit depth

Uses ffmpeg for robust audio format conversion.
"""

import os
import sys
import subprocess
import tempfile
from pathlib import Path
from typing import Optional


class AudioProcessor:
    """Audio preprocessor for WhisperX"""
    
    def __init__(self):
        """Initialize audio processor"""
        self._check_ffmpeg()
    
    def _check_ffmpeg(self):
        """Check if ffmpeg is available"""
        try:
            subprocess.run(['ffmpeg', '-version'], 
                          capture_output=True, check=True)
            print("✅ ffmpeg found")
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("❌ ffmpeg not found. Please install ffmpeg:")
            print("  Ubuntu/Debian: sudo apt update && sudo apt install ffmpeg")
            print("  macOS: brew install ffmpeg")
            print("  Windows: choco install ffmpeg")
            sys.exit(1)
    
    def get_audio_info(self, input_path: str) -> dict:
        """Get audio file information"""
        try:
            cmd = [
                'ffprobe', '-v', 'quiet', '-print_format', 'json',
                '-show_streams', '-select_streams', 'a:0', input_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            
            import json
            info = json.loads(result.stdout)
            
            if 'streams' not in info or len(info['streams']) == 0:
                raise Exception("No audio streams found in file")
            
            stream = info['streams'][0]
            
            return {
                'sample_rate': int(stream.get('sample_rate', 0)),
                'channels': int(stream.get('channels', 0)),
                'duration': float(stream.get('duration', 0)),
                'codec': stream.get('codec_name', 'unknown'),
                'bit_rate': int(stream.get('bit_rate', 0)) if stream.get('bit_rate') else None
            }
            
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to get audio info: {e}")
            return {}
        except Exception as e:
            print(f"❌ Error processing audio info: {e}")
            return {}
    
    def needs_preprocessing(self, input_path: str) -> bool:
        """Check if audio file needs preprocessing"""
        info = self.get_audio_info(input_path)
        
        if not info:
            return True  # If we can't get info, assume preprocessing is needed
        
        # Check if already in optimal format
        is_mono = info.get('channels', 0) == 1
        is_16khz = info.get('sample_rate', 0) == 16000
        is_wav = input_path.lower().endswith('.wav')
        
        if is_mono and is_16khz and is_wav:
            print(f"✅ Audio already in optimal format: {input_path}")
            return False
        
        print(f"🔄 Audio needs preprocessing:")
        print(f"  Current: {info.get('channels', '?')} channels, {info.get('sample_rate', '?')}Hz, {info.get('codec', '?')}")
        print(f"  Target: 1 channel, 16000Hz, WAV")
        
        return True
    
    def preprocess_audio(self, input_path: str, output_path: Optional[str] = None) -> str:
        """
        Convert audio to mono 16kHz WAV format
        
        Args:
            input_path: Path to input audio file
            output_path: Path for output WAV file (optional)
            
        Returns:
            Path to preprocessed audio file
        """
        
        # Check if preprocessing is needed
        if not self.needs_preprocessing(input_path):
            return input_path
        
        # Generate output path if not provided
        if output_path is None:
            input_name = Path(input_path).stem
            temp_dir = tempfile.gettempdir()
            output_path = os.path.join(temp_dir, f"{input_name}_processed.wav")
        
        print(f"🔄 Converting audio: {input_path} -> {output_path}")
        
        try:
            # Build ffmpeg command for optimal WhisperX format
            cmd = [
                'ffmpeg',
                '-i', input_path,           # Input file
                '-ac', '1',                 # Convert to mono (1 channel)
                '-ar', '16000',             # Resample to 16kHz
                '-sample_fmt', 's16',       # 16-bit signed integer samples
                '-f', 'wav',                # Output format: WAV
                '-y',                       # Overwrite output file
                output_path
            ]
            
            # Run ffmpeg conversion
            result = subprocess.run(
                cmd, 
                capture_output=True, 
                text=True, 
                check=True
            )
            
            # Verify output file exists
            if not os.path.exists(output_path):
                raise Exception("Output file was not created")
            
            # Get info about processed file
            processed_info = self.get_audio_info(output_path)
            
            print(f"✅ Audio preprocessing completed:")
            print(f"  Output: {output_path}")
            print(f"  Format: {processed_info.get('channels', '?')} channel, {processed_info.get('sample_rate', '?')}Hz")
            print(f"  Duration: {processed_info.get('duration', '?'):.2f}s")
            
            return output_path
            
        except subprocess.CalledProcessError as e:
            print(f"❌ Audio conversion failed:")
            print(f"  Command: {' '.join(cmd)}")
            print(f"  Error: {e.stderr}")
            sys.exit(1)
            
        except Exception as e:
            print(f"❌ Audio preprocessing error: {e}")
            sys.exit(1)
    
    def preprocess_for_whisperx(self, input_path: str, keep_original: bool = False) -> str:
        """
        Preprocess audio file for optimal WhisperX performance
        
        Args:
            input_path: Path to input audio file
            keep_original: Whether to keep the original file
            
        Returns:
            Path to preprocessed audio file
        """
        
        print(f"🎵 Preprocessing audio for WhisperX: {input_path}")
        
        # Get original audio info
        original_info = self.get_audio_info(input_path)
        if original_info:
            print(f"📊 Original audio info:")
            print(f"  Channels: {original_info.get('channels', '?')}")
            print(f"  Sample rate: {original_info.get('sample_rate', '?')} Hz")
            print(f"  Duration: {original_info.get('duration', 0):.2f}s")
            print(f"  Codec: {original_info.get('codec', '?')}")
        
        # Preprocess the audio
        processed_path = self.preprocess_audio(input_path)
        
        # Clean up original file if not keeping it and it's different from processed
        if not keep_original and processed_path != input_path:
            try:
                # Only remove if it's a temporary file (in temp directory)
                if tempfile.gettempdir() in input_path:
                    os.remove(input_path)
                    print(f"🧹 Cleaned up original file: {input_path}")
            except Exception as e:
                print(f"⚠️  Could not clean up original file: {e}")
        
        return processed_path


def main():
    """Main entry point for testing"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Preprocess audio files for WhisperX (mono 16kHz WAV)'
    )
    parser.add_argument(
        'input_file',
        help='Input audio file path'
    )
    parser.add_argument(
        '--output', '-o',
        help='Output file path (default: auto-generated)'
    )
    parser.add_argument(
        '--info-only',
        action='store_true',
        help='Only show audio file information'
    )
    
    args = parser.parse_args()
    
    # Initialize processor
    processor = AudioProcessor()
    
    if args.info_only:
        # Just show file info
        info = processor.get_audio_info(args.input_file)
        print(f"📊 Audio file information:")
        for key, value in info.items():
            print(f"  {key}: {value}")
    else:
        # Preprocess the file
        output_path = processor.preprocess_audio(args.input_file, args.output)
        print(f"🎉 Preprocessing completed: {output_path}")


if __name__ == '__main__':
    main() 