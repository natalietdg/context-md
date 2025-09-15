"""
Clinical Transcription Pipeline using Pyannote + MERaLiON

This module implements a complete pipeline for processing clinical consultation audio files
using pyannote for speaker diarization and MERaLiON for transcription.
"""

import os
import json
import torch
import librosa
import soundfile as sf
import numpy as np
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass
import logging

# Audio processing
from pydub import AudioSegment

# AWS S3 support
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))
from aws.s3_downloader import S3AudioDownloader

# ML models
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline
from pyannote.audio import Pipeline as PyannoteePipeline
# Language detection now handled during transcription - langdetect removed

# Remove enhanced translator import - using MERaLiON for translation instead

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class Speaker:
    """Speaker information."""
    id: str
    role: Optional[str] = None
    speaking_time: float = 0.0


@dataclass
class Segment:
    """Audio segment with speaker and transcription information."""
    speaker_id: str
    role: Optional[str]
    start_time: float
    end_time: float
    text: Dict[str, str]  # {"original": "", "english": ""}


@dataclass
class TranscriptionResult:
    """Complete transcription result."""
    original_language: str
    speakers: Dict[str, Any]
    segments: List[Segment]
    summary: Dict[str, float]


class MERaLiONTranscriber:
    """
    Complete pipeline for medical consultation transcription using MERaLiON.
    
    Uses pyannote for speaker diarization and MERaLiON-2-3B for transcription.
    """
    
    def __init__(
        self,
        huggingface_token: str,
        device: Optional[str] = None,
        cache_dir: Optional[str] = None,
        s3_region: Optional[str] = None
    ):
        """
        Initialize the clinical transcription pipeline.
        
        Args:
            huggingface_token: HuggingFace token with access to pyannote models
            device: Device to use ('cuda', 'cpu', or None for auto-detect)
            cache_dir: Directory to cache converted audio files
            s3_region: AWS region for S3 downloads (optional)
        """
        self.hf_token = huggingface_token
        self.device = device or ('cuda' if torch.cuda.is_available() else 'cpu')
        self.cache_dir = Path(cache_dir or './audio_cache')
        self.cache_dir.mkdir(exist_ok=True)
        
        logger.info(f"Initializing pipeline on device: {self.device}")
        
        # Initialize models
        self._init_diarization_model()
        self._init_transcription_model()
        
        # Initialize S3 downloader (optional)
        self._init_s3_downloader(s3_region)
        
        # Configuration
        self.min_speakers = 1  # Allow single speaker recordings
        self.max_speakers = 4
        self.segment_merge_threshold = 1.0  # seconds
        self.max_segment_length = 25.0  # seconds for transcription chunking
        
    def _init_diarization_model(self):
        """Initialize pyannote diarization model."""
        logger.info("Loading pyannote speaker diarization model...")
        try:
            self.diarization_pipeline = PyannoteePipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                use_auth_token=self.hf_token
            )
            if torch.cuda.is_available():
                self.diarization_pipeline = self.diarization_pipeline.to(torch.device(self.device))
            logger.info("Diarization model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load diarization model: {e}")
            raise
            
    def _init_transcription_model(self):
        """Initialize MERaLiON transcription model."""
        logger.info("Loading MERaLiON transcription model...")
        try:
            model_id = "MERaLiON/MERaLiON-2-3B"
            
            # Load MERaLiON model with correct parameters
            model = AutoModelForSpeechSeq2Seq.from_pretrained(
                model_id,
                trust_remote_code=True,
                torch_dtype="auto",
                token=self.hf_token
            )
            
            processor = AutoProcessor.from_pretrained(
                model_id,
                trust_remote_code=True,
                token=self.hf_token
            )
            
            # Store model and processor separately for direct access
            self.model = model
            self.processor = processor
            
            # Move model to device if not CPU
            if self.device != 'cpu':
                self.model = self.model.to(self.device)
            
            # Ensure consistent padding
            if hasattr(processor, 'tokenizer'):
                processor.tokenizer.padding_side = 'right'
            if hasattr(processor, 'feature_extractor'):
                processor.feature_extractor.padding_side = 'right'
            
            # Also create pipeline for backward compatibility (if needed elsewhere)
            self.transcription_pipeline = pipeline(
                "automatic-speech-recognition",
                model=model,
                tokenizer=processor.tokenizer,
                feature_extractor=processor.feature_extractor,
                generate_kwargs={"max_new_tokens": 128},
                chunk_length_s=30,
                batch_size=16,
                torch_dtype=torch.float16 if self.device == 'cuda' else torch.float32,
                device=self.device if self.device != 'cpu' else -1,
            )
            
            logger.info("MERaLiON transcription model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load transcription model: {e}")
            raise
    
# Translator initialization removed - using MERaLiON for translation

    def _init_s3_downloader(self, s3_region: Optional[str] = None):
        """Initialize S3 downloader for audio file downloads."""
        try:
            self.s3_downloader = S3AudioDownloader(
                region=s3_region,
                cache_dir=str(self.cache_dir)
            )
            logger.info("S3 downloader initialized successfully")
        except Exception as e:
            logger.warning(f"S3 downloader not available: {e}")
            logger.info("Local file processing will still work normally")
            self.s3_downloader = None
    
    def resolve_audio_file(self, audio_path: str) -> str:
        """
        Resolve audio file path - download from S3 if needed, otherwise return local path.
        
        Args:
            audio_path: Local file path or S3 URI (s3://bucket/path/file.ext)
            
        Returns:
            Local path to audio file
        """
        # Check if it's an S3 URI
        if audio_path.startswith('s3://') or (not os.path.exists(audio_path) and self.s3_downloader):
            if not self.s3_downloader:
                raise ValueError(f"S3 URI provided but S3 downloader not available: {audio_path}")
            
            logger.info(f"Downloading audio file from S3: {audio_path}")
            try:
                local_path = self.s3_downloader.download_audio_file(audio_path, use_cache=True)
                return local_path
            except Exception as e:
                logger.error(f"Failed to download audio file from S3: {e}")
                raise
        
        # Local file path
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")
        
        return audio_path
    
    def preprocess_audio(self, audio_path: str) -> str:
        """
        Convert m4a audio file to WAV format (16kHz, mono).
        
        Args:
            audio_path: Path to input audio file
            
        Returns:
            Path to converted WAV file
        """
        audio_path = Path(audio_path)
        cache_path = self.cache_dir / f"{audio_path.stem}.wav"
        
        # Return cached version if it exists
        if cache_path.exists():
            logger.info(f"Using cached audio file: {cache_path}")
            return str(cache_path)
        
        logger.info(f"Converting audio file: {audio_path}")
        
        try:
            # Load and convert audio using librosa
            audio, sr = librosa.load(str(audio_path), sr=16000, mono=True)
            
            # Save as WAV
            sf.write(str(cache_path), audio, 16000)
            
            logger.info(f"Audio converted and saved to: {cache_path}")
            return str(cache_path)
            
        except Exception as e:
            logger.error(f"Failed to convert audio: {e}")
            raise
    
    def perform_diarization(self, audio_path: str) -> List[Tuple[str, float, float]]:
        """
        Perform speaker diarization on audio file.
        
        Args:
            audio_path: Path to audio file
            
        Returns:
            List of (speaker_id, start_time, end_time) tuples
        """
        logger.info("Performing speaker diarization...")
        
        try:
            diarization = self.diarization_pipeline(
                audio_path,
                min_speakers=self.min_speakers,
                max_speakers=self.max_speakers
            )
            
            # Extract segments
            segments = []
            for turn, _, speaker in diarization.itertracks(yield_label=True):
                segments.append((speaker, turn.start, turn.end))
            
            # Group adjacent segments from same speaker
            merged_segments = self._merge_adjacent_segments(segments)
            
            logger.info(f"Diarization completed. Found {len(set(s[0] for s in merged_segments))} speakers, {len(merged_segments)} segments")
            return merged_segments
            
        except Exception as e:
            logger.error(f"Diarization failed: {e}")
            raise
    
    def _merge_adjacent_segments(
        self, 
        segments: List[Tuple[str, float, float]]
    ) -> List[Tuple[str, float, float]]:
        """
        Merge adjacent segments from the same speaker if gap < threshold.
        
        Args:
            segments: List of (speaker_id, start_time, end_time) tuples
            
        Returns:
            Merged segments
        """
        if not segments:
            return segments
        
        # Sort by start time
        segments = sorted(segments, key=lambda x: x[1])
        merged = [segments[0]]
        
        for speaker_id, start, end in segments[1:]:
            last_speaker, last_start, last_end = merged[-1]
            
            # If same speaker and gap is small, merge segments
            if (speaker_id == last_speaker and 
                start - last_end <= self.segment_merge_threshold):
                merged[-1] = (last_speaker, last_start, end)
            else:
                merged.append((speaker_id, start, end))
        
        return merged
    
    def transcribe_segments(
        self, 
        audio_path: str, 
        segments: List[Tuple[str, float, float]]
    ) -> Tuple[List[Tuple[str, float, float, str]], str]:
        """
        Transcribe each audio segment using MERaLiON and detect language.
        
        Args:
            audio_path: Path to audio file
            segments: List of (speaker_id, start_time, end_time) tuples
            
        Returns:
            Tuple of (transcribed_segments, detected_language)
            - transcribed_segments: List of (speaker_id, start_time, end_time, transcription) tuples
            - detected_language: Language code detected from first segment
        """
        logger.info(f"Transcribing {len(segments)} segments...")
        
        # Load full audio
        audio, sr = librosa.load(audio_path, sr=16000, mono=True)
        transcribed_segments = []
        detected_language = "en"  # Default fallback
        
        for i, (speaker_id, start, end) in enumerate(segments):
            logger.info(f"Transcribing segment {i+1}/{len(segments)} ({speaker_id})")
            
            # Extract segment audio
            start_sample = int(start * sr)
            end_sample = int(end * sr)
            segment_audio = audio[start_sample:end_sample]
            
            # Check if segment is too long and needs chunking
            segment_duration = end - start
            if segment_duration > self.max_segment_length:
                chunks = self._chunk_long_segment(segment_audio, sr, self.max_segment_length)
                transcription = ""
                
                for j, chunk in enumerate(chunks):
                    chunk_result = self._transcribe_audio_chunk(chunk, sr)
                    transcription += chunk_result + " "
                    
                    # Detect language from first chunk of first segment
                    if i == 0 and j == 0:
                        detected_language = self._detect_language_from_transcription(chunk_result)
                
                transcription = transcription.strip()
            else:
                transcription = self._transcribe_audio_chunk(segment_audio, sr)
                
                # Detect language from first segment
                if i == 0:
                    detected_language = self._detect_language_from_transcription(transcription)
            
            transcribed_segments.append((speaker_id, start, end, transcription))
        
        logger.info(f"Language detected during transcription: {detected_language}")
        return transcribed_segments, detected_language
    
    def _detect_language_from_transcription(self, transcription_text: str) -> str:
        """
        Detect language from transcription text using simple heuristics.
        
        Args:
            transcription_text: Transcribed text from first segment
            
        Returns:
            Language code (e.g., 'en', 'ms', 'zh', 'id')
        """
        if not transcription_text or len(transcription_text.strip()) < 10:
            return "en"  # Default to English for short/empty text
        
        text_lower = transcription_text.lower()
        
        # Simple language detection based on common words/patterns
        # This is a simplified approach - in production you might want more sophisticated detection
        
        # Malay indicators
        malay_indicators = ["saya", "anda", "dengan", "yang", "untuk", "ini", "itu", "ada", "tidak", "boleh", "akan", "sudah", "belum", "dari", "ke", "di", "pada"]
        if any(word in text_lower for word in malay_indicators):
            return "ms"
        
        # Indonesian indicators (similar to Malay but with some differences)
        indonesian_indicators = ["saya", "anda", "dengan", "yang", "untuk", "ini", "itu", "ada", "tidak", "bisa", "akan", "sudah", "belum", "dari", "ke", "di", "pada"]
        if any(word in text_lower for word in indonesian_indicators):
            return "id"
        
        # Chinese indicators (if transcribed in pinyin or mixed)
        chinese_indicators = ["wo", "ni", "ta", "de", "shi", "zai", "you", "le", "ma", "ne"]
        if any(word in text_lower for word in chinese_indicators):
            return "zh"
        
        # Thai indicators
        thai_indicators = ["ครับ", "ค่ะ", "เป็น", "ที่", "กับ", "ใน", "จาก", "ไป"]
        if any(word in transcription_text for word in thai_indicators):
            return "th"
        
        # Default to English if no patterns match
        return "en"
    
    def _chunk_long_segment(
        self, 
        audio: np.ndarray, 
        sr: int, 
        max_length: float
    ) -> List[np.ndarray]:
        """
        Split long audio segment into smaller chunks.
        
        Args:
            audio: Audio array
            sr: Sample rate
            max_length: Maximum chunk length in seconds
            
        Returns:
            List of audio chunks
        """
        chunk_samples = int(max_length * sr)
        chunks = []
        
        for i in range(0, len(audio), chunk_samples):
            chunk = audio[i:i + chunk_samples]
            if len(chunk) > sr:  # Only include chunks longer than 1 second
                chunks.append(chunk)
        
        return chunks
    
    def _transcribe_audio_chunk(self, audio: np.ndarray, sr: int) -> str:
        """
        Transcribe a single audio chunk using MERaLiON following their documentation format.
        
        Args:
            audio: Audio array
            sr: Sample rate
            
        Returns:
            Transcription text
        """
        try:
            # Ensure audio is the right format and length
            if len(audio) == 0:
                logger.warning("Empty audio segment")
                return ""
            
            # MERaLiON expects audio to be duplicated in a list (from their docs)
            audio_list = [audio, audio]  # Duplicate as shown in their example
            
            # Prepare MERaLiON-specific prompt format
            prompt_template = "Given the following audio context: <SpeechHere>\n\nText instruction: {query}"
            transcribe_query = "Please transcribe this speech."
            
            conversation = [
                [{"role": "user", "content": prompt_template.format(query=transcribe_query)}]
            ]
            
            # Apply chat template
            chat_prompt = self.processor.tokenizer.apply_chat_template(
                conversation=conversation,
                tokenize=False,
                add_generation_prompt=True
            )
            
            # Process inputs following MERaLiON documentation exactly
            inputs = self.processor(text=chat_prompt, audios=audio_list)
            
            # Keep inputs on CPU for now to avoid dtype issues
            # The model will handle device placement automatically
            
            # Generate transcription
            with torch.no_grad():
                outputs = self.model.generate(**inputs, max_new_tokens=256)
            
            # Decode only the generated tokens
            generated_ids = outputs[:, inputs['input_ids'].size(1):]
            response = self.processor.tokenizer.batch_decode(
                generated_ids, skip_special_tokens=True
            )[0]
            
            logger.debug(f"Transcription result: '{response.strip()}'")
            return response.strip()
            
        except Exception as e:
            logger.error(f"Transcription failed for segment: {e}")
            logger.debug(f"Audio shape: {audio.shape}, Sample rate: {sr}")
            import traceback
            logger.debug(f"Full traceback: {traceback.format_exc()}")
            return ""
    
# Language detection method removed - now handled during transcription process
    
    def translate_segments(
        self, 
        segments: List[Tuple[str, float, float, str]], 
        source_language: str,
        target_lang: str = "en"
    ) -> List[Tuple[str, float, float, str]]:
        """
        Translate segments to target language using MERaLiON if needed.
        
        Args:
            segments: List of transcribed segments
            source_language: Source language code  
            target_lang: Target language code
            
        Returns:
            List of (speaker_id, start, end, original_text, translated_text) tuples
        """
        if source_language == target_lang:
            logger.info("Source and target languages are the same, no translation needed")
            return [(speaker_id, start, end, text, text) 
                    for speaker_id, start, end, text in segments]
        
        logger.info(f"Translating segments from {source_language} to {target_lang} using MERaLiON")
        translated_segments = []
        
        for i, (speaker_id, start, end, text) in enumerate(segments):
            if not text.strip():
                translated_segments.append((speaker_id, start, end, text, text))
                continue
                
            logger.debug(f"Translating segment {i+1}/{len(segments)} ({speaker_id})")
            
            try:
                # Use MERaLiON for translation with a translation-specific prompt
                translated_text = self._translate_text_with_meralion(text, source_language, target_lang)
                translated_segments.append((speaker_id, start, end, text, translated_text))
            except Exception as e:
                logger.warning(f"Translation failed for segment {i+1}: {e}")
                translated_segments.append((speaker_id, start, end, text, text))
        
        return translated_segments
    
    def _translate_text_with_meralion(self, text: str, source_lang: str, target_lang: str) -> str:
        """
        Translate text using MERaLiON model with text generation capabilities.
        
        Args:
            text: Text to translate
            source_lang: Source language code
            target_lang: Target language code
            
        Returns:
            Translated text
        """
        try:
            # Create translation prompt for MERaLiON AudioLLM
            # MERaLiON can handle text-to-text translation as shown in their examples
            if source_lang == "en" and target_lang != "en":
                prompt = f"Translate this English text from a medical consultation to {target_lang}. Preserve medical terminology accuracy: {text}"
            else:
                prompt = f"Translate this text from a medical consultation to English. Preserve medical terminology accuracy: {text}"
            
            # Use the same model but with a text generation approach
            # Create a conversation format that MERaLiON expects
            conversation = [
                {"role": "user", "content": prompt}
            ]
            
            # Apply chat template
            chat_prompt = self.transcription_pipeline.tokenizer.apply_chat_template(
                conversation=conversation,
                tokenize=False,
                add_generation_prompt=True
            )
            
            # Generate translation using the text generation capabilities
            inputs = self.transcription_pipeline.tokenizer(
                chat_prompt, 
                return_tensors="pt", 
                padding=True, 
                truncation=True,
                max_length=1024
            )
            
            # Move to appropriate device
            if self.device != 'cpu':
                inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            # Generate translation
            with torch.no_grad():
                outputs = self.transcription_pipeline.model.generate(
                    **inputs,
                    max_new_tokens=256,
                    temperature=0.1,
                    do_sample=True,
                    pad_token_id=self.transcription_pipeline.tokenizer.eos_token_id
                )
            
            # Decode the generated text
            generated_ids = outputs[:, inputs['input_ids'].size(1):]
            translated_text = self.transcription_pipeline.tokenizer.batch_decode(
                generated_ids, skip_special_tokens=True
            )[0]
            
            return translated_text.strip() if translated_text else text
            
        except Exception as e:
            logger.warning(f"MERaLiON translation failed: {e}")
            return text  # Return original text if translation fails
    
    def identify_doctor(
        self, 
        segments: List[Tuple[str, float, float, str, str]]
    ) -> Dict[str, str]:
        """
        Identify which speaker is the doctor using LLM analysis of conversation patterns.
        
        Args:
            segments: List of transcribed and translated segments
            
        Returns:
            Dictionary mapping speaker IDs to roles
        """
        logger.info("Identifying doctor/patient roles using LLM analysis...")
        
        try:
            # Prepare conversation text for analysis
            speaker_texts = {}
            for speaker_id, _, _, _, english_text in segments:
                if speaker_id not in speaker_texts:
                    speaker_texts[speaker_id] = []
                speaker_texts[speaker_id].append(english_text)
            
            # Handle single speaker scenario
            if len(speaker_texts) == 1:
                return self._identify_single_speaker_role(speaker_texts)
            
            # Create a structured conversation for the LLM
            conversation_text = ""
            for speaker_id in speaker_texts:
                speaker_content = " ".join(speaker_texts[speaker_id][:3])  # Use first 3 segments per speaker
                conversation_text += f"{speaker_id}: {speaker_content}\n\n"
            
            # Create prompt for doctor identification
            prompt = f"""Analyze this medical consultation transcript and identify who is the doctor and who are the patients based on:
1. Medical terminology usage
2. Question patterns (doctors ask about symptoms, patients describe problems)
3. Professional language and advice giving
4. Prescription or treatment recommendations
5. Medical examination descriptions

Conversation:
{conversation_text}

Based on the conversation above, identify each speaker's role. Respond ONLY with a JSON format like:
{{"SPEAKER_00": "Doctor", "SPEAKER_01": "Patient"}}"""

            # Use MERaLiON for role identification
            roles_json = self._generate_text_with_meralion(prompt)
            
            # Parse the JSON response
            import json
            try:
                roles = json.loads(roles_json)
                logger.info(f"LLM identified roles: {roles}")
                return roles
            except json.JSONDecodeError:
                logger.warning("Failed to parse LLM response, using fallback method")
                return self._fallback_doctor_identification(speaker_texts)
                
        except Exception as e:
            logger.warning(f"LLM-based doctor identification failed: {e}")
            return self._fallback_doctor_identification(speaker_texts)
    
    def _generate_text_with_meralion(self, prompt: str) -> str:
        """
        Generate text using MERaLiON model for analysis tasks.
        
        Args:
            prompt: Input prompt for text generation
            
        Returns:
            Generated text
        """
        try:
            conversation = [{"role": "user", "content": prompt}]
            
            # Apply chat template
            chat_prompt = self.transcription_pipeline.tokenizer.apply_chat_template(
                conversation=conversation,
                tokenize=False,
                add_generation_prompt=True
            )
            
            # Generate response
            inputs = self.transcription_pipeline.tokenizer(
                chat_prompt, 
                return_tensors="pt", 
                padding=True, 
                truncation=True,
                max_length=2048
            )
            
            if self.device != 'cpu':
                inputs = {k: v.to(self.device) for k, v in inputs.items()}
            
            with torch.no_grad():
                outputs = self.transcription_pipeline.model.generate(
                    **inputs,
                    max_new_tokens=512,
                    temperature=0.1,
                    do_sample=True,
                    pad_token_id=self.transcription_pipeline.tokenizer.eos_token_id
                )
            
            generated_ids = outputs[:, inputs['input_ids'].size(1):]
            response = self.transcription_pipeline.tokenizer.batch_decode(
                generated_ids, skip_special_tokens=True
            )[0]
            
            return response.strip()
            
        except Exception as e:
            logger.error(f"Text generation failed: {e}")
            return ""
    
    def _fallback_doctor_identification(self, speaker_texts: Dict[str, List[str]]) -> Dict[str, str]:
        """
        Fallback method for doctor identification using simple heuristics.
        
        Args:
            speaker_texts: Dictionary mapping speaker IDs to their text segments
            
        Returns:
            Dictionary mapping speaker IDs to roles
        """
        logger.info("Using fallback method for doctor identification")
        
        # Simple heuristic: speaker with more medical-sounding phrases is likely the doctor
        medical_indicators = [
            "how are you feeling", "what brings you", "any symptoms", "let me check",
            "i recommend", "you should", "take this medication", "come back",
            "diagnosis", "treatment", "prescription", "examination"
        ]
        
        speaker_scores = {}
        for speaker_id, texts in speaker_texts.items():
            combined_text = " ".join(texts).lower()
            score = sum(1 for indicator in medical_indicators if indicator in combined_text)
            speaker_scores[speaker_id] = score
        
        # Identify doctor as speaker with highest score
        doctor_id = max(speaker_scores.keys(), key=lambda x: speaker_scores[x]) if speaker_scores else list(speaker_texts.keys())[0]
        
        # Create role mapping
        roles = {}
        for speaker_id in speaker_texts.keys():
            roles[speaker_id] = "Doctor" if speaker_id == doctor_id else "Patient"
        
        logger.info(f"Fallback identified roles: {roles}")
        return roles
    
    def _identify_single_speaker_role(self, speaker_texts: Dict[str, List[str]]) -> Dict[str, str]:
        """
        Identify role for single speaker recordings using LLM analysis.
        
        Args:
            speaker_texts: Dictionary with single speaker's text segments
            
        Returns:
            Dictionary mapping speaker ID to role
        """
        speaker_id = list(speaker_texts.keys())[0]
        combined_text = " ".join(speaker_texts[speaker_id][:5])  # Use first 5 segments
        
        logger.info("Single speaker detected - analyzing role based on content...")
        
        # Create prompt for single speaker analysis
        prompt = f"""Analyze this medical-related speech transcript from a single speaker and determine if the speaker is most likely a doctor or a patient based on:

1. Language patterns:
   - Doctor: Professional medical language, giving advice, asking diagnostic questions
   - Patient: Describing symptoms, asking for help, expressing concerns

2. Medical terminology usage:
   - Doctor: Uses medical terms professionally, explains conditions
   - Patient: Uses everyday language to describe symptoms

3. Content patterns:
   - Doctor: Gives instructions, recommendations, diagnoses
   - Patient: Seeks help, describes problems, asks questions

Speech content:
{combined_text}

Based on the speech content above, determine if this is most likely a Doctor or Patient speaking. Respond ONLY with a JSON format:
{{"role": "Doctor"}} or {{"role": "Patient"}}"""

        try:
            # Use MERaLiON for role identification
            role_json = self._generate_text_with_meralion(prompt)
            
            import json
            role_response = json.loads(role_json)
            identified_role = role_response.get("role", "Unknown")
            
            result = {speaker_id: identified_role}
            logger.info(f"Single speaker identified as: {identified_role}")
            return result
            
        except Exception as e:
            logger.warning(f"Single speaker role identification failed: {e}")
            # Fallback: Use simple heuristics
            return self._fallback_single_speaker_identification(speaker_id, combined_text)
    
    def _fallback_single_speaker_identification(self, speaker_id: str, text: str) -> Dict[str, str]:
        """
        Fallback method for single speaker role identification.
        
        Args:
            speaker_id: Speaker ID
            text: Combined text from speaker
            
        Returns:
            Dictionary mapping speaker ID to role
        """
        text_lower = text.lower()
        
        # Doctor indicators: professional, giving advice
        doctor_indicators = [
            "i recommend", "you should take", "the diagnosis is", "let me examine",
            "your condition", "the treatment", "prescription", "dosage", "come back",
            "follow up", "the medication", "your symptoms indicate"
        ]
        
        # Patient indicators: seeking help, describing problems
        patient_indicators = [
            "i feel", "it hurts", "i have pain", "help me", "what should i do",
            "i'm worried", "i don't understand", "can you help", "i've been having",
            "doctor", "please", "my problem is"
        ]
        
        doctor_score = sum(1 for indicator in doctor_indicators if indicator in text_lower)
        patient_score = sum(1 for indicator in patient_indicators if indicator in text_lower)
        
        if doctor_score > patient_score:
            role = "Doctor"
        elif patient_score > doctor_score:
            role = "Patient"
        else:
            role = "Unknown"  # Can't determine
        
        logger.info(f"Fallback single speaker identification: {role} (doctor_score: {doctor_score}, patient_score: {patient_score})")
        return {speaker_id: role}
    
    def calculate_speaking_times(
        self, 
        segments: List[Tuple[str, float, float, str, str]]
    ) -> Dict[str, float]:
        """
        Calculate total speaking time for each speaker.
        
        Args:
            segments: List of segments
            
        Returns:
            Dictionary mapping speaker IDs to speaking times
        """
        speaking_times = {}
        
        for speaker_id, start, end, _, _ in segments:
            if speaker_id not in speaking_times:
                speaking_times[speaker_id] = 0.0
            speaking_times[speaker_id] += (end - start)
        
        return speaking_times
    
    def process_audio_file(self, audio_path: str) -> TranscriptionResult:
        """
        Process a complete audio file through the entire pipeline.
        
        Args:
            audio_path: Local file path or S3 URI (s3://bucket/path/file.ext)
            
        Returns:
            Complete transcription result
        """
        logger.info(f"Processing audio file: {audio_path}")
        
        try:
            # Step 1: Resolve audio file (download from S3 if needed)
            local_audio_path = self.resolve_audio_file(audio_path)
            
            # Step 2: Preprocess audio
            wav_path = self.preprocess_audio(local_audio_path)
            
            # Step 3: Perform speaker diarization
            diarization_segments = self.perform_diarization(wav_path)
            
            # Step 4: Transcribe segments and detect language
            transcribed_segments, detected_language = self.transcribe_segments(wav_path, diarization_segments)
            print('transcribed segments:', transcribed_segments)
            print('detected language:', detected_language)
            
            # Create minimal result for testing transcription
            segments = []
            total_duration = 0.0
            
            for speaker_id, start, end, transcription in transcribed_segments:
                segment = Segment(
                    speaker_id=speaker_id,
                    role="Unknown",  # Skip role detection for now
                    start_time=start,
                    end_time=end,
                    text={
                        "original": transcription,
                        "english": transcription  # Skip translation for now
                    }
                )
                segments.append(segment)
                total_duration = max(total_duration, end)
            
            # Create minimal result for testing
            result = TranscriptionResult(
                original_language=detected_language,
                speakers={
                    "total": 1,
                    "doctor": None,
                    "patients": []
                },
                segments=segments,
                summary={
                    "total_duration": total_duration,
                    "doctor_speaking_time": 0.0,
                    "patient_speaking_time": 0.0
                }
            )
            
            logger.info("Transcription test completed")
            return result
            
        except Exception as e:
            logger.error(f"Processing failed: {e}")
            raise
    
    def save_result_to_json(self, result: TranscriptionResult, output_path: str):
        """
        Save transcription result to JSON file.
        
        Args:
            result: Transcription result
            output_path: Output file path
        """
        # Convert to serializable format
        result_dict = {
            "original_language": result.original_language,
            "speakers": result.speakers,
            "segments": [
                {
                    "speaker_id": seg.speaker_id,
                    "role": seg.role,
                    "start_time": seg.start_time,
                    "end_time": seg.end_time,
                    "text": seg.text
                }
                for seg in result.segments
            ],
            "summary": result.summary
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result_dict, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Result saved to: {output_path}") 