// Seeded history with full transcripts per case

export type ConsultationEntry = {
  id: string;
  dateISO: string; // ISO timestamp
  doctor: string;
  title: string;
  highlights: {
    symptoms?: string;
    treatments?: string;
    caveats?: string;
  };
  // Optional i18n versions of highlights
  highlightsI18n?: {
    symptoms?: { english?: string; malay?: string; chinese?: string };
    treatments?: { english?: string; malay?: string; chinese?: string };
    caveats?: { english?: string; malay?: string; chinese?: string };
  };
  warnings?: string[]; // mock conflicts
  warningsI18n?: {
    english?: string[];
    malay?: string[];
    chinese?: string[];
  };
  // Legacy single transcript (English). Prefer 'transcripts' below when available.
  transcript?: string;
  transcripts?: {
    english?: string;
    malay?: string;
    chinese?: string;
  };
  summary?: {
    english?: string;
    malay?: string;
    chinese?: string;
  };
};


export function buildEntryFromCurrent(payload: {
  doctor?: string;
  title?: string;
  summary?: any;
  transcript?: any;
}): ConsultationEntry {
  const nowISO = new Date().toISOString();
  const doc = payload.doctor || ' Tan';
  const s = payload.summary || {};
  // Normalize conflicts supplied by SEA-LION
  const conflictsRaw = s?.potentialMedicationConflicts;
  let conflicts: string[] = [];
  if (Array.isArray(conflictsRaw)) {
    conflicts = conflictsRaw
      .map((t: any) => (typeof t === 'string' ? t : ''))
      .map((t: string) => t.trim())
      .filter((t: string) => t.length > 0);
  } else if (typeof conflictsRaw === 'string') {
    conflicts = conflictsRaw
      .split(/\n|;/)
      .map((t: string) => t.trim())
      .filter((t: string) => t.length > 0);
  }

  // Simple heuristic rules from summary fields
  const tp = (s?.treatmentPlan || '').toLowerCase();
  const caveats = (s?.medicalCaveats || '').toLowerCase();
  const symptoms = (s?.symptoms || '').toLowerCase();
  const addConflict = (msg: string) => {
    if (!conflicts.includes(msg)) conflicts.push(msg);
  };
  if (/nsaid/.test(tp) && /(gastric|ulcer|gerd|reflux)/.test(caveats + ' ' + symptoms)) {
    addConflict('NSAIDs caution with gastric/ulcer history');
  }
  if (/(ace inhibitor|ace-inhibitor|enalapril|lisinopril|ramipril)/.test(tp) && /(renal|kidney)/.test(caveats + ' ' + symptoms)) {
    addConflict('ACE inhibitors caution with renal impairment');
  }

  // Build bilingual warnings for known heuristics
  const translate = (msg: string, lang: 'malay' | 'chinese'): string => {
    if (msg === 'NSAIDs caution with gastric/ulcer history') {
      return lang === 'malay' ? 'NSAID berhati-hati dengan riwayat gastrik/ulser' : 'NSAIDs在胃病/溃疡史患者需谨慎';
    }
    if (msg === 'ACE inhibitors caution with renal impairment') {
      return lang === 'malay' ? 'Perencat ACE berhati-hati pada gangguan buah pinggang' : 'ACE抑制剂在肾功能受损者需谨慎';
    }
    return '';
  };
  const warningsI18n = {
    english: conflicts.slice(),
    malay: conflicts.map((c) => translate(c, 'malay')).filter((t) => t),
    chinese: conflicts.map((c) => translate(c, 'chinese')).filter((t) => t),
  } as { english?: string[]; malay?: string[]; chinese?: string[] };

  const entry: ConsultationEntry = {
    id: `c-${Math.random().toString(36).slice(2, 8)}`,
    dateISO: nowISO,
    doctor: doc,
    title: payload.title || 'Consultation Summary',
    highlights: {
      symptoms: s?.symptoms || '',
      treatments: s?.treatmentPlan || '',
      caveats: s?.medicalCaveats || '',
    },
    warnings: conflicts,
    warningsI18n,
    transcript: Array.isArray(payload.transcript)
      ? payload.transcript.map((t: any) => `${t.speaker ? t.speaker + ': ' : ''}${t.text || ''}`).join('\n')
      : (typeof payload.transcript === 'string' ? payload.transcript : ''),
    summary: {
      english: [s?.symptoms, s?.treatmentPlan, s?.medicalCaveats].filter(Boolean).join('\n'),
      malay: s?.summaryMs || '',
      chinese: s?.summaryZh || '',
    },
  };
  return entry;
}
