#!/usr/bin/env python3
"""
Convenience wrapper for AWS Transcriber

This script allows you to run the AWS transcriber from the project root
without changing into the aws/ directory.
"""

import sys
import os
from pathlib import Path

# Add the aws package to the Python path
aws_dir = Path(__file__).parent / "aws"
sys.path.insert(0, str(aws_dir))

# Import and run the transcriber
from transcriber import main

if __name__ == '__main__':
    main() 