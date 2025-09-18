import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, BeforeInsert, BeforeUpdate } from 'typeorm';
import { randomBytes } from 'crypto';
import * as crypto from 'crypto';

@Entity('patient')
export class Patient {
  @PrimaryColumn('varchar', { length: 50 })
  id!: string;

  @Column()
  name!: string;

  @Column({ unique: true, nullable: true })
  nric!: string;

  @Column({ nullable: true })
  phone!: string;

  @Column({ name: 'email', type: 'varchar', nullable: true })
  private _email!: string;

  @Column({ nullable: true })
  allergies!: string;

  @Column({ nullable: true })
  medication!: string;

  @Column({ nullable: true })
  medical_history!: string;

  @Column({ default: true })
  is_active!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @OneToMany('Consultation', 'patient')
  consultations!: any[];

  @OneToMany('Consent', 'patient')
  consents!: any[];

  @OneToMany('Appointment', 'patient')
  appointments!: any[];

  // Encryption key and algorithm
  private static readonly ENCRYPTION_KEY = (() => {
    const key = process.env.DB_ENCRYPTION_KEY || 'dev-key-32-chars-long-change-me!!';
    
    // Handle hex keys (64 chars = 32 bytes)
    if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
      return Buffer.from(key, 'hex').toString('binary');
    }
    
    // Ensure key is exactly 32 bytes for AES-256
    if (Buffer.from(key).length !== 32) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('DB_ENCRYPTION_KEY must be exactly 32 characters/bytes or 64 hex characters for AES-256');
      }
      // Pad or truncate dev key to 32 bytes
      return key.padEnd(32, '0').substring(0, 32);
    }
    return key;
  })();
  private static readonly ALGORITHM = 'aes-256-cbc';

  // Email getter/setter with deterministic encryption
  get email(): string {
    return this.decrypt(this._email);
  }

  set email(value: string) {
    // Only encrypt if not already encrypted (doesn't contain ':')
    if (value && !value.includes(':')) {
      this._email = this.encryptDeterministic(value);
    } else {
      this._email = value;
    }
  }

  // Deterministic encryption for emails (same input = same output)
  private encryptDeterministic(text: string): string {
    // Use a fixed IV derived from the text itself for deterministic encryption
    const hash = crypto.createHash('sha256').update(text + Patient.ENCRYPTION_KEY).digest();
    const iv = hash.slice(0, 16); // Use first 16 bytes as IV
    const cipher = crypto.createCipheriv(Patient.ALGORITHM, Patient.ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedText: string): string {
    if (!encryptedText || !encryptedText.includes(':')) {
      return encryptedText || '';
    }
    
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      return encryptedText;
    }
    
    try {
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const decipher = crypto.createDecipheriv(Patient.ALGORITHM, Patient.ENCRYPTION_KEY, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      return encryptedText;
    }
  }

  // Generate ID with proper prefix on creation
  @BeforeInsert()
  generateIdWithPrefix() {
    if (!this.id) {
      // Generate new VARCHAR and add prefix
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const bytes = randomBytes(12);
      let idPart = '';
      for (let i = 0; i < bytes.length; i++) {
        idPart += chars[bytes[i] % chars.length];
      }
      this.id = 'PTNT' + idPart;
    } else if (!this.id.startsWith('PTNT')) {
      this.id = 'PTNT' + this.id;
    }
  }
}
