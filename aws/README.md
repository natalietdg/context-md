# AWS Utilities

This folder contains AWS-related scripts and utilities for the context-md project.

## Scripts

### `transcriber.py`
Transcribes .m4a audio files from S3 using Amazon Transcribe service.

**Features:**
- Automatic language detection (en-US, zh-CN, ms-MY)
- Speaker diarization (up to 2 speakers)
- Outputs both plain text and JSON formats
- Uses S3 bucket from environment variables

**Usage:**
```bash
# From project root using wrapper
python aws_transcribe.py path/to/audio.m4a

# Direct execution
python aws/transcriber.py path/to/audio.m4a

# As module
python -m aws.transcriber path/to/audio.m4a
```



## Configuration

Make sure your `.env` file contains:
```bash
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_DEFAULT_REGION=your-region
AUDIO_S3_BUCKET=your-bucket-name
```

## Output

All transcript files are saved to `aws/transcript_output/`:
- `<filename>_transcript.txt` - Plain text with speaker labels
- `<filename>_transcript.json` - Full AWS Transcribe response 