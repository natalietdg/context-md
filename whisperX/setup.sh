#!/bin/bash

# WhisperX Setup Script
# Installs dependencies for WhisperX transcription and diarization

set -e

echo "🚀 WhisperX Setup Script"
echo "========================"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Python version
echo "🐍 Checking Python version..."
if command_exists python3; then
    python_version=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
    echo "  Found Python $python_version"
    
    # Check if version is >= 3.8
    if python3 -c 'import sys; exit(0 if sys.version_info >= (3, 8) else 1)'; then
        echo "  ✅ Python version is compatible"
    else
        echo "  ❌ Python 3.8+ is required"
        exit 1
    fi
else
    echo "  ❌ Python 3 not found. Please install Python 3.8+"
    exit 1
fi

# Check pip
echo ""
echo "📦 Checking pip..."
if command_exists pip3; then
    echo "  ✅ pip3 found"
elif command_exists pip; then
    echo "  ✅ pip found"
else
    echo "  ❌ pip not found. Installing pip..."
    python3 -m ensurepip --default-pip
fi

# Check ffmpeg
echo ""
echo "🎵 Checking ffmpeg..."
if command_exists ffmpeg; then
    echo "  ✅ ffmpeg found"
else
    echo "  ⚠️  ffmpeg not found"
    echo "  Please install ffmpeg:"
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "    sudo apt update && sudo apt install ffmpeg"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "    brew install ffmpeg"
    else
        echo "    Please visit https://ffmpeg.org/download.html"
    fi
    
    echo ""
    read -p "Continue without ffmpeg? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Install PyTorch
echo ""
echo "🔥 Installing PyTorch..."
if command_exists nvidia-smi; then
    echo "  NVIDIA GPU detected, installing CUDA version..."
    pip3 install torch>=2.0.0 torchaudio>=2.0.0 --index-url https://download.pytorch.org/whl/cu118
else
    echo "  Installing CPU version..."
    pip3 install torch>=2.0.0 torchaudio>=2.0.0
fi

# Install other dependencies
echo ""
echo "📚 Installing other dependencies..."
pip3 install transformers>=4.19.0
pip3 install faster-whisper>=0.9.0
pip3 install pyannote-audio>=3.1.0
pip3 install boto3
pip3 install python-dotenv

# Install WhisperX
echo ""
echo "🎤 Installing WhisperX..."
pip3 install git+https://github.com/m-bain/whisperx.git

# Verify installation
echo ""
echo "🔍 Verifying installation..."
python3 -c "import whisperx; print('✅ WhisperX installed successfully')" 2>/dev/null || echo "❌ WhisperX installation failed"
python3 -c "import torch; print('✅ PyTorch installed successfully')" 2>/dev/null || echo "❌ PyTorch installation failed"
python3 -c "import boto3; print('✅ boto3 installed successfully')" 2>/dev/null || echo "❌ boto3 installation failed"

# Check CUDA availability
echo ""
echo "🖥️  Checking CUDA availability..."
python3 -c "
import torch
if torch.cuda.is_available():
    print(f'✅ CUDA available: {torch.cuda.get_device_name(0)}')
    print(f'   CUDA version: {torch.version.cuda}')
    print(f'   GPUs available: {torch.cuda.device_count()}')
else:
    print('⚠️  CUDA not available, will use CPU')
"

# Create example .env file
echo ""
echo "📝 Creating example .env file..."
cat > .env.example << 'EOF'
# AWS Configuration
AUDIO_S3_BUCKET=your-audio-bucket-name
AWS_DEFAULT_REGION=ap-southeast-2

# HuggingFace Token (required for speaker diarization)
# Get your token from: https://huggingface.co/settings/tokens
# Make sure to accept licenses for:
# - pyannote/segmentation-3.0
# - pyannote/speaker-diarization-3.1
HF_TOKEN=your_huggingface_token_here
EOF

echo "  📄 Created .env.example file"
echo "  Please copy it to .env and fill in your credentials:"
echo "    cp .env.example .env"

echo ""
echo "🎉 Setup completed!"
echo ""
echo "Next steps:"
echo "1. Copy .env.example to .env and fill in your credentials"
echo "2. Test the installation:"
echo "   python3 main.py --help"
echo ""
echo "For HuggingFace token (required for speaker diarization):"
echo "1. Create account at https://huggingface.co"
echo "2. Go to Settings > Access Tokens"
echo "3. Create a token with read permissions"
echo "4. Accept licenses for pyannote models"
echo ""
echo "Example usage:"
echo "  python3 main.py s3://your-bucket/audio.mp3"
echo "  python3 main.py local_audio.wav --language en" 