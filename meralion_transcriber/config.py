"""
Configuration settings for Clinical Transcription Pipeline

This module provides default configuration and easy customization options.
"""

import os
from dataclasses import dataclass
from typing import Optional, Dict, Any
from pathlib import Path


@dataclass
class PipelineConfig:
    """Configuration for Clinical Transcription Pipeline."""
    
    # Model Configuration
    huggingface_token: Optional[str] = None
    
    # Device Configuration
    device: Optional[str] = None  # 'cuda', 'cpu', or None for auto-detect
    
    # Audio Processing
    cache_dir: str = './audio_cache'
    target_sample_rate: int = 16000
    audio_format: str = 'wav'
    
    # S3 Configuration (optional)
    s3_region: Optional[str] = None
    
    # Speaker Diarization
    min_speakers: int = 1  # Allow single speaker recordings
    max_speakers: int = 4
    segment_merge_threshold: float = 1.0  # seconds
    
    # Transcription
    max_segment_length: float = 25.0  # seconds
    chunk_length_s: int = 30
    batch_size: int = 16
    max_new_tokens: int = 128
    temperature: float = 0.1
    
    # Medical Keywords for Doctor Identification
    medical_keywords: list = None
    
    # Translation
    translation_batch_size: int = 5
    rate_limit_delay: float = 6.5  # seconds
    
    # Output
    output_format: str = 'json'
    include_timestamps: bool = True
    include_original_text: bool = True
    
    def __post_init__(self):
        """Initialize default values and environment variables."""
        # Try to get tokens from environment
        if not self.huggingface_token:
            self.huggingface_token = os.getenv('HF_TOKEN')
        
        # Set default medical keywords if not provided
        if self.medical_keywords is None:
            self.medical_keywords = [
                'diagnosis', 'treatment', 'prescription', 'medication', 'dosage',
                'symptoms', 'condition', 'therapy', 'recommend', 'prescribe',
                'medicine', 'drug', 'illness', 'disease', 'exam', 'examination',
                'blood pressure', 'heart rate', 'temperature', 'allergies',
                'medical history', 'follow up', 'appointment', 'test results',
                'patient', 'doctor', 'clinic', 'hospital', 'consultation'
            ]
    
    @classmethod
    def from_file(cls, config_path: str) -> 'PipelineConfig':
        """
        Load configuration from a file.
        
        Args:
            config_path: Path to configuration file (JSON or Python)
            
        Returns:
            PipelineConfig instance
        """
        config_path = Path(config_path)
        
        if config_path.suffix == '.json':
            import json
            with open(config_path, 'r') as f:
                config_dict = json.load(f)
        elif config_path.suffix == '.py':
            # Load Python config file
            import importlib.util
            spec = importlib.util.spec_from_file_location("config", config_path)
            config_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(config_module)
            config_dict = {
                key: getattr(config_module, key)
                for key in dir(config_module)
                if not key.startswith('_')
            }
        else:
            raise ValueError(f"Unsupported config file format: {config_path.suffix}")
        
        return cls(**config_dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert configuration to dictionary."""
        return {
            field.name: getattr(self, field.name)
            for field in self.__dataclass_fields__.values()
        }
    
    def save_to_file(self, config_path: str):
        """
        Save configuration to a file.
        
        Args:
            config_path: Path to save configuration file
        """
        config_path = Path(config_path)
        
        if config_path.suffix == '.json':
            import json
            with open(config_path, 'w') as f:
                json.dump(self.to_dict(), f, indent=2)
        else:
            raise ValueError(f"Unsupported config file format: {config_path.suffix}")
    
    def validate(self) -> bool:
        """
        Validate configuration settings.
        
        Returns:
            True if configuration is valid
            
        Raises:
            ValueError: If configuration is invalid
        """
        if not self.huggingface_token:
            raise ValueError("HuggingFace token is required. Set HF_TOKEN environment variable or provide in config.")
        
        if self.min_speakers < 1:
            raise ValueError("min_speakers must be at least 1")
            
        if self.max_speakers < self.min_speakers:
            raise ValueError("max_speakers must be >= min_speakers")
        
        if self.max_segment_length <= 0:
            raise ValueError("max_segment_length must be positive")
        
        if self.target_sample_rate <= 0:
            raise ValueError("target_sample_rate must be positive")
        
        return True


# Default configuration instance
DEFAULT_CONFIG = PipelineConfig()


def create_config_template(output_path: str = "clinical_config.json"):
    """
    Create a configuration template file.
    
    Args:
        output_path: Path to save the configuration template
    """
    template_config = PipelineConfig(
        huggingface_token="your_hf_token_here",
        device="cuda",  # or "cpu"
        cache_dir="./audio_cache",
        s3_region="ap-northeast-2",  # AWS region for S3 support
        min_speakers=1,  # Allow single speaker recordings
        max_speakers=4,
        max_segment_length=25.0,
        temperature=0.1
    )
    
    template_config.save_to_file(output_path)
    print(f"Configuration template saved to: {output_path}")
    print("Edit the file with your API keys and preferred settings.")


if __name__ == '__main__':
    # Create configuration template when run directly
    create_config_template() 