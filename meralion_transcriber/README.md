# MERaLiON Transcriber

A complete pipeline for processing medical consultation audio files using **Pyannote** for speaker diarization and **MERaLiON-2-3B** for both transcription and translation, with LLM-powered doctor/patient identification.

## Features

- 🎤 **Multi-format Audio Support**: Process m4a, wav, and mp3 audio files
- 🌐 **S3 Integration**: Direct processing from AWS S3 buckets with automatic download and caching
- 🗣️ **Speaker Diarization**: Identify and separate 2-4 speakers using pyannote
- 📝 **Medical Transcription**: High-quality transcription using MERaLiON-2-3B
- 🌍 **Multi-language Support**: Automatic language detection and MERaLiON-powered translation
- 👨‍⚕️ **Doctor/Patient Identification**: LLM-powered role detection using conversation analysis
- ⚡ **GPU Acceleration**: CUDA support for faster processing
- 📊 **Structured Output**: Comprehensive JSON output with timing and roles
- 📁 **Organized Results**: Outputs saved to `transcript_output/` folder by default

## Installation

### Dependencies

```bash
# Install from requirements.txt (recommended)
pip install -r requirements.txt

# Or install individual dependencies
pip install torch>=2.0.0 torchaudio>=2.0.0
pip install transformers>=4.50.1
pip install pyannote.audio>=3.1.0
pip install librosa>=0.10.0
pip install soundfile>=0.12.0
pip install pydub>=0.25.1
pip install boto3>=1.35.0  # For S3 support
# pip install flash-attn>=2.0.0  # Optional, for faster attention (skip if installation fails)
# Note: langdetect removed - language detection now handled during transcription
```

### Requirements

**HuggingFace Token**: Required for pyannote speaker diarization
- Get token from: https://huggingface.co/settings/tokens  
- Request access to: `pyannote/speaker-diarization-3.1`

*Note: Translation is now handled internally by MERaLiON - no external API keys needed!*

## Quick Start

```python
import os
from meralion_transcriber import MERaLiONTranscriber

# Initialize pipeline (HF_TOKEN loaded from .env automatically)
pipeline = MERaLiONTranscriber(
    huggingface_token=os.getenv('HF_TOKEN'),  # Loaded from .env file
    s3_region="ap-southeast-2"  # Optional for S3 support
)

# Process local audio file
result = pipeline.process_audio_file("consultation.m4a")

# OR process audio directly from S3
result = pipeline.process_audio_file("s3://my-bucket/audio/consultation.m4a")

# Save results to transcript_output folder
os.makedirs("transcript_output", exist_ok=True)
pipeline.save_result_to_json(result, "transcript_output/consultation_transcription.json")

# Access results
print(f"Detected {result.speakers['total']} speakers")
print(f"Doctor: {result.speakers['doctor']}")
print(f"Language: {result.original_language}")
```

## Command Line Usage

```bash
# Basic usage with local audio file (HF_TOKEN from .env)
python meralion_transcriber/example_usage.py \
    --audio consultation.m4a

# Process audio directly from S3
python meralion_transcriber/example_usage.py \
    --audio s3://my-bucket/audio/consultation.m4a \
    --s3-region ap-southeast-2

# Override HF token if needed
python meralion_transcriber/example_usage.py \
    --audio consultation.m4a \
    --hf-token your_token_here

# Specify custom output path and cache directory  
python meralion_transcriber/example_usage.py \
    --audio consultation.m4a \
    --output custom_results.json \
    --cache-dir ./cache \
    --device cuda
```

## Pipeline Components

### 1. S3 Integration (Optional)
- Automatically downloads audio files from AWS S3 buckets
- Supports various S3 URI formats:
  - `s3://bucket/path/file.m4a` (full URI)
  - `s3://file.m4a` (uses default bucket)
  - `path/file.m4a` (uses default bucket if no local file exists)
- Local caching prevents re-downloading the same files
- Seamless fallback to local file processing

### 2. Audio Preprocessing
- Converts m4a/mp3 files to WAV format (16kHz, mono)
- Caches converted files for reuse
- Uses librosa for high-quality conversion

### 3. Speaker Diarization (Pyannote)
- Uses `pyannote/speaker-diarization-3.1` model
- Supports 1-4 speakers (single speaker recordings now supported)
- Merges adjacent segments from same speaker (gap < 1 second)
- GPU acceleration when available

### 4. Transcription (MERaLiON)
- Uses `MERaLiON/MERaLiON-2-3B` model
- Segments longer than 25 seconds are automatically chunked
- Medical consultation context in prompts
- Optimized for clinical terminology

### 5. Language Detection & Translation
- Automatic language detection using first few segments  
- MERaLiON-powered translation for all supported languages
- Medical context-aware translation prompts
- No external API dependencies

### 6. Doctor/Patient Identification  
- LLM-powered analysis using MERaLiON model
- Supports both multi-speaker and single speaker recordings
- Analyzes conversation patterns and medical terminology usage
- Considers question patterns, professional language, and advice-giving
- Intelligent role mapping with fallback heuristics

## Output Format

The pipeline generates structured JSON output:

```json
{
  "original_language": "ms",
  "speakers": {
    "total": 2,
    "doctor": "SPEAKER_00",
    "patients": ["SPEAKER_01"]
  },
  "segments": [
    {
      "speaker_id": "SPEAKER_00",
      "role": "Doctor",
      "start_time": 0.0,
      "end_time": 15.2,
      "text": {
        "original": "Apa masalah anda hari ini?",
        "english": "What is your problem today?"
      }
    },
    {
      "speaker_id": "SPEAKER_01", 
      "role": "Patient",
      "start_time": 15.2,
      "end_time": 28.5,
      "text": {
        "original": "Saya sakit kepala dan demam.",
        "english": "I have a headache and fever."
      }
    }
  ],
  "summary": {
    "total_duration": 1800.0,
    "doctor_speaking_time": 900.0,
    "patient_speaking_time": 900.0
  }
}
```

## Configuration

### Environment Variables

```bash
# Required for speaker diarization
export HF_TOKEN="your_huggingface_token"

# Optional for S3 support
export AWS_ACCESS_KEY_ID="your_aws_access_key"
export AWS_SECRET_ACCESS_KEY="your_aws_secret_key"
export AWS_DEFAULT_REGION="ap-southeast-2"
export AUDIO_S3_BUCKET="my-audio-bucket"  # Default bucket for relative S3 paths

# Translation handled internally by MERaLiON - no external API needed
```

### Pipeline Parameters

```python
pipeline = MERaLiONTranscriber(
    huggingface_token="...",
    device="cuda",                    # or "cpu", None for auto  
    cache_dir="./audio_cache",        # Audio conversion cache
)

# Adjust speaker detection
pipeline.min_speakers = 1            # Minimum speakers (1 = single speaker supported)
pipeline.max_speakers = 4            # Maximum speakers expected
pipeline.segment_merge_threshold = 1.0  # Seconds gap for merging
pipeline.max_segment_length = 25.0   # Max segment for chunking
```

## Performance Considerations

### GPU Memory Management
- Models are loaded with memory optimization
- Use `torch.float16` on CUDA for reduced memory usage
- Sequential processing prevents GPU memory overflow

### Processing Speed
- GPU processing: ~2-3x real-time
- CPU processing: ~0.5x real-time (slower than real-time)
- Caching converted audio files saves time on re-processing

### Rate Limiting
- No external API rate limits (translation handled internally)
- Processing speed limited only by GPU/CPU performance
- Efficient batch processing for translation tasks

## Troubleshooting

### Common Issues

1. **HuggingFace Access Denied**
   ```
   Solution: Request access to pyannote/speaker-diarization-3.1
   ```

2. **CUDA Out of Memory**
   ```python
   # Use CPU for transcription if GPU memory is limited
   pipeline = MERaLiONTranscriber(device="cpu")
   ```

3. **Translation Not Working**
   ```
   Translation handled by MERaLiON model internally
   Check GPU memory if translation fails
   ```

4. **Audio Format Issues**
   ```
   Supported: .m4a, .wav, .mp3
   Large files may need chunking
   ```

### Debug Mode

```python
import logging
logging.basicConfig(level=logging.DEBUG)

# Enable debug logging for detailed output
pipeline = MERaLiONTranscriber(...)
```

## API Reference

### MERaLiONTranscriber

Main pipeline class for processing clinical audio files.

#### Methods

- `process_audio_file(audio_path: str) -> TranscriptionResult`
  - Process complete audio file through pipeline
  
- `preprocess_audio(audio_path: str) -> str`
  - Convert audio to WAV format
  
- `perform_diarization(audio_path: str) -> List[Tuple]`
  - Perform speaker diarization
  
- `transcribe_segments(audio_path: str, segments: List) -> List[Tuple]`
  - Transcribe audio segments
  
- `save_result_to_json(result: TranscriptionResult, output_path: str)`
  - Save results to JSON file

### Data Classes

- `TranscriptionResult`: Complete transcription result
- `Segment`: Individual audio segment with transcription
- `Speaker`: Speaker information and metadata

## License

This project builds upon several open-source models:
- Pyannote: MIT License
- MERaLiON: Custom license (check model page)
- SEA-LION: API usage terms apply

## Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Submit pull request with clear description

## Support

For issues and questions:
1. Check troubleshooting section
2. Review logs with debug mode enabled
3. Open GitHub issue with reproduction steps 