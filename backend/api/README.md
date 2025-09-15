# ContextMD NestJS API

NestJS implementation of the previous Supabase Edge Functions. Provides two endpoints that call the Sea Lion API and return either a structured JSON or a summary-parsed response.

## Endpoints
- POST `/analyze/structured`
- POST `/analyze/summary`

Both expect the JSON body:
```json
{
  "transcript": "string",
  "language": "en",
  "outputLanguage": "en"
}
```

## Security & Limits
- CORS allowed origins: `https://contextmd.netlify.app`, `http://localhost:3000`
- Body size limit: 50KB
- In-memory per-IP rate-limit: 20 requests/min
- Optional `x-api-key` required if `API_KEY_REQUIRED=true` and must match one of `ALLOWED_API_KEYS` (comma separated)

## Environment
Copy `.env.example` to `.env` and set values:
- `PORT` — default 4000
- `SEALION_API_KEY` — API key for Sea Lion
- `ENVIRONMENT` — `development` to include raw LLM data in responses
- `ALLOWED_API_KEYS` — comma-separated list
- `API_KEY_REQUIRED` — `true` to enforce API key check

## Development
Install dependencies and start the dev server:

```bash
npm install
npm run start:dev
```

The app listens on `http://localhost:4000`.

## Example curl
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-api-key: <optional-if-required>" \
  -d '{
    "transcript": "Patient reports headache and dizziness...",
    "language": "en",
    "outputLanguage": "en"
  }' \
  http://localhost:4000/analyze/structured
```

## API Reference

Below is a concise reference of the available backend API endpoints and their auth requirements. Base URL defaults to `http://localhost:4000`.

### Auth
- POST `/auth/login` — Public. Issue JWT for existing user.
- POST `/auth/register/doctor` — Public. Create a doctor + user.
- GET `/auth/profile` — JWT required. Returns current user from token.
- POST `/auth/refresh` — JWT required. Simple token validity check.

### Users
- POST `/users` — Public. Create a bare user.
- POST `/users/doctor` — Public. Create doctor profile + user.
- POST `/users/patient` — Public. Create patient profile + user.
- POST `/users/login` — Public. Alternative login endpoint.
- GET `/users` — JWT + role DOCTOR.
- GET `/users/:id` — JWT required.
- GET `/users/:id/profile` — JWT required.
- PATCH `/users/:id` — JWT + role DOCTOR.
- DELETE `/users/:id` — JWT + role DOCTOR. Soft-deactivate.

Seed helpers (development only):
- POST `/seed/sample-doctor`
- POST `/seed/sample-patient`
- POST `/seed/bulk-doctors`
- POST `/seed/bulk-patients`

### Analyze (SEA-LION)
Requires API key guard. Provide header `x-api-key: <key>` when `API_KEY_REQUIRED=true`.
- POST `/analyze/structured`
  - Body: `{ transcript: string, language: 'en'|'zh'|'ms', outputLanguage: 'en'|'zh'|'ms' }`
- POST `/analyze/summary`
  - Body: same as structured.

### Consultation
JWT required for all endpoints.
- POST `/consultation` — multipart/form-data with `audio` file field + JSON body of consultation metadata. Stores/upload-processes an audio-driven consultation.
- GET `/consultation/:id`
- PUT `/consultation/:id` — update consultation fields.
- PUT `/consultation/lock` — lock a consultation record.
- GET `/consultation/:id/status` — processing status.
- GET `/consultation/patient/:patientId`
- GET `/consultation/doctor/:doctorId`
- GET `/consultation` — query by date range: `?startDate=ISO&endDate=ISO&doctorId?=&patientId?=`

### Consent
JWT required for all endpoints.
- POST `/consent` — multipart/form-data with `audio` file field + JSON body. Creates consent record.
- GET `/consent/:id`
- POST `/consent/replay` — log a consent replay event.
- GET `/consent/:id/replay-logs`
- GET `/consent/patient/:patientId`
- GET `/consent/doctor/:doctorId`
- PUT `/consent/:id/revoke` — revoke consent.

### Report
JWT required for all endpoints.
- POST `/report` — generate an AI report for a consultation.
- GET `/report/:id`
- GET `/report/consultation/:consultationId`
- PUT `/report/:id` — update report metadata/content.
- POST `/report/:id/regenerate` — optional `target_language` to translate/regenerate.
- GET `/report/patient/:patientId`
- GET `/report/doctor/:doctorId`
- GET `/report/conflicts/all` — list reports with medication conflicts.

### History
JWT required.
- GET `/history/patient/:patientId` — timeline/history for a patient.
- GET `/history/doctor/:doctorId/patients` — patients for a doctor.
- GET `/history/patient/:patientId/handover` — handover summary.
- GET `/history/patient/:patientId/search?q=...` — full-text search within a patient history.

### Dashboard
JWT required.
- GET `/dashboard/doctor/:doctorId` — dashboard metrics and upcoming appointments.
- PUT `/dashboard/appointment/:appointmentId/status` — update appointment status. Body: `{ status: 'scheduled'|'in_progress'|'completed'|'cancelled'|'no_show' }`
- POST `/dashboard/appointment` — create appointment. Body includes `patient_id`, `doctor_id`, `scheduled_at` (ISO), optional `duration_minutes`, `appointment_type`, `notes`.

### Database (ops/introspection)
- GET `/database/health` — health check.
- GET `/database/config` — sanitized DB config (no secrets).

## Auth, Security & Limits
- CORS: `https://contextmd.netlify.app`, `http://localhost:3000`.
- Body limit: 50KB.
- Rate limit: 20 req/min/IP.
- API key guard: supply `x-api-key` when required. Configure via `.env` (`API_KEY_REQUIRED`, `ALLOWED_API_KEYS`).
- JWT: most endpoints require JWT; use `/auth/login` or `/users/login` to obtain a token.

## Environment
Copy `.env.example` to `.env` and set values for `PORT`, `SEALION_API_KEY`, `ENVIRONMENT`, `ALLOWED_API_KEYS`, `API_KEY_REQUIRED`, and database credentials (if using persistent storage).

