import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface MedicalReport {
  symptoms: string[];
  diagnosis: string[];
  treatment: string[];
  medications: string[];
  caveats: string[];
  conflicts: string[];
  red_flags: string[];
  follow_up: string[];
  confidence_score: number;
}

export interface ReportGenerationResult {
  report: MedicalReport;
  processing_time_ms: number;
  model_version: string;
  confidence_score: number;
}

@Injectable()
export class SeaLionService {
  private readonly logger = new Logger(SeaLionService.name);
  private readonly apiEndpoint: string;
  private readonly apiKey: string;
  private readonly modelVersion: string = 'sea-lion-7b-instruct';

  constructor(private httpService: HttpService) {
    this.apiEndpoint = process.env.SEALION_ENDPOINT || 'https://api.sea-lion.ai/v1/chat/completions';
    this.apiKey = process.env.SEALION_API_KEY;
    this.logger.log(`🔍 DEBUG: SEA-LION endpoint: ${this.apiEndpoint}`);
    this.logger.log(`🔍 DEBUG: SEA-LION API key set: ${this.apiKey ? 'Yes' : 'No'}`);
  }

  async generateMedicalReport(
    englishTranscript: string,
    patientHistory?: string,
    currentMedications?: string,
    allergies?: string
  ): Promise<ReportGenerationResult> {
    const startTime = Date.now();

    try {
      const prompt = this.buildMedicalAnalysisPrompt(
        englishTranscript,
        patientHistory,
        currentMedications,
        allergies
      );

      const response = await firstValueFrom(
        this.httpService.post(
          this.apiEndpoint,
          {
            model: this.modelVersion,
            messages: [
              {
                role: 'system',
                content: 'You are a medical AI assistant specializing in analyzing consultation transcripts and generating structured medical reports. Always provide responses in valid JSON format.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.3,
            max_tokens: 2000,
            response_format: { type: 'json_object' }
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 120000, // 2 minutes timeout
          }
        )
      );

      const result = response.data.choices[0].message.content;
      const parsedReport = JSON.parse(result);

      // Validate and structure the report
      const medicalReport: MedicalReport = {
        symptoms: parsedReport.symptoms || [],
        diagnosis: parsedReport.diagnosis || [],
        treatment: parsedReport.treatment || [],
        medications: parsedReport.medications || [],
        caveats: parsedReport.caveats || [],
        conflicts: parsedReport.conflicts || [],
        red_flags: parsedReport.red_flags || [],
        follow_up: parsedReport.follow_up || [],
        confidence_score: parsedReport.confidence_score || 0.8,
      };

      // Check for medication conflicts
      const medicationConflicts = this.detectMedicationConflicts(
        medicalReport.medications,
        currentMedications,
        allergies
      );

      const processingTime = Date.now() - startTime;

      return {
        report: {
          ...medicalReport,
          conflicts: medicationConflicts,
        },
        processing_time_ms: processingTime,
        model_version: this.modelVersion,
        confidence_score: medicalReport.confidence_score,
      };
    } catch (error) {
      this.logger.error('Medical report generation failed:', error);
      throw new Error(`Medical report generation failed: ${error.message}`);
    }
  }

  private buildMedicalAnalysisPrompt(
    transcript: string,
    patientHistory?: string,
    currentMedications?: string,
    allergies?: string
  ): string {
    return `
Analyze the following medical consultation transcript and generate a structured medical report in JSON format.

CONSULTATION TRANSCRIPT:
${transcript}

PATIENT CONTEXT:
- Medical History: ${patientHistory || 'Not provided'}
- Current Medications: ${currentMedications || 'Not provided'}
- Known Allergies: ${allergies || 'Not provided'}

Please provide a comprehensive analysis in the following JSON structure:

{
  "symptoms": ["list of symptoms mentioned by patient"],
  "diagnosis": ["preliminary or confirmed diagnoses discussed"],
  "treatment": ["treatment plans or recommendations"],
  "medications": ["medications prescribed or discussed"],
  "caveats": ["important warnings or considerations"],
  "conflicts": ["potential medication conflicts or contraindications"],
  "red_flags": ["critical findings requiring immediate attention"],
  "follow_up": ["follow-up instructions or appointments needed"],
  "confidence_score": 0.85
}

IMPORTANT GUIDELINES:
1. Only include information explicitly mentioned or clearly implied in the transcript
2. Flag any potential medication conflicts with existing medications or allergies
3. Identify red flags that require immediate medical attention
4. Provide a confidence score (0.0-1.0) based on clarity of the transcript
5. Use medical terminology appropriately but ensure clarity
6. If information is unclear or missing, note it in caveats
7. Focus on actionable medical insights
`;
  }

  private detectMedicationConflicts(
    newMedications: string[],
    currentMedications?: string,
    allergies?: string
  ): string[] {
    const conflicts: string[] = [];

    if (!newMedications.length) return conflicts;

    // Simple conflict detection - in production, use a comprehensive drug interaction database
    const knownConflicts = {
      'warfarin': ['aspirin', 'ibuprofen', 'naproxen'],
      'metformin': ['alcohol', 'contrast dye'],
      'lisinopril': ['potassium supplements', 'spironolactone'],
      'simvastatin': ['grapefruit', 'cyclosporine'],
    };

    const allergyList = allergies?.toLowerCase().split(',').map(a => a.trim()) || [];
    const currentMedList = currentMedications?.toLowerCase().split(',').map(m => m.trim()) || [];

    for (const newMed of newMedications) {
      const medLower = newMed.toLowerCase();

      // Check allergies
      for (const allergy of allergyList) {
        if (medLower.includes(allergy) || allergy.includes(medLower)) {
          conflicts.push(`${newMed} may cause allergic reaction (known allergy: ${allergy})`);
        }
      }

      // Check drug interactions
      for (const currentMed of currentMedList) {
        const conflictingDrugs = knownConflicts[medLower] || [];
        if (conflictingDrugs.some(drug => currentMed.includes(drug))) {
          conflicts.push(`${newMed} may interact with current medication: ${currentMed}`);
        }
      }
    }

    return conflicts;
  }

  async translateReport(
    report: MedicalReport,
    targetLanguage: string
  ): Promise<MedicalReport> {
    if (targetLanguage === 'en') {
      return report;
    }

    try {
      const translatePrompt = `
Translate the following medical report to ${targetLanguage}. Maintain medical accuracy and terminology.

Original Report (JSON):
${JSON.stringify(report, null, 2)}

Provide the translated report in the same JSON structure, keeping medical terms accurate in the target language.
`;

      const response = await firstValueFrom(
        this.httpService.post(
          this.apiEndpoint,
          {
            model: this.modelVersion,
            messages: [
              {
                role: 'system',
                content: 'You are a medical translator specializing in accurate translation of medical reports while preserving clinical meaning.'
              },
              {
                role: 'user',
                content: translatePrompt
              }
            ],
            temperature: 0.2,
            max_tokens: 2000,
            response_format: { type: 'json_object' }
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 60000,
          }
        )
      );

      const translatedResult = JSON.parse(response.data.choices[0].message.content);
      return translatedResult;
    } catch (error) {
      this.logger.error('Report translation failed:', error);
      // Return original report if translation fails
      return report;
    }
  }
}
