import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, BeforeInsert, BeforeUpdate } from 'typeorm';
import { Consultation } from './consultation.entity';

@Entity('report')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
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
      // Generate new UUID and add prefix
      const { v4: uuidv4 } = require('uuid');
      this.id = 'R_' + uuidv4();
    } else if (!this.id.startsWith('R_')) {
      this.id = 'R_' + this.id;
    }
  }
}
