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
