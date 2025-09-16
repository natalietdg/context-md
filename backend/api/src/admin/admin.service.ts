import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Doctor } from '../entities/doctor.entity';
import { Patient } from '../entities/patient.entity';
import { Consultation, ProcessingStatus } from '../entities/consultation.entity';
import { Report } from '../entities/report.entity';
import { Consent, ConsentStatus } from '../entities/consent.entity';
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
    @InjectRepository(Consultation) private readonly consultationRepo: Repository<Consultation>,
    @InjectRepository(Report) private readonly reportRepo: Repository<Report>,
    @InjectRepository(Consent) private readonly consentRepo: Repository<Consent>,
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
              name: ' Sarah Chen',
              employee_id: 'D1001',
              department: 'General Medicine',
              email: 'sarah.chen@contextmd.com',
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

  async seedComprehensive() {
    return await this.dataSource.transaction(async manager => {
      try {
        // Create multiple doctors
        const doctors = [
          {
            name: 'Sarah Chen',
            employee_id: 'D1001',
            department: 'General Medicine',
            email: 'sarah.chen@contextmd.com',
            is_active: true,
          },
          {
            name: 'Michael Rodriguez',
            employee_id: 'D1002', 
            department: 'Cardiology',
            email: 'michael.rodriguez@contextmd.com',
            is_active: true,
          },
          {
            name: ' Priya Sharma',
            employee_id: 'D1003',
            department: 'Pediatrics',
            email: 'priya.sharma@contextmd.com',
            is_active: true,
          },
          {
            name: ' James Wilson',
            employee_id: 'D1004',
            department: 'Emergency Medicine',
            email: 'james.wilson@contextmd.com',
            is_active: true,
          }
        ];

        const savedDoctors = [];
        for (const doctorData of doctors) {
          let doctor = await manager.findOne(Doctor, { where: { employee_id: doctorData.employee_id } });
          if (!doctor) {
            doctor = manager.create(Doctor, doctorData);
            doctor = await manager.save(doctor);
          }
          savedDoctors.push(doctor);

          // Create user for doctor
          let doctorUser = await manager.findOne(User, { where: { profile_id: doctor.id, profile_type: ProfileType.DOCTOR } });
          if (!doctorUser) {
            const u = manager.create(User, {
              profile_id: doctor.id,
              profile_type: ProfileType.DOCTOR,
              is_active: true,
            });
            u.email = doctorData.email;
            u.password_hash = await bcrypt.hash('password123', 10);
            await manager.save(u);
          }
        }

        // Create multiple patients with diverse profiles
        const patients = [
          {
            name: 'John Tan Wei Ming',
            nric: 'S1234567A',
            phone: '+65 91234567',
            email: 'john.tan@email.com',
            date_of_birth: new Date('1985-03-15'),
            allergies: 'Penicillin, Shellfish',
            medical_history: 'Hypertension, Type 2 Diabetes',
            medication: 'Metformin 500mg BD, Lisinopril 10mg OD',
            is_active: true,
          },
          {
            name: 'Mary Lim Hui Fen',
            nric: 'S2345678B',
            phone: '+65 92345678',
            email: 'mary.lim@email.com',
            date_of_birth: new Date('1992-07-22'),
            allergies: 'None known',
            medical_history: 'Asthma since childhood',
            medication: 'Salbutamol inhaler PRN',
            is_active: true,
          },
          {
            name: 'Ahmad Rahman',
            nric: 'S3456789C',
            phone: '+65 93456789',
            email: 'ahmad.rahman@email.com',
            date_of_birth: new Date('1978-11-08'),
            allergies: 'Aspirin',
            medical_history: 'Coronary artery disease, Hyperlipidemia',
            medication: 'Atorvastatin 20mg ON, Clopidogrel 75mg OD',
            is_active: true,
          },
          {
            name: 'Jennifer Wong',
            nric: 'S4567890D',
            phone: '+65 94567890',
            email: 'jennifer.wong@email.com',
            date_of_birth: new Date('1995-05-12'),
            allergies: 'Latex',
            medical_history: 'Migraine, Anxiety disorder',
            medication: 'Sumatriptan PRN, Sertraline 50mg OD',
            is_active: true,
          },
          {
            name: 'Robert Chen',
            nric: 'S5678901E',
            phone: '+65 95678901',
            email: 'robert.chen@email.com',
            date_of_birth: new Date('1960-12-03'),
            allergies: 'Sulfa drugs',
            medical_history: 'Chronic kidney disease, Gout',
            medication: 'Allopurinol 100mg OD, Furosemide 40mg OD',
            is_active: true,
          },
          {
            name: 'Siti Nurhaliza',
            nric: 'S6789012F',
            phone: '+65 96789012',
            email: 'siti.nurhaliza@email.com',
            date_of_birth: new Date('1988-09-18'),
            allergies: 'Iodine contrast',
            medical_history: 'Thyroid disorder, PCOS',
            medication: 'Levothyroxine 75mcg OD, Metformin 850mg BD',
            is_active: true,
          }
        ];

        const savedPatients = [];
        for (const patientData of patients) {
          let patient = await manager.findOne(Patient, { where: { nric: patientData.nric } });
          if (!patient) {
            patient = manager.create(Patient, patientData);
            patient = await manager.save(patient);
          }
          savedPatients.push(patient);

          // Create user for patient
          let patientUser = await manager.findOne(User, { where: { profile_id: patient.id, profile_type: ProfileType.PATIENT } });
          if (!patientUser) {
            const u = manager.create(User, {
              profile_id: patient.id,
              profile_type: ProfileType.PATIENT,
              is_active: true,
            });
            u.email = patientData.email;
            u.password_hash = await bcrypt.hash('password123', 10);
            await manager.save(u);
          }
        }

        // Create consultations (past and upcoming)
        const consultations = [];
        const now = new Date();
        
        // Past consultations (completed with transcripts and reports)
        const pastConsultations = [
          {
            consultation_date: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
            patient: savedPatients[0],
            doctor: savedDoctors[0],
            processing_status: 'completed',
            transcript_original: 'Patient complains of chest pain for the past 2 days. Pain is sharp, worse with deep breathing. No fever, no cough. Has history of hypertension and diabetes.',
            transcript_eng: 'Patient complains of chest pain for the past 2 days. Pain is sharp, worse with deep breathing. No fever, no cough. Has history of hypertension and diabetes.',
            notes: 'Possible pleuritic chest pain. ECG normal. Chest X-ray pending.',
            is_locked: true,
          },
          {
            consultation_date: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
            patient: savedPatients[1],
            doctor: savedDoctors[2],
            processing_status: 'completed',
            transcript_original: 'Child brought in by mother for persistent cough and wheezing. Symptoms worse at night. Using inhaler but not much improvement.',
            transcript_eng: 'Child brought in by mother for persistent cough and wheezing. Symptoms worse at night. Using inhaler but not much improvement.',
            notes: 'Asthma exacerbation. Increased inhaler frequency. Follow up in 1 week.',
            is_locked: true,
          },
          {
            consultation_date: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000), // 21 days ago
            patient: savedPatients[2],
            doctor: savedDoctors[1],
            processing_status: 'completed',
            transcript_original: 'Follow-up for cardiac condition. Patient reports occasional chest tightness during exercise. Taking medications as prescribed.',
            transcript_eng: 'Follow-up for cardiac condition. Patient reports occasional chest tightness during exercise. Taking medications as prescribed.',
            notes: 'Stable coronary artery disease. Continue current medications. Stress test recommended.',
            is_locked: true,
          }
        ];

        // Upcoming consultations
        const upcomingConsultations = [
          {
            consultation_date: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
            patient: savedPatients[3],
            doctor: savedDoctors[0],
            processing_status: 'pending',
            notes: 'Follow-up for migraine management',
            is_locked: false,
          },
          {
            consultation_date: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
            patient: savedPatients[4],
            doctor: savedDoctors[3],
            processing_status: 'pending',
            notes: 'Routine check-up for chronic kidney disease',
            is_locked: false,
          },
          {
            consultation_date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            patient: savedPatients[5],
            doctor: savedDoctors[2],
            processing_status: 'pending',
            notes: 'Thyroid function review',
            is_locked: false,
          }
        ];

        // Save all consultations
        for (const consultationData of [...pastConsultations, ...upcomingConsultations]) {
          // Create consent first
          const consent = manager.create(Consent, {
            patient_id: consultationData.patient.id,
            doctor_id: consultationData.doctor.id,
            aws_audio_link: `https://contextmd-audio.s3.amazonaws.com/consent_${Date.now()}.wav`,
            consent_hash: `hash_${randomBytes(8).toString('hex')}`,
            file_size: Math.floor(Math.random() * 1000000) + 100000,
            duration_seconds: Math.floor(Math.random() * 300) + 60,
            consent_text: 'Patient consents to audio recording and processing for medical documentation purposes.',
            status: ConsentStatus.ACTIVE,
            expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
          });
          const savedConsent = await manager.save(consent);

          const consultation = manager.create(Consultation, {
            patient_id: consultationData.patient.id,
            doctor_id: consultationData.doctor.id,
            consent_id: savedConsent.id,
            consultation_date: consultationData.consultation_date,
            aws_audio_link: `https://contextmd-audio.s3.amazonaws.com/consultation_${Date.now()}.wav`,
            transcript_raw: consultationData.notes || 'Raw transcript pending...',
            transcript_eng: consultationData.notes || 'English transcript pending...',
            audio_duration_seconds: Math.floor(Math.random() * 1800) + 300,
            file_size: Math.floor(Math.random() * 5000000) + 1000000,
            processing_status: consultationData.processing_status === 'completed' ? ProcessingStatus.COMPLETED : ProcessingStatus.PENDING,
            is_locked: consultationData.is_locked || false
          });
          const savedConsultation = await manager.save(consultation);
          consultations.push(savedConsultation);

          // Create reports for completed consultations
          if (consultationData.processing_status === 'completed') {
            const reportData = {
              consultation_id: savedConsultation.id,
              report_eng: {
                assessment: {
                  primary_diagnosis: consultationData.patient.id === savedPatients[0].id ? 'Pleuritic chest pain' :
                                   consultationData.patient.id === savedPatients[1].id ? 'Asthma exacerbation' :
                                   'Stable coronary artery disease',
                  differential_diagnosis: ['Viral pleuritis', 'Musculoskeletal pain'],
                  clinical_impression: 'Patient stable, responding to treatment'
                },
                treatment: {
                  medications: consultationData.patient.id === savedPatients[0].id ? ['Ibuprofen 400mg TDS', 'Paracetamol 1g QDS PRN'] :
                              consultationData.patient.id === savedPatients[1].id ? ['Salbutamol inhaler 2 puffs QDS', 'Prednisolone 30mg OD x 5 days'] :
                              ['Continue current cardiac medications'],
                  follow_up: ['Review in 1 week', 'Return if symptoms worsen']
                },
                red_flags: consultationData.patient.id === savedPatients[2].id ? ['Chest pain on exertion'] : [],
                medication_conflicts: []
              },
              target_language: 'en',
              ai_model_version: 'gpt-4-turbo-2024-04-09',
              confidence_score: 0.92,
              processing_time_ms: 2500,
            };

            const report = manager.create(Report, reportData);
            await manager.save(report);
          }
        }

        this.logger.log(`Seeded ${savedDoctors.length} doctors, ${savedPatients.length} patients, ${consultations.length} consultations`);

        return {
          doctors: savedDoctors.map(d => ({ id: d.id, name: d.name, department: d.department })),
          patients: savedPatients.map(p => ({ id: p.id, name: p.name, nric: p.nric })),
          consultations: consultations.map(c => ({ 
            id: c.id, 
            date: c.consultation_date, 
            status: c.processing_status,
            patient: c.patient_id,
            doctor: c.doctor_id
          })),
          summary: {
            totalDoctors: savedDoctors.length,
            totalPatients: savedPatients.length,
            totalConsultations: consultations.length,
            pastConsultations: pastConsultations.length,
            upcomingConsultations: upcomingConsultations.length
          }
        };

      } catch (error) {
        console.error('Error in comprehensive seeding:', error);
        throw error;
      }
    });
  }
}
