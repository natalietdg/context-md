#!/usr/bin/env python3
"""
SEA-LION JSON Translator

Translates JSON transcript data from whisperX lean format to English using SEA-LION API.
Input and output formats are identical, only the text content is translated.

Requirements:
- Python 3.9+
- openai (pip install openai)
- Optional: python-dotenv for .env support

Usage:
    translator = SEALionTranslator()
    translated_json = translator.translate_json(input_json_data)
"""

import os
import sys
import time
import json
from typing import Dict, List, Any, Optional

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
    """SEA-LION API client for translating JSON transcript data to English"""
    
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
    
    def should_skip_translation(self, json_data: Dict[str, Any]) -> bool:
        """Check if translation should be skipped (already English)"""
        languages_detected = json_data.get('languages_detected', [])
        
        # Skip if languages_detected contains only 'en'
        if languages_detected == ['en']:
            print("🔍 Content already in English, skipping translation")
            return True
        
        return False
    
    def translate_text(self, text: str) -> str:
        """Translate text to English using SEA-LION API"""
        try:
            prompt = f"""Please translate the following text to English. If the text is already in English, return it unchanged. Preserve the original meaning and tone:

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
                max_tokens=1000   # Reasonable limit for individual text segments
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
    
    def translate_json(self, json_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Translate JSON transcript data from whisperX lean format
        
        Expected input format:
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
        
        Returns same format with translated text
        """
        try:
            # Validate input format
            if 'turns' not in json_data:
                raise ValueError("Invalid JSON format: missing 'turns' array")
            
            # Check if we should skip translation
            if self.should_skip_translation(json_data):
                return json_data
            
            # Create a deep copy to avoid modifying original
            translated_data = json.loads(json.dumps(json_data))
            
            print(f"🎯 Translating {len(json_data['turns'])} turns...")
            
            # Translate each turn
            for i, turn in enumerate(translated_data['turns']):
                if 'text' not in turn:
                    print(f"⚠️  Turn {i+1} missing 'text' field, skipping")
                    continue
                
                original_text = turn['text']
                if not original_text.strip():
                    print(f"⚠️  Turn {i+1} has empty text, skipping")
                    continue
                
                print(f"📝 Translating turn {i+1}/{len(translated_data['turns'])} (Speaker: {turn.get('speaker', 'Unknown')})")
                
                # Translate the text
                translated_text = self.translate_text(original_text)
                turn['text'] = translated_text
                
                # Rate limiting between requests (except for last turn)
                if i < len(translated_data['turns']) - 1:
                    print(f"⏳ Waiting {self.rate_limit_delay}s for rate limit...")
                    time.sleep(self.rate_limit_delay)
            
            # Update languages_detected to indicate translation to English
            translated_data['languages_detected'] = ['en']
            
            print("🎉 JSON translation complete!")
            return translated_data
            
        except Exception as e:
            print(f"❌ Failed to translate JSON: {str(e)}")
            raise
    
    def translate_json_string(self, json_string: str) -> str:
        """
        Convenience method to translate JSON string input and return JSON string output
        """
        try:
            # Parse JSON string
            json_data = json.loads(json_string)
            
            # Translate
            translated_data = self.translate_json(json_data)
            
            # Return as JSON string
            return json.dumps(translated_data, indent=2, ensure_ascii=False)
            
        except json.JSONDecodeError as e:
            print(f"❌ Invalid JSON input: {str(e)}")
            raise
        except Exception as e:
            print(f"❌ Translation failed: {str(e)}")
            raise


def main():
    """Demo usage"""
    print("SEA-LION JSON Translator - Demo Mode")
    print("This is a library class. Import and use programmatically.")
    print("Example usage:")
    print("  translator = SEALionTranslator()")
    print("  result = translator.translate_json(your_json_data)")


if __name__ == '__main__':
    main() 