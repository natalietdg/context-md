# SEA-LION Utilities

This folder contains SEA-LION API-related scripts and utilities for the context-md project.

## Scripts

### `main.py` ⭐ **Recommended**
Translates JSON transcript files from `outputs/01_transcripts_lean/` to `outputs/02_translated/` using SEA-LION API.

**Features:**
- Uses SEA-LION Gemma-v4-27B-IT instruct model
- **🚀 Bulk translation**: Translates entire conversations in one API call (much faster!)
- Processes whisperX lean JSON format with speaker turns
- Preserves original JSON structure with translated text
- Rate limiting compliance (10 requests per minute)
- Batch processing of all JSON files or individual file selection
- Smart English detection to avoid redundant translations
- Automatic output directory creation
- Overwrite protection with user confirmation
- Progress tracking and error handling
- Automatic fallback to per-turn translation if bulk fails

**Usage:**
```bash
# Translate all JSON files in outputs/01_transcripts_lean/
python sealion/main.py

# Translate a specific file
python sealion/main.py --file filename.json

# List available files without translating
python sealion/main.py --list

# Use custom API key
python sealion/main.py --api-key your-api-key
```

**Input Format (whisperX lean JSON):**
```json
{
  "languages_detected": ["ms"],
  "turns": [
    {
      "turn_id": 1,
      "speaker": "SPEAKER_01", 
      "text": "original text here"
    }
  ]
}
```

**Output:** `filename_translated.json` with same structure but translated text

**⚡ Performance:**
- **4-turn conversation**: 1 API call (~7s) vs 4 API calls (~26s) - **75% faster**
- **10-turn conversation**: 1 API call (~7s) vs 10 API calls (~65s) - **90% faster**  
- Dramatically reduces rate limit risk and translation time

### `translator.py` *(Legacy)*
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

### JSON Translation (main.py)
English translations are saved to `outputs/02_translated/`:
- `<filename>_translated.json` - Translated JSON with same structure as input

### Text Translation (translator.py)
English translations are saved to `aws/transcript_output/`:
- `<filename>_transcript_en.txt` - English translation with speaker labels

## Rate Limits

- **10 requests per minute** per API key
- **main.py**: Uses bulk translation (1 API call per conversation) - much more efficient!
- **translator.py**: Individual turn translation with 6.5s delays between turns
- Additional 2s delay between files in batch mode

## Supported Languages

The translator works best with:
- Chinese (Simplified/Traditional)
- Malay  
- English (will process for consistency)
- Other languages supported by SEA-LION models

## Integration

### Modern JSON Workflow (Recommended)
1. `python whisperX/main.py audio.m4a` → Creates transcript in outputs/00_transcripts/
2. Convert to lean format → outputs/01_transcripts_lean/
3. `python sealion/main.py` → Creates English translation in outputs/02_translated/

### Legacy Text Workflow
1. `python aws_transcribe.py audio.m4a` → Creates transcript
2. `python translate.py` → Creates English translation 