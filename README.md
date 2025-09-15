# Context-MD

Multi-modal audio transcription and translation pipelines using AWS Transcribe, WhisperX, Clinical Transcription with MERaLiON, and SEA-LION API.

## Project Structure

```
context-md/
├── .env                    # Your API keys and configuration
├── .env.example           # Configuration template
├── requirements.txt       # Python dependencies  
├── aws_transcribe.py      # 🎵 Transcribe audio files
├── translate.py           # 🌍 Translate to English
├── aws/                   # AWS utilities
│   ├── transcriber.py     # Core transcription logic
│   ├── s3_downloader.py   # S3 audio downloader (shared)
│   ├── transcript_output/ # Generated transcripts
│   └── README.md          # AWS documentation
├── whisperX/              # 🎤 WhisperX transcription & diarization
│   ├── main.py            # Main pipeline script
│   ├── audio_processor.py # Audio preprocessing (mono 16kHz)
│   ├── whisperx_transcriber.py # WhisperX implementation
│   ├── setup.sh           # Installation script
│   ├── README.md          # WhisperX documentation
│   └── transcript_output/ # WhisperX output files
├── meralion_transcriber/ # 🏥 MERaLiON medical transcription pipeline
│   ├── pipeline.py        # Main clinical pipeline
│   ├── example_usage.py   # Usage examples
│   ├── config.py          # Configuration management
│   └── README.md          # Clinical pipeline documentation
├── transcript_output/     # 📁 Clinical transcription results
└── sealion/               # SEA-LION utilities  
    ├── translator.py      # Core translation logic
    └── README.md          # Translation documentation
```

## Quick Start

### 1. Setup Environment
```bash
# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install boto3 requests openai python-dotenv

# Configure credentials
cp .env.example .env
# Edit .env with your API keys
```

### 2. Configure API Keys

Edit `.env` file:
```bash
# AWS Configuration
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key  
AWS_DEFAULT_REGION=ap-southeast-2
AUDIO_S3_BUCKET=your-s3-bucket-name

# SEA-LION API
SEALION_API_KEY=your-sealion-api-key
```

### 3. Complete Workflow

```bash
# Step 1: Transcribe audio from S3
python aws_transcribe.py path/to/audio.m4a

# Step 2: Translate to English  
python translate.py

# Results in aws/transcript_output/:
# - audio_transcript.txt      (original)
# - audio_transcript_en.txt   (English)
# - audio_transcript.json     (full AWS response)
```

## Features

### 🎵 **Transcription (AWS Transcribe)**
- **Multi-language detection**: Auto-detects between en-US, zh-CN, ms-MY
- **Speaker diarization**: Identifies up to 2 speakers
- **S3 integration**: Reads .m4a files directly from S3
- **Dual output**: Plain text + full JSON response

### 🌍 **Translation (SEA-LION API)**
- **Gemma-v4-27B-IT model**: State-of-the-art instruct-tuned LLM
- **Smart processing**: Preserves speaker labels and formatting
- **Rate limiting**: Automatic 10 RPM compliance
- **Batch processing**: Handles multiple files automatically

### 🎤 **WhisperX (Advanced Transcription)**
- **Multi-language support**: English, Malay, Chinese with auto-detection
- **Speaker diarization**: Advanced speaker identification and separation
- **Audio preprocessing**: Automatic conversion to mono 16kHz WAV
- **Word-level timestamps**: Precise timing for each word
- **S3 integration**: Direct processing from S3 buckets
- **GPU acceleration**: CUDA support for faster processing

### 🛠️ **Developer Experience**
- **Modular design**: Separate AWS and SEA-LION concerns
- **Error handling**: Comprehensive error reporting
- **Progress feedback**: Clear status updates
- **Flexible usage**: Wrapper scripts + direct execution

## Usage Examples

### Transcription
```bash
# Using S3 path (bucket from .env)
python aws_transcribe.py recordings/meeting.m4a

# Using full S3 URI
python aws_transcribe.py s3://bucket/recordings/meeting.m4a

# Specify language
python aws_transcribe.py recordings/meeting.m4a --language zh-CN

# Different region
python aws_transcribe.py recordings/meeting.m4a --region us-east-1
```

### Translation
```bash
# Translate all transcript files
python translate.py

# Translate specific file
python translate.py --file meeting_transcript.txt

# Direct execution
python sealion/translator.py --file specific_file.txt
```

## API Requirements

### AWS Setup
1. Create AWS account
2. Set up IAM user with Transcribe + S3 permissions
3. Create S3 bucket for audio files
4. Generate access key pair

### SEA-LION Setup
1. Visit [SEA-LION Playground](https://playground.sea-lion.ai/)
2. Sign in with Google account
3. Navigate to API Key Manager
4. Create New Trial API Key

## Supported Formats

- **Audio**: .m4a files (stored in S3)
- **Languages**: English (US), Chinese (Simplified), Malay
- **Output**: UTF-8 text files with speaker labels

## Rate Limits

- **AWS Transcribe**: Standard service limits
- **SEA-LION API**: 10 requests per minute (handled automatically)

## Directory Details

- **`aws/`**: AWS Transcribe functionality, outputs to `aws/transcript_output/`
- **`sealion/`**: SEA-LION translation functionality  
- **`.env`**: Private configuration (never commit)
- **Wrappers**: `aws_transcribe.py` and `translate.py` for convenience

## Contributing

1. Fork the repository
2. Create feature branch
3. Test with your AWS/SEA-LION credentials  
4. Submit pull request

## License

MIT License - see LICENSE file for details 