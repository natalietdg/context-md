import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, BeforeInsert, BeforeUpdate } from 'typeorm';

export enum ConsentStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
  EXPIRED = 'expired'
}

@Entity('consent')
export class Consent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  patient_id!: string;

  @Column('uuid')
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
      // Generate new UUID and add prefix
      const { v4: uuidv4 } = require('uuid');
      this.id = 'CON_' + uuidv4();
    } else if (!this.id.startsWith('CON_')) {
      this.id = 'CON_' + this.id;
    }
  }
}
