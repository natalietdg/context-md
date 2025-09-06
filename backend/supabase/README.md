# Supabase Edge Functions

This directory contains two Supabase Edge Functions (Deno) for analyzing medical transcripts via the Sea Lion API.

- `functions/analyze-transcript-structured/` — Returns a strictly structured JSON object with keys like `symptoms`, `treatmentPlan`, `medicalCaveats`, etc.
- `functions/analyze-transcript-summary/` — Returns a simpler parsed summary by splitting lines in the LLM response.

## Endpoints (local dev)
- `analyze-transcript-structured` — POST `/functions/v1/analyze-transcript-structured`
- `analyze-transcript-summary` — POST `/functions/v1/analyze-transcript-summary`

## Request Body
```json
{
  "transcript": "string",
  "language": "en" ,
  "outputLanguage": "en"
}
```

## CORS
Allowed origins are restricted to:
- https://contextmd.netlify.app
- http://localhost:3000

Update these inside each function file if you need to allow more origins.

## Environment Variables
The functions expect the following environment variables:

- `SEA_LION_API_KEY` — API key for Sea Lion API
- `ENVIRONMENT` — e.g. `development` to include `rawSeaLionData` in responses
- `ALLOWED_API_KEYS` — optional, comma-separated list of allowed `x-api-key` header values
- `API_KEY_REQUIRED` — optional, set to `true` to enforce presence of a valid `x-api-key`

See `.env.example` in this folder.

## Run Locally
Requires the Supabase CLI. Start the local edge runtime:

```bash
supabase start
supabase functions serve --env-file backend/supabase/.env --no-verify-jwt
```

Then call the function, for example:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-api-key: <optional-if-required>" \
  -d '{
    "transcript": "Patient reports headache and dizziness...",
    "language": "en",
    "outputLanguage": "en"
  }' \
  http://localhost:54321/functions/v1/analyze-transcript-structured
```

## Deploy
Ensure you are logged in and linked to your project, then deploy each function:

```bash
supabase functions deploy analyze-transcript-structured --project-ref <YOUR_PROJECT_REF>
supabase functions deploy analyze-transcript-summary --project-ref <YOUR_PROJECT_REF>
```

Optionally set environment variables in your Supabase project (recommended):

```bash
supabase secrets set \
  SEA_LION_API_KEY=******** \
  ENVIRONMENT=production \
  ALLOWED_API_KEYS=key1,key2 \
  API_KEY_REQUIRED=true \
  --project-ref <YOUR_PROJECT_REF>
```

## Notes
- Both functions implement basic in-memory rate limiting (per-edge-instance). For distributed rate limiting, use a persistent store.
- Request size is limited to 50KB.
- The structured variant attempts to extract a JSON block from the LLM response and will error if the model returns non-JSON/invalid JSON.
