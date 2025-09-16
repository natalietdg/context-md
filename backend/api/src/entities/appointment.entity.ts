import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BeforeInsert, BeforeUpdate } from 'typeorm';
import { Doctor } from './doctor.entity';
import { Patient } from './patient.entity';
import { Consultation } from './consultation.entity';
import { randomBytes } from 'crypto';

export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show'
}

@Entity('appointment')
export class Appointment {
  @PrimaryColumn('varchar', { length: 50 })
  id!: string;

  @Column()
  patient_id!: string;

  @Column()
  doctor_id!: string;

  @Column({ nullable: true })
  consultation_id?: string;

  @Column()
  scheduled_at!: Date;

  @Column({ default: 30 })
  duration_minutes!: number;

  @Column({
    type: 'enum',
    enum: AppointmentStatus,
    default: AppointmentStatus.SCHEDULED
  })
  status!: AppointmentStatus;

  @Column({ default: 'consultation' })
  appointment_type!: string;

  @Column({ nullable: true })
  notes?: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @ManyToOne(() => Patient, patient => patient.appointments)
  @JoinColumn({ name: 'patient_id' })
  patient!: Patient;

  @ManyToOne(() => Doctor, doctor => doctor.appointments)
  @JoinColumn({ name: 'doctor_id' })
  doctor!: Doctor;

  @ManyToOne(() => Consultation)
  @JoinColumn({ name: 'consultation_id' })
  consultation?: Consultation;

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
      this.id = 'APPT' + idPart;
    } else if (!this.id.startsWith('APPT')) {
      this.id = 'APPT' + this.id;
    }
  }
}
