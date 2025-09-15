-- Sample data for ContextMD development and testing

-- Insert sample doctors
INSERT INTO doctor (id, name, employee_id, department, email, password_hash) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Dr. Sarah Chen', 'DOC001', 'General Medicine', 'sarah.chen@contextmd.com', '$2b$10$example_hash_1'),
('550e8400-e29b-41d4-a716-446655440002', 'Dr. Ahmad Rahman', 'DOC002', 'Cardiology', 'ahmad.rahman@contextmd.com', '$2b$10$example_hash_2'),
('550e8400-e29b-41d4-a716-446655440003', 'Dr. Li Wei Ming', 'DOC003', 'Pediatrics', 'li.weiming@contextmd.com', '$2b$10$example_hash_3');

-- Insert sample patients
INSERT INTO patient (id, name, nric, phone, email, allergies, medication, medical_history) VALUES
('650e8400-e29b-41d4-a716-446655440001', 'John Tan Wei Liang', 'S1234567A', '+65 9123 4567', 'john.tan@email.com', 'Penicillin, Shellfish', 'Metformin 500mg twice daily', 'Type 2 Diabetes, Hypertension'),
('650e8400-e29b-41d4-a716-446655440002', 'Mary Lim Hui Fen', 'S2345678B', '+65 9234 5678', 'mary.lim@email.com', 'None known', 'Lisinopril 10mg daily', 'Hypertension'),
('650e8400-e29b-41d4-a716-446655440003', 'Kumar Raj', 'S3456789C', '+65 9345 6789', 'kumar.raj@email.com', 'Aspirin', 'None', 'No significant medical history');

-- Insert sample appointments
INSERT INTO appointment (id, patient_id, doctor_id, scheduled_at, duration_minutes, status, appointment_type, notes) VALUES
('750e8400-e29b-41d4-a716-446655440001', '650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', '2024-01-15 09:00:00', 30, 'scheduled', 'consultation', 'Follow-up for diabetes management'),
('750e8400-e29b-41d4-a716-446655440002', '650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', '2024-01-15 10:30:00', 45, 'scheduled', 'consultation', 'Cardiac evaluation'),
('750e8400-e29b-41d4-a716-446655440003', '650e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', '2024-01-15 14:00:00', 30, 'completed', 'consultation', 'Routine check-up');

-- Note: Consent, consultation, and report data will be created through the application workflow
-- as they involve S3 uploads and AI processing that should be done through the API endpoints
