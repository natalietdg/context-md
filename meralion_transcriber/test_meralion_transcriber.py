#!/usr/bin/env python3
"""
Fixed MERaLiON Transcription Test

Test the MERaLiON model with proper dtype handling.
"""

import os
import sys
import librosa
import torch
from pathlib import Path
import numpy as np

# Load environment
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor


def fixed_transcription_test():
    """Test MERaLiON transcription with fixed dtype handling."""
    
    print("🧪 Testing MERaLiON-2-3B transcription (lighter 3.47B parameter model)...")
    
    try:
        # Load model and processor
        model_id = "MERaLiON/MERaLiON-2-3B"
        hf_token = os.getenv('HF_TOKEN')
        
        print("📦 Loading processor...")
        processor = AutoProcessor.from_pretrained(
            model_id, 
            trust_remote_code=True,
            token=hf_token
        )
        
        print("📦 Loading MERaLiON-2-3B model (3.47B params vs 10.1B - much faster on CPU)...")
        model = AutoModelForSpeechSeq2Seq.from_pretrained(
            model_id,
            trust_remote_code=True,
            torch_dtype=torch.float32,  # Use float32 to match audio input
            token=hf_token
        )
        
        # Load test audio
        audio_path = "audio_cache/malay1.wav"
        print(f"🎵 Loading audio: {audio_path}")
        
        if not os.path.exists(audio_path):
            print(f"❌ Audio file not found: {audio_path}")
            return
        
        audio_array, sample_rate = librosa.load(audio_path, sr=16000)
        print(f"📊 Audio loaded: {len(audio_array)} samples, {sample_rate} Hz, dtype: {audio_array.dtype}")
        
        # Prepare conversation exactly as in MERaLiON docs
        prompt = "Given the following audio context: <SpeechHere>\n\nText instruction: {query}"
        transcribe_query = "Please transcribe this speech."
        
        conversation = [
            [{"role": "user", "content": prompt.format(query=transcribe_query)}]
        ]
        
        print("📝 Applying chat template...")
        chat_prompt = processor.tokenizer.apply_chat_template(
            conversation=conversation,
            tokenize=False,
            add_generation_prompt=True
        )
        
        print("🔄 Processing inputs...")
        # Use audio array duplicated as in their docs
        audio_list = [audio_array, audio_array]
        inputs = processor(text=chat_prompt, audios=audio_list)
        
        print(f"📊 Input tensor dtypes:")
        for key, value in inputs.items():
            if isinstance(value, torch.Tensor):
                print(f"  {key}: {value.dtype}")
        
        print("🚀 Generating transcription...")
        with torch.no_grad():
            outputs = model.generate(**inputs, max_new_tokens=256)
        
        # Decode result
        generated_ids = outputs[:, inputs['input_ids'].size(1):]
        response = processor.tokenizer.batch_decode(generated_ids, skip_special_tokens=True)
        
        print(f"✅ Transcription result: '{response[0]}'")
        return response[0]
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        print(f"Full error: {traceback.format_exc()}")
        return None


if __name__ == '__main__':
    result = fixed_transcription_test()
    if result:
        print(f"\n🎉 SUCCESS! MERaLiON-2-3B Transcription: {result}")
    else:
        print(f"\n❌ FAILED - 3B model transcription not working") 