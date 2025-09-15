# Clinical Extractor

A biomedical text processing system that extracts critical clinical fields from English consultation transcripts using scispaCy, negspacy, and regex-based extraction techniques.

## Overview

This system reads JSON files from the `outputs/02_translated` folder and extracts structured clinical information, outputting results to the `outputs/03_clinical_extraction` folder.

### Extracted Fields

- `chief_complaint`: First sentence of consultation (≤120 chars)
- `symptoms_present[]`: Detected symptoms/conditions (not negated)
- `symptoms_negated[]`: Explicitly denied symptoms/conditions
- `onset_or_duration`: Temporal information (e.g., "for 2 days")
- `allergy_substance[]`: Mentioned allergies
- `meds_current[]`: Current medications
- `conditions_past[]`: Past medical conditions (currently empty)
- `primary_diagnosis`: Suspected diagnosis from consultation
- `rx_drug`: Prescribed medication
- `rx_dose`: Dosage, frequency, and duration
- `follow_up`: Follow-up instructions
- `red_flags[]`: Warning signs requiring immediate attention

## Installation

### Prerequisites

- Python 3.8 or higher
- pip package manager

### Setup

1. Navigate to the clinical_extractor directory:
```bash
cd clinical_extractor
```

2. Install required packages:
```bash
pip install -r requirements.txt
```

3. Download required spaCy models (will happen automatically on first run):
```bash
python -c "import spacy; spacy.cli.download('en_core_sci_sm')"
```

Optional (for better biomedical NER):
```bash
python -c "import spacy; spacy.cli.download('en_ner_bc5cdr_md')"
```

## Usage

### Command Line Interface

Process a single file:
```bash
python cli.py --file path/to/transcript.txt
python cli.py --file path/to/transcript.json
```

### Batch Processing

Process all JSON files from `outputs/02_translated` to `outputs/03_clinical_extraction`:
```bash
python batch_processor.py
```

### Python API

```python
from extractor import extract_minimal_json

text = "Patient has chest pain for 2 days..."
result = extract_minimal_json(text)
print(result)
```

## File Structure

```
clinical_extractor/
├── requirements.txt          # Python dependencies
├── extractor.py             # Core extraction functions
├── cli.py                   # Command line interface
├── batch_processor.py       # Batch processing script
├── tests/
│   └── test_extractor.py    # Test cases
└── README.md               # This file
```

## Testing

Run the test suite:
```bash
cd tests
python test_extractor.py
```

The tests include:
- Acceptance test with the example from requirements
- Empty input handling
- Individual function testing

## Technical Details

### Dependencies

- **spaCy 3.x**: Core NLP framework
- **scispaCy 0.5.x**: Biomedical NLP models
- **negspacy 1.0.x**: Negation detection
- **rapidfuzz 3.x**: String matching (future use)

### Models Used

- `en_core_sci_sm`: Base scispaCy model for biomedical text
- `en_ner_bc5cdr_md`: Optional enhanced biomedical NER (graceful fallback)

### Extraction Methods

1. **Biomedical NER**: Uses scispaCy models to identify DISEASE and CHEMICAL entities
2. **Negation Detection**: negspacy with custom prefixes: ["no","denies","denied","not","without"]
3. **Regex Patterns**: For temporal expressions, dosages, follow-up instructions, and red flags
4. **Fallback Lexicons**: Common medications for cases where NER fails

## Example

### Input
```
Patient: I've had chest pain for 2 days, worse on exertion, no fever or cough.
Doctor: Any allergies?
Patient: I'm allergic to penicillin.
Doctor: Current meds?
Patient: Amlodipine at night.
Doctor: Likely diagnosis: stable angina. I'll prescribe nitroglycerin 0.4 mg sublingual PRN chest pain, review in one week. If chest pain at rest or severe breathlessness, go to ER immediately.
```

### Output
```json
{
  "chief_complaint": "Patient: I've had chest pain for 2 days, worse on exertion, no fever or cough",
  "symptoms_present": ["chest pain"],
  "symptoms_negated": ["fever", "cough"],
  "onset_or_duration": "for 2 days",
  "allergy_substance": ["penicillin"],
  "meds_current": ["amlodipine"],
  "conditions_past": [],
  "primary_diagnosis": "stable angina",
  "rx_drug": "nitroglycerin",
  "rx_dose": "0.4 mg PRN",
  "follow_up": "review in one week",
  "red_flags": ["go to ER"]
}
```

## Limitations

- CPU-only processing (no GPU acceleration)
- Conservative extraction (only explicitly mentioned information)
- English language only
- No training or fine-tuning capabilities
- Regex-based patterns may miss variations in medical terminology

## Troubleshooting

### Common Issues

1. **Model download failures**: Ensure internet connection and try manual download
2. **Import errors**: Check that all dependencies are installed in the correct environment
3. **Empty extractions**: Verify input text is in English and contains medical content
4. **Performance**: Initial run may be slow due to model loading; subsequent runs are faster

### Debugging

Run with verbose output:
```bash
python -c "from extractor import extract_minimal_json; import json; result = extract_minimal_json('your text here'); print(json.dumps(result, indent=2))"
```

## Contributing

When modifying extraction functions:
1. Keep functions small and well-commented
2. Test with the provided acceptance example
3. Ensure backward compatibility with the JSON output format
4. Update tests accordingly 