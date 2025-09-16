#!/usr/bin/env python3
"""
Batch processor for LLM-based clinical extraction.
Processes all JSON files from outputs/02_translated/ and saves to outputs/03_clinical_extraction/
"""

import json
import sys
from pathlib import Path
from typing import Dict, Any, List, Tuple

from extractor import extract_clinical_json


def process_file(input_file: Path, output_dir: Path) -> Tuple[bool, str]:
    """
    Process a single file with LLM-based clinical extraction.
    
    Args:
        input_file: Path to input JSON file
        output_dir: Output directory for results
        
    Returns:
        (success: bool, message: str)
    """
    try:
        print(f"🧠 Processing: {input_file.name}")
        
        # Load input JSON
        with open(input_file, 'r', encoding='utf-8') as f:
            json_data = json.load(f)
        
        # Extract clinical information using LLM
        result = extract_clinical_json(json_data)
        
        # Add metadata
        result['_metadata'] = {
            'source_file': input_file.name,
            'model_used': 'Qwen/Qwen2.5-3B-Instruct',
            'extraction_method': 'llm'
        }
        
        # Create output filename
        output_filename = input_file.stem + '_llm_clinical.json'
        output_path = output_dir / output_filename
        
        # Save results
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        
        # Show summary if available
        summary = result.get('summary', 'No summary')
        print(f"  ✅ Saved: {output_filename}")
        print(f"  📋 {summary}")
        
        return True, f"Successfully processed {input_file.name}"
        
    except Exception as e:
        error_msg = f"Failed to process {input_file.name}: {e}"
        print(f"  ❌ {error_msg}")
        return False, error_msg


def main():
    """Main batch processing function."""
    # Set up paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    input_dir = project_root / "outputs" / "02_translated"
    output_dir = project_root / "outputs" / "03_clinical_extraction"
    
    print("🏥 LLM-based Clinical Extraction Batch Processor")
    print("=" * 60)
    print(f"📂 Input directory:  {input_dir}")
    print(f"📂 Output directory: {output_dir}")
    print()
    
    # Validate input directory
    if not input_dir.exists():
        print(f"❌ Input directory not found: {input_dir}")
        sys.exit(1)
    
    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Find JSON files
    json_files = list(input_dir.glob("*.json"))
    
    if not json_files:
        print("❌ No JSON files found in input directory")
        sys.exit(1)
    
    print(f"📋 Found {len(json_files)} JSON files to process")
    print()
    
    # Process files
    results = []
    successful = 0
    failed = 0
    
    for json_file in sorted(json_files):
        success, message = process_file(json_file, output_dir)
        results.append((json_file.name, success, message))
        
        if success:
            successful += 1
        else:
            failed += 1
        
        print()  # Add spacing between files
    
    # Summary
    print("=" * 60)
    print("📊 Batch Processing Summary:")
    print(f"✅ Successfully processed: {successful}")
    print(f"❌ Failed: {failed}")
    print(f"📁 Total files: {len(json_files)}")
    
    if failed > 0:
        print("\n❌ Failed files:")
        for filename, success, message in results:
            if not success:
                print(f"  • {filename}: {message}")
    
    print(f"\n💾 Results saved to: {output_dir}")
    
    # Exit with appropriate code
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n⏸️  Batch processing interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1) 