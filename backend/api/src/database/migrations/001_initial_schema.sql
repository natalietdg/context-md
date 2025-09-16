-- ContextMD Database Schema
-- Initial migration for healthcare consultation documentation system
-- Date: 2025-09-16
-- Description: Prefix-based IDs (no UUIDs)

---------------------------------------------------
-- USERS TABLE
---------------------------------------------------
CREATE TABLE IF NOT EXISTS "user" (
    id VARCHAR PRIMARY KEY,
    email VARCHAR NOT NULL UNIQUE, 
    password_hash VARCHAR NOT NULL, 
    profile_id VARCHAR NOT NULL,
    profile_type VARCHAR NOT NULL CHECK (profile_type IN ('doctor', 'patient')),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP NULL,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_profile_id ON "user"(profile_id);
CREATE INDEX idx_user_profile_type ON "user"(profile_type);
CREATE INDEX idx_user_email ON "user"(email);

---------------------------------------------------
-- TRIGGER FUNCTION: ADD PREFIX TO IDS
---------------------------------------------------
CREATE OR REPLACE FUNCTION add_id_prefix() 
RETURNS TRIGGER AS $$
BEGIN
    CASE TG_TABLE_NAME
        WHEN '"user"' THEN
            IF NEW.id IS NOT NULL AND NEW.id NOT LIKE 'USER%' THEN
                NEW.id := 'USER' || NEW.id;
            END IF;
        WHEN 'doctor' THEN
            IF NEW.id IS NOT NULL AND NEW.id NOT LIKE 'DCTR%' THEN
                NEW.id := 'DCTR' || NEW.id;
            END IF;
        WHEN 'patient' THEN
            IF NEW.id IS NOT NULL AND NEW.id NOT LIKE 'PTNT%' THEN
                NEW.id := 'PTNT' || NEW.id;
            END IF;
        WHEN 'consultation' THEN
            IF NEW.id IS NOT NULL AND NEW.id NOT LIKE 'COXN%' THEN
                NEW.id := 'COXN' || NEW.id;
            END IF;
        WHEN 'consent' THEN
            IF NEW.id IS NOT NULL AND NEW.id NOT LIKE 'CNST%' THEN
                NEW.id := 'CNST' || NEW.id;
            END IF;
        WHEN 'report' THEN
            IF NEW.id IS NOT NULL AND NEW.id NOT LIKE 'RPRT%' THEN
                NEW.id := 'RPRT' || NEW.id;
            END IF;
        WHEN 'appointment' THEN
            IF NEW.id IS NOT NULL AND NEW.id NOT LIKE 'APPT%' THEN
                NEW.id := 'APPT' || NEW.id;
            END IF;
        WHEN 'audit_log' THEN
            IF NEW.id IS NOT NULL AND NEW.id NOT LIKE 'AULG%' THEN
                NEW.id := 'AULG' || NEW.id;
            END IF;
        WHEN 'consent_replay_log' THEN
            IF NEW.id IS NOT NULL AND NEW.id NOT LIKE 'CORL%' THEN
                NEW.id := 'CORL' || NEW.id;
            END IF;
    END CASE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

---------------------------------------------------
-- DOCTOR TABLE
---------------------------------------------------
CREATE TABLE doctor (
    id VARCHAR PRIMARY KEY,
    name TEXT NOT NULL,
    employee_id TEXT UNIQUE NOT NULL,
    department TEXT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    deleted_at TIMESTAMP NULL,
    user_id VARCHAR REFERENCES "user"(id) ON DELETE RESTRICT
);

---------------------------------------------------
-- PATIENT TABLE
---------------------------------------------------
CREATE TABLE patient (
    id VARCHAR PRIMARY KEY,
    name TEXT NOT NULL,
    nric TEXT UNIQUE,
    phone TEXT,
    email TEXT,
    allergies TEXT,
    medication TEXT,
    medical_history TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    deleted_at TIMESTAMP NULL,
    user_id VARCHAR REFERENCES "user"(id) ON DELETE RESTRICT
);

---------------------------------------------------
-- CONSENT TABLE
---------------------------------------------------
CREATE TABLE consent (
    id VARCHAR PRIMARY KEY,
    patient_id VARCHAR REFERENCES patient(id) ON DELETE RESTRICT,
    doctor_id VARCHAR REFERENCES doctor(id) ON DELETE RESTRICT,
    aws_audio_link TEXT NOT NULL,
    consent_hash TEXT NOT NULL,
    file_size BIGINT,
    duration_seconds INTEGER,
    consent_text TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active','revoked','expired')),
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

---------------------------------------------------
-- CONSENT REPLAY LOG
---------------------------------------------------
CREATE TABLE consent_replay_log (
    id VARCHAR PRIMARY KEY,
    consent_id VARCHAR REFERENCES consent(id) ON DELETE RESTRICT,
    replayed_by VARCHAR,
    role TEXT NOT NULL CHECK (role IN ('doctor','staff','patient','admin')),
    replayed_at TIMESTAMP DEFAULT now(),
    purpose TEXT,
    ip_address INET,
    user_agent TEXT,
    session_id TEXT
);

---------------------------------------------------
-- CONSULTATION
---------------------------------------------------
CREATE TABLE consultation (
    id VARCHAR PRIMARY KEY,
    patient_id VARCHAR REFERENCES patient(id) ON DELETE RESTRICT,
    doctor_id VARCHAR REFERENCES doctor(id) ON DELETE RESTRICT,
    consent_id VARCHAR REFERENCES consent(id) ON DELETE SET NULL,
    aws_audio_link TEXT NOT NULL,
    transcript_raw TEXT,
    transcript_eng TEXT,
    audio_duration_seconds INTEGER,
    file_size BIGINT,
    processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending','processing','completed','failed')),
    consultation_date TIMESTAMP DEFAULT now(),
    is_locked BOOLEAN DEFAULT false,
    locked_at TIMESTAMP,
    locked_by VARCHAR REFERENCES doctor(id),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

---------------------------------------------------
-- REPORTS
---------------------------------------------------
CREATE TABLE report (
    id VARCHAR PRIMARY KEY,
    consultation_id VARCHAR REFERENCES consultation(id) ON DELETE RESTRICT,
    report_eng JSONB NOT NULL,
    report_other_lang JSONB,
    target_language TEXT,
    ai_model_version TEXT,
    confidence_score DECIMAL(3,2),
    medication_conflicts JSONB,
    red_flags JSONB,
    processing_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

---------------------------------------------------
-- APPOINTMENTS
---------------------------------------------------
CREATE TABLE appointment (
    id VARCHAR PRIMARY KEY,
    patient_id VARCHAR REFERENCES patient(id) ON DELETE RESTRICT,
    doctor_id VARCHAR REFERENCES doctor(id) ON DELETE RESTRICT,
    consultation_id VARCHAR REFERENCES consultation(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMP NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','cancelled','no_show')),
    appointment_type TEXT DEFAULT 'consultation',
    notes TEXT,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

---------------------------------------------------
-- AUDIT LOGS
---------------------------------------------------
CREATE TABLE audit_log (
    id VARCHAR PRIMARY KEY,
    user_id VARCHAR,
    user_type TEXT CHECK (user_type IN ('doctor','patient','admin','system')),
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id VARCHAR,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    session_id TEXT,
    created_at TIMESTAMP DEFAULT now()
);

---------------------------------------------------
-- TRIGGERS
---------------------------------------------------
-- Prefix triggers
CREATE TRIGGER prefix_user BEFORE INSERT OR UPDATE ON "user"
    FOR EACH ROW EXECUTE FUNCTION add_id_prefix();

CREATE TRIGGER prefix_doctor BEFORE INSERT OR UPDATE ON doctor
    FOR EACH ROW EXECUTE FUNCTION add_id_prefix();

CREATE TRIGGER prefix_patient BEFORE INSERT OR UPDATE ON patient
    FOR EACH ROW EXECUTE FUNCTION add_id_prefix();

CREATE TRIGGER prefix_consent BEFORE INSERT OR UPDATE ON consent
    FOR EACH ROW EXECUTE FUNCTION add_id_prefix();

CREATE TRIGGER prefix_consultation BEFORE INSERT_
