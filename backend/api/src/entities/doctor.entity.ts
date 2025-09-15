import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, BeforeInsert, BeforeUpdate } from 'typeorm';

@Entity('doctor')
export class Doctor {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ unique: true })
  employee_id!: string;

  @Column()
  department!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  password_hash!: string;

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
      // Generate new UUID and add prefix
      const { v4: uuidv4 } = require('uuid');
      this.id = 'D_' + uuidv4();
    } else if (!this.id.startsWith('D_')) {
      this.id = 'D_' + this.id;
    }
  }
}
