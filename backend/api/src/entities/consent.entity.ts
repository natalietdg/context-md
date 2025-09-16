import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, BeforeInsert, BeforeUpdate } from 'typeorm';
import { randomBytes } from 'crypto';

export enum ConsentStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
  EXPIRED = 'expired'
}

@Entity('consent')
export class Consent {
  @PrimaryColumn('varchar', { length: 50 })
  id!: string;

  @Column('varchar')
  patient_id!: string;

  @Column('varchar')
  doctor_id!: string;

  @Column()
  aws_audio_link!: string;

  @Column()
  consent_hash!: string;

  @Column('bigint', { nullable: true })
  file_size?: number;

  @Column({ nullable: true })
  duration_seconds?: number;

  @Column({ nullable: true })
  consent_text?: string;

  @Column({
    type: 'enum',
    enum: ConsentStatus,
    default: ConsentStatus.ACTIVE
  })
  status!: ConsentStatus;

  @Column({ nullable: true })
  expires_at?: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @ManyToOne('Patient', 'consents')
  @JoinColumn({ name: 'patient_id' })
  patient!: any;

  @ManyToOne('Doctor', 'consents')
  @JoinColumn({ name: 'doctor_id' })
  doctor!: any;

  @OneToMany('ConsentReplayLog', 'consent')
  replay_logs!: any[];

  @OneToMany('Consultation', 'consent')
  consultations!: any[];

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
      this.id = 'CNST' + idPart;
    } else if (!this.id.startsWith('CNST')) {
      this.id = 'CNST' + this.id;
    }
  }
}
