import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, BeforeInsert, BeforeUpdate } from 'typeorm';

export enum UserType {
  DOCTOR = 'doctor',
  PATIENT = 'patient',
  ADMIN = 'admin',
  SYSTEM = 'system'
}

@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { nullable: true })
  user_id: string;

  @Column({
    type: 'enum',
    enum: UserType,
    nullable: true
  })
  user_type: UserType;

  @Column()
  action: string;

  @Column({ nullable: true })
  resource_type: string;

  @Column('uuid', { nullable: true })
  resource_id: string;

  @Column('jsonb', { nullable: true })
  details: any;

  @Column('inet', { nullable: true })
  ip_address: string;

  @Column({ nullable: true })
  user_agent: string;

  @Column({ nullable: true })
  session_id: string;

  @CreateDateColumn()
  created_at: Date;

  // Generate ID with proper prefix on creation
  @BeforeInsert()
  generateIdWithPrefix() {
    if (!this.id) {
      // Generate new UUID and add prefix
      const { v4: uuidv4 } = require('uuid');
      this.id = 'AL_' + uuidv4();
    } else if (!this.id.startsWith('AL_')) {
      this.id = 'AL_' + this.id;
    }
  }
}
