import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Doctor } from '../entities/doctor.entity';
import { Patient } from '../entities/patient.entity';
import { User, ProfileType } from '../entities';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Doctor) private readonly doctorRepo: Repository<Doctor>,
    @InjectRepository(Patient) private readonly patientRepo: Repository<Patient>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

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
    // Upsert a Doctor
    let doctor = await this.doctorRepo.findOne({ where: { employee_id: 'D1001' } });
    if (!doctor) {
      doctor = this.doctorRepo.create({
        name: 'Dr. Demo',
        employee_id: 'D1001',
        department: 'General Medicine',
        email: 'dr.demo@example.com',
        password_hash: await bcrypt.hash('Password123!', 10),
        is_active: true,
      });
      doctor = await this.doctorRepo.save(doctor);
    }

    // Upsert a Patient
    let patient = await this.patientRepo.findOne({ where: { nric: 'S1234567A' } });
    if (!patient) {
      patient = this.patientRepo.create({
        name: 'Jane Patient',
        nric: 'S1234567A',
        phone: '+65 80000000',
        email: 'jane.patient@example.com',
        is_active: true,
      });
      patient = await this.patientRepo.save(patient);
    }

    // Upsert a User for the Doctor
    let doctorUser = await this.userRepo.findOne({ where: { profile_id: doctor.id, profile_type: ProfileType.DOCTOR } });
    if (!doctorUser) {
      doctorUser = this.userRepo.create({
        email: 'dr.demo@example.com',
        password_hash: await bcrypt.hash('Password123!', 10),
        profile_id: doctor.id,
        profile_type: ProfileType.DOCTOR,
        is_active: true,
      });
      doctorUser = await this.userRepo.save(doctorUser);
    }

    // Upsert a User for the Patient
    let patientUser = await this.userRepo.findOne({ where: { profile_id: patient.id, profile_type: ProfileType.PATIENT } });
    if (!patientUser) {
      patientUser = this.userRepo.create({
        email: 'jane.patient@example.com',
        password_hash: await bcrypt.hash('Password123!', 10),
        profile_id: patient.id,
        profile_type: ProfileType.PATIENT,
        is_active: true,
      });
      patientUser = await this.userRepo.save(patientUser);
    }

    return {
      ok: true,
      doctor: { id: doctor.id, email: doctor.email },
      patient: { id: patient.id, email: patient.email },
      users: [doctorUser.id, patientUser.id],
    };
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
  async insertSqlUsers(payload: { records: Array<{ email: string; password?: string; password_hash?: string; role: string }> }) {
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
      return { email: r.email, password_hash, role: r.role };
    }));

    // Build a parameterized multi-row UPSERT
    const valuesSql: string[] = [];
    const params: any[] = [];
    normalized.forEach((row, i) => {
      const base = i * 3;
      valuesSql.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
      params.push(row.email, row.password_hash, row.role);
    });

    const sql = `
      INSERT INTO users (email, password_hash, role)
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
}
