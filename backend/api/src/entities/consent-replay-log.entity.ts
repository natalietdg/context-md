import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, BeforeInsert, BeforeUpdate } from 'typeorm';
import { Consent } from './consent.entity';

export enum ReplayRole {
  DOCTOR = 'doctor',
  STAFF = 'staff',
  PATIENT = 'patient',
  ADMIN = 'admin'
}

@Entity('consent_replay_log')
export class ConsentReplayLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  consent_id: string;

  @Column('uuid', { nullable: true })
  replayed_by: string;

  @Column({
    type: 'enum',
    enum: ReplayRole
  })
  role: ReplayRole;

  @CreateDateColumn()
  replayed_at: Date;

  @Column({ nullable: true })
  purpose: string;

  @Column('inet', { nullable: true })
  ip_address: string;

  @Column({ nullable: true })
  user_agent: string;

  @Column({ nullable: true })
  session_id: string;

  @ManyToOne(() => Consent, consent => consent.replay_logs)
  @JoinColumn({ name: 'consent_id' })
  consent: Consent;

  // Generate ID with proper prefix on creation
  @BeforeInsert()
  generateIdWithPrefix() {
    if (!this.id) {
      // Generate new UUID and add prefix
      const { v4: uuidv4 } = require('uuid');
      this.id = 'CRL_' + uuidv4();
    } else if (!this.id.startsWith('CRL_')) {
      this.id = 'CRL_' + this.id;
    }
  }
}
