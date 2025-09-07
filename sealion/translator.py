#!/usr/bin/env python3
"""
SEA-LION Translator

Translates transcript .txt files from transcript_output/ to English using SEA-LION API.

Requirements:
- Python 3.9+
- openai (pip install openai)
- Optional: python-dotenv for .env support

Usage:
    python sealion/translator.py                          # Translate all .txt files
    python sealion/translator.py --file filename.txt     # Translate specific file
"""

import os
import sys
import time
import argparse
from pathlib import Path
from typing import Optional, List

# Optional .env support - continue silently if not available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    from openai import OpenAI
except ImportError:
    print("❌ OpenAI library not installed. Please run: pip install openai")
    sys.exit(1)


class SEALionTranslator:
    """SEA-LION API client for translating transcripts to English"""
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize SEA-LION API client"""
        self.api_key = api_key or os.getenv('SEALION_API_KEY')
        
        if not self.api_key:
            print("❌ SEA-LION API key not found.")
            print("Please set SEALION_API_KEY in your .env file or pass it as an argument")
            sys.exit(1)
        
        self.client = OpenAI(
            api_key=self.api_key,
            base_url="https://api.sea-lion.ai/v1"
        )
        
        # Rate limit: 10 requests per minute
        self.rate_limit_delay = 6.5  # seconds between requests (slightly over 6 to be safe)
        
        print("✅ Connected to SEA-LION API")
    
    def get_transcript_files(self, specific_file: Optional[str] = None) -> List[Path]:
        """Get list of transcript files to translate"""
        project_root = Path(__file__).parent.parent
        transcript_dir = project_root / "aws" / "transcript_output"
        
        if not transcript_dir.exists():
            print(f"❌ Transcript directory not found: {transcript_dir}")
            print("Run the transcriber first to generate transcript files")
            return []
        
        if specific_file:
            file_path = transcript_dir / specific_file
            if not file_path.exists():
                print(f"❌ File not found: {file_path}")
                return []
            if not file_path.suffix == '.txt':
                print(f"❌ File must be a .txt file: {file_path}")
                return []
            return [file_path]
        
        # Get all .txt files
        txt_files = list(transcript_dir.glob("*_transcript.txt"))
        
        if not txt_files:
            print(f"❌ No transcript .txt files found in {transcript_dir}")
            print("Run the transcriber first to generate transcript files")
            return []
        
        return sorted(txt_files)
    
    def translate_text(self, text: str, source_language: str = "auto-detect") -> str:
        """Translate text to English using SEA-LION API"""
        try:
            # Create translation prompt
            if source_language == "auto-detect":
                prompt = f"""Please translate the following text to English. If the text is already in English, return it unchanged. Preserve the speaker labels (like "Speaker 0:", "Speaker 1:") and formatting:

{text}"""
            else:
                prompt = f"""Please translate the following {source_language} text to English. Preserve the speaker labels (like "Speaker 0:", "Speaker 1:") and formatting:

{text}"""
            
            print("🔄 Sending translation request to SEA-LION API...")
            
            completion = self.client.chat.completions.create(
                model="aisingapore/Gemma-SEA-LION-v4-27B-IT",
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.1,  # Low temperature for consistent translations
                max_tokens=4000   # Reasonable limit for translations
            )
            
            translated_text = completion.choices[0].message.content.strip()
            print("✅ Translation completed")
            
            return translated_text
            
        except Exception as e:
            print(f"❌ Translation failed: {str(e)}")
            if "rate_limit" in str(e).lower():
                print("⏳ Rate limit hit. Waiting longer before retry...")
                time.sleep(60)  # Wait 1 minute on rate limit
            raise
    
    def process_file(self, file_path: Path) -> bool:
        """Process a single transcript file"""
        try:
            print(f"\n📄 Processing: {file_path.name}")
            
            # Read original file
            with open(file_path, 'r', encoding='utf-8') as f:
                original_text = f.read().strip()
            
            if not original_text:
                print("⚠️  File is empty, skipping")
                return True
            
            print(f"📊 Original text length: {len(original_text)} characters")
            
            # Check if already in English (simple heuristic)
            if self.is_likely_english(original_text):
                print("🔍 Text appears to already be in English, translating anyway to ensure consistency...")
            
            # Translate
            translated_text = self.translate_text(original_text)
            
            # Create output filename
            original_name = file_path.stem  # Remove .txt extension
            if original_name.endswith('_transcript'):
                base_name = original_name[:-11]  # Remove '_transcript'
            else:
                base_name = original_name
            
            output_filename = f"{base_name}_transcript_en.txt"
            output_path = file_path.parent / output_filename
            
            # Save translated file
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(translated_text)
            
            print(f"💾 Saved translation: {output_filename}")
            print(f"📊 Translated text length: {len(translated_text)} characters")
            
            return True
            
        except Exception as e:
            print(f"❌ Failed to process {file_path.name}: {str(e)}")
            return False
    
    def is_likely_english(self, text: str) -> bool:
        """Simple heuristic to check if text is likely English"""
        # Count common English words
        english_indicators = [
            'the', 'and', 'is', 'in', 'to', 'of', 'a', 'that', 'it', 'with',
            'for', 'as', 'was', 'on', 'are', 'you', 'this', 'be', 'at', 'have'
        ]
        
        text_lower = text.lower()
        english_word_count = sum(1 for word in english_indicators if f' {word} ' in text_lower)
        
        # If we find several common English words, it's likely English
        return english_word_count >= 3
    
    def translate_files(self, specific_file: Optional[str] = None):
        """Main method to translate transcript files"""
        files_to_process = self.get_transcript_files(specific_file)
        
        if not files_to_process:
            return
        
        print(f"🎯 Found {len(files_to_process)} file(s) to translate")
        
        successful = 0
        failed = 0
        
        for i, file_path in enumerate(files_to_process):
            if self.process_file(file_path):
                successful += 1
            else:
                failed += 1
            
            # Rate limiting - wait between requests (except for last file)
            if i < len(files_to_process) - 1:
                print(f"⏳ Waiting {self.rate_limit_delay}s for rate limit...")
                time.sleep(self.rate_limit_delay)
        
        print(f"\n🎉 Translation complete!")
        print(f"✅ Successfully translated: {successful}")
        if failed > 0:
            print(f"❌ Failed: {failed}")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Translate transcript .txt files to English using SEA-LION API'
    )
    parser.add_argument(
        '--file', '-f',
        help='Specific .txt file to translate (optional, default: translate all)'
    )
    parser.add_argument(
        '--api-key', '-k',
        help='SEA-LION API key (optional, default: from SEALION_API_KEY env var)'
    )
    
    args = parser.parse_args()
    
    # Create translator and process files
    translator = SEALionTranslator(api_key=args.api_key)
    translator.translate_files(specific_file=args.file)


if __name__ == '__main__':
    main() 