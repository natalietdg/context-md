-- ContextMD Database Schema
-- Initial migration for healthcare consultation documentation system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Doctor table
CREATE TABLE doctor (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    employee_id TEXT UNIQUE NOT NULL,
    department TEXT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Patient table
CREATE TABLE patient (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    nric TEXT UNIQUE,
    phone TEXT,
    email TEXT,
    allergies TEXT,
    medication TEXT,
    medical_history TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Consent table (stores the original consent recording + hash)
CREATE TABLE consent (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patient(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctor(id) ON DELETE CASCADE,
    aws_audio_link TEXT NOT NULL,     -- S3 link to original consent recording
    consent_hash TEXT NOT NULL,       -- tamper-evident hash of the recording
    file_size BIGINT,                 -- file size in bytes for integrity check
    duration_seconds INTEGER,         -- audio duration for validation
    consent_text TEXT,                -- transcript of consent if available
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
    expires_at TIMESTAMP,             -- optional expiry date for consent
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Consent replay log (tracks every replay of consent, by staff/doctor OR patient)
CREATE TABLE consent_replay_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consent_id UUID REFERENCES consent(id) ON DELETE CASCADE,
    replayed_by UUID,                 -- can be doctor.id OR patient.id
    role TEXT NOT NULL CHECK (role IN ('doctor', 'staff', 'patient', 'admin')),
    replayed_at TIMESTAMP DEFAULT now(),
    purpose TEXT,                     -- optional: reason for replay (audit, compliance, patient request)
    ip_address INET,                  -- track IP for security audit
    user_agent TEXT,                  -- track browser/device for security audit
    session_id TEXT                   -- track session for audit trail
);

-- Consultation table (ties together doctor, patient, consent, and transcript)
CREATE TABLE consultation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patient(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctor(id) ON DELETE CASCADE,
    consent_id UUID REFERENCES consent(id) ON DELETE SET NULL,
    aws_audio_link TEXT NOT NULL,     -- consultation audio recording (S3 link)
    transcript_raw TEXT,              -- raw "rojak" transcript
    transcript_eng TEXT,              -- normalized English transcript
    audio_duration_seconds INTEGER,   -- duration for validation
    file_size BIGINT,                 -- file size for integrity
    processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    consultation_date TIMESTAMP DEFAULT now(),
    is_locked BOOLEAN DEFAULT false,  -- immutable once locked
    locked_at TIMESTAMP,
    locked_by UUID REFERENCES doctor(id),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Report table (AI-generated structured summary of consultation)
CREATE TABLE report (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consultation_id UUID REFERENCES consultation(id) ON DELETE CASCADE,
    report_eng JSONB NOT NULL,        -- always populated (English summary)
    report_other_lang JSONB,          -- optional (Malay/Chinese/etc.)
    target_language TEXT,             -- language code for other_lang report
    ai_model_version TEXT,            -- track which AI model version was used
    confidence_score DECIMAL(3,2),    -- AI confidence score (0.00-1.00)
    medication_conflicts JSONB,       -- detected medication conflicts
    red_flags JSONB,                  -- critical findings that need attention
    processing_time_ms INTEGER,       -- time taken to generate report
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Appointment/Schedule table for dashboard
CREATE TABLE appointment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES patient(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctor(id) ON DELETE CASCADE,
    consultation_id UUID REFERENCES consultation(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMP NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show')),
    appointment_type TEXT DEFAULT 'consultation',
    notes TEXT,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Audit log for general system activities
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,                     -- doctor or patient ID
    user_type TEXT CHECK (user_type IN ('doctor', 'patient', 'admin', 'system')),
    action TEXT NOT NULL,             -- action performed
    resource_type TEXT,               -- type of resource (consultation, consent, etc.)
    resource_id UUID,                 -- ID of the resource
    details JSONB,                    -- additional details about the action
    ip_address INET,
    user_agent TEXT,
    session_id TEXT,
    created_at TIMESTAMP DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_doctor_employee_id ON doctor(employee_id);
CREATE INDEX idx_patient_nric ON patient(nric);
CREATE INDEX idx_consent_patient_doctor ON consent(patient_id, doctor_id);
CREATE INDEX idx_consent_replay_log_consent_id ON consent_replay_log(consent_id);
CREATE INDEX idx_consent_replay_log_replayed_at ON consent_replay_log(replayed_at);
CREATE INDEX idx_consultation_patient_id ON consultation(patient_id);
CREATE INDEX idx_consultation_doctor_id ON consultation(doctor_id);
CREATE INDEX idx_consultation_date ON consultation(consultation_date);
CREATE INDEX idx_report_consultation_id ON report(consultation_id);
CREATE INDEX idx_appointment_doctor_scheduled ON appointment(doctor_id, scheduled_at);
CREATE INDEX idx_appointment_patient_scheduled ON appointment(patient_id, scheduled_at);
CREATE INDEX idx_audit_log_user_created ON audit_log(user_id, created_at);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_doctor_updated_at BEFORE UPDATE ON doctor FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_patient_updated_at BEFORE UPDATE ON patient FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_consent_updated_at BEFORE UPDATE ON consent FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_consultation_updated_at BEFORE UPDATE ON consultation FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_report_updated_at BEFORE UPDATE ON report FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_appointment_updated_at BEFORE UPDATE ON appointment FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
