"""
DEBUG VERSION: Clinical extractor with detailed logging
"""

import json
import re
import os
from pathlib import Path
from typing import Dict, Any, Optional
import warnings

# Suppress tokenizer warnings
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", message=".*clean_up_tokenization_spaces.*")

try:
    from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
    import torch
    HAS_TRANSFORMERS = True
except ImportError:
    HAS_TRANSFORMERS = False
    print("⚠️  Warning: transformers not installed. Install with: pip install transformers torch")


class ClinicalExtractorLLM:
    # def __init__(self, model_name: str = "/Users/estherlow/models/Qwen2.5-3B-Instruct"):
    def __init__(self, model_name: str = "Qwen/Qwen2.5-3B-Instruct"):
        """
        Initialize the LLM-based clinical extractor.
        
        Args:
            model_name: HuggingFace model name or local path
        """
        self.model_name = model_name
        self.model = None
        self.tokenizer = None
        self.generator = None
        self.is_local = self._is_local_path(model_name)
        
        if HAS_TRANSFORMERS:
            self._load_model()
    
    def _is_local_path(self, model_name: str) -> bool:
        """Check if model_name is a local path."""
        return os.path.exists(model_name) and os.path.isdir(model_name)
    
    def _load_model(self):
        """Load the LLM model and tokenizer."""
        try:
            if self.is_local:
                print(f"Loading model from local path: {self.model_name}")
            else:
                print(f"Loading {self.model_name} model from HuggingFace Hub...")
            
            # Set loading parameters based on local vs remote
            load_kwargs = {
                "trust_remote_code": True,
                "padding_side": "left"
            }
            
            if self.is_local:
                load_kwargs["local_files_only"] = True
            
            # Load tokenizer
            self.tokenizer = AutoTokenizer.from_pretrained(
                self.model_name,
                **load_kwargs
            )
            
            # Add pad token if missing
            if self.tokenizer.pad_token is None:
                self.tokenizer.pad_token = self.tokenizer.eos_token
            
            # Model loading parameters
            model_kwargs = {
                "dtype": torch.float16,  
                "trust_remote_code": True,
                "low_cpu_mem_usage": True
            }
            
            if self.is_local:
                model_kwargs["local_files_only"] = True
            
            # Load model
            self.model = AutoModelForCausalLM.from_pretrained(
                self.model_name,
                **model_kwargs
            )
            
            # Move model to CPU manually
            self.model = self.model.to("cpu")
            
            # Create pipeline with explicit device
            self.generator = pipeline(
                "text-generation",
                model=self.model,
                tokenizer=self.tokenizer,
                device="cpu",
                return_full_text=False,
                do_sample=True,
                temperature=0.1,
                max_new_tokens=1000,
                pad_token_id=self.tokenizer.eos_token_id
            )
            
            if self.is_local:
                print("✅ Local model loaded successfully")
            else:
                print("✅ HuggingFace model loaded successfully")
            
        except Exception as e:
            print(f"❌ Error loading model: {e}")
            if self.is_local:
                print("💡 Check if all model files are present in the local directory")
                print("💡 Required files: config.json, tokenizer_config.json, model files")
            else:
                print("💡 Check internet connection or try downloading the model locally")
            print("💡 Falling back to template-based extraction")
            self.model = None
            self.generator = None
    
    def json_to_text(self, json_data: Dict[Any, Any]) -> str:
        """
        Convert JSON transcript to plain text with speaker labels.
        
        Args:
            json_data: JSON transcript data
            
        Returns:
            Plain text conversation with speaker labels
        """
        # Handle different JSON structures
        text_parts = []
        
        # Check for 'turns' structure (conversation format)
        if 'turns' in json_data and isinstance(json_data['turns'], list):
            for turn in json_data['turns']:
                if isinstance(turn, dict) and 'text' in turn:
                    speaker = turn.get('speaker', 'Speaker')
                    text = turn['text'].strip()
                    if text:
                        text_parts.append(f"{speaker}: {text}")
        
        # Check for direct text fields
        elif 'text' in json_data:
            text_parts.append(json_data['text'])
        elif 'translated_text' in json_data:
            text_parts.append(json_data['translated_text'])
        elif 'transcript' in json_data:
            text_parts.append(json_data['transcript'])
        
        # Fallback: convert entire JSON to string
        else:
            return json.dumps(json_data, indent=2)
        
        result = '\n'.join(text_parts)
        print(f"🔤 Converted transcript text:\n{result}\n")
        return result
    
    def create_extraction_prompt(self, transcript_text: str) -> str:
        """Create the prompt for clinical extraction."""
        prompt = f"""You are a clinical information extraction assistant. Your task is to extract medical information from consultation transcripts.

From this transcript, extract only explicit facts into valid JSON with this schema:

{{
  "summary": string,   // Brief consultation overview: "Patient presented with [issue], diagnosed with [condition], prescribed [treatment]" or similar
  "chief_complaint": string or null,
  "symptoms_present": [strings],
  "symptoms_negated": [strings],
  "onset_or_duration": string or null,
  "allergy_substance": [strings],
  "meds_current": [strings],
  "conditions_past": [strings],
  "primary_diagnosis": string or null,
  "rx_drug": string or null,
  "rx_dose": string or null,
  "follow_up": string or null,
  "red_flags": [strings]
}}

Rules:
- Only extract what is explicitly stated; do not guess.
- Keep drug/disease names lowercase.
- Deduplicate list entries.
- Put negated symptoms into `symptoms_negated`.
- `rx_drug` = drug name prescribed, `rx_dose` = dose/frequency/duration details.
- If nothing is mentioned, return null or [].

Now process this consultation transcript:

{transcript_text}

JSON:"""
        
        print(f"📝 Generated prompt:\n{prompt}\n")
        return prompt
    
    def parse_llm_response(self, response: str) -> Dict[str, Any]:
        """
        Parse LLM response and extract JSON.
        
        Args:
            response: Raw LLM response
            
        Returns:
            Parsed clinical data dictionary
        """
        print(f"🤖 Raw LLM response:\n{repr(response)}\n")
        print(f"🤖 Raw LLM response (readable):\n{response}\n")
        
        try:
            # Look for JSON in the response - try multiple patterns
            patterns = [
                r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}',  # Nested JSON
                r'\{.*?\}',  # Simple JSON
                r'```json\s*(\{.*?\})\s*```',  # JSON in code blocks
                r'```\s*(\{.*?\})\s*```',  # JSON in any code blocks
            ]
            
            for i, pattern in enumerate(patterns):
                json_matches = re.findall(pattern, response, re.DOTALL | re.IGNORECASE)
                if json_matches:
                    print(f"✅ Found JSON with pattern {i+1}: {json_matches}")
                    
                    for match in json_matches:
                        try:
                            parsed = json.loads(match)
                            print(f"✅ Successfully parsed JSON: {parsed}")
                            return parsed
                        except json.JSONDecodeError as e:
                            print(f"❌ JSON decode error for match '{match[:100]}...': {e}")
                            continue
            
            print("❌ No valid JSON found in response")
            
        except Exception as e:
            print(f"❌ Error parsing LLM response: {e}")
        
        # Fallback: create empty structure
        print("🔄 Using empty extraction structure")
        return self._create_empty_extraction()
    
    def _create_empty_extraction(self) -> Dict[str, Any]:
        """Create empty extraction structure."""
        return {
            "summary": None,
            "chief_complaint": None,
            "symptoms_present": [],
            "symptoms_negated": [],
            "onset_or_duration": None,
            "allergy_substance": [],
            "meds_current": [],
            "conditions_past": [],
            "primary_diagnosis": None,
            "rx_drug": None,
            "rx_dose": None,
            "follow_up": None,
            "red_flags": []
        }
    
    def extract_clinical_info(self, json_data: Dict[Any, Any]) -> Dict[str, Any]:
        """
        Extract clinical information from JSON transcript using LLM.
        
        Args:
            json_data: JSON transcript data
            
        Returns:
            Structured clinical information
        """
        print("🚀 Starting extraction...")
        
        # Convert to plain text
        transcript_text = self.json_to_text(json_data)
        
        if not transcript_text.strip():
            print("❌ Empty transcript text")
            return self._create_empty_extraction()
        
        # Use LLM if available
        if self.generator:
            try:
                print("🧠 Using LLM for extraction...")
                prompt = self.create_extraction_prompt(transcript_text)
                
                # Generate response
                print("⏳ Generating response...")
                response = self.generator(
                    prompt,
                    max_new_tokens=800,
                    temperature=0.1,
                    do_sample=True,
                    pad_token_id=self.tokenizer.eos_token_id
                )
                
                if response and len(response) > 0:
                    generated_text = response[0]['generated_text']
                    print(f"✅ LLM generated response (length: {len(generated_text)})")
                    return self.parse_llm_response(generated_text)
                else:
                    print("❌ LLM returned empty response")
                    
            except Exception as e:
                print(f"⚠️  LLM extraction failed: {e}")
                import traceback
                traceback.print_exc()
        else:
            print("❌ No LLM generator available")
        
        # Fallback: basic template-based extraction
        print("🔄 Using fallback extraction")
        return self._fallback_extraction(transcript_text)
    
    def _fallback_extraction(self, text: str) -> Dict[str, Any]:
        """
        Fallback extraction using simple patterns when LLM is unavailable.
        """
        result = self._create_empty_extraction()
        
        # Basic pattern matching as fallback
        text_lower = text.lower()
        
        # Extract chief complaint (first patient statement)
        lines = text.split('\n')
        for line in lines:
            if 'speaker_01:' in line.lower():
                result['chief_complaint'] = line.strip()
                break
        
        # Basic symptom detection
        common_symptoms = ['pain', 'headache', 'fever', 'cough', 'nausea', 'dizziness']
        for symptom in common_symptoms:
            if symptom in text_lower:
                # Simple negation check
                if any(neg in text_lower for neg in ['no ' + symptom, 'not ' + symptom, 'without ' + symptom]):
                    result['symptoms_negated'].append(symptom)
                else:
                    result['symptoms_present'].append(symptom)
        
        result['summary'] = "Fallback extraction used"
        
        return result


# Global extractor instance
_extractor = None

def get_extractor() -> ClinicalExtractorLLM:
    """Get or create global extractor instance."""
    global _extractor
    if _extractor is None:
        _extractor = ClinicalExtractorLLM()
    return _extractor


def extract_clinical_json(json_data: Dict[Any, Any]) -> Dict[str, Any]:
    """
    Main function to extract clinical information from JSON transcript.
    
    Args:
        json_data: JSON transcript data
        
    Returns:
        Structured clinical information
    """
    extractor = get_extractor()
    return extractor.extract_clinical_info(json_data)


if __name__ == "__main__":
    # Test with sample data
    test_data = {
        "turns": [
            {"speaker": "SPEAKER_01", "text": "Doctor, I've been having chest pain for 2 days"},
            {"speaker": "SPEAKER_00", "text": "Any allergies?"},
            {"speaker": "SPEAKER_01", "text": "I'm allergic to penicillin"},
            {"speaker": "SPEAKER_00", "text": "I'll prescribe aspirin 100mg daily"}
        ]
    }
    
    result = extract_clinical_json(test_data)
    print("🎯 Final result:")
    print(json.dumps(result, indent=2, ensure_ascii=False))