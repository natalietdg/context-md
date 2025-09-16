# Clinical Extractor LLM

A **Large Language Model-based** clinical information extraction system that converts consultation transcripts into structured medical data using **Qwen2.5-3B-Instruct**.

## 🎯 Overview

This system replaces complex NER+regex approaches with clean, contextual LLM-based extraction. It reads JSON transcripts from `outputs/02_translated` and produces structured clinical data in `outputs/03_clinical_extraction`.

### ✅ Advantages over Traditional NER:
- **Contextual Understanding**: Distinguishes "chest pain present" vs "no chest pain" 
- **Medical Knowledge**: Recognizes diabetes, hypertension as conditions (not symptoms)
- **Clean Output**: No tokenization artifacts or contradictory data
- **Easy Maintenance**: Single prompt instead of complex rule systems
- **Self-Correcting**: Resolves logical inconsistencies automatically

## 📋 Extracted Fields

```json
{
  "summary": "Patient with chest pain, taking metformin, prescribed aspirin",
  "chief_complaint": "SPEAKER_01: Doctor, I've been having chest pain for 2 days",
  "symptoms_present": ["chest pain"],
  "symptoms_negated": ["fever", "cough"], 
  "onset_or_duration": "2 days",
  "allergy_substance": ["penicillin"],
  "meds_current": ["metformin", "amlodipine"],
  "conditions_past": ["diabetes", "hypertension"],
  "primary_diagnosis": "stable angina",
  "rx_drug": "aspirin",
  "rx_dose": "100mg daily",
  "follow_up": "return in 2 weeks",
  "red_flags": ["chest pain at rest"]
}
```

## 🚀 Installation

### Prerequisites
- Python 3.8+
- 8GB+ RAM recommended (for Qwen2.5-3B-Instruct model)
- ~6GB disk space for model download

### Setup
```bash
cd clinical_extractor_llm
pip install -r requirements.txt
```

**First run will download Qwen2.5-3B-Instruct model (~6GB)**

## 💻 Usage

### Single File Processing
```bash
# JSON transcript
python cli.py --file consultation.json

# Plain text file  
python cli.py --file transcript.txt

# Custom output location
python cli.py --file data.json --output custom_results.json

# Print only (no file saving)
python cli.py --file transcript.json --print-only

# Use different model
python cli.py --file data.json --model microsoft/DialoGPT-medium

# Use custom model downloaded locally 
python cli.py --file data.json --model /Users/estherlow/models/Qwen2.5-3B-Instruct
```

### Batch Processing
```bash
python batch_processor.py
```
Processes all files from `outputs/02_translated/` → `outputs/03_clinical_extraction/`

### Python API
```python
from extractor import extract_clinical_json

# JSON transcript data
transcript = {
    "turns": [
        {"speaker": "SPEAKER_01", "text": "I have chest pain"},
        {"speaker": "SPEAKER_00", "text": "How long?"}
    ]
}

result = extract_clinical_json(transcript)
print(result['chief_complaint'])  # "SPEAKER_01: I have chest pain"
```

## 📂 Input Formats

### JSON Transcript (Preferred)
```json
{
  "turns": [
    {"speaker": "SPEAKER_01", "text": "Doctor, I have chest pain"},
    {"speaker": "SPEAKER_00", "text": "How long have you had this?"}
  ]
}
```

### Plain Text
```
SPEAKER_01: Doctor, I have chest pain
SPEAKER_00: How long have you had this?
```

### Simple JSON
```json
{
  "text": "Patient reports chest pain for 2 days...",
  "translated_text": "..."
}
```

## 🧠 LLM Model Options

### Default: Qwen2.5-3B-Instruct
- **Size**: 3B parameters
- **Strengths**: Excellent instruction following, reasoning, multilingual
- **Memory**: ~6-8GB RAM
- **Speed**: Fast inference on CPU


## 📊 Output Structure

### File Naming
- **Input**: `consultation.json`
- **Output**: `consultation_llm_clinical.json`

### Metadata Included
```json
{
  "_metadata": {
    "source_file": "consultation.json",
    "model_used": "Qwen/Qwen2.5-3B-Instruct", 
    "extraction_method": "llm"
  }
}
```

## 🔧 Configuration

### Memory Optimization
For systems with limited RAM, modify `extractor.py`:
```python
# Load model in 8-bit mode
self.model = AutoModelForCausalLM.from_pretrained(
    self.model_name,
    load_in_8bit=True,  # Reduce memory usage
    device_map="auto"
)
```

### Custom Prompts
Modify the extraction prompt in `extractor.py` → `create_extraction_prompt()` method.

## 🚨 Troubleshooting

### Common Issues

**1. Model Download Fails**
```bash
# Manual download
huggingface-cli download Qwen/Qwen2.5-3B-Instruct
```

**2. Out of Memory**
- Close other applications
- Use smaller model: `--modelQwen/Qwen2.5-1.5B-Instruct`
- Enable 8-bit loading (see Configuration)

**3. Slow Performance**
- First run downloads model (one-time)
- Subsequent runs much faster (~5-10 seconds)
- Consider GPU if available

**4. Empty Extractions**
- Check input format is correct
- Verify text contains medical content
- Try fallback: if LLM fails, basic pattern matching is used

### Debug Mode
```python
# In extractor.py, add debug prints
print(f"Generated response: {generated_text}")
```

## 📈 Performance

### Speed
- **First run**: 30-60 seconds (model download)
- **Subsequent runs**: 5-10 seconds per file
- **Batch processing**: Parallel-ready architecture

### Accuracy
- **Clinical Understanding**: High (understands medical context)
- **Negation Detection**: Excellent (contextual)
- **Entity Recognition**: Very good (medical knowledge built-in)
- **Consistency**: High (no contradictory outputs)

## 🔄 Comparison with Traditional NER

| Feature | Traditional NER | LLM-based |
|---------|----------------|-----------|
| Setup Complexity | High (models, rules, patterns) | Low (single model) |
| Medical Knowledge | Limited | Built-in |
| Contextual Understanding | Poor | Excellent |
| Negation Handling | Rule-based | Natural |
| Maintenance | High | Low |
| Consistency | Poor (conflicts) | High |
| Performance | Fast | Moderate |

## 🏥 Medical Use Cases

- **Clinical Documentation**: Structure unstructured notes
- **Medical Coding**: Extract ICD-10 relevant information  
- **Research**: Standardize consultation data
- **Quality Assurance**: Identify missing information
- **Telemedicine**: Process virtual consultation transcripts

## ⚖️ Limitations

- **Internet Required**: First-time model download only
- **Memory Usage**: ~6-8GB RAM for Qwen2.5-3B-Instruct
- **Processing Time**: Slower than simple NER (~5-10 sec/file)
- **Language**: Optimized for English medical text
- **Accuracy**: Dependent on input transcript quality

## 🔮 Future Enhancements

- **GPU Acceleration**: Faster processing with CUDA
- **Model Fine-tuning**: Customize on medical data
- **Multi-language**: Support for non-English transcripts
- **Streaming**: Real-time transcript processing
- **API Integration**: REST API for external systems

---

**Built with ❤️ for better healthcare documentation** 