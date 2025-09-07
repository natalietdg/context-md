# SEA-LION Utilities

This folder contains SEA-LION API-related scripts and utilities for the context-md project.

## Scripts

### `translator.py`
Translates transcript .txt files from `aws/transcript_output/` to English using SEA-LION API.

**Features:**
- Uses SEA-LION Gemma-v4-27B-IT instruct model
- Preserves speaker labels and formatting  
- Auto-detects source language
- Rate limiting compliance (10 requests per minute)
- Batch processing of all transcript files
- Smart English detection to avoid redundant translations

**Usage:**
```bash
# From project root using wrapper
python translate.py

# Translate all transcript files
python sealion/translator.py

# Translate specific file
python sealion/translator.py --file filename_transcript.txt

# With custom API key
python sealion/translator.py --api-key your-api-key

# As module
python -m sealion.translator --file filename_transcript.txt
```

## Configuration

Make sure your `.env` file contains:
```bash
SEALION_API_KEY=your-sealion-api-key
```

Get your API key from the [SEA-LION Playground](https://playground.sea-lion.ai/) by:
1. Sign in with Google account
2. Navigate to API Key Manager  
3. Create New Trial API Key

## Output

English translations are saved to `aws/transcript_output/`:
- `<filename>_transcript_en.txt` - English translation with speaker labels

## Rate Limits

- **10 requests per minute** per API key
- Script automatically handles rate limiting with 6.5s delays
- Processes files sequentially to stay within limits

## Supported Languages

The translator works best with:
- Chinese (Simplified/Traditional)
- Malay  
- English (will process for consistency)
- Other languages supported by SEA-LION models

## Integration

Designed to work seamlessly with the AWS transcriber workflow:
1. `python aws_transcribe.py audio.m4a` → Creates transcript
2. `python translate.py` → Creates English translation 