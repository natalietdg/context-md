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

export function mockHistory(): ConsultationEntry[] {
  const now = new Date();
  const day = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString();
  return [
    {
      id: 'c-003',
      dateISO: day(2),
      doctor: 'Dr. Tan',
      title: 'Fever and sore throat',
      highlights: {
        symptoms: 'Fever 38.5°C, sore throat, mild cough',
        treatments: 'Paracetamol, lozenges, hydration',
        caveats: 'Return if fever persists >48h or breathing worsens',
      },
      highlightsI18n: {
        symptoms: {
          english: 'Fever 38.5°C, sore throat, mild cough',
          malay: 'Demam 38.5°C, sakit tekak, batuk ringan',
          chinese: '发烧38.5°C，喉咙痛，轻微咳嗽',
        },
        treatments: {
          english: 'Paracetamol, lozenges, hydration',
          malay: 'Parasetamol, gula-gula hisap, banyakkan minum',
          chinese: '对乙酰氨基酚、含片、多喝水',
        },
        caveats: {
          english: 'Return if fever persists >48h or breathing worsens',
          malay: 'Datang semula jika demam berlanjutan >48 jam atau sesak nafas bertambah',
          chinese: '若发烧超过48小时或呼吸变差请回诊',
        },
      },
      warnings: [],
      transcript: [
        'Doctor: Good afternoon. What brings you in today?',
        'Patient: I have had a fever and sore throat for about two days.',
        'Doctor: Any cough, runny nose, or difficulty breathing?',
        'Patient: Mild cough and a bit of a runny nose. No trouble breathing.',
        'Doctor: Any known COVID-19 contacts? Body aches or headache?',
        'Patient: No known contacts. I do feel achy and tired.',
        'Doctor: Your temperature is 38.5°C. Throat is red with mild tonsillar swelling, no pus.',
        'Doctor: Most likely a viral upper respiratory tract infection.',
        'Doctor: Take paracetamol 1g every 6 hours as needed, lozenges, warm fluids, and rest.',
        'Doctor: If fever persists beyond 48 hours, you have trouble breathing, or chest pain, return immediately.',
        'Patient: Okay, thank you. I will monitor and come back if it gets worse.'
      ].join('\n'),
      transcripts: {
        english: [
          'Doctor: Good afternoon. What brings you in today?',
          'Patient: I have had a fever and sore throat for about two days.',
          'Doctor: Any cough, runny nose, or difficulty breathing?',
          'Patient: Mild cough and a bit of a runny nose. No trouble breathing.',
          'Doctor: Any known COVID-19 contacts? Body aches or headache?',
          'Patient: No known contacts. I do feel achy and tired.',
          'Doctor: Your temperature is 38.5°C. Throat is red with mild tonsillar swelling, no pus.',
          'Doctor: Most likely a viral upper respiratory tract infection.',
          'Doctor: Take paracetamol 1g every 6 hours as needed, lozenges, warm fluids, and rest.',
          'Doctor: If fever persists beyond 48 hours, you have trouble breathing, or chest pain, return immediately.',
          'Patient: Okay, thank you. I will monitor and come back if it gets worse.'
        ].join('\n'),
        malay: [
          'Doktor: Selamat petang. Apa yang membawa anda datang hari ini?',
          'Pesakit: Saya demam dan sakit tekak sejak dua hari lalu.',
          'Doktor: Ada batuk, hingus, atau sukar bernafas?',
          'Pesakit: Batuk ringan dan sedikit hingus. Tiada masalah bernafas.',
          'Doktor: Ada kontak COVID-19? Sakit badan atau sakit kepala?',
          'Pesakit: Tiada kontak. Saya rasa sengal dan letih.',
          'Doktor: Suhu anda 38.5°C. Tekak merah dengan bengkak tonsil ringan, tiada nanah.',
          'Doktor: Kemungkinan besar jangkitan virus saluran pernafasan atas.',
          'Doktor: Ambil parasetamol 1g setiap 6 jam jika perlu, gula-gula hisap, air suam, dan rehat.',
          'Doktor: Jika demam berlarutan lebih 48 jam, sukar bernafas, atau sakit dada, datang segera.',
          'Pesakit: Baik doktor, terima kasih. Saya akan pantau.'
        ].join('\n'),
        chinese: [
          '医生：下午好，今天怎么了？',
          '病人：我发烧喉咙痛大约两天了。',
          '医生：有没有咳嗽、流鼻涕或呼吸困难？',
          '病人：有点轻微咳嗽和流鼻涕，呼吸没问题。',
          '医生：有接触过新冠患者吗？有肌肉酸痛或头痛吗？',
          '病人：没有接触过，有些酸痛和疲倦。',
          '医生：你的体温是38.5°C。咽部充血、扁桃体轻度肿大，无脓点。',
          '医生：大多可能是上呼吸道病毒感染。',
          '医生：按需每6小时服用扑热息痛1克，含片，温水，多休息。',
          '医生：若发热超过48小时、呼吸困难或胸痛，请立即回诊。',
          '病人：好的，谢谢医生，我会留意。'
        ].join('\n'),
      },
      summary: {
        english: 'Viral URTI suspected. Supportive care advised.',
        malay: 'Disyaki jangkitan saluran pernafasan atas. Rawatan sokongan dinasihatkan.',
        chinese: '怀疑上呼吸道感染。建议对症支持治疗。',
      },
    },
    {
      id: 'c-002',
      dateISO: day(10),
      doctor: 'Dr. Sarah Chen',
      title: 'Back pain follow-up',
      highlights: {
        symptoms: 'Lower back pain improved; no radiation',
        treatments: 'Continue physio, NSAIDs PRN',
        caveats: 'Avoid heavy lifting; red flags explained',
      },
      highlightsI18n: {
        symptoms: {
          english: 'Lower back pain improved; no radiation',
          malay: 'Sakit belakang bawah bertambah baik; tiada radiasi ke kaki',
          chinese: '下背痛好转；无放射至下肢',
        },
        treatments: {
          english: 'Continue physio, NSAIDs PRN',
          malay: 'Teruskan fisioterapi, NSAID bila perlu',
          chinese: '继续物理治疗，按需使用NSAIDs',
        },
        caveats: {
          english: 'Avoid heavy lifting; red flags explained',
          malay: 'Elakkan angkat berat; tanda amaran diterangkan',
          chinese: '避免搬重物；已说明警示征象',
        },
      },
      warnings: ['NSAIDs caution with gastric reflux history'],
      warningsI18n: {
        english: ['NSAIDs caution with gastric reflux history'],
        malay: ['NSAID berhati-hati dengan riwayat refluks gastrik'],
        chinese: ['NSAIDs在胃食管反流史患者需谨慎'],
      },
      transcript: [
        'Doctor: Hi, how is your lower back feeling since our last visit?',
        'Patient: Much better. Pain is 3/10 now and no shooting pain down the legs.',
        'Doctor: Any numbness, weakness, or bladder/bowel issues?',
        'Patient: None of those.',
        'Doctor: Great. Continue physiotherapy exercises and use NSAIDs as needed with food.',
        'Doctor: Avoid heavy lifting for another two weeks and keep good posture.',
        'Doctor: If you develop leg weakness, numbness in the saddle area, or lose bladder/bowel control, seek urgent care.',
        'Patient: Understood. I will continue the exercises and be careful.'
      ].join('\n'),
      transcripts: {
        english: [
          'Doctor: Hi, how is your lower back feeling since our last visit?',
          'Patient: Much better. Pain is 3/10 now and no shooting pain down the legs.',
          'Doctor: Any numbness, weakness, or bladder/bowel issues?',
          'Patient: None of those.',
          'Doctor: Great. Continue physiotherapy exercises and use NSAIDs as needed with food.',
          'Doctor: Avoid heavy lifting for another two weeks and keep good posture.',
          'Doctor: If you develop leg weakness, numbness in the saddle area, or lose bladder/bowel control, seek urgent care.',
          'Patient: Understood. I will continue the exercises and be careful.'
        ].join('\n'),
        malay: [
          'Doktor: Hai, bagaimana keadaan belakang bawah sejak lawatan lepas?',
          'Pesakit: Jauh lebih baik. Sakit sekarang 3/10 dan tiada rasa menjalar ke kaki.',
          'Doktor: Ada kebas, lemah, atau masalah kencing/berak?',
          'Pesakit: Tiada.',
          'Doktor: Bagus. Teruskan senaman fisioterapi dan ambil NSAID bila perlu bersama makanan.',
          'Doktor: Elakkan angkat berat selama dua minggu lagi dan jaga postur.',
          'Doktor: Jika kaki jadi lemah, kebas di kawasan pelana, atau hilang kawalan kencing/berak, segera ke kecemasan.',
          'Pesakit: Faham. Saya akan teruskan senaman dan berhati-hati.'
        ].join('\n'),
        chinese: [
          '医生：上次复诊后你的下背感觉怎么样？',
          '病人：好多了。现在疼痛3/10，没有放射到腿部。',
          '医生：有没有麻木、无力，或大小便问题？',
          '病人：都没有。',
          '医生：很好。继续做物理治疗运动，按需与食物同服NSAIDs。',
          '医生：再避免搬重物两周，并保持良好姿势。',
          '医生：若出现腿无力、胯区麻木或大小便失禁，请立刻就医。',
          '病人：明白了。我会继续锻炼并小心。'
        ].join('\n'),
      },
      summary: {
        english: 'Stable improvement with physio; continue conservative management.',
        malay: 'Peningkatan stabil dengan fisioterapi; teruskan rawatan konservatif.',
        chinese: '物理治疗后稳定好转；继续保守治疗。',
      },
    },
    {
      id: 'c-001',
      dateISO: day(30),
      doctor: 'Dr. Lim',
      title: 'Hypertension review',
      highlights: {
        symptoms: 'Asymptomatic; home BP average 130/80',
        treatments: 'Continue amlodipine 5mg OD',
        caveats: 'Monitor ankle swelling; lifestyle modifications',
      },
      highlightsI18n: {
        symptoms: {
          english: 'Asymptomatic; home BP average 130/80',
          malay: 'Tanpa gejala; bacaan BP di rumah purata 130/80',
          chinese: '无症状；居家血压平均130/80',
        },
        treatments: {
          english: 'Continue amlodipine 5mg OD',
          malay: 'Teruskan amlodipine 5mg sekali sehari',
          chinese: '继续服用氨氯地平5mg每日一次',
        },
        caveats: {
          english: 'Monitor ankle swelling; lifestyle modifications',
          malay: 'Pantau bengkak buku lali; ubah gaya hidup',
          chinese: '监测踝部水肿；进行生活方式调整',
        },
      },
      warnings: [],
      transcript: [
        'Doctor: Let’s review your blood pressure readings this month.',
        'Patient: My home readings are around 128 to 132 over 78 to 82.',
        'Doctor: That is within target. Any side effects like ankle swelling or dizziness?',
        'Patient: Slight ankle swelling in the evenings, but not painful.',
        'Doctor: Continue amlodipine 5 mg once daily. Elevate legs when resting and reduce salt intake.',
        'Doctor: Aim for 150 minutes of moderate exercise per week and maintain weight.',
        'Doctor: If swelling worsens or you feel dizzy, let us know and we can adjust medication.',
        'Patient: Will do. Thank you doctor.'
      ].join('\n'),
      transcripts: {
        english: [
          'Doctor: Let’s review your blood pressure readings this month.',
          'Patient: My home readings are around 128 to 132 over 78 to 82.',
          'Doctor: That is within target. Any side effects like ankle swelling or dizziness?',
          'Patient: Slight ankle swelling in the evenings, but not painful.',
          'Doctor: Continue amlodipine 5 mg once daily. Elevate legs when resting and reduce salt intake.',
          'Doctor: Aim for 150 minutes of moderate exercise per week and maintain weight.',
          'Doctor: If swelling worsens or you feel dizzy, let us know and we can adjust medication.',
          'Patient: Will do. Thank you doctor.'
        ].join('\n'),
        malay: [
          'Doktor: Mari semak bacaan tekanan darah anda bulan ini.',
          'Pesakit: Bacaan di rumah sekitar 128 hingga 132 atas 78 hingga 82.',
          'Doktor: Itu dalam sasaran. Ada kesan sampingan seperti bengkak buku lali atau pening?',
          'Pesakit: Sedikit bengkak pada waktu petang, tetapi tidak sakit.',
          'Doktor: Teruskan amlodipine 5 mg sekali sehari. Tinggikan kaki semasa berehat dan kurangkan garam.',
          'Doktor: Sasarkan 150 minit senaman sederhana seminggu dan kekalkan berat badan.',
          'Doktor: Jika bengkak bertambah atau pening, beritahu kami untuk ubah ubat.',
          'Pesakit: Baik, terima kasih doktor.'
        ].join('\n'),
        chinese: [
          '医生：我们来看一下你本月的血压记录。',
          '病人：家里测量大约在128-132/78-82。',
          '医生：达标了。有踝部肿胀或头晕等副作用吗？',
          '病人：晚上有点踝部肿胀，但不痛。',
          '医生：继续每日一次服用氨氯地平5毫克。休息时抬高下肢并减少盐分摄入。',
          '医生：每周进行150分钟中等强度运动并保持体重。',
          '医生：若肿胀加重或头晕，请告知我们以调整用药。',
          '病人：好的，谢谢医生。'
        ].join('\n'),
      },
      summary: {
        english: 'BP controlled; continue regimen and lifestyle advice.',
        malay: 'Tekanan darah terkawal; teruskan ubat dan nasihat gaya hidup.',
        chinese: '血压受控；继续用药与生活方式建议。',
      },
    },
  ];
}

export function buildEntryFromCurrent(payload: {
  doctor?: string;
  title?: string;
  summary?: any;
  transcript?: any;
}): ConsultationEntry {
  const nowISO = new Date().toISOString();
  const doc = payload.doctor || 'Dr. Tan';
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
