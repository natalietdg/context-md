import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, BeforeInsert, BeforeUpdate } from 'typeorm';
import { Doctor } from './doctor.entity';
import { Patient } from './patient.entity';
import { Consent } from './consent.entity';
import { randomBytes } from 'crypto';


export enum ProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

@Entity('consultation')
export class Consultation {
  @PrimaryColumn('varchar', { length: 50 })
  id!: string;

  @Column()
  patient_id!: string;

  @Column()
  doctor_id!: string;

  @Column({ nullable: true })
  consent_id?: string;

  @Column()
  aws_audio_link!: string;

  @Column({ nullable: true })
  transcript_raw?: string;

  @Column({ nullable: true })
  transcript_eng?: string;

  @Column({ nullable: true })
  notes?: string;

  @Column({ nullable: true })
  audio_duration_seconds?: number;

  @Column('bigint', { nullable: true })
  file_size?: number;

  @Column({
    type: 'enum',
    enum: ProcessingStatus,
    default: ProcessingStatus.PENDING
  })
  processing_status!: ProcessingStatus;

  @Column({ default: () => 'CURRENT_TIMESTAMP' })
  consultation_date!: Date;

  @Column({ default: false })
  is_locked!: boolean;

  @Column({ nullable: true })
  locked_at?: Date;

  @Column({ nullable: true })
  locked_by?: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @ManyToOne(() => Patient, patient => patient.consultations)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @ManyToOne(() => Doctor, doctor => doctor.consultations)
  @JoinColumn({ name: 'doctor_id' })
  doctor!: Doctor;

  @ManyToOne(() => Consent, consent => consent.consultations)
  @JoinColumn({ name: 'consent_id' })
  consent?: Consent;

  @OneToMany('Report', 'consultation')
  reports!: any[];

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
      this.id = 'COXN' + idPart;
    } else if (!this.id.startsWith('COXN')) {
      this.id = 'COXN' + this.id;
    }
  }
}
