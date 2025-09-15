"""
MERaLiON Transcriber - Medical Audio Transcription Pipeline

This module provides a complete pipeline for processing medical consultation audio files
using MERaLiON models with speaker diarization and transcription capabilities.
"""

from .pipeline import MERaLiONTranscriber

__version__ = "1.0.0"
__all__ = ["MERaLiONTranscriber"] 