#!/usr/bin/env python3
"""
Command line interface for clinical text extraction.
Usage: python cli.py --file path/to/transcript.txt
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, Any

from extractor import build_nlp, extract_minimal_json


def extract_text_from_json(json_data: Dict[Any, Any]) -> str:
    """
    Extract text content from translated JSON file.
    Looks for common text fields in translated JSON structures.
    """
    # Common field names that might contain the translated text
    text_fields = [
        'text', 'translated_text', 'transcript', 'content', 
        'english_text', 'translation', 'english_translation'
    ]
    
    # Try to find text in the JSON structure
    for field in text_fields:
        if field in json_data and isinstance(json_data[field], str):
            return json_data[field].strip()
    
    # If no direct text field found, look for nested structures
    if isinstance(json_data, dict):
        # Look for turns structure (common in conversation transcripts)
        if 'turns' in json_data and isinstance(json_data['turns'], list):
            turns_text = []
            for turn in json_data['turns']:
                if isinstance(turn, dict) and 'text' in turn:
                    speaker = turn.get('speaker', 'Speaker')
                    text = turn['text'].strip()
                    if text:
                        turns_text.append(f"{speaker}: {text}")
            if turns_text:
                return ' '.join(turns_text)
        
        # Look for segments or similar structures
        if 'segments' in json_data and isinstance(json_data['segments'], list):
            segments_text = []
            for segment in json_data['segments']:
                if isinstance(segment, dict):
                    for field in text_fields:
                        if field in segment and isinstance(segment[field], str):
                            segments_text.append(segment[field].strip())
                            break
                elif isinstance(segment, str):
                    segments_text.append(segment.strip())
            if segments_text:
                return ' '.join(segments_text)
        
        # Look for any string value in the JSON
        for key, value in json_data.items():
            if isinstance(value, str) and len(value.strip()) > 20:  # Assume meaningful text is longer than 20 chars
                return value.strip()
    
    # If all else fails, convert the entire JSON to string
    return json.dumps(json_data) if json_data else ""


def main():
    parser = argparse.ArgumentParser(
        description='Extract clinical information from consultation transcripts',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python cli.py --file consultation.txt
  python cli.py --file /path/to/transcript.json
        """
    )
    
    parser.add_argument(
        '--file', '-f',
        type=str,
        required=True,
        help='Path to the text file or JSON file containing the transcript'
    )
    
    parser.add_argument(
        '--output', '-o',
        type=str,
        help='Output file path (default: saves to outputs/03_clinical_extraction/)'
    )
    
    parser.add_argument(
        '--print-only', '-p',
        action='store_true',
        help='Only print to stdout, do not save to file'
    )
    
    args = parser.parse_args()
    
    # Check if file exists
    file_path = Path(args.file)
    if not file_path.exists():
        print(f"Error: File '{args.file}' does not exist", file=sys.stderr)
        sys.exit(1)
    
    try:
        # Read the file
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # If it's a JSON file, try to extract text field
        if file_path.suffix.lower() == '.json':
            try:
                json_data = json.loads(content)
                text = extract_text_from_json(json_data)
            except json.JSONDecodeError:
                # If JSON parsing fails, treat as plain text
                text = content
        else:
            text = content
        
        if not text.strip():
            print("Error: File appears to be empty or contains no readable text", file=sys.stderr)
            sys.exit(1)
        
        # Extract clinical information
        result = extract_minimal_json(text)
        
        # Add metadata
        result['_metadata'] = {
            'source_file': file_path.name,
            'processed_timestamp': None,
            'original_text_length': len(text)
        }
        
        # Determine output path
        if not args.print_only:
            if args.output:
                output_file = Path(args.output)
            else:
                # Default: save to outputs/03_clinical_extraction/
                script_dir = Path(__file__).parent
                project_root = script_dir.parent
                output_dir = project_root / "outputs" / "03_clinical_extraction"
                output_dir.mkdir(parents=True, exist_ok=True)
                
                # Create output filename
                if file_path.suffix.lower() == '.json':
                    output_filename = file_path.stem + '_clinical.json'
                else:
                    output_filename = file_path.stem + '_clinical.json'
                output_file = output_dir / output_filename
            
            # Save to file
            try:
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump(result, f, indent=2, ensure_ascii=False)
                print(f"✅ Clinical extraction saved to: {output_file}")
                print(f"📝 Processed {len(text)} characters from: {file_path.name}")
                print()
            except Exception as e:
                print(f"❌ Error saving file: {e}", file=sys.stderr)
        
        # Always print result for immediate feedback
        print("📋 Clinical Extraction Results:")
        print(json.dumps(result, ensure_ascii=False, indent=2))
        
    except Exception as e:
        print(f"Error processing file: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main() 