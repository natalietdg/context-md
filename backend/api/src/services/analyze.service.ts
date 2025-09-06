import { Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common';

const SEA_LION_URL = 'https://api.sea-lion.ai/v1/chat/completions';

@Injectable()
export class AnalyzeService {
  private extractJson(s: string) {
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    return s.slice(start, end + 1);
  }

  private toTextOrStringify(v: unknown, fallback: string) {
    if (v == null) return fallback;
    if (typeof v === 'string') return v.trim() || fallback;
    try {
      return JSON.stringify(v);
    } catch {
      return fallback;
    }
  }

  async analyzeStructured({ transcript, language, outputLanguage }: { transcript: string; language: string; outputLanguage: string; }) {
    if (!transcript || !language || !outputLanguage) {
      throw new BadRequestException('Missing required fields');
    }

    const apiKey = process.env.SEA_LION_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException('Service configuration error');
    }

    const res = await fetch(SEA_LION_URL, {
      method: 'POST',
      headers: {
        accept: 'text/plain',
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content:
              'You are a medical assistant that extracts key information from medical transcripts.' +
              ' The transcript language is "' + language + '".' +
              ' Always answer in "en" and "' + outputLanguage + '".',
          },
          {
            role: 'user',
            content: (() => {
              const bilingualLine = outputLanguage !== 'en'
                ? 'and ' + outputLanguage + ' in this format:\n"<EN text> | <' + outputLanguage + ' text>'
                : '';
              const schemaSuffix = outputLanguage !== 'en' ? ' | ' + outputLanguage : '';
              const potentialNone = outputLanguage !== 'en' ? ' | None in ' + outputLanguage : '';
              return [
                'Analyze the medical transcript and return ONLY one JSON object with exactly these keys.',
                'For each field, write one line that combines EN ' + bilingualLine,
                '',
                'Do not include any extra text, comments, or code fences.',
                '',
                'Schema:',
                '{',
                '  "symptoms": "Chief symptoms or primary complaint (EN' + schemaSuffix + ')",',
                '  "treatmentPlan": "Recommended treatment plan (EN' + schemaSuffix + ')",',
                '  "medicalCaveats": "Important medical caveats (EN' + schemaSuffix + ')",',
                '  "medicationsPrescribed": "Medications mentioned, comma-separated (EN' + schemaSuffix + ' for each)",',
                '  "potentialMedicationConflicts": "Potential medication conflicts; if none, \'None\'' + potentialNone + '"',
                '}',
                '',
                'Transcript:',
                transcript,
              ].join('\n');
            })(),
          },
          {
            role: 'user',
            content: transcript,
          },
        ],
        model: 'aisingapore/Llama-SEA-LION-v3-70B-IT',
      }),
    });

    if (!res.ok) {
      throw new ServiceUnavailableException('External API error');
    }

    const result = await res.json();
    const content: string = result?.choices?.[0]?.message?.content ?? '';

    const jsonText = this.extractJson(content);
    if (!jsonText) {
      throw new ServiceUnavailableException('Upstream returned non-JSON format');
    }

    let data: any;
    try {
      data = JSON.parse(jsonText);
    } catch {
      throw new ServiceUnavailableException('Upstream returned invalid JSON');
    }

    const medsObj = data.medicationsPrescribed ?? data.medicationPrescribed ?? {};
    const medications = medsObj;

    const transformedResponse: Record<string, unknown> = {
      symptoms: this.toTextOrStringify(data.symptoms, 'No specific symptoms found'),
      treatmentPlan: this.toTextOrStringify(data.treatmentPlan, 'No specific treatment plan found'),
      medicalCaveats: this.toTextOrStringify(data.medicalCaveats, 'No specific medical caveats found'),
      medicationsPrescribed: medications,
      potentialMedicationConflicts: this.toTextOrStringify(data.potentialMedicationConflicts, 'No potential medical conflicts found'),
      ...(process.env.ENVIRONMENT === 'development' ? { rawSeaLionData: result } : {}),
    };

    return transformedResponse;
  }

  async analyzeSummary({ transcript, language, outputLanguage }: { transcript: string; language: string; outputLanguage: string; }) {
    if (!transcript || !language || !outputLanguage) {
      throw new BadRequestException('Missing required fields');
    }

    const apiKey = process.env.SEA_LION_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException('Service configuration error');
    }

    const res = await fetch(SEA_LION_URL, {
      method: 'POST',
      headers: {
        accept: 'text/plain',
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        max_completion_tokens: 200,
        messages: [
          { role: 'system', content: 'You are a medical assistant that extracts key information from medical transcripts.' },
          {
            role: 'user',
            content: `Analyze the following medical transcript. 
            Provide a summary focusing on:
            1. Chief symptoms or primary complaint
            2. Recommended treatment plan
            3. Any important medical caveats
            4. List of medications mentioned
            5. Check for any potential medication conflicts`,
          },
          { role: 'user', content: JSON.stringify(transcript) },
        ],
        model: 'aisingapore/Llama-SEA-LION-v3-70B-IT',
      }),
    });

    if (!res.ok) {
      throw new ServiceUnavailableException('External API error');
    }

    const result = await res.json();
    const messageContent: string = result?.choices?.[0]?.message?.content ?? '';
    const lines = messageContent.split('\n').map((l: string) => l.trim()).filter(Boolean);

    const getAfter = (prefix: string) =>
      lines.find((line: string) => line.toLowerCase().startsWith(prefix.toLowerCase()))?.slice(prefix.length).trim();

    const transformedResponse = {
      symptoms: getAfter('Symptoms:') || 'No specific symptoms found',
      treatment: getAfter('Treatment Plan:') || 'No specific treatment plan found',
      caveats: getAfter('Caveats:') || 'No specific medical caveats found',
      medications: lines
        .filter((line: string) => line.toLowerCase().startsWith('medication:'))
        .map((line: string) => {
          const medName = line.slice('Medication:'.length).trim();
          return { name: medName, conflict: false as boolean, warning: null as string | null };
        }),
      ...(process.env.ENVIRONMENT === 'development' ? { rawSeaLionData: result } : {}),
    };

    return transformedResponse;
  }
}
