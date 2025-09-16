-- Migration: Add ID prefixes and user table
-- Date: 2025-09-14
-- Description: Adds prefixed UUIDs to all tables and creates new user table with encryption

-- First, create the user table with encrypted fields
CREATE TABLE IF NOT EXISTS user (
    id VARCHAR PRIMARY KEY,
    email VARCHAR NOT NULL UNIQUE, -- Will be encrypted at application level
    password_hash VARCHAR NOT NULL, -- Will be encrypted at application level
    profile_id VARCHAR NOT NULL,
    profile_type VARCHAR NOT NULL CHECK (profile_type IN ('doctor', 'patient')),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP NULL,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for user table
CREATE INDEX idx_user_profile_id ON user(profile_id);
CREATE INDEX idx_user_profile_type ON user(profile_type);
CREATE INDEX idx_user_email ON user(email);

-- Function to add prefixes to existing UUIDs
CREATE OR REPLACE FUNCTION add_prefix_to_uuid(table_name TEXT, prefix TEXT) 
RETURNS VOID AS $$
BEGIN
    EXECUTE format('UPDATE %I SET id = %L || id WHERE id NOT LIKE %L', 
                   table_name, prefix, prefix || '%');
END;
$$ LANGUAGE plpgsql;

-- Add prefixes to all existing tables
-- Note: This will only work if there are no foreign key constraints
-- In production, you would need to handle FK constraints carefully

-- Doctors: D_ prefix
SELECT add_prefix_to_uuid('doctor', 'DCTR');

-- Patients: P_ prefix  
SELECT add_prefix_to_uuid('patient', 'PTNT');

-- Consultations: C_ prefix
SELECT add_prefix_to_uuid('consultation', 'COXN');

-- Consents: CON_ prefix
SELECT add_prefix_to_uuid('consent', 'CNST');

-- Reports: R_ prefix
SELECT add_prefix_to_uuid('report', 'RPRT');

-- Appointments: A_ prefix
SELECT add_prefix_to_uuid('appointment', 'APPT');

-- Audit Logs: AL_ prefix
SELECT add_prefix_to_uuid('audit_log', 'AULG');

-- Consent Replay Logs: CRL_ prefix
SELECT add_prefix_to_uuid('consent_replay_log', 'CORL');

-- Update foreign key references to include prefixes
-- This is a complex operation that would need careful handling in production

-- Add trigger to automatically add prefixes to new records
CREATE OR REPLACE FUNCTION add_id_prefix() 
RETURNS TRIGGER AS $$
BEGIN
    CASE TG_TABLE_NAME
        WHEN 'user' THEN
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
        WHEN 'user' THEN
            IF NEW.id IS NOT NULL AND NEW.id NOT LIKE 'USER%' THEN
                NEW.id := 'USER' || NEW.id;
            END IF;
    END CASE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for all tables
CREATE TRIGGER trigger_add_prefix_user
    BEFORE INSERT OR UPDATE ON user
    FOR EACH ROW EXECUTE FUNCTION add_id_prefix();

CREATE TRIGGER trigger_add_prefix_doctor
    BEFORE INSERT OR UPDATE ON doctor
    FOR EACH ROW EXECUTE FUNCTION add_id_prefix();

CREATE TRIGGER trigger_add_prefix_patient
    BEFORE INSERT OR UPDATE ON patient
    FOR EACH ROW EXECUTE FUNCTION add_id_prefix();

CREATE TRIGGER trigger_add_prefix_consultation
    BEFORE INSERT OR UPDATE ON consultation
    FOR EACH ROW EXECUTE FUNCTION add_id_prefix();

CREATE TRIGGER trigger_add_prefix_consent
    BEFORE INSERT OR UPDATE ON consent
    FOR EACH ROW EXECUTE FUNCTION add_id_prefix();

CREATE TRIGGER trigger_add_prefix_report
    BEFORE INSERT OR UPDATE ON report
    FOR EACH ROW EXECUTE FUNCTION add_id_prefix();

CREATE TRIGGER trigger_add_prefix_appointment
    BEFORE INSERT OR UPDATE ON appointment
    FOR EACH ROW EXECUTE FUNCTION add_id_prefix();

CREATE TRIGGER trigger_add_prefix_audit_log
    BEFORE INSERT OR UPDATE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION add_id_prefix();

CREATE TRIGGER trigger_add_prefix_consent_replay_log
    BEFORE INSERT OR UPDATE ON consent_replay_log
    FOR EACH ROW EXECUTE FUNCTION add_id_prefix();

CREATE TRIGGER trigger_add_prefix_user
    BEFORE INSERT OR UPDATE ON user
    FOR EACH ROW EXECUTE FUNCTION add_id_prefix();

-- Clean up helper function
DROP FUNCTION add_prefix_to_uuid(TEXT, TEXT);

-- Add comments for documentation
COMMENT ON TABLE user IS 'Centralized authentication table with encrypted credentials';
COMMENT ON COLUMN user.email IS 'Encrypted email address for authentication';
COMMENT ON COLUMN user.password_hash IS 'Encrypted password hash';
COMMENT ON COLUMN user.profile_id IS 'Polymorphic foreign key to doctor or patient';
COMMENT ON COLUMN user.profile_type IS 'Indicates whether profile_id references doctor or patient table';

-- Note: In production, you would also need to:
-- 1. Update all foreign key references to use the new prefixed IDs
-- 2. Handle data migration more carefully with proper backup/restore procedures
-- 3. Test thoroughly in a staging environment first
-- 4. Consider using a more robust migration tool like TypeORM migrations
