import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, BeforeInsert, BeforeUpdate } from 'typeorm';
import { Consent } from './consent.entity';
import { randomBytes } from 'crypto';

export enum ReplayRole {
  DOCTOR = 'doctor',
  STAFF = 'staff',
  PATIENT = 'patient',
  ADMIN = 'admin'
}

@Entity('consent_replay_log')
export class ConsentReplayLog {
  @PrimaryColumn('varchar', { length: 50 })
  id: string;

  @Column('varchar')
  consent_id: string;

  @Column('varchar', { nullable: true })
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
      // Generate new VARCHAR and add prefix
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const bytes = randomBytes(12);
      let idPart = '';
      for (let i = 0; i < bytes.length; i++) {
        idPart += chars[bytes[i] % chars.length];
      }
      this.id = 'CORL' + idPart;
    } else if (!this.id.startsWith('CORL')) {
      this.id = 'CORL' + this.id;
    }
  }
}
