#!/usr/bin/env python3
"""
Convenience wrapper for SEA-LION Translator

This script allows you to run the translator from the project root
without changing into the sealion/ directory.
"""

import sys
import os
from pathlib import Path

# Add the sealion package to the Python path
sealion_dir = Path(__file__).parent / "sealion"
sys.path.insert(0, str(sealion_dir))

# Import and run the translator
from translator import main

if __name__ == '__main__':
    main() 