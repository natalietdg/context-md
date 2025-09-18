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
    
    def translate_bulk_conversation(self, turns: List[Dict[str, Any]]) -> List[str]:
        """
        Translate multiple conversation turns in one API call for efficiency
        
        Returns list of translated texts in the same order as input turns
        """
        try:
            # Collect all non-empty texts with turn markers
            turn_texts = []
            turn_mapping = []  # Track which turns have text
            
            for i, turn in enumerate(turns):
                if 'text' not in turn or not turn['text'].strip():
                    continue
                    
                turn_texts.append(f"[TURN_{i+1}] {turn['text']}")
                turn_mapping.append(i)
            
            if not turn_texts:
                print("⚠️  No text content found to translate")
                return [turn.get('text', '') for turn in turns]
            
            # Combine all turns into one text block
            combined_text = "\n\n".join(turn_texts)
            
            print(f"🚀 Bulk translating {len(turn_texts)} turns in one API call...")
            
            # Create specialized prompt for conversation translation
            prompt = f"""Please translate the following conversation turns to English. Each turn is marked with [TURN_X] followed by the text. 

Preserve the exact [TURN_X] markers and return the translation in the same format, maintaining the same number of turns and order. If any text is already in English, return it unchanged but still with its [TURN_X] marker.

{combined_text}"""
            
            print("🔄 Sending bulk translation request to SEA-LION API...")
            
            completion = self.client.chat.completions.create(
                model="aisingapore/Gemma-SEA-LION-v4-27B-IT",
                messages=[
                    {
                        "role": "user", 
                        "content": prompt
                    }
                ],
                temperature=0.1,  # Low temperature for consistent translations
                max_tokens=4000   # Higher limit for bulk content
            )
            
            translated_response = completion.choices[0].message.content.strip()
            print("✅ Bulk translation completed")
            
            # Parse response back into individual turns
            translated_texts = self._parse_bulk_response(translated_response, len(turns), turn_mapping)
            
            return translated_texts
            
        except Exception as e:
            print(f"❌ Bulk translation failed: {str(e)}")
            print("🔄 Falling back to individual turn translation...")
            # Fallback to individual translation
            return self._translate_turns_individually(turns)
    
    def _parse_bulk_response(self, response: str, total_turns: int, turn_mapping: List[int]) -> List[str]:
        """Parse bulk translation response back into individual turn texts"""
        try:
            # Initialize result array with original texts
            result = [''] * total_turns
            
            # Extract translated turns using regex or string splitting
            import re
            
            # Find all [TURN_X] markers and their content
            turn_pattern = r'\[TURN_(\d+)\]\s*(.*?)(?=\[TURN_\d+\]|$)'
            matches = re.findall(turn_pattern, response, re.DOTALL)
            
            for turn_num_str, content in matches:
                try:
                    turn_index = int(turn_num_str) - 1  # Convert to 0-based index
                    if 0 <= turn_index < total_turns:
                        # Clean up the content
                        cleaned_content = content.strip()
                        result[turn_index] = cleaned_content
                except (ValueError, IndexError):
                    continue
            
            # Fill in any missing translations with empty strings
            for i, text in enumerate(result):
                if not text and i < len(turn_mapping):
                    result[i] = ''  # Keep empty for missing translations
            
            return result
            
        except Exception as e:
            print(f"⚠️  Error parsing bulk response: {str(e)}")
            print("🔄 Falling back to individual turn translation...")
            # Return empty list to trigger fallback
            return []
    
    def _translate_turns_individually(self, turns: List[Dict[str, Any]]) -> List[str]:
        """Fallback method: translate turns individually (original behavior)"""
        result = []
        
        for i, turn in enumerate(turns):
            if 'text' not in turn or not turn['text'].strip():
                result.append(turn.get('text', ''))
                continue
            
            print(f"📝 Translating turn {i+1}/{len(turns)} individually (Speaker: {turn.get('speaker', 'Unknown')})")
            
            try:
                translated_text = self.translate_text(turn['text'])
                result.append(translated_text)
            except Exception as e:
                print(f"⚠️  Error translating turn {i+1}: {str(e)}")
                result.append(turn['text'])  # Keep original on error
            
            # Rate limiting between requests (except for last turn)
            if i < len(turns) - 1:
                print(f"⏳ Waiting {self.rate_limit_delay}s for rate limit...")
                time.sleep(self.rate_limit_delay)
        
        return result

    def translate_json(self, json_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Translate JSON transcript data from whisperX lean format using bulk translation
        
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
            
            print(f"🎯 Preparing to translate {len(json_data['turns'])} turns using bulk translation...")
            
            # Use bulk translation
            translated_texts = self.translate_bulk_conversation(translated_data['turns'])
            
            # Apply translated texts back to turns
            for i, (turn, translated_text) in enumerate(zip(translated_data['turns'], translated_texts)):
                if translated_text:  # Only update if we got a translation
                    turn['text'] = translated_text
            
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
    
    def translate_transcript(self, transcript_path: str) -> str:
        """
        Pipeline-compatible method to translate transcript file
        
        Args:
            transcript_path: Path to lean transcript JSON file
            
        Returns:
            Path to translated JSON file (or original path if translation fails/skipped)
        """
        try:
            # Read transcript file
            with open(transcript_path, 'r', encoding='utf-8') as f:
                transcript_data = json.load(f)
            
            # Check if translation should be skipped
            if self.should_skip_translation(transcript_data):
                return transcript_path
            
            # Translate the transcript
            translated_data = self.translate_json(transcript_data)
            
            # Save translated result
            from pathlib import Path
            input_path = Path(transcript_path)
            translated_filename = f"{input_path.stem}_translated.json"
            translated_path = input_path.parent.parent / "02_translated" / translated_filename
            
            # Ensure output directory exists
            translated_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(translated_path, 'w', encoding='utf-8') as f:
                json.dump(translated_data, f, indent=2, ensure_ascii=False)
            
            print(f"✅ Translation completed: {translated_path}")
            return str(translated_path)
            
        except Exception as e:
            print(f"❌ Translation failed: {e}")
            return transcript_path  # Return original path on failure


def main():
    """Demo usage"""
    print("SEA-LION JSON Translator - Demo Mode")
    print("This is a library class. Import and use programmatically.")
    print("Example usage:")
    print("  translator = SEALionTranslator()")
    print("  result = translator.translate_json(your_json_data)")


if __name__ == '__main__':
    main() 