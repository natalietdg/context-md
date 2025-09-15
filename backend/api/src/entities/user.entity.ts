import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, BeforeInsert, BeforeUpdate } from 'typeorm';
import * as crypto from 'crypto';

export enum ProfileType {
  DOCTOR = 'doctor',
  PATIENT = 'patient'
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  private _email!: string;

  @Column({ type: 'varchar' })
  private _password_hash!: string;

  @Column('uuid')
  profile_id!: string;

  @Column({
    type: 'enum',
    enum: ProfileType
  })
  profile_type!: ProfileType;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  last_login?: Date;

  @Column({ type: 'integer', default: 0 })
  failed_login_attempts!: number;

  @Column({ type: 'timestamp', nullable: true })
  locked_until?: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  // Encryption key - CRITICAL: Must be set in production environment
  private static readonly ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY || (() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DB_ENCRYPTION_KEY environment variable is required in production');
    }
    return 'dev-key-32-chars-long-change-me!!';
  })();
  private static readonly ALGORITHM = 'aes-256-cbc';

  // Email getter/setter with encryption
  get email(): string {
    return this.decrypt(this._email);
  }

  set email(value: string) {
    this._email = this.encrypt(value);
  }

  // Password hash getter/setter with encryption
  get password_hash(): string {
    return this.decrypt(this._password_hash);
  }

  set password_hash(value: string) {
    this._password_hash = this.encrypt(value);
  }

  // Encryption helper methods
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(User.ALGORITHM, User.ENCRYPTION_KEY);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipher(User.ALGORITHM, User.ENCRYPTION_KEY);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // Generate ID with proper prefix on creation
  @BeforeInsert()
  generateIdWithPrefix() {
    if (!this.id) {
      // Generate new UUID and add prefix
      const { v4: uuidv4 } = require('uuid');
      this.id = 'U_' + uuidv4();
    } else if (!this.id.startsWith('U_')) {
      this.id = 'U_' + this.id;
    }
  }

  // Helper method to check if account is locked
  isAccountLocked(): boolean {
    return this.locked_until ? new Date() < this.locked_until : false;
  }

  // Helper method to increment failed login attempts
  incrementFailedAttempts(): void {
    this.failed_login_attempts += 1;
    
    // Lock account after 5 failed attempts for 30 minutes
    if (this.failed_login_attempts >= 5) {
      this.locked_until = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    }
  }

  // Helper method to reset failed login attempts on successful login
  resetFailedAttempts(): void {
    this.failed_login_attempts = 0;
    this.locked_until = undefined;
    this.last_login = new Date();
  }
}
