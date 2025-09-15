# WhisperX Implementation

A complete pipeline for transcribing and diarizing audio files using WhisperX. This implementation supports:

- **Multi-language transcription**: English, Malay, and Chinese
- **Speaker diarization**: Identify and separate different speakers
- **S3 integration**: Download audio files directly from S3 buckets
- **Word-level timestamps**: Precise timing information for each word
- **Multiple output formats**: JSON, plain text, and speaker-separated transcripts

## Output Results 
- transcript_output -> contains raw json transcription with scores for each word 
- transcript_output_lean -> contains extracted text, speaker, language of the conversation

## Features

- 🎵 **S3 Integration**: Download audio files directly from S3 buckets
- 🔄 **Audio Preprocessing**: Automatic conversion to mono 16kHz WAV for optimal performance
- 🗣️ **Advanced Transcription**: Uses WhisperX for fast and accurate transcription
- 👥 **Speaker Diarization**: Identifies and separates different speakers
- 🌍 **Multi-language Support**: English, Malay (ms), Chinese (zh)
- ⏰ **Word-level Timestamps**: Precise timing for each word
- 📊 **Multiple Output Formats**: JSON, text, and speaker-separated formats
- 🚀 **GPU Acceleration**: Automatic CUDA detection for faster processing

## Requirements

- Python 3.8+
- PyTorch 2.0+
- CUDA-compatible GPU (optional, for acceleration)
- AWS credentials (for S3 access)
- HuggingFace token (for speaker diarization)

## Installation

1. **Install system dependencies**:
   ```bash
   # Ubuntu/Debian
   sudo apt update && sudo apt install ffmpeg
   
   # macOS
   brew install ffmpeg
   
   # Windows
   choco install ffmpeg
   ```

2. **Install Python dependencies**:
   ```bash
   pip install torch>=2.0.0 torchaudio>=2.0.0
   pip install git+https://github.com/m-bain/whisperx.git
   pip install boto3 python-dotenv
   ```

3. **Set up environment variables**:
   Add to your main project `.env` file (in the project root):
   ```env
   # AWS Configuration (may already be configured)
   AUDIO_S3_BUCKET=your-audio-bucket
   AWS_DEFAULT_REGION=your-aws-region
   
   # HuggingFace Token (required for speaker diarization)
   HF_TOKEN=your_huggingface_token
   ```

## Quick Start

### Basic Usage

```bash
# Process a local audio file
python whisperX/main.py audio.mp3

# Process an S3 audio file
python whisperX/main.py s3://your-bucket/audio.wav

# Process with specific language
python whisperX/main.py audio.mp3 --language en
```

### Advanced Usage

```bash
# Full configuration with diarization
python whisperX/main.py s3://bucket/audio.mp3 \
  --language auto \
  --model-size base \
  --min-speakers 2 \
  --max-speakers 4 \
  --hf-token your_token \
  --output-dir ./results

# High-quality processing with large model
python whisperX/main.py audio.wav \
  --model-size large-v3 \
  --device cuda \
  --batch-size 8

# Process without speaker diarization (faster)
python whisperX/main.py audio.mp3 \
  --disable-diarization \
  --model-size small
```

## Configuration Options

### Language Options
- `auto`: Automatic language detection (default)
- `en`: English
- `ms`: Malay
- `zh`: Chinese

### Model Sizes
- `tiny`: Fastest, least accurate (~39M parameters)
- `base`: Good balance of speed and accuracy (~74M parameters, default)
- `small`: Better accuracy (~244M parameters)
- `medium`: High accuracy (~769M parameters)
- `large-v1/v2/v3`: Best accuracy (~1550M parameters)

### Device Options
- `auto`: Automatic device selection (default)
- `cpu`: Force CPU processing
- `cuda`: Use GPU acceleration (if available)

## Output Files

The pipeline generates multiple output files in the specified output directory:

1. **Full JSON Result**: `filename_whisperx_timestamp.json`
   - Complete WhisperX output with all metadata
   - Includes segments, timestamps, confidence scores

2. **Plain Text Transcript**: `filename_transcript_timestamp.txt`
   - Simple text transcript
   - Includes speaker labels if diarization is enabled

3. **Speaker-Separated Transcript**: `filename_speakers_timestamp.txt` (if speakers detected)
   - Organized by speaker
   - Clear separation between different speakers

## Example Output

### Without Diarization
```
Hello, this is a test recording for WhisperX transcription.
The audio quality seems good and the transcription should be accurate.
```

### With Diarization
```
[SPEAKER_00]: Hello, this is a test recording for WhisperX transcription.
[SPEAKER_01]: Yes, I can confirm the audio quality is excellent.
[SPEAKER_00]: Great! The transcription should be very accurate then.
```

## API Usage

You can also use the components programmatically:

```python
from whisperX.main import WhisperXPipeline

# Initialize pipeline
pipeline = WhisperXPipeline(aws_region='ap-southeast-2')

# Process S3 audio
result = pipeline.process_s3_audio(
    's3://bucket/audio.mp3',
    language='auto',
    model_size='base',
    enable_diarization=True,
    min_speakers=2,
    max_speakers=4
)

# Process local audio
result = pipeline.process_local_audio(
    'local_audio.wav',
    language='en',
    model_size='medium',
    enable_diarization=False
)
```

## Environment Setup

### AWS Credentials
Make sure your AWS credentials are configured. You can use:
- AWS CLI: `aws configure`
- Environment variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- IAM roles (if running on EC2)

### HuggingFace Token
For speaker diarization, you need a HuggingFace token:

1. Create account at [huggingface.co](https://huggingface.co)
2. Go to Settings > Access Tokens
3. Create a new token with read permissions
4. Accept the license agreements for:
   - `pyannote/segmentation-3.0`
   - `pyannote/speaker-diarization-3.1`

## Performance Optimization

### GPU Acceleration
- Install CUDA-compatible PyTorch for GPU acceleration
- Use `--device cuda` to force GPU usage
- Larger batch sizes work better on GPU

### Memory Management
- Use smaller models (`tiny`, `base`) for limited memory
- Reduce batch size if running out of memory
- Use CPU processing for very large files

### Speed vs Accuracy Trade-offs
- `tiny` model: ~32x faster than large, lower accuracy
- `base` model: ~16x faster, good balance (recommended)
- `large` models: Best accuracy, slower processing

## Troubleshooting

### Common Issues

1. **"WhisperX not found"**
   ```bash
   pip install git+https://github.com/m-bain/whisperx.git
   ```

2. **"No HuggingFace token"**
   - Set `HF_TOKEN` environment variable
   - Or use `--hf-token` argument
   - Accept required model licenses

3. **"CUDA out of memory"**
   - Reduce batch size: `--batch-size 8`
   - Use smaller model: `--model-size base`
   - Use CPU: `--device cpu`

4. **"S3 access denied"**
   - Check AWS credentials
   - Verify bucket permissions
   - Check bucket region

5. **"ffmpeg not found"**
   - Install ffmpeg: `sudo apt install ffmpeg` (Ubuntu) or `brew install ffmpeg` (macOS)
   - Ensure ffmpeg is in your PATH

6. **"No audio streams found"**
   - Check if input file is a valid audio file
   - Try converting manually: `ffmpeg -i input.ext output.wav`

### Performance Issues

- **Slow processing**: Use GPU acceleration (`--device cuda`)
- **High memory usage**: Reduce batch size or use smaller model
- **Poor accuracy**: Use larger model or check audio quality

## Audio Preprocessing

The pipeline automatically preprocesses audio files to the optimal format for WhisperX:

- **Mono channel**: Converts stereo/multi-channel audio to single channel
- **16kHz sample rate**: Resamples to the optimal rate for speech recognition
- **WAV format**: Converts to uncompressed WAV for best quality
- **16-bit depth**: Uses 16-bit signed integer samples

### Why This Matters

Audio preprocessing is crucial for optimal transcription quality:
- **Better accuracy**: WhisperX performs best with mono 16kHz audio
- **Consistent results**: Normalized format ensures predictable performance
- **Faster processing**: Optimal format reduces computational overhead

The preprocessor intelligently checks if conversion is needed - if your audio is already in the optimal format, it skips preprocessing.

## File Support

Supported input audio formats:
- WAV, MP3, M4A, FLAC, AAC, OGG
- Any format supported by ffmpeg

All formats are automatically converted to mono 16kHz WAV during preprocessing.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project uses WhisperX which is licensed under MIT License.

## Acknowledgments

- [WhisperX](https://github.com/m-bain/whisperX) by Max Bain et al.
- [OpenAI Whisper](https://github.com/openai/whisper) for the base model
- [pyannote-audio](https://github.com/pyannote/pyannote-audio) for speaker diarization 