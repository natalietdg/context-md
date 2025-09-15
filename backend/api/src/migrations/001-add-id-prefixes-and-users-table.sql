-- Migration: Add ID prefixes and Users table
-- Date: 2025-09-14
-- Description: Adds prefixed UUIDs to all tables and creates new users table with encryption

-- First, create the users table with encrypted fields
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR NOT NULL UNIQUE, -- Will be encrypted at application level
    password_hash VARCHAR NOT NULL, -- Will be encrypted at application level
    profile_id UUID NOT NULL,
    profile_type VARCHAR NOT NULL CHECK (profile_type IN ('doctor', 'patient')),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP NULL,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for users table
CREATE INDEX idx_users_profile_id ON users(profile_id);
CREATE INDEX idx_users_profile_type ON users(profile_type);
CREATE INDEX idx_users_email ON users(email);

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
SELECT add_prefix_to_uuid('doctor', 'D_');

-- Patients: P_ prefix  
SELECT add_prefix_to_uuid('patient', 'P_');

-- Consultations: C_ prefix
SELECT add_prefix_to_uuid('consultation', 'C_');

-- Consents: CON_ prefix
SELECT add_prefix_to_uuid('consent', 'CON_');

-- Reports: R_ prefix
SELECT add_prefix_to_uuid('report', 'R_');

-- Appointments: A_ prefix
SELECT add_prefix_to_uuid('appointment', 'A_');

-- Audit Logs: AL_ prefix
SELECT add_prefix_to_uuid('audit_log', 'AL_');

-- Consent Replay Logs: CRL_ prefix
SELECT add_prefix_to_uuid('consent_replay_log', 'CRL_');

-- Update foreign key references to include prefixes
-- This is a complex operation that would need careful handling in production

-- Add trigger to automatically add prefixes to new records
CREATE OR REPLACE FUNCTION add_id_prefix() 
RETURNS TRIGGER AS $$
BEGIN
    CASE TG_TABLE_NAME
        WHEN 'users' THEN
            IF NEW.id IS NOT NULL AND NEW.id NOT LIKE 'U_%' THEN
                NEW.id := 'U_' || NEW.id;
            END IF;
        WHEN 'doctor' THEN
            IF NEW.id IS NOT NULL AND NEW.id NOT LIKE 'D_%' THEN
                NEW.id := 'D_' || NEW.id;
            END IF;
        WHEN 'patient' THEN
            IF NEW.id IS NOT NULL AND NEW.id NOT LIKE 'P_%' THEN
                NEW.id := 'P_' || NEW.id;
            END IF;
        WHEN 'consultation' THEN
            IF NEW.id IS NOT NULL AND NEW.id NOT LIKE 'C_%' THEN
                NEW.id := 'C_' || NEW.id;
            END IF;
        WHEN 'consent' THEN
            IF NEW.id IS NOT NULL AND NEW.id NOT LIKE 'CON_%' THEN
                NEW.id := 'CON_' || NEW.id;
            END IF;
        WHEN 'report' THEN
            IF NEW.id IS NOT NULL AND NEW.id NOT LIKE 'R_%' THEN
                NEW.id := 'R_' || NEW.id;
            END IF;
        WHEN 'appointment' THEN
            IF NEW.id IS NOT NULL AND NEW.id NOT LIKE 'A_%' THEN
                NEW.id := 'A_' || NEW.id;
            END IF;
        WHEN 'audit_log' THEN
            IF NEW.id IS NOT NULL AND NEW.id NOT LIKE 'AL_%' THEN
                NEW.id := 'AL_' || NEW.id;
            END IF;
        WHEN 'consent_replay_log' THEN
            IF NEW.id IS NOT NULL AND NEW.id NOT LIKE 'CRL_%' THEN
                NEW.id := 'CRL_' || NEW.id;
            END IF;
    END CASE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for all tables
CREATE TRIGGER trigger_add_prefix_users
    BEFORE INSERT OR UPDATE ON users
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

-- Clean up helper function
DROP FUNCTION add_prefix_to_uuid(TEXT, TEXT);

-- Add comments for documentation
COMMENT ON TABLE users IS 'Centralized authentication table with encrypted credentials';
COMMENT ON COLUMN users.email IS 'Encrypted email address for authentication';
COMMENT ON COLUMN users.password_hash IS 'Encrypted password hash';
COMMENT ON COLUMN users.profile_id IS 'Polymorphic foreign key to doctor or patient';
COMMENT ON COLUMN users.profile_type IS 'Indicates whether profile_id references doctor or patient table';

-- Note: In production, you would also need to:
-- 1. Update all foreign key references to use the new prefixed IDs
-- 2. Handle data migration more carefully with proper backup/restore procedures
-- 3. Test thoroughly in a staging environment first
-- 4. Consider using a more robust migration tool like TypeORM migrations
