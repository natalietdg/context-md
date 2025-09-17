import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from '../entities/patient.entity';
import { AuditService } from '../shared/audit.service';
import { UserType } from '../entities/audit-log.entity';

@Injectable()
export class PatientService {
  private readonly logger = new Logger(PatientService.name);

  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    private readonly auditService: AuditService,
  ) {}

  async getAllPatients(req: any) {
    try {
      const patients = await this.patientRepository.find({
        where: { is_active: true },
        order: { name: 'ASC' }
      });

      // Log audit trail
      await this.auditService.log(
        req.user?.sub || 'unknown',
        req.user?.role === 'doctor' ? UserType.DOCTOR : UserType.PATIENT,
        'VIEW_PATIENTS_LIST',
        'Patient',
        null,
        { total_patients: patients.length },
        req.ip,
        req.get('User-Agent')
      );

      this.logger.log(`Retrieved ${patients.length} patients for user ${req.user?.sub}`);

      return patients.map(patient => ({
        id: patient.id,
        name: patient.name,
        nric: patient.nric,
        email: patient.email,
        phone: patient.phone,
        allergies: patient.allergies,
        medical_history: patient.medical_history,
        medication: patient.medication,
        is_active: patient.is_active
      }));
    } catch (error) {
      this.logger.error('Error retrieving patients:', error);
      throw error;
    }
  }

  async searchPatients(term: string, req: any) {
    try {
      const q = `%${term.toLowerCase()}%`;
      const patients = await this.patientRepository
        .createQueryBuilder('patient')
        .where('patient.is_active = :active', { active: true })
        .andWhere(
          '(LOWER(patient.name) LIKE :q OR LOWER(patient.nric) LIKE :q OR LOWER(patient.email) LIKE :q)',
          { q }
        )
        .orderBy('patient.name', 'ASC')
        .getMany();

      // Log audit trail
      await this.auditService.log(
        req.user?.sub || 'unknown',
        req.user?.role === 'doctor' ? UserType.DOCTOR : UserType.PATIENT,
        'SEARCH_PATIENTS',
        'Patient',
        null,
        { term, total_patients: patients.length },
        req.ip,
        req.get('User-Agent')
      );

      this.logger.log(`Searched patients with term '${term}' and found ${patients.length} results for user ${req.user?.sub}`);

      return patients.map(patient => ({
        id: patient.id,
        name: patient.name,
        nric: patient.nric,
        email: patient.email,
        phone: patient.phone,
        allergies: patient.allergies,
        medical_history: patient.medical_history,
        medication: patient.medication,
        is_active: patient.is_active
      }));
    } catch (error) {
      this.logger.error('Error searching patients:', error);
      throw error;
    }
  }
}
