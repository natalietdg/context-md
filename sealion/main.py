#!/usr/bin/env python3
"""
SEA-LION Translation Script

Translates JSON transcript files from outputs/01_transcripts_lean to outputs/02_translated
using the SEA-LION API.

Usage:
    python sealion/main.py                    # Translate all JSON files
    python sealion/main.py --file filename    # Translate specific file
    python sealion/main.py --api-key key      # Use custom API key

Requirements:
- SEALION_API_KEY environment variable or .env file
- Input files in outputs/01_transcripts_lean/
"""

import os
import sys
import json
import argparse
from pathlib import Path
from typing import Optional, List

# Add the project root to Python path to import from sealion
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from sealion.translator import SEALionTranslator


class TranslationProcessor:
    """Handles batch translation of JSON transcript files"""
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize with translator and set up directories"""
        self.translator = SEALionTranslator(api_key)
        
        # Set up directory paths relative to project root
        self.input_dir = project_root / "outputs" / "01_transcripts_lean"
        self.output_dir = project_root / "outputs" / "02_translated"
        
        # Create output directory if it doesn't exist
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        print(f"📁 Input directory: {self.input_dir}")
        print(f"📁 Output directory: {self.output_dir}")
    
    def get_json_files(self) -> List[Path]:
        """Get all JSON files from the input directory"""
        if not self.input_dir.exists():
            print(f"❌ Input directory not found: {self.input_dir}")
            return []
        
        json_files = list(self.input_dir.glob("*.json"))
        print(f"🔍 Found {len(json_files)} JSON files to process")
        
        return json_files
    
    def translate_file(self, input_file: Path) -> bool:
        """
        Translate a single JSON file
        
        Returns True if successful, False otherwise
        """
        try:
            # Generate output filename
            output_filename = input_file.stem + "_translated.json"
            output_path = self.output_dir / output_filename
            
            print(f"\n🎯 Processing: {input_file.name}")
            print(f"💾 Output will be: {output_filename}")
            
            # Check if output already exists
            if output_path.exists():
                response = input("⚠️  Output file already exists. Overwrite? (y/N): ")
                if response.lower() != 'y':
                    print("⏭️  Skipping file")
                    return True
            
            # Read input JSON
            print("📖 Reading input file...")
            with open(input_file, 'r', encoding='utf-8') as f:
                json_data = json.load(f)
            
            # Translate the JSON
            translated_data = self.translator.translate_json(json_data)
            
            # Write output JSON
            print(f"💾 Saving translated file to {output_filename}")
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(translated_data, f, indent=2, ensure_ascii=False)
            
            print(f"✅ Successfully translated {input_file.name}")
            return True
            
        except FileNotFoundError:
            print(f"❌ File not found: {input_file}")
            return False
        except json.JSONDecodeError as e:
            print(f"❌ Invalid JSON in {input_file.name}: {str(e)}")
            return False
        except Exception as e:
            print(f"❌ Error translating {input_file.name}: {str(e)}")
            return False
    
    def translate_all(self) -> None:
        """Translate all JSON files in the input directory"""
        json_files = self.get_json_files()
        
        if not json_files:
            print("❌ No JSON files found to translate")
            return
        
        print(f"\n🚀 Starting batch translation of {len(json_files)} files...")
        
        success_count = 0
        total_files = len(json_files)
        
        for i, json_file in enumerate(json_files, 1):
            print(f"\n{'='*50}")
            print(f"📄 File {i}/{total_files}: {json_file.name}")
            print(f"{'='*50}")
            
            if self.translate_file(json_file):
                success_count += 1
            
            # Add a small delay between files to be respectful to the API
            if i < total_files:
                print("⏳ Waiting 2 seconds before next file...")
                import time
                time.sleep(2)
        
        print(f"\n🎉 Batch translation complete!")
        print(f"✅ Successfully translated: {success_count}/{total_files} files")
        print(f"📁 Translated files saved to: {self.output_dir}")
    
    def translate_specific_file(self, filename: str) -> None:
        """Translate a specific file by name"""
        input_path = self.input_dir / filename
        
        # Try with .json extension if not provided
        if not input_path.exists() and not filename.endswith('.json'):
            input_path = self.input_dir / (filename + '.json')
        
        if not input_path.exists():
            print(f"❌ File not found: {filename}")
            print(f"💡 Available files in {self.input_dir}:")
            for json_file in self.get_json_files():
                print(f"   - {json_file.name}")
            return
        
        print(f"🎯 Translating specific file: {input_path.name}")
        
        if self.translate_file(input_path):
            print(f"✅ Successfully translated {input_path.name}")
        else:
            print(f"❌ Failed to translate {input_path.name}")


def main():
    """Main function with CLI argument parsing"""
    parser = argparse.ArgumentParser(
        description="Translate JSON transcript files using SEA-LION API",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python sealion/main.py                          # Translate all files
  python sealion/main.py --file filename.json    # Translate specific file
  python sealion/main.py --api-key your-key      # Use custom API key
        """
    )
    
    parser.add_argument(
        '--file', '-f',
        type=str,
        help='Translate a specific file (filename or full path)'
    )
    
    parser.add_argument(
        '--api-key', '-k',
        type=str,
        help='SEA-LION API key (overrides environment variable)'
    )
    
    parser.add_argument(
        '--list', '-l',
        action='store_true',
        help='List available files without translating'
    )
    
    args = parser.parse_args()
    
    try:
        # Initialize processor
        processor = TranslationProcessor(api_key=args.api_key)
        
        if args.list:
            # Just list files
            json_files = processor.get_json_files()
            print("\n📋 Available files for translation:")
            for json_file in json_files:
                print(f"   - {json_file.name}")
            return
        
        if args.file:
            # Translate specific file
            processor.translate_specific_file(args.file)
        else:
            # Translate all files
            processor.translate_all()
            
    except KeyboardInterrupt:
        print("\n\n⏹️  Translation interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main() 