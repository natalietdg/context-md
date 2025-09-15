"""
Clinical text extraction module for extracting key medical information from consultation transcripts.
Uses scispaCy for biomedical NER, negspacy for negation detection, and regex for temporal/dose extraction.
"""

import re
import json
import sys
from typing import Optional, List, Tuple, Dict

import spacy
from spacy import Language
from negspacy.negation import Negex
from transformers import pipeline, AutoTokenizer, AutoModelForTokenClassification


def build_nlp():
    """
    Builds and returns NLP models: spaCy pipeline + HuggingFace biomedical NER.
    Downloads models if they don't exist.
    """
    # Load spaCy for basic NLP processing and negation detection
    try:
        nlp = spacy.load("en_core_web_sm")
        print("✅ Using en_core_web_sm model")
    except OSError:
        print("Downloading en_core_web_sm model...")
        spacy.cli.download("en_core_web_sm")
        nlp = spacy.load("en_core_web_sm")
        print("✅ Successfully downloaded and loaded en_core_web_sm")
    
    # Add negation detection to spaCy
    chunk_prefix = ["no", "denies", "denied", "not", "without", "negative", "absent"]
    try:
        nlp.add_pipe(
            "negex",
            config={
                "chunk_prefix": chunk_prefix,
                "ent_types": ["PERSON", "ORG", "GPE"]  # Will apply to any entities we find
            }
        )
        print("✅ Added negation detection")
    except Exception as e:
        print(f"⚠️  Warning: Could not add negation detection: {e}")
    
    # Load HuggingFace biomedical NER model
    biomedical_ner = None
    try:
        print("Loading HuggingFace biomedical NER model...")
        tokenizer = AutoTokenizer.from_pretrained("d4data/biomedical-ner-all")
        model = AutoModelForTokenClassification.from_pretrained("d4data/biomedical-ner-all")
        biomedical_ner = pipeline("ner", model=model, tokenizer=tokenizer, aggregation_strategy="simple")
        print("✅ Successfully loaded d4data/biomedical-ner-all")
    except Exception as e:
        print(f"⚠️  Warning: Could not load biomedical NER model: {e}")
        print("Will use fallback pattern matching for biomedical entities.")
    
    return {
        'spacy': nlp,
        'biomedical_ner': biomedical_ner
    }


def extract_chief_complaint(text: str) -> Optional[str]:
    """
    Extract the chief complaint - first sentence trimmed to ≤120 chars.
    """
    sentences = re.split(r'[.!?]+', text.strip())
    if not sentences or not sentences[0].strip():
        return None
    
    first_sentence = sentences[0].strip()
    if len(first_sentence) > 120:
        first_sentence = first_sentence[:117] + "..."
    
    return first_sentence if first_sentence else None


def extract_temporal(text: str) -> Optional[str]:
    """
    Extract temporal information using regex patterns.
    """
    patterns = [
        r'\b(?:for|since)\s+(?:\d+\s*(?:day|week|month|hour)s?|\d+\s*(?:days?|weeks?|months?|hours?))\b',
        r'\byesterday\b',
        r'\blast night\b',
        r'\bthis morning\b',
        r'\btoday\b',
        r'\b\d+\s*(?:day|days|week|weeks|month|months|hour|hours)\s*(?:ago)?\b'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group().strip()
    
    return None


def extract_followup(text: str) -> Optional[str]:
    """
    Extract follow-up instructions using regex patterns.
    """
    patterns = [
        r'follow\s+up\s+(?:in|after)\s+[^.]+',
        r'review\s+(?:in|after)\s+[^.]+',
        r'(?:follow.up|follow\s+up|review)[^.]*(?:week|day|month)[^.]*',
        r'see\s+you\s+(?:in|after)\s+[^.]+',
        r'return\s+(?:in|after)\s+[^.]+'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group().strip()
    
    return None


def extract_redflags(text: str) -> List[str]:
    """
    Extract red flag warnings using regex patterns.
    """
    patterns = [
        r'go to (?:the\s+)?(?:ER|emergency|A&E|hospital)',
        r'return immediately',
        r'if\s+(?:worse|symptoms\s+worsen)',
        r'breathless(?:ness)?',
        r'high fever',
        r'severe\s+(?:chest\s+pain|breathlessness|difficulty\s+breathing)',
        r'chest\s+pain\s+at\s+rest'
    ]
    
    red_flags = []
    for pattern in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for match in matches:
            red_flag = match.strip()
            if red_flag and red_flag.lower() not in [rf.lower() for rf in red_flags]:
                red_flags.append(red_flag)
    
    return red_flags


def extract_allergies(text: str) -> List[str]:
    """
    Extract allergies using regex patterns around allergy mentions.
    """
    patterns = [
        r'allergic\s+to\s+([^.,;]+)',
        r'allergy\s+to\s+([^.,;]+)',
        r'has\s+allergy\s+to\s+([^.,;]+)',
        r'allergies?[:\-]?\s*([^.,;]+)'
    ]
    
    allergies = []
    for pattern in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for match in matches:
            allergy = match.strip().lower()
            # Clean up common phrases
            allergy = re.sub(r'\s+and\s+', ', ', allergy)
            allergy = re.sub(r'\s*,\s*', ', ', allergy)
            
            if allergy and allergy not in allergies:
                allergies.append(allergy)
    
    return allergies


def extract_rx(text: str, models: dict) -> Tuple[Optional[str], Optional[str]]:
    """
    Find the last sentence with a drug mention and extract dose/frequency/duration.
    """
    # Fallback drug lexicon
    fallback_drugs = {
        'amlodipine', 'metformin', 'paracetamol', 'ibuprofen', 'omeprazole',
        'losartan', 'atorvastatin', 'salbutamol', 'nitroglycerin', 'aspirin',
        'warfarin', 'insulin', 'furosemide', 'lisinopril', 'simvastatin'
    }
    
    # Dose/frequency/duration patterns
    dose_pattern = r'\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|puff(?:s)?|tablet(?:s)?|capsule(?:s)?)\b'
    freq_pattern = r'\b(?:bid|tid|qid|q\d+h|once\s+daily|twice\s+daily|three\s+times\s+daily|qhs|prn|as\s+needed)\b'
    duration_pattern = r'\bfor\s+\d+\s+(?:day|days|week|weeks)\b'
    
    # Process text with spaCy for sentence segmentation
    nlp = models['spacy']
    biomedical_ner = models['biomedical_ner']
    doc = nlp(text)
    
    # Find sentences with drug mentions
    sentences = list(doc.sents)
    drug_sentences = []
    
    for sent in sentences:
        sent_text = sent.text.lower()
        found_drug = False
        
        # First try biomedical NER model
        if biomedical_ner:
            try:
                bio_entities = biomedical_ner(sent.text)
                
                # Group drug entities for this sentence
                drug_entities = []
                for entity in bio_entities:
                    entity_label = entity.get('entity_group', '').upper()
                    if any(drug_label in entity_label for drug_label in ['DRUG', 'MED', 'CHEM', 'PHARM']):
                        clean_word = entity['word'].replace('##', '').strip()
                        if len(clean_word) > 1:
                            drug_entities.append({
                                'word': clean_word,
                                'start': entity['start'],
                                'end': entity['end']
                            })
                
                # Reconstruct full drug names
                if drug_entities:
                    drug_entities.sort(key=lambda x: x['start'])
                    current_drug = drug_entities[0]['word']
                    last_end = drug_entities[0]['end']
                    
                    for i in range(1, len(drug_entities)):
                        entity = drug_entities[i]
                        if entity['start'] - last_end <= 2:
                            current_drug += entity['word']
                            last_end = entity['end']
                        else:
                            # Save current drug and start new one
                            if len(current_drug) > 2:
                                drug_sentences.append((sent.text, current_drug.lower()))
                                found_drug = True
                                break
                            current_drug = entity['word']
                            last_end = entity['end']
                    
                    # Don't forget the last drug
                    if not found_drug and len(current_drug) > 2:
                        drug_sentences.append((sent.text, current_drug.lower()))
                        found_drug = True
                        
            except Exception as e:
                print(f"Warning: Biomedical NER failed for sentence: {e}")
        
        # Fallback to spaCy NER
        if not found_drug:
            for ent in sent.ents:
                if ent.label_ in ["CHEMICAL", "DRUG", "PERSON"]:  # PERSON sometimes captures drug names
                    # Basic filtering to avoid non-drug entities
                    ent_text = ent.text.lower()
                    if len(ent_text) > 3 and not any(word in ent_text for word in ['patient', 'doctor', 'nurse']):
                        drug_sentences.append((sent.text, ent_text))
                        found_drug = True
                        break
        
        # Check fallback lexicon if no NER drug found
        if not found_drug:
            for drug in fallback_drugs:
                if drug in sent_text:
                    drug_sentences.append((sent.text, drug))
                    found_drug = True
                    break
    
    if not drug_sentences:
        return None, None
    
    # Take the last sentence with a drug mention
    last_sentence, rx_drug = drug_sentences[-1]
    
    # Extract dose, frequency, and duration
    dose_components = []
    
    dose_match = re.search(dose_pattern, last_sentence, re.IGNORECASE)
    if dose_match:
        dose_components.append(dose_match.group())
    
    freq_match = re.search(freq_pattern, last_sentence, re.IGNORECASE)
    if freq_match:
        dose_components.append(freq_match.group())
    
    duration_match = re.search(duration_pattern, last_sentence, re.IGNORECASE)
    if duration_match:
        dose_components.append(duration_match.group())
    
    rx_dose = ' '.join(dose_components) if dose_components else None
    
    return rx_drug, rx_dose


def extract_symptoms_and_dx(text: str, models: dict) -> Tuple[List[str], List[str], Optional[str]]:
    """
    Extract symptoms (present/negated) and primary diagnosis using NER and heuristics.
    """
    nlp = models['spacy']
    biomedical_ner = models['biomedical_ner']
    doc = nlp(text)
    
    symptoms_present = []
    symptoms_negated = []
    
    # Extract symptoms using biomedical NER model
    if biomedical_ner:
        try:
            bio_entities = biomedical_ner(text)
            
            # Filter and group symptom entities
            symptom_entities = []
            for entity in bio_entities:
                entity_label = entity.get('entity_group', '').upper()
                if any(symptom_label in entity_label for symptom_label in ['DISEASE', 'SYMPTOM', 'CONDITION', 'DISORDER']):
                    symptom_entities.append(entity)
            
            # Sort by start position
            symptom_entities.sort(key=lambda x: x['start'])
            
            # Group adjacent/overlapping entities to reconstruct full words
            processed_entities = []
            i = 0
            while i < len(symptom_entities):
                current_entity = symptom_entities[i]
                combined_start = current_entity['start']
                combined_end = current_entity['end']
                
                # Look ahead to combine adjacent subword tokens
                j = i + 1
                while j < len(symptom_entities):
                    next_entity = symptom_entities[j]
                    # If next entity starts close to where current ends, combine them
                    if next_entity['start'] <= combined_end + 2:  # Allow small gaps
                        combined_end = max(combined_end, next_entity['end'])
                        j += 1
                    else:
                        break
                
                # Extract the full combined span from original text
                if combined_start < len(text) and combined_end <= len(text):
                    full_symptom = text[combined_start:combined_end].strip().lower()
                    
                    if full_symptom and len(full_symptom) > 2:
                        # Check for negation using the full symptom context
                        context_start = max(0, combined_start - 50)
                        context_end = min(len(text), combined_end + 20)
                        context = text[context_start:context_end].lower()
                        
                        # Check for negation in the text before the symptom
                        negation_words = ['no', 'not', 'without', 'denies', 'denied', 'never', 'absent', 'negative']
                        context_before = context[:combined_start - context_start]
                        is_negated = any(neg_word in context_before.split()[-5:] for neg_word in negation_words)
                        
                        if is_negated:
                            if full_symptom not in symptoms_negated:
                                symptoms_negated.append(full_symptom)
                        else:
                            if full_symptom not in symptoms_present:
                                symptoms_present.append(full_symptom)
                
                i = j if j > i else i + 1  # Move to next unprocessed entity
                        
        except Exception as e:
            print(f"Warning: Biomedical NER failed for symptoms extraction: {e}")
    
    # Fallback: Extract symptoms from spaCy entities
    for ent in doc.ents:
        if ent.label_ in ["DISEASE", "SYMPTOM"]:
            symptom = ent.text.lower().strip()
            if symptom:
                # Check if negated using negspacy
                try:
                    is_negated = any(token._.negex for token in ent)
                except:
                    is_negated = False
                
                if is_negated:
                    if symptom not in symptoms_negated:
                        symptoms_negated.append(symptom)
                else:
                    if symptom not in symptoms_present:
                        symptoms_present.append(symptom)
    
    # Fallback: Use pattern matching for common symptoms that biomedical NER might miss
    common_symptoms = [
        'chest pain', 'pain', 'headache', 'fever', 'cough', 'nausea', 'vomiting',
        'dizziness', 'fatigue', 'shortness of breath', 'breathlessness', 
        'abdominal pain', 'back pain', 'sore throat', 'runny nose', 'congestion',
        'migraines', 'migraine', 'blurred vision', 'vision changes', 'sweating'
    ]
    
    # Look for symptoms in text with context for negation detection
    for symptom in common_symptoms:
        pattern = r'\b' + re.escape(symptom) + r'\b'
        matches = list(re.finditer(pattern, text, re.IGNORECASE))
        
        for match in matches:
            # Check context around the symptom for negation
            start_pos = max(0, match.start() - 50)
            end_pos = min(len(text), match.end() + 20)
            context = text[start_pos:end_pos].lower()
            
            # Simple negation detection for fallback
            negation_words = ['no', 'not', 'without', 'denies', 'denied', 'never', 'absent']
            is_negated = False
            
            # Check if any negation word appears before the symptom in the context
            symptom_in_context = match.start() - start_pos
            context_before_symptom = context[:symptom_in_context]
            
            for neg_word in negation_words:
                if neg_word in context_before_symptom.split()[-5:]:  # Check last 5 words before symptom
                    is_negated = True
                    break
            
            symptom_clean = symptom.lower()
            
            if is_negated:
                if symptom_clean not in symptoms_negated:
                    symptoms_negated.append(symptom_clean)
            else:
                if symptom_clean not in symptoms_present:
                    symptoms_present.append(symptom_clean)
    
    # Extract primary diagnosis using heuristics
    dx_patterns = [
        r'(?:diagnosis|impression|assessment|likely|suspect|consistent\s+with)\s*[:\-]?\s*([^.]+)',
        r'(?:diagnosed\s+with|likely\s+to\s+be)\s+([^.]+)',
        r'(?:appears\s+to\s+be|seems\s+to\s+be)\s+([^.]+)'
    ]
    
    primary_diagnosis = None
    for pattern in dx_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        if matches:
            # Take the last match
            diagnosis = matches[-1].strip().lower()
            # Clean up common trailing phrases
            diagnosis = re.sub(r'\s*(?:and|,).*$', '', diagnosis)
            primary_diagnosis = diagnosis
            break
    
    # Clean up partial matches - remove shorter symptoms that are substrings of longer ones
    def deduplicate_symptoms(symptom_list):
        cleaned = []
        for symptom in symptom_list:
            # Check if this symptom is a substring of any longer symptom
            is_substring = False
            for other_symptom in symptom_list:
                if symptom != other_symptom and symptom in other_symptom and len(other_symptom) > len(symptom):
                    is_substring = True
                    break
            if not is_substring:
                cleaned.append(symptom)
        return cleaned
    
    symptoms_present = deduplicate_symptoms(symptoms_present)
    symptoms_negated = deduplicate_symptoms(symptoms_negated)
    
    return symptoms_present, symptoms_negated, primary_diagnosis


def extract_current_meds(text: str, models: dict) -> List[str]:
    """
    Extract current medications from CHEMICAL entities and fallback lexicon.
    """
    # Fallback drug lexicon
    fallback_drugs = {
        'amlodipine', 'metformin', 'paracetamol', 'ibuprofen', 'omeprazole',
        'losartan', 'atorvastatin', 'salbutamol', 'nitroglycerin', 'aspirin',
        'warfarin', 'insulin', 'furosemide', 'lisinopril', 'simvastatin'
    }
    
    nlp = models['spacy']
    biomedical_ner = models['biomedical_ner']
    doc = nlp(text)
    medications = []
    
    # Extract using biomedical NER model
    if biomedical_ner:
        try:
            bio_entities = biomedical_ner(text)
            
            # Group and clean medication entities
            drug_entities = []
            for entity in bio_entities:
                entity_label = entity.get('entity_group', '').upper()
                # Look for medication/drug related entities
                if any(drug_label in entity_label for drug_label in ['DRUG', 'MED', 'CHEM', 'PHARM']):
                    # Clean up tokenization artifacts
                    clean_word = entity['word'].replace('##', '').strip()
                    if len(clean_word) > 1:  # Keep even 2-letter parts for reconstruction
                        drug_entities.append({
                            'word': clean_word,
                            'start': entity['start'],
                            'end': entity['end']
                        })
            
            # Reconstruct full drug names from consecutive tokens
            if drug_entities:
                # Sort by position
                drug_entities.sort(key=lambda x: x['start'])
                
                current_drug = drug_entities[0]['word']
                last_end = drug_entities[0]['end']
                
                for i in range(1, len(drug_entities)):
                    entity = drug_entities[i]
                    # If tokens are close together (likely same word), combine them
                    if entity['start'] - last_end <= 2:  # Allow small gaps
                        current_drug += entity['word']
                        last_end = entity['end']
                    else:
                        # Save current drug and start new one
                        if len(current_drug) > 2 and current_drug not in medications:
                            if not any(common_word in current_drug.lower() for common_word in ['patient', 'doctor', 'nurse', 'hospital']):
                                medications.append(current_drug.lower())
                        current_drug = entity['word']
                        last_end = entity['end']
                
                # Don't forget the last drug
                if len(current_drug) > 2 and current_drug not in medications:
                    if not any(common_word in current_drug.lower() for common_word in ['patient', 'doctor', 'nurse', 'hospital']):
                        medications.append(current_drug.lower())
                        
        except Exception as e:
            print(f"Warning: Biomedical NER failed for medication extraction: {e}")
    
    # Fallback: Extract from spaCy NER entities
    for ent in doc.ents:
        if ent.label_ in ["CHEMICAL", "DRUG"]:
            med = ent.text.lower().strip()
            if med and med not in medications:
                medications.append(med)
    
    # Extract from fallback lexicon
    text_lower = text.lower()
    for drug in fallback_drugs:
        if drug in text_lower and drug not in medications:
            medications.append(drug)
    
    return medications


def extract_minimal_json(transcript: str) -> Dict:
    """
    Orchestrate all extraction functions and return structured clinical data.
    """
    models = build_nlp()
    
    # Extract all components
    chief_complaint = extract_chief_complaint(transcript)
    symptoms_present, symptoms_negated, primary_diagnosis = extract_symptoms_and_dx(transcript, models)
    onset_or_duration = extract_temporal(transcript)
    allergy_substance = extract_allergies(transcript)
    meds_current = extract_current_meds(transcript, models)
    rx_drug, rx_dose = extract_rx(transcript, models)
    follow_up = extract_followup(transcript)
    red_flags = extract_redflags(transcript)
    
    return {
        "chief_complaint": chief_complaint,
        "symptoms_present": symptoms_present,
        "symptoms_negated": symptoms_negated,
        "onset_or_duration": onset_or_duration,
        "allergy_substance": allergy_substance,
        "meds_current": meds_current,
        "conditions_past": [],  # leave empty for now
        "primary_diagnosis": primary_diagnosis,
        "rx_drug": rx_drug,
        "rx_dose": rx_dose,
        "follow_up": follow_up,
        "red_flags": red_flags
    }


if __name__ == "__main__":
    # Quick test on stdin
    if len(sys.argv) > 1:
        with open(sys.argv[1], 'r') as f:
            text = f.read()
    else:
        text = sys.stdin.read()
    
    result = extract_minimal_json(text)
    print(json.dumps(result, ensure_ascii=False, indent=2)) 