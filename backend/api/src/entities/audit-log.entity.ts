import { Entity, PrimaryColumn, Column, CreateDateColumn, BeforeInsert, BeforeUpdate } from 'typeorm';
import { randomBytes } from 'crypto';

export enum UserType {
  DOCTOR = 'doctor',
  PATIENT = 'patient',
  ADMIN = 'admin',
  SYSTEM = 'system'
}

@Entity('audit_log')
export class AuditLog {
  @PrimaryColumn('varchar', { length: 50 })
  id: string;

  @Column('varchar', { nullable: true })
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

  @Column('varchar', { nullable: true })
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
      // Generate new VARCHAR and add prefix
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const bytes = randomBytes(12);
      let idPart = '';
      for (let i = 0; i < bytes.length; i++) {
        idPart += chars[bytes[i] % chars.length];
      }
      this.id = 'AULG' + idPart;
    } else if (!this.id.startsWith('AULG')) {
      this.id = 'AULG' + this.id;
    }
  }
}
