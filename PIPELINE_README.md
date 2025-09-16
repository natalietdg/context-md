# Audio Processing Pipeline

A comprehensive pipeline that orchestrates the complete audio processing workflow from S3 download to clinical information extraction.

## 🎯 Overview

The `pipeline.py` script provides a unified interface that sequentially processes audio files through all stages:

1. **📥 S3 Download**: Downloads audio files from AWS S3 buckets
2. **🎙️ Transcription**: Converts audio to text using WhisperX with speaker diarization
3. **🌍 Translation**: Translates non-English transcripts to English using SEA-LION API
4. **🏥 Clinical Extraction**: Extracts structured medical information using LLM

## 🚀 Quick Start

### Basic Usage

```bash
# Process S3 audio file
python pipeline.py s3://your-bucket/consultation.m4a 

# Process local audio file
python pipeline.py /path/to/audio.wav

# With specific language and whisperX model size 
python pipeline.py audio.mp3 --language en --model-size base
```

### Advanced Usage

```bash
# With speaker diarization (2-4 speakers)
python pipeline.py audio.m4a --min-speakers 2 --max-speakers 4

# Skip translation for English audio
python pipeline.py english_audio.wav --skip-translation

# Skip clinical extraction (transcription + translation only)
python pipeline.py audio.m4a --skip-clinical

# Verbose output with custom settings
python pipeline.py s3://bucket/audio.m4a --verbose --cache-dir ./my_cache

# Use custom clinical extraction model
python pipeline.py audio.m4a --clinical-model microsoft/DialoGPT-medium

# Use local model for clinical extraction
python pipeline.py audio.m4a --clinical-model /path/to/local/model 
python pipeline.py s3://english2p1.m4a --clinical-model /Users/estherlow/models/Qwen2.5-3B-Instruct
```

## 📋 Prerequisites

### Required Dependencies

Install all required Python packages:

```bash
# Core dependencies
pip install torch>=2.0.0 torchaudio>=2.0.0
pip install git+https://github.com/m-bain/whisperx.git
pip install boto3 python-dotenv openai
pip install transformers>=4.21.0

# For clinical extraction
pip install accelerate
```

### Environment Variables

Set up your `.env` file in the project root:

```bash
# AWS credentials for S3 access
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_DEFAULT_REGION=ap-southeast-1

# SEA-LION API key for translation
SEALION_API_KEY=your_sealion_api_key

# HuggingFace token for speaker diarization (optional)
HF_TOKEN=your_huggingface_token
```

### Get API Keys

1. **SEA-LION API Key**: Visit [SEA-LION Playground](https://playground.sea-lion.ai/)
   - Sign in with Google account
   - Navigate to API Key Manager
   - Create New Trial API Key

2. **HuggingFace Token** (for speaker diarization):
   - Create account at [huggingface.co](https://huggingface.co)
   - Go to Settings > Access Tokens
   - Create token with read permissions
   - Accept licenses for `pyannote/segmentation-3.0` and `pyannote/speaker-diarization-3.1`

## 🔧 Command Line Options

### Input

```bash
audio_input              # Audio file (S3 URI, S3 path, or local file)
```

### Transcription Options

```bash
--language, -l          # Language code (auto, en, ms, zh, etc.) [default: auto]
--model-size, -m        # WhisperX model size [default: large-v2]
                        # Options: tiny, base, small, medium, large-v1, large-v2, large-v3
```

### Speaker Diarization

```bash
--min-speakers          # Minimum number of speakers
--max-speakers          # Maximum number of speakers
```

### Pipeline Control

```bash
--skip-translation      # Skip translation step (for English audio)
--skip-clinical         # Skip clinical extraction step
```

### Configuration

```bash
--cache-dir             # Directory for caching downloaded files
--aws-region            # AWS region override
--sealion-api-key       # SEA-LION API key override
--hf-token              # HuggingFace token override
--clinical-model        # Model name/path for clinical extraction [default: Qwen/Qwen2.5-3B-Instruct]
--verbose, -v           # Enable verbose output
```

## 📂 Output Structure

The pipeline creates organized output directories:

```
outputs/
├── 00_transcripts/           # Raw WhisperX transcription results
│   └── audio_whisperx_1234567890.json
├── 01_transcripts_lean/      # Clean transcript format
│   └── audio_lean_1234567890.json
├── 02_translated/            # English translations
│   └── audio_lean_1234567890_translated.json
└── 03_clinical_extraction/   # Structured clinical data
    └── audio_lean_1234567890_clinical.json
```

## 📊 Example Workflow

### Input: S3 Audio File
```bash
python pipeline.py s3://medical-audio/consultation_001.m4a --min-speakers 2 --max-speakers 2
```

### Pipeline Steps:
1. **Download**: `consultation_001.m4a` → `audio_cache/consultation_001.m4a`
2. **Transcription**: Audio → `consultation_001_whisperx_1699123456.json` (raw) + `consultation_001_lean_1699123456.json` (clean)
3. **Translation**: Malay transcript → `consultation_001_lean_1699123456_translated.json` (English)
4. **Clinical Extraction**: English transcript → `consultation_001_lean_1699123456_clinical.json` (structured data)

### Final Output:
```json
{
  "summary": "Patient presented with chest pain, diagnosed with stable angina, prescribed aspirin",
  "chief_complaint": "SPEAKER_01: Doctor, I've been having chest pain for 2 days",
  "symptoms_present": ["chest pain"],
  "symptoms_negated": ["fever", "shortness of breath"],
  "onset_or_duration": "2 days",
  "primary_diagnosis": "stable angina",
  "rx_drug": "aspirin",
  "rx_dose": "100mg daily",
  "_metadata": {
    "source_file": "consultation_001_lean_1699123456_translated.json",
    "model_used": "Qwen/Qwen2.5-3B-Instruct",
    "extraction_method": "llm",
    "pipeline_version": "1.0"
  }
}
```

## ⚡ Performance Tips

### For Faster Processing:
- Use smaller models (`--model-size base`) for development
- Skip unnecessary steps (`--skip-translation` for English audio)
- Use GPU acceleration (ensure CUDA is installed)
- Cache frequently used audio files

### For Better Accuracy:
- Use larger models (`--model-size large-v3`) for production
- Specify language explicitly (`--language ms` instead of `auto`)
- Use speaker diarization for multi-speaker conversations
- Ensure good audio quality (16kHz, mono preferred)

## 🐛 Troubleshooting

### Common Issues:

**Import Errors:**
```bash
❌ Import error: No module named 'whisperx'
```
Solution: Install WhisperX with `pip install git+https://github.com/m-bain/whisperx.git`

**AWS Credentials:**
```bash
⚠️ S3 downloader initialization failed
```
Solution: Configure AWS credentials or check `.env` file

**Memory Issues:**
```bash
❌ CUDA out of memory
```
Solution: Use smaller model (`--model-size base`) or process on CPU

**API Rate Limits:**
```bash
❌ Translation failed: rate_limit
```
Solution: SEA-LION API has 10 requests/minute limit. Pipeline handles this automatically.

### Debug Mode:
```bash
python pipeline.py audio.mp3 --verbose
```

## 🔀 Integration with Existing Tools

The pipeline integrates seamlessly with existing project components:

- **S3 Downloader**: `aws/s3_downloader.py`
- **WhisperX**: `whisperX/whisperx_transcriber.py`
- **SEA-LION**: `sealion/translator.py`
- **Clinical Extractor**: `clinical_extractor_llm/extractor.py`

You can also use individual components separately if needed.

## 📈 Monitoring & Logging

The pipeline provides comprehensive logging:

- ✅ Success indicators for each step
- ⏱️ Processing time tracking
- 📊 Summary statistics
- 🎯 Final results paths
- ❌ Error messages with context

All output files include metadata for traceability and debugging. 