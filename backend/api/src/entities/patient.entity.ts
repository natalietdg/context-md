import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, BeforeInsert, BeforeUpdate } from 'typeorm';
import { randomBytes } from 'crypto';

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

  @Column({ nullable: true })
  email!: string;

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
