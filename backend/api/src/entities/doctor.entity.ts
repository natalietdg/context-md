import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, BeforeInsert, BeforeUpdate } from 'typeorm';
import { randomBytes } from 'crypto';

@Entity('doctor')
export class Doctor {
  @PrimaryColumn('varchar', { length: 50 })
  id!: string;

  @Column()
  name!: string;

  @Column({ unique: true })
  employee_id!: string;

  @Column()
  department!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ default: true })
  is_active!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @OneToMany('Consultation', 'doctor')
  consultations!: any[];

  @OneToMany('Consent', 'doctor')
  consents!: any[];

  @OneToMany('Appointment', 'doctor')
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
      this.id = 'DCTR' + idPart;
    } else if (!this.id.startsWith('DCTR')) {
      this.id = 'DCTR' + this.id;
    }
  }
}
