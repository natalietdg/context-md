import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Doctor } from '../entities/doctor.entity';
import { Patient } from '../entities/patient.entity';
import { User, ProfileType } from '../entities';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Doctor) private readonly doctorRepo: Repository<Doctor>,
    @InjectRepository(Patient) private readonly patientRepo: Repository<Patient>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) { }

  async syncSchema(options?: { drop?: boolean }) {
    const drop = !!options?.drop;
    if (drop) {
      this.logger.warn('Dropping database before synchronize...');
      await this.dataSource.dropDatabase();
    }
    await this.dataSource.synchronize();
    return { ok: true, dropped: drop };
  }

  async seedBasic() {
    // Use transaction to ensure all-or-nothing persistence
    return await this.dataSource.transaction(async manager => {

      try {

        // Upsert a Doctor
        let doctor = await manager.findOne(Doctor, { where: { employee_id: 'D1001' } });

        if (!doctor) {
          try {
            doctor = manager.create(Doctor, {
              name: 'Dr. Sarah Chen',
              employee_id: 'D1001',
              department: 'General Medicine',
              email: 'sarah.chen@contextmd.com',
              password_hash: await bcrypt.hash('password123', 10),
              is_active: true,
            });
            doctor = await manager.save(doctor);
            console.log('Doctor seeded:', doctor);
          } catch (error) {
            console.error('Error creating doctor:', error);
            throw error;
          }
        }

        // Upsert a Patient
        let patient = await manager.findOne(Patient, { where: { nric: 'S1234567A' } });
        if (!patient) {
          patient = manager.create(Patient, {
            name: 'John Tan',
            nric: 'S1234567A',
            phone: '+65 80000000',
            email: 'john.tan@email.com',
            is_active: true,
          });
          patient = await manager.save(patient);
        }

        // Upsert a User for the Doctor
        let doctorUser = await manager.findOne(User, { where: { profile_id: doctor.id, profile_type: ProfileType.DOCTOR } });
        if (!doctorUser) {
          const u = manager.create(User, {
            profile_id: doctor.id,
            profile_type: ProfileType.DOCTOR,
            is_active: true,
          });
          // Set email and password via setters to trigger encryption
          u.email = 'sarah.chen@contextmd.com';
          u.password_hash = await bcrypt.hash('password123', 10);

          doctorUser = await manager.save(u);

        }

        // Upsert a User for the Patient
        let patientUser = await manager.findOne(User, { where: { profile_id: patient.id, profile_type: ProfileType.PATIENT } });
        if (!patientUser) {
          const u = manager.create(User, {
            profile_id: patient.id,
            profile_type: ProfileType.PATIENT,
            is_active: true,
          });
          // Set email and password via setters to trigger encryption
          u.email = 'john.tan@email.com';
          u.password_hash = await bcrypt.hash('password123', 10);
          patientUser = await manager.save(u);
        }

        return {
          doctor: { id: doctor.id, name: doctor.name },
          patient: { id: patient.id, name: patient.name },
          users: {
            doctor: { id: doctorUser.id, email: doctorUser.email },
            patient: { id: patientUser.id, email: patientUser.email },
          },
        };
      }
      catch (error) {
        console.error(error);
        throw error;
      }
    });
  }

  async insertRecords(body: { entity: 'doctor' | 'patient' | 'user'; records: any[] }) {
    const { entity, records } = body || ({} as any);
    if (!entity || !Array.isArray(records) || records.length === 0) {
      throw new Error('Invalid payload. Expect { entity: "doctor"|"patient"|"user", records: [...] }');
    }

    const entityMap = {
      doctor: Doctor,
      patient: Patient,
      user: User,
    } as const;

    const entityClass = entityMap[entity as keyof typeof entityMap];
    if (!entityClass) {
      throw new Error(`Unsupported entity: ${entity}`);
    }

    // Auto-hash password if provided as plain text
    const prepared = await Promise.all(
      records.map(async (r) => {
        const copy = { ...r };
        if (copy.password && !copy.password_hash) {
          copy.password_hash = await bcrypt.hash(copy.password, 10);
          delete copy.password;
        }
        return copy;
      })
    );

    const repo = this.dataSource.getRepository(entityClass);
    const created = repo.create(prepared as any);
    const saved = await repo.save(created as any);
    return { ok: true, count: saved.length ?? (saved ? 1 : 0), ids: (Array.isArray(saved) ? saved : [saved]).map((s: any) => s.id) };
  }

  /**
   * Raw SQL insert into the SQL-defined `users` table (id, email, password_hash, role, created_at, updated_at)
   * WARNING: This bypasses the TypeORM `User` entity encryption scheme. Do not read these rows via the entity.
   */
  async insertSqlUsers(payload: { records: Array<{ id?: string; email: string; password?: string; password_hash?: string; role: string }> }) {
    const roles = new Set(['doctor', 'patient', 'admin', 'superadmin']);
    const records = payload?.records || [];
    if (!Array.isArray(records) || records.length === 0) {
      throw new Error('Invalid payload. Expect { records: [{ email, password|password_hash, role }, ...] }');
    }

    // Normalize and validate
    const normalized = await Promise.all(records.map(async (r, idx) => {
      if (!r.email) throw new Error(`Record #${idx + 1}: email is required`);
      if (!r.password && !r.password_hash) throw new Error(`Record #${idx + 1}: password or password_hash is required`);
      if (!r.role || !roles.has(r.role)) throw new Error(`Record #${idx + 1}: role must be one of ${Array.from(roles).join(', ')}`);
      const password_hash = r.password_hash ?? await bcrypt.hash(r.password!, 10);
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const bytes = randomBytes(12);
      let idPart = '';
      for (let i = 0; i < bytes.length; i++) {
        idPart += chars[bytes[i] % chars.length];
      }
      const id = r.id ?? `USER${idPart}`;
      return { id, email: r.email, password_hash, role: r.role };
    }));

    // Build a parameterized multi-row UPSERT
    const valuesSql: string[] = [];
    const params: any[] = [];
    normalized.forEach((row, i) => {
      const base = i * 4;
      valuesSql.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
      params.push(row.id, row.email, row.password_hash, row.role);
    });

    const sql = `
      INSERT INTO users (id, email, password_hash, role)
      VALUES ${valuesSql.join(', ')}
      ON CONFLICT (email) DO UPDATE
        SET password_hash = EXCLUDED.password_hash,
            role = EXCLUDED.role,
            updated_at = now()
      RETURNING id, email, role, created_at, updated_at;
    `;

    const rows = await this.dataSource.query(sql, params);
    return { ok: true, count: rows.length, rows };
  }

  async diagnoseSchema() {
    const meta = await this.dataSource.query(
      `select current_database() as database, current_schema() as schema, version()`
    );

    const columns = await this.dataSource.query(
      `select table_name, column_name, data_type
       from information_schema.columns
       where table_schema = 'public'
         and table_name in ('doctor','patient','consultation','consent','report','appointment','audit_log','consent_replay_log','user','users')
       order by table_name, column_name`
    );

    return { ok: true, meta: meta?.[0] ?? null, columns };
  }
}
