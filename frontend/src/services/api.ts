import axios, { AxiosInstance, AxiosResponse } from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Dev-only: basic request/response logging to verify auth/login flow
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('[ApiService] Base URL =', API_BASE_URL);
    }

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('contextmd_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.log('[ApiService] Request', (config.method || 'GET').toUpperCase(), config.url, config.data);
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle auth errors
    this.api.interceptors.response.use(
      (response) => {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.log('[ApiService] Response', response.config.url, response.status, response.data);
        }
        return response;
      },
      (error) => {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.log('[ApiService] Error', error?.response?.status, error?.response?.data);
        }
        if (error.response?.status === 401) {
          // Just clear auth; ProtectedRoute will handle navigation via React Router
          localStorage.removeItem('contextmd_token');
          localStorage.removeItem('contextmd_user');
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async login(email: string, password: string, role: 'doctor' | 'patient') {
    const response = await this.api.post('/auth/login', { email, password, role });

    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('[ApiService] /auth/login data', response.status, response.data);
    }
    return response.data;
  }

  async registerDoctor(data: {
    name: string;
    employee_id: string;
    department?: string;
    email: string;
    password: string;
  }) {
    const response = await this.api.post('/auth/register/doctor', data);
    return response.data;
  }

  async getProfile() {
    const response = await this.api.get('/auth/profile');
    return response.data;
  }

  // Consent endpoints
  async createConsent(data: FormData) {
    const response = await this.api.post('/consent', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async getConsent(id: string) {
    const response = await this.api.get(`/consent/${id}`);
    return response.data;
  }

  async replayConsent(data: { consent_id: string; role: string; purpose?: string }) {
    const response = await this.api.post('/consent/replay', data);
    return response.data;
  }

  async getConsentReplayLogs(consentId: string) {
    const response = await this.api.get(`/consent/${consentId}/replay-logs`);
    return response.data;
  }

  async getPatientConsents(patientId: string) {
    const response = await this.api.get(`/consent/patient/${patientId}`);
    return response.data;
  }

  async getDoctorConsents(doctorId: string) {
    const response = await this.api.get(`/consent/doctor/${doctorId}`);
    return response.data;
  }

  // Consultation endpoints
  async createConsultation(data: FormData | {
    patient_id: string;
    doctor_id?: string;
    consultation_date: string;
    notes?: string;
  }) {
    if (data instanceof FormData) {
      const response = await this.api.post('/consultation', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } else {
      const response = await this.api.post('/consultation', data);
      return response.data;
    }
  }

  async getConsultation(id: string) {
    const response = await this.api.get(`/consultation/${id}`);
    return response.data;
  }

  async updateConsultation(id: string, data: any) {
    const response = await this.api.put(`/consultation/${id}`, data);
    return response.data;
  }

  async uploadConsultationAudio(
    id: string,
    data: FormData,
    onProgress?: (percent: number) => void
  ) {
    const response = await this.api.put(`/consultation/${id}/audio`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (evt) => {
        if (!onProgress) return;
        if (typeof evt.total === 'number' && evt.total > 0) {
          const percent = Math.round((evt.loaded * 100) / evt.total);
          onProgress(percent);
        }
      }
    });
    return response.data;
  }

  async lockConsultation(data: { consultation_id: string; lock?: boolean }) {
    const response = await this.api.put('/consultation/lock', data);
    return response.data;
  }

  async getConsultationStatus(id: string) {
    const response = await this.api.get(`/consultation/${id}/status`);
    return response.data;
  }

  async getPatientConsultations(patientId: string) {
    const response = await this.api.get(`/consultation/patient/${patientId}`);
    return response.data;
  }

  async getDoctorConsultations(doctorId: string) {
    const response = await this.api.get(`/consultation/doctor/${doctorId}`);
    return response.data;
  }

  // Report endpoints
  async generateReport(data: { consultation_id: string; target_language?: string }) {
    const response = await this.api.post('/report', data);
    return response.data;
  }

  async getReport(id: string) {
    const response = await this.api.get(`/report/${id}`);
    return response.data;
  }

  async getReportByConsultation(consultationId: string) {
    const response = await this.api.get(`/report/consultation/${consultationId}`);
    return response.data;
  }

  async updateReport(id: string, data: any) {
    const response = await this.api.put(`/report/${id}`, data);
    return response.data;
  }

  async regenerateReport(id: string, targetLanguage?: string) {
    const response = await this.api.post(`/report/${id}/regenerate`, {
      target_language: targetLanguage,
    });
    return response.data;
  }

  async getPatientReports(patientId: string) {
    const response = await this.api.get(`/report/patient/${patientId}`);
    return response.data;
  }

  async getDoctorReports(doctorId: string) {
    const response = await this.api.get(`/report/doctor/${doctorId}`);
    return response.data;
  }

  async getReportsWithConflicts() {
    const response = await this.api.get('/report/conflicts/all');
    return response.data;
  }

  async getAllReports() {
    const response = await this.api.get('/report/all');
    return response.data;
  }

  // History endpoints
  async getPatientHistory(patientId: string) {
    const response = await this.api.get(`/history/patient/${patientId}`);
    return response.data;
  }

  async getDoctorPatients(doctorId: string) {
    const response = await this.api.get(`/history/doctor/${doctorId}/patients`);
    return response.data;
  }

  async getHandoverSummary(patientId: string) {
    const response = await this.api.get(`/history/patient/${patientId}/handover`);
    return response.data;
  }

  async searchPatientHistory(patientId: string, searchTerm: string) {
    const response = await this.api.get(`/history/patient/${patientId}/search`, {
      params: { q: searchTerm },
    });
    return response.data;
  }

  // Dashboard endpoints
  async getDoctorDashboard(doctorId: string) {
    const response = await this.api.get(`/dashboard/doctor/${doctorId}`);
    return response.data;
  }

  // Patient endpoints
  async getPatients(search?: string) {
    const response = await this.api.get('/patients', {
      params: search && search.trim() ? { search } : undefined,
    });
    return response.data;
  }

  async updateAppointmentStatus(appointmentId: string, status: string) {
    const response = await this.api.put(`/dashboard/appointment/${appointmentId}/status`, {
      status,
    });
    return response.data;
  }

  async createAppointment(data: {
    patient_id: string;
    doctor_id: string;
    scheduled_at: string;
    duration_minutes?: number;
    appointment_type?: string;
    notes?: string;
  }) {
    const response = await this.api.post('/dashboard/appointment', data);
    return response.data;
  }
}

export const apiService = new ApiService();
export default apiService;
