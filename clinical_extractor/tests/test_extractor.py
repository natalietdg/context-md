#!/usr/bin/env python3
"""
Test cases for clinical extractor functionality.
Includes the acceptance test case from the requirements.
"""

import json
import sys
import os

# Add parent directory to path to import extractor
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from extractor import extract_minimal_json


def test_acceptance_example():
    """
    Test the acceptance example from the requirements.
    """
    input_text = """Patient: I've had chest pain for 2 days, worse on exertion, no fever or cough.
Doctor: Any allergies?
Patient: I'm allergic to penicillin.
Doctor: Current meds?
Patient: Amlodipine at night.
Doctor: Likely diagnosis: stable angina. I'll prescribe nitroglycerin 0.4 mg sublingual PRN chest pain, review in one week. If chest pain at rest or severe breathlessness, go to ER immediately."""
    
    result = extract_minimal_json(input_text)
    
    # Print the result for debugging
    print("Extraction Result:")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    # Test assertions (case-insensitive)
    errors = []
    
    # Check chief complaint
    if not result.get('chief_complaint') or 'chest pain' not in result['chief_complaint'].lower():
        errors.append(f"Chief complaint should contain 'chest pain', got: {result.get('chief_complaint')}")
    
    # Check symptoms present
    symptoms_present_lower = [s.lower() for s in result.get('symptoms_present', [])]
    if 'chest pain' not in ' '.join(symptoms_present_lower) and 'pain' not in ' '.join(symptoms_present_lower):
        errors.append(f"Symptoms present should contain 'chest pain' or 'pain', got: {result.get('symptoms_present')}")
    
    # Check symptoms negated
    symptoms_negated_lower = [s.lower() for s in result.get('symptoms_negated', [])]
    if not any('fever' in s for s in symptoms_negated_lower):
        errors.append(f"Symptoms negated should contain 'fever', got: {result.get('symptoms_negated')}")
    if not any('cough' in s for s in symptoms_negated_lower):
        errors.append(f"Symptoms negated should contain 'cough', got: {result.get('symptoms_negated')}")
    
    # Check temporal
    if not result.get('onset_or_duration') or '2 days' not in result['onset_or_duration'].lower():
        errors.append(f"Onset/duration should contain '2 days', got: {result.get('onset_or_duration')}")
    
    # Check allergies
    allergy_substances_lower = [a.lower() for a in result.get('allergy_substance', [])]
    if not any('penicillin' in a for a in allergy_substances_lower):
        errors.append(f"Allergies should contain 'penicillin', got: {result.get('allergy_substance')}")
    
    # Check current meds
    meds_current_lower = [m.lower() for m in result.get('meds_current', [])]
    if 'amlodipine' not in meds_current_lower:
        errors.append(f"Current meds should contain 'amlodipine', got: {result.get('meds_current')}")
    
    # Check primary diagnosis
    if not result.get('primary_diagnosis') or 'stable angina' not in result['primary_diagnosis'].lower():
        errors.append(f"Primary diagnosis should contain 'stable angina', got: {result.get('primary_diagnosis')}")
    
    # Check prescription
    if not result.get('rx_drug') or 'nitroglycerin' not in result['rx_drug'].lower():
        errors.append(f"Rx drug should be 'nitroglycerin', got: {result.get('rx_drug')}")
    
    if not result.get('rx_dose') or '0.4 mg' not in result.get('rx_dose', ''):
        errors.append(f"Rx dose should contain '0.4 mg', got: {result.get('rx_dose')}")
    
    if not result.get('rx_dose') or 'prn' not in result.get('rx_dose', '').lower():
        errors.append(f"Rx dose should contain 'PRN', got: {result.get('rx_dose')}")
    
    # Check follow up
    if not result.get('follow_up') or 'review in' not in result['follow_up'].lower():
        errors.append(f"Follow up should contain 'review in', got: {result.get('follow_up')}")
    
    if not result.get('follow_up') or 'one week' not in result['follow_up'].lower():
        errors.append(f"Follow up should contain 'one week', got: {result.get('follow_up')}")
    
    # Check red flags
    red_flags_lower = [rf.lower() for rf in result.get('red_flags', [])]
    red_flags_text = ' '.join(red_flags_lower)
    if 'go to er' not in red_flags_text and 'go to emergency' not in red_flags_text:
        errors.append(f"Red flags should contain 'go to ER', got: {result.get('red_flags')}")
    
    # Print results
    if errors:
        print("\n❌ Test FAILED with errors:")
        for error in errors:
            print(f"  - {error}")
        return False
    else:
        print("\n✅ Test PASSED - All requirements met!")
        return True


def test_empty_input():
    """Test handling of empty input."""
    result = extract_minimal_json("")
    
    # Should return structure with mostly None/empty values
    expected_keys = [
        'chief_complaint', 'symptoms_present', 'symptoms_negated', 
        'onset_or_duration', 'allergy_substance', 'meds_current',
        'conditions_past', 'primary_diagnosis', 'rx_drug', 'rx_dose',
        'follow_up', 'red_flags'
    ]
    
    for key in expected_keys:
        if key not in result:
            print(f"❌ Missing key '{key}' in result")
            return False
    
    print("✅ Empty input test passed")
    return True


def test_individual_functions():
    """Test individual extraction functions."""
    from extractor import (
        extract_chief_complaint, extract_temporal, extract_followup,
        extract_redflags, extract_allergies, build_nlp
    )
    
    print("\nTesting individual functions:")
    
    # Test chief complaint
    text = "I have a headache. It started yesterday."
    cc = extract_chief_complaint(text)
    print(f"Chief complaint: {cc}")
    
    # Test temporal
    temporal = extract_temporal("I've had this pain for 3 days")
    print(f"Temporal: {temporal}")
    
    # Test follow-up
    followup = extract_followup("Please follow up in 2 weeks")
    print(f"Follow-up: {followup}")
    
    # Test red flags
    red_flags = extract_redflags("Go to ER immediately if symptoms worsen")
    print(f"Red flags: {red_flags}")
    
    # Test allergies
    allergies = extract_allergies("I'm allergic to penicillin and shellfish")
    print(f"Allergies: {allergies}")
    
    print("✅ Individual functions test completed")
    return True


if __name__ == "__main__":
    print("Running Clinical Extractor Tests")
    print("=" * 40)
    
    all_passed = True
    
    # Run acceptance test
    print("1. Running acceptance test...")
    if not test_acceptance_example():
        all_passed = False
    
    print("\n" + "=" * 40)
    
    # Run empty input test
    print("2. Running empty input test...")
    if not test_empty_input():
        all_passed = False
    
    print("\n" + "=" * 40)
    
    # Run individual functions test
    print("3. Running individual functions test...")
    if not test_individual_functions():
        all_passed = False
    
    print("\n" + "=" * 40)
    
    if all_passed:
        print("🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print("❌ SOME TESTS FAILED!")
        sys.exit(1) 