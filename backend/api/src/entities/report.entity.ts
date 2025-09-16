import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BeforeInsert, BeforeUpdate } from 'typeorm';
import { Consultation } from './consultation.entity';
import { randomBytes } from 'crypto';

@Entity('report')
export class Report {
  @PrimaryColumn('varchar', { length: 50 })
  id!: string;

  @Column('varchar')
  consultation_id!: string;

  @Column('jsonb')
  report_eng: any;

  @Column('jsonb', { nullable: true })
  report_other_lang: any;

  @Column({ nullable: true })
  target_language!: string;

  @Column({ nullable: true })
  ai_model_version!: string;

  @Column('decimal', { precision: 3, scale: 2, nullable: true })
  confidence_score!: number;

  @Column('jsonb', { nullable: true })
  medication_conflicts!: any;

  @Column('jsonb', { nullable: true })
  red_flags!: any;

  @Column({ nullable: true })
  processing_time_ms!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @ManyToOne(() => Consultation, consultation => consultation.reports)
  @JoinColumn({ name: 'consultation_id' })
  consultation!: Consultation;

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
      this.id = 'RPRT' + idPart;
    } else if (!this.id.startsWith('RPRT')) {
      this.id = 'RPRT' + this.id;
    }
  }
}
