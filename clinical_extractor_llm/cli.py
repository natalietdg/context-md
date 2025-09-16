#!/usr/bin/env python3
"""
Command line interface for LLM-based clinical text extraction.
Usage: python cli.py --file path/to/transcript.json
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, Any

from extractor import extract_clinical_json


def load_input_file(file_path: Path) -> Dict[Any, Any]:
    """
    Load input file (JSON or text) and convert to JSON format.
    
    Args:
        file_path: Path to input file
        
    Returns:
        JSON data structure
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read().strip()
        
        if not content:
            raise ValueError("File is empty")
        
        # Try to parse as JSON
        if file_path.suffix.lower() == '.json':
            try:
                return json.loads(content)
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid JSON format: {e}")
        
        # Handle plain text files
        else:
            # Convert plain text to conversation format
            lines = content.split('\n')
            turns = []
            
            for i, line in enumerate(lines):
                line = line.strip()
                if line:
                    # Try to detect speaker patterns
                    if ':' in line and len(line.split(':', 1)) == 2:
                        speaker, text = line.split(':', 1)
                        turns.append({
                            "turn_id": i + 1,
                            "speaker": speaker.strip(),
                            "text": text.strip()
                        })
                    else:
                        # No speaker detected, use generic
                        turns.append({
                            "turn_id": i + 1,
                            "speaker": f"SPEAKER_{i % 2:02d}",
                            "text": line
                        })
            
            return {
                "languages_detected": ["en"],
                "turns": turns
            }
            
    except Exception as e:
        raise ValueError(f"Error reading file '{file_path}': {e}")


def save_output(data: Dict[str, Any], output_path: Path) -> None:
    """Save extracted data to JSON file."""
    try:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            
    except Exception as e:
        raise ValueError(f"Error saving output to '{output_path}': {e}")


def main():
    parser = argparse.ArgumentParser(
        description='LLM-based clinical information extraction from consultation transcripts',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python cli.py --file consultation.json
  python cli.py --file transcript.txt --output results.json
  python cli.py --file data.json --print-only
        """
    )
    
    parser.add_argument(
        '--file', '-f',
        type=str,
        required=True,
        help='Path to input file (JSON transcript or plain text)'
    )
    
    parser.add_argument(
        '--output', '-o',
        type=str,
        help='Output file path (default: saves to outputs/03_clinical_extraction/)'
    )
    
    parser.add_argument(
        '--print-only', '-p',
        action='store_true',
        help='Only print results to stdout, do not save to file'
    )
    
    parser.add_argument(
        '--model', '-m',
        type=str,
        default="Qwen/Qwen2.5-3B-Instruct",
        help='HuggingFace model name (default: Qwen/Qwen2.5-3B-Instruct)'
    )
    
    args = parser.parse_args()
    
    # Validate input file
    input_path = Path(args.file)
    if not input_path.exists():
        print(f"❌ Error: File '{args.file}' does not exist", file=sys.stderr)
        sys.exit(1)
    
    try:
        # Load input data
        print(f"📝 Loading input file: {input_path.name}")
        json_data = load_input_file(input_path)
        
        # Extract clinical information
        print("🧠 Extracting clinical information using LLM...")
        
        # Override model if specified
        if args.model != "Qwen/Qwen2.5-3B-Instruct":
            from extractor import ClinicalExtractorLLM
            extractor = ClinicalExtractorLLM(model_name=args.model)
            result = extractor.extract_clinical_info(json_data)
        else:
            result = extract_clinical_json(json_data)
        
        # Add metadata
        result['_metadata'] = {
            'source_file': input_path.name,
            'model_used': args.model,
            'extraction_method': 'llm'
        }
        
        # Handle output
        if not args.print_only:
            if args.output:
                output_path = Path(args.output)
            else:
                # Default: save to outputs/03_clinical_extraction/
                project_root = Path(__file__).parent.parent
                output_dir = project_root / "outputs" / "03_clinical_extraction"
                output_filename = input_path.stem + '_llm_clinical.json'
                output_path = output_dir / output_filename
            
            # Save results
            save_output(result, output_path)
            print(f"✅ Results saved to: {output_path}")
            print(f"📊 Processed: {input_path.name}")
            
            # Show summary
            if result.get('summary'):
                print(f"📋 Summary: {result['summary']}")
            print()
        
        # Always print results for immediate feedback
        print("🎯 Clinical Extraction Results:")
        print("=" * 50)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
    except KeyboardInterrupt:
        print("\n⏸️  Extraction interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main() 