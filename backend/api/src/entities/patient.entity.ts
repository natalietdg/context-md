import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, BeforeInsert, BeforeUpdate } from 'typeorm';

@Entity('patient')
export class Patient {
  @PrimaryGeneratedColumn('uuid')
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
      // Generate new UUID and add prefix
      const { v4: uuidv4 } = require('uuid');
      this.id = 'P_' + uuidv4();
    } else if (!this.id.startsWith('P_')) {
      this.id = 'P_' + this.id;
    }
  }
}
