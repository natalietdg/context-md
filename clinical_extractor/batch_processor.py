#!/usr/bin/env python3
"""
Batch processor for clinical extraction.
Reads JSON files from 02_translated folder and outputs extracted clinical data to 03_clinical_extraction.
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, Any

from extractor import extract_minimal_json


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


def process_file(input_file: Path, output_dir: Path) -> bool:
    """
    Process a single JSON file from 02_translated and output clinical extraction.
    Returns True if successful, False otherwise.
    """
    try:
        print(f"Processing: {input_file.name}")
        
        # Read the input JSON file
        with open(input_file, 'r', encoding='utf-8') as f:
            json_data = json.load(f)
        
        # Extract text content
        text = extract_text_from_json(json_data)
        
        if not text.strip():
            print(f"  Warning: No readable text found in {input_file.name}")
            return False
        
        # Extract clinical information
        clinical_data = extract_minimal_json(text)
        
        # Add metadata
        clinical_data['_metadata'] = {
            'source_file': input_file.name,
            'processed_timestamp': None,  # Could add timestamp if needed
            'original_text_length': len(text)
        }
        
        # Create output filename (replace .json with _clinical.json)
        output_filename = input_file.stem + '_clinical.json'
        output_file = output_dir / output_filename
        
        # Write the clinical extraction
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(clinical_data, f, indent=2, ensure_ascii=False)
        
        print(f"  ✅ Saved to: {output_filename}")
        return True
        
    except Exception as e:
        print(f"  ❌ Error processing {input_file.name}: {e}")
        return False


def main():
    """
    Main function to process all files in 02_translated folder.
    """
    # Set up paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    input_dir = project_root / "outputs" / "02_translated"
    output_dir = project_root / "outputs" / "03_clinical_extraction"
    
    print(f"Input directory: {input_dir}")
    print(f"Output directory: {output_dir}")
    
    # Check if input directory exists
    if not input_dir.exists():
        print(f"❌ Error: Input directory '{input_dir}' does not exist")
        return False
    
    # Create output directory if it doesn't exist
    output_dir.mkdir(exist_ok=True)
    
    # Find all JSON files in the input directory
    json_files = list(input_dir.glob("*.json"))
    
    if not json_files:
        print("❌ No JSON files found in the input directory")
        return False
    
    print(f"Found {len(json_files)} JSON files to process")
    print("=" * 50)
    
    # Process each file
    successful = 0
    failed = 0
    
    for json_file in json_files:
        if process_file(json_file, output_dir):
            successful += 1
        else:
            failed += 1
    
    print("=" * 50)
    print(f"Processing complete!")
    print(f"✅ Successful: {successful}")
    if failed > 0:
        print(f"❌ Failed: {failed}")
    
    return failed == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 