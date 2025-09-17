#!/usr/bin/env python3
"""
Setup script for Clinical Transcription Pipeline

This script helps set up the complete clinical transcription pipeline
with all required dependencies and configurations.
"""

import os
import sys
import subprocess
import argparse
from pathlib import Path


def check_python_version():
    """Check if Python version is compatible."""
    if sys.version_info < (3, 8):
        print("❌ Python 3.8+ is required")
        print(f"   Current version: {sys.version}")
        return False
    print(f"✅ Python version: {sys.version}")
    return True


def install_dependencies():
    """Install required Python packages."""
    print("\n🔧 Installing Python dependencies...")
    
    try:
        # Install from requirements.txt
        subprocess.check_call([
            sys.executable, "-m", "pip", "install", "-r", "requirements.txt"
        ])
        print("✅ Dependencies installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install dependencies: {e}")
        return False


def check_gpu_support():
    """Check if GPU support is available."""
    print("\n🔍 Checking GPU support...")
    
    try:
        import torch
        if torch.cuda.is_available():
            gpu_count = torch.cuda.device_count()
            gpu_name = torch.cuda.get_device_name(0)
            print(f"✅ CUDA available with {gpu_count} GPU(s)")
            print(f"   Primary GPU: {gpu_name}")
            return True
        else:
            print("⚠️  CUDA not available, will use CPU (slower)")
            return False
    except ImportError:
        print("⚠️  PyTorch not installed, cannot check GPU support")
        return False


def setup_cache_directory(cache_dir="./audio_cache"):
    """Create cache directory for audio files."""
    print(f"\n📁 Setting up cache directory: {cache_dir}")
    
    cache_path = Path(cache_dir)
    cache_path.mkdir(exist_ok=True)
    print(f"✅ Cache directory ready: {cache_path.absolute()}")


def check_model_access():
    """Check access to required models."""
    print("\n🔐 Checking model access...")
    
    # Check HuggingFace token
    hf_token = os.getenv('HF_TOKEN')
    if hf_token:
        print("✅ HuggingFace token found in environment")
        
        # Try to access pyannote model
        try:
            from huggingface_hub import HfApi
            api = HfApi()
            # This will raise an error if no access
            model_info = api.model_info("pyannote/speaker-diarization-3.1", token=hf_token)
            print("✅ Access to pyannote/speaker-diarization-3.1 confirmed")
        except Exception as e:
            print(f"❌ Cannot access pyannote model: {e}")
            print("   Request access at: https://huggingface.co/pyannote/speaker-diarization-3.1")
            return False
    else:
        print("⚠️  HuggingFace token not found (HF_TOKEN environment variable)")
        print("   Get token from: https://huggingface.co/settings/tokens")
        return False
    
    # Translation handled by MERaLiON internally - no external API needed
    print("✅ Translation handled by MERaLiON model (no external API needed)")
    
    return True


def create_example_config():
    """Create example configuration file."""
    print("\n📝 Creating configuration template...")
    
    from meralion_transcriber.config import create_config_template
    create_config_template("clinical_config.json")
    
    print("✅ Configuration template created: clinical_config.json")
    print("   Edit this file with your API keys and settings")


def run_simple_test():
    """Run a simple test to verify installation."""
    print("\n🧪 Running installation test...")
    
    try:
        from meralion_transcriber import MERaLiONTranscriber
        print("✅ Clinical transcription module imported successfully")
        
        # Try to initialize (will fail without tokens, but import should work)
        try:
            pipeline = MERaLiONTranscriber(
                huggingface_token=os.getenv('HF_TOKEN', 'test')
            )
            print("✅ Pipeline initialization test passed")
        except Exception as e:
            if "token" in str(e).lower():
                print("⚠️  Pipeline needs valid tokens (expected)")
            else:
                print(f"❌ Pipeline initialization failed: {e}")
                return False
        
        return True
        
    except ImportError as e:
        print(f"❌ Failed to import clinical transcription: {e}")
        return False


def print_next_steps():
    """Print next steps for the user."""
    print("\n" + "="*60)
    print("🎉 SETUP COMPLETE!")
    print("="*60)
    print("\n📋 NEXT STEPS:")
    print("1. Set your HuggingFace token in .env file:")
    print("   echo 'HF_TOKEN=your_huggingface_token' >> .env")
    print("2. (Optional) Edit clinical_config.json for advanced settings")
    print("\n🚀 USAGE:")
    print("   # Process local audio file (HF_TOKEN from .env)")
    print("   python meralion_transcriber/example_usage.py --audio your_audio_file.m4a")
    print("")
    print("   # Process S3 audio file")
    print("   python meralion_transcriber/example_usage.py \\")
    print("     --audio s3://bucket/path/file.m4a --s3-region ap-northeast-2")
    print("")
    print("   # Results saved to transcript_output/ folder automatically")
    print("\n📖 Documentation: meralion_transcriber/README.md")


def main():
    """Main setup function."""
    parser = argparse.ArgumentParser(
        description="Setup Clinical Transcription Pipeline"
    )
    parser.add_argument(
        '--skip-deps', action='store_true',
        help='Skip dependency installation'
    )
    parser.add_argument(
        '--skip-test', action='store_true',
        help='Skip installation test'
    )
    
    args = parser.parse_args()
    
    print("🏥 Clinical Transcription Pipeline Setup")
    print("="*50)
    
    # Check Python version
    if not check_python_version():
        return 1
    
    # Install dependencies
    if not args.skip_deps:
        if not install_dependencies():
            return 1
    
    # Check GPU support
    check_gpu_support()
    
    # Setup cache directory
    setup_cache_directory()
    
    # Check model access
    if not check_model_access():
        print("\n⚠️  Model access issues detected. Setup continuing...")
    
    # Create configuration template
    create_example_config()
    
    # Run test
    if not args.skip_test:
        if not run_simple_test():
            print("\n❌ Installation test failed")
            return 1
    
    # Print next steps
    print_next_steps()
    
    return 0


if __name__ == '__main__':
    sys.exit(main()) 