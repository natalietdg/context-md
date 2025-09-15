import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Mic, MicOff, Languages, CheckCircle, Circle, Play, Square, HelpCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { AlertDescription } from './ui/alert';
import DeterministicKaraoke from './DeterministicKaraoke';
import LiveConsentKaraoke from './LiveConsentKaraoke';

export function ConsentRecording({
  language,
  setLanguage,
  consentCompleted,
  onConsentComplete,
  transcript,
  isRecording,
  onRecordingStart,
  onRecordingStop,
  onTranscriptUpdate,
  onNext,
  recordingComplete
}: { language: string; setLanguage: (language: string) => void; consentCompleted: boolean; onConsentComplete: () => void; transcript: any; isRecording: boolean; onRecordingStart: () => void; onRecordingStop: (transcript: any) => void; onTranscriptUpdate: (transcript: any) => void; onNext: () => void; recordingComplete: boolean }) {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [spokenWords, setSpokenWords] = useState(new Set());
  const [isVerifying, setIsVerifying] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [clips, setClips] = useState<{ src: string; speaker: 'Doctor' | 'Patient' | 'Doktor' | 'Pesakit' | '医生' | '病人'; seq: number; text?: string }[]>([]);
  const [clipIndex, setClipIndex] = useState(0);
  const [currentTranscriptLine, setCurrentTranscriptLine] = useState(0);
  const [externalFinal, setExternalFinal] = useState('');
  const [externalInterim, setExternalInterim] = useState('');
  const audioRef = useRef(null);
  const intervalRef: any = useRef(null);
  const [consentCollapsed, setConsentCollapsed] = useState(false);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  // Demo functionality removed

  // const consentScripts: any = {
  //   en: {
  //     title: 'Consent for Medical Recording',
  //     text: 'Under the Personal Data Protection Act, we will record this consultation to ensure accuracy in your medical record. The recording will be securely stored and shared only with relevant medical staff. Do you consent?',
  //     words: ['Under', 'the', 'Personal', 'Data', 'Protection', 'Act,', 'we', 'will', 'record', 'this', 'consultation', 'to', 'ensure', 'accuracy', 'in', 'your', 'medical', 'record.', 'The', 'recording', 'will', 'be', 'securely', 'stored', 'and', 'shared', 'only', 'with', 'relevant', 'medical', 'staff.', 'Do', 'you', 'consent?']
  //   },
  //   ms: {
  //     title: 'Persetujuan untuk Rakaman Perubatan',
  //     text: 'Di bawah Akta Perlindungan Data Peribadi, kami akan merakam konsultasi ini untuk memastikan ketepatan dalam rekod perubatan anda. Rakaman akan disimpan dengan selamat dan dikongsi hanya dengan kakitangan perubatan yang berkaitan. Adakah anda bersetuju?',
  //     words: ['Di', 'bawah', 'Akta', 'Perlindungan', 'Data', 'Peribadi,', 'kami', 'akan', 'merakam', 'konsultasi', 'ini', 'untuk', 'memastikan', 'ketepatan', 'dalam', 'rekod', 'perubatan', 'anda.', 'Rakaman', 'akan', 'disimpan', 'dengan', 'selamat', 'dan', 'dikongsi', 'hanya', 'dengan', 'kakitangan', 'perubatan', 'yang', 'berkaitan.', 'Adakah', 'anda', 'bersetuju?']
  //   },
  //   zh: {
  //     title: '医疗录音同意书',
  //     text: '根据个人数据保护法，我们将录制此次咨询以确保您医疗记录的准确性。录音将被安全存储，仅与相关医疗人员共享。您是否同意？',
  //     words: ['根据', '个人', '数据', '保护法，', '我们', '将', '录制', '此次', '咨询', '以', '确保', '您', '医疗', '记录', '的', '准确性。', '录音', '将被', '安全', '存储，', '仅', '与', '相关', '医疗', '人员', '共享。', '您', '是否', '同意？']
  //   }
  // };

  const consentScripts: any = {
    en: {
      title: "Consent for Medical Recording",
      text: [
        "This consultation will be recorded for quality assurance and training purposes.",
        "Your personal health information will be processed in accordance with the Personal Data Protection Act (PDPA).",
        "The recording and transcript will be stored securely and only accessed by authorized healthcare personnel.",
        "You have the right to request access to, correct, or delete your personal data at any time.",
        "Your data will not be shared with third parties without your explicit consent, except as required by law.",
        "This AI-powered system will analyze the consultation to provide summaries and identify key medical information.",
        "By proceeding, you consent to the recording and processing of your personal health data as described above."].join('\n'),
      words: [
        "This", "consultation", "will", "be", "recorded", "for", "quality", "assurance", "and", "training", "purposes.",
        "Your", "personal", "health", "information", "will", "be", "processed", "in", "accordance", "with", "the", "Personal", "Data", "Protection", "Act", "(PDPA).",
        "The", "recording", "and", "transcript", "will", "be", "stored", "securely", "and", "only", "accessed", "by", "authorized", "healthcare", "personnel.",
        "You", "have", "the", "right", "to", "request", "access", "to,", "correct,", "or", "delete", "your", "personal", "data", "at", "any", "time.",
        "Your", "data", "will", "not", "be", "shared", "with", "third", "parties", "without", "your", "explicit", "consent,", "except", "as", "required", "by", "law.",
        "This", "AI-powered", "system", "will", "analyze", "the", "consultation", "to", "provide", "summaries", "and", "identify", "key", "medical", "information.",
        "By", "proceeding,", "you", "consent", "to", "the", "recording", "and", "processing", "of", "your", "personal", "health", "data", "as", "described", "above."
      ]
    },
    ms: {
      title: "Persetujuan untuk Rakaman Perubatan",
      text: [
        "Perundingan ini akan dirakam untuk tujuan jaminan kualiti dan latihan.",
        "Maklumat kesihatan peribadi anda akan diproses mengikut Akta Perlindungan Data Peribadi (PDPA).",
        "Rakaman dan transkrip akan disimpan dengan selamat dan hanya diakses oleh kakitangan penjagaan kesihatan yang dibenarkan.",
        "Anda mempunyai hak untuk meminta akses, membetulkan, atau memadamkan data peribadi anda pada bila-bila masa.",
        "Data anda tidak akan dikongsi dengan pihak ketiga tanpa persetujuan eksplisit anda, kecuali seperti yang dikehendaki oleh undang-undang.",
        "Sistem berkuasa AI ini akan menganalisis perundingan untuk menyediakan ringkasan dan mengenal pasti maklumat perubatan utama.",
        "Dengan meneruskan, anda bersetuju dengan rakaman dan pemprosesan data kesihatan peribadi anda seperti yang diterangkan di atas."
      ],
      words: [
        "Perundingan", "ini", "akan", "dirakam", "untuk", "tujuan", "jaminan", "kualiti", "dan", "latihan.",
        "Maklumat", "kesihatan", "peribadi", "anda", "akan", "diproses", "mengikut", "Akta", "Perlindungan", "Data", "Peribadi", "(PDPA).",
        "Rakaman", "dan", "transkrip", "akan", "disimpan", "dengan", "selamat", "dan", "hanya", "diakses", "oleh", "kakitangan", "penjagaan", "kesihatan", "yang", "dibenarkan.",
        "Anda", "mempunyai", "hak", "untuk", "meminta", "akses,", "membetulkan,", "atau", "memadamkan", "data", "peribadi", "anda", "pada", "bila-bila", "masa.",
        "Data", "anda", "tidak", "akan", "dikongsi", "dengan", "pihak", "ketiga", "tanpa", "persetujuan", "eksplisit", "anda,", "kecuali", "seperti", "yang", "dikehendaki", "oleh", "undang-undang.",
        "Sistem", "berkuasa", "AI", "ini", "akan", "menganalisis", "perundingan", "untuk", "menyediakan", "ringkasan", "dan", "mengenal", "pasti", "maklumat", "perubatan", "utama.",
        "Dengan", "meneruskan,", "anda", "bersetuju", "dengan", "rakaman", "dan", "pemprosesan", "data", "kesihatan", "peribadi", "anda", "seperti", "yang", "diterangkan", "di", "atas."
      ]
    },
    zh: {
      title: "医疗录音同意书",
      text: ["本次咨询将被录音用于质量保证和培训目的。",
        "您的个人健康信息将根据个人资料保护法（PDPA）进行处理。",
        "录音和记录将被安全存储，只有授权的医疗人员可以访问。",
        "您有权随时要求访问、更正或删除您的个人数据。",
        "未经您的明确同意，您的数据不会与第三方共享，法律要求的除外。",
        "这个AI驱动的系统将分析咨询内容，提供摘要并识别关键医疗信息。",
        "继续进行即表示您同意按上述描述录音和处理您的个人健康数据。"].join('\n'),
      words: [
        "本次", "咨询", "将", "被", "录音", "用于", "质量", "保证", "和", "培训", "目的。",
        "您的", "个人", "健康", "信息", "将", "根据", "个人资料", "保护法", "（PDPA）", "进行", "处理。",
        "录音", "和", "记录", "将", "被", "安全", "存储", "，", "只有", "授权", "的", "医疗", "人员", "可以", "访问。",
        "您", "有权", "随时", "要求", "访问、", "更正、", "或", "删除", "您的", "个人", "数据。",
        "未经", "您的", "明确", "同意，", "您的", "数据", "不会", "与", "第三方", "共享，", "法律要求的除外。",
        "这个", "AI", "驱动的", "系统", "将", "分析", "咨询内容，", "提供", "摘要并识别关键医疗信息。",
        "继续", "进行", "即表示", "您同意","按上述描述录音", "和处理", "您的个人健康数据。"
      ]
    }
  }

  const languageOptions = [
    { value: 'en', label: 'English', flag: '🇺🇸' },
    { value: 'ms', label: 'Bahasa Malaysia', flag: '🇲🇾' },
    { value: 'zh', label: '中文', flag: '🇨🇳' }
  ];

  const currentScript = consentScripts[language];
  const consentLines: string[] = Array.isArray(currentScript.text)
    ? currentScript.text
    : (typeof currentScript.text === 'string' ? currentScript.text.split('\n') : [])

  // Internal WPM defaults for optional auto-advance (not user-exposed)
  const languageWPM: Record<string, number> = { en: 110, ms: 110, zh: 110 };
  const karaokeWPM = languageWPM[language] ?? 110;

  // Mode toggle: 'voice' (default) uses VAD; 'manual' uses deterministic fallback
  const [karaokeMode, setKaraokeMode] = useState<'voice' | 'manual'>('voice');

  // Reset verification when language changes
  useEffect(() => {
    setCurrentWordIndex(0);
    setSpokenWords(new Set());
    setIsVerifying(false);
    setCurrentTranscriptLine(0);
    setExternalFinal('');
    setExternalInterim('');
  }, [language]);

  // Auto-collapse consent section once completed
  useEffect(() => {
    if (consentCompleted) {
      setConsentCollapsed(true);
    }
  }, [consentCompleted]);

  // No audio clips needed for demo removal
  useEffect(() => {
    setClips([]);
  }, []);

  // Load consultation clips dynamically from script-wav/consultations/{language}
  useEffect(() => {
    try {
      // Make extension matching case-insensitive (handles .WAV/.MP3 etc.)
      const audioCtx = (require as any).context('../script-wav/consultations', true, /\.(mp3|wav)$/i);
      const jsonCtx = (require as any).context('../script-wav/consultations', true, /\.(json)$/i);
      const manifestKey = `./${language}/${language}.json`;
      const hasManifest = jsonCtx.keys().includes(manifestKey);
      let built: { src: string; speaker: any; seq: number; text?: string }[] = [];

      // Helper to resolve an audio key in a case-insensitive way within the same folder
      const resolveAudioKey = (targetPath: string) => {
        const keys: string[] = audioCtx.keys();
        // Try exact first
        if (keys.includes(targetPath)) return targetPath;
        // Fallback: case-insensitive match
        const lower = targetPath.toLowerCase();
        const found = keys.find(k => k.toLowerCase() === lower);
        if (found) return found;
        // Fallback: match by basename within same folder
        const dir = targetPath.substring(0, targetPath.lastIndexOf('/') + 1);
        const baseLower = targetPath.substring(targetPath.lastIndexOf('/') + 1).toLowerCase();
        const inDir = keys.filter(k => k.startsWith(dir));
        const byBase = inDir.find(k => k.substring(k.lastIndexOf('/') + 1).toLowerCase() === baseLower);
        return byBase || null;
      };

      if (hasManifest) {
        const manifest = jsonCtx(manifestKey);
        const clipsFromManifest = (manifest?.clips || []) as Array<{ seq: number; file: string; speaker?: string; text?: string }>;
        built = clipsFromManifest.map((c) => {
          const desiredKey = `./${language}/${c.file}`;
          const key = resolveAudioKey(desiredKey);
          if (!key) return null;
          // localize speaker if absent in manifest
          let speaker: any = c.speaker;
          if (!speaker) {
            const role = /-(dr|pt)-/i.test(c.file) ? (c.file.match(/-(dr|pt)-/i)![1].toLowerCase()) : 'dr';
            speaker = role === 'dr'
              ? (language === 'ms' ? 'Doktor' : language === 'zh' ? '医生' : 'Doctor')
              : (language === 'ms' ? 'Pesakit' : language === 'zh' ? '病人' : 'Patient');
          }
          return { src: audioCtx(key), speaker, seq: c.seq, text: c.text };
        }).filter(Boolean) as any[];
        built.sort((a, b) => a.seq - b.seq);
      } else {
        // Fallback: discover and parse by filename
        const langDir = `./${language}/`;
        const keys = audioCtx.keys().filter((k: string) => k.startsWith(langDir));
        const parsed = keys.map((k: string) => {
          const base = k.split('/').pop() || '';
          const m = base.match(/^(en|ms|zh)-(dr|pt)-(\d+)\.(mp3|wav)$/i);
          if (!m) return null;
          const [, , role, num] = m;
          const speaker = (role.toLowerCase() === 'dr')
            ? (language === 'ms' ? 'Doktor' : language === 'zh' ? '医生' : 'Doctor')
            : (language === 'ms' ? 'Pesakit' : language === 'zh' ? '病人' : 'Patient');
          return { src: audioCtx(k), speaker, seq: parseInt(num, 10) };
        }).filter(Boolean) as { src: string; speaker: any; seq: number }[];
        parsed.sort((a, b) => a.seq - b.seq);
        built = parsed;
      }

      // Fallback to a single file at src/script-wav/{language}.wav if no clips built
      if (built.length === 0) {
        try {
          const rootAudioCtx = (require as any).context('../script-wav', false, /\.(mp3|wav)$/i);
          const fallbackKey = `./${language}.wav`;
          // Try .wav and .mp3 in a case-insensitive way
          const fallbackCandidates = [
            fallbackKey,
            `./${language}.mp3`,
          ];
          const rootKeys = rootAudioCtx.keys();
          const foundFallback = fallbackCandidates.find(c => rootKeys.includes(c) || rootKeys.map((k: any) => k.toLowerCase()).includes(c.toLowerCase()));
          if (foundFallback) {
            const single = rootAudioCtx(foundFallback);
            built = [{ src: single, speaker: '', seq: 1 }];
          }
        } catch { }
      }

      try { console.log('[Playback] built clips', { language, count: built.length, built }); } catch {}
      setClips(built);
      setClipIndex(0);
    } catch (e) {
      setClips([]);
      setClipIndex(0);
    }
  }, [language]);

  // Clean up intervals on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Simulate karaoke verification
  const startVerification = () => {
    setIsVerifying(true);
    setCurrentWordIndex(0);
    setSpokenWords(new Set());

    // Simulate word-by-word progression
    const interval = setInterval(() => {
      setCurrentWordIndex(prev => {
        const nextIndex = prev + 1;
        setSpokenWords(current => new Set([...current, prev]));

        if (nextIndex >= currentScript.words.length) {
          clearInterval(interval);
          setIsVerifying(false);
          onConsentComplete();
          return prev;
        }
        return nextIndex;
      });
    }, 800);
  };

  // Handle consultation playback (sequential playlist)
  const handlePlaySampleConsultation = () => {
    const audio = audioRef.current as HTMLAudioElement | null;
    try { console.log('[Playback] audioRef', { hasAudioEl: !!audio }); } catch {}
    if (!audio) return;

    // Block playback until consent is completed
    if (!consentCompleted) {
      try { console.warn('Playback blocked: consent not completed'); } catch {}
      return;
    }

    const stopPlayback = () => {
      setIsPlayingAudio(false);
      try { audio.pause(); audio.currentTime = 0; } catch { }
      setClipIndex(0);
      setCurrentTranscriptLine(0);
      if (intervalRef.current) clearInterval(intervalRef.current);
      setExternalFinal('');
      setExternalInterim('');
    };

    if (isPlayingAudio) {
      stopPlayback();
      return;
    }

    try { console.log('[Playback] click PlaySample', { clipCount: clips.length }); } catch {}
    if (clips.length === 0) {
      // No audio available; use mock transcript instead.
      const mockTranscript = [
        { speaker: "Doctor", text: "How are you feeling today?" },
        { speaker: "Patient", text: "I have been experiencing headaches and dizziness." }
      ];
      onRecordingStop(mockTranscript);
      return;
    }

    // Begin sequential playback of clips (decoupled from consent/mic recording)
    setIsPlayingAudio(true);
    setConsentCollapsed(true);
    setExternalFinal('');
    setExternalInterim('');
    setCurrentTranscriptLine(0);

    // Transcribe a clip via a pluggable ASR endpoint. If not configured, no-op.
    // const transcribeClip = async (src: string): Promise<string | null> => {
    //   const endpoint = (import.meta as any)?.env?.VITE_ASR_ENDPOINT;
    //   if (!endpoint) {
    //     try { console.warn('[ASR] VITE_ASR_ENDPOINT not set; skipping transcription'); } catch {}
    //     return null;
    //   }
    //   try {
    //     // Fetch audio and send as multipart/form-data to avoid CORS fetch-from-server issues
    //     const res = await fetch(src);
    //     const blob = await res.blob();
    //     const form = new FormData();
    //     form.append('file', blob, src.split('/').pop() || 'audio');
    //     const asr = await fetch(endpoint, { method: 'POST', body: form });
    //     if (!asr.ok) throw new Error(`ASR failed: ${asr.status}`);
    //     const data = await asr.json();
    //     // Expect { text: string }
    //     return data?.text ?? null;
    //   } catch (e) {
    //     console.error('[ASR] transcription error', e);
    //     return null;
    //   }
    // };

    const playAtIndex = (i: number) => {
      const clip = clips[i];
      if (!clip) { finish(); return; }
      try { console.log('[Playback] playAtIndex', { i, src: clip.src }); } catch {}
      audio.src = clip.src;
      audio.onended = () => {
        const next = i + 1;
        setClipIndex(next);
        playAtIndex(next);
      };
      audio.onplay = () => {
        // Kick off ASR; fall back to empty text if not available
        (async () => {
          const text = clip.text;
          // const text = await transcribeClip(clip.src);
          const payload = {
            speaker: (clip as any).speaker || '',
            text: text ?? '',
            timestamp: new Date(),
          };
          try { console.log('[Playback] onTranscriptUpdate (ASR)', payload); } catch {}
          onTranscriptUpdate(payload);
        })();
      };
      audio.play().catch((err) => {
        console.error('Audio play failed:', err, { src: clip.src });
      });
    };

    const finish = () => {
      setIsPlayingAudio(false);
      try { audio.pause(); } catch { }
      const mockTranscript = [
        { speaker: "Doctor", text: "How are you feeling today?" },
        { speaker: "Patient", text: "I have been experiencing headaches and dizziness." }
      ];
      onRecordingStop(mockTranscript);
    };

    setClipIndex(0);
    playAtIndex(0);
  };

  const CombinedLanguageConsentPreview: React.FC<{ completedOverride?: boolean }> = ({ completedOverride }) => {
    const [consentCompleted, setConsentCompleted] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    const isDone = !!completedOverride || consentCompleted;

    // const consentScripts = {
    //   '🇺🇸 English': {
    //     title: 'PDPA Consent Script',
    //     words: [
    //       'Your', 'personal', 'data', 'will', 'be', 'collected', 'and', 'processed', 'for', 'medical',
    //       'consultation', 'purposes.', 'Audio', 'recordings', 'will', 'be', 'transcribed', 'and',
    //       'analyzed', 'by', 'AI', 'systems', 'to', 'provide', 'medical', 'insights.', 'You', 'have',
    //       'the', 'right', 'to', 'access,', 'correct,', 'or', 'delete', 'your', 'personal', 'data',
    //       'at', 'any', 'time.'
    //     ]
    //   },
    //   '🇲🇾 Bahasa Melayu': {
    //     title: 'Skrip Persetujuan PDPA',
    //     words: [
    //       'Data', 'peribadi', 'anda', 'akan', 'dikumpul', 'dan', 'diproses', 'untuk', 'tujuan',
    //       'konsultasi', 'perubatan.', 'Rakaman', 'audio', 'akan', 'ditranskrip', 'dan', 'dianalisis',
    //       'oleh', 'sistem', 'AI', 'untuk', 'memberikan', 'pandangan', 'perubatan.'
    //     ]
    //   },
    //   '🇨🇳 中文': {
    //     title: 'PDPA 同意书',
    //     words: [
    //       '您的', '个人', '数据', '将被', '收集', '和', '处理', '用于', '医疗', '咨询', '目的。',
    //       '音频', '录音', '将被', '转录', '并由', 'AI', '系统', '分析', '以', '提供', '医疗', '见解。'
    //     ]
    //   }
    // };

    // const currentScript = consentScripts[language] || consentScripts['🇺🇸 English'];

    // const getWordStatus = (index: number) => {
    //   if (!isVerifying) return 'pending';
    //   if (index < currentWordIndex) return 'completed';
    //   if (index === currentWordIndex) return 'current';
    //   return 'pending';
    // };

    const startVerification = () => {
      setIsVerifying(true);
      setCurrentWordIndex(0);
      setConsentCompleted(false);
    };

    useEffect(() => {
      if (!isVerifying) return;

      const interval = setInterval(() => {
        setCurrentWordIndex(prev => {
          if (prev >= currentScript.words.length - 1) {
            setIsVerifying(false);
            setConsentCompleted(true);
            return prev;
          }
          return prev + 1;
        });
      }, 300);

      return () => clearInterval(interval);
    }, [isVerifying, currentScript.words.length]);

    const renderSeparateRowApproach = () => {
      if (isPlayingAudio) {
        return (
          <Card className="border-slate-200 bg-slate-50">
            <CardHeader>
              <CardTitle>Consent Verification</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-slate-600">Consent verification is paused during consultation playback.</div>
            </CardContent>
          </Card>
        );
      }

      return (
        <Card className={
          isDone
            ? 'border-green-300 bg-green-50'
            : 'border-slate-200'
        }>
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Languages className="h-5 w-5" />
                <span>{currentScript.title}</span>

                <div className="relative group">
                  <HelpCircle className="h-5 w-5 text-gray-400 hover:text-gray-600 cursor-help" />
                  <div className="absolute right-0 top-6 w-80 bg-white border border-gray-200 rounded-lg shadow-lg p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                    <h4 className="font-medium text-gray-900 mb-2">How to use:</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Change the language to see different scripts</li>
                      <li>• Click "Start Live Verification" to see the karaoke effect</li>
                      <li>• Watch words highlight as they are "spoken"</li>
                      <li>• Consent checkbox enables after completion</li>
                    </ul>
                  </div>
                </div>
            </CardTitle>

            {isDone && (
              <Badge className="bg-green-100 text-green-800 border-green-300">
                <CheckCircle className="h-4 w-4 mr-1" />
                Consent Script Completed
              </Badge>
            )}
          </div>

          {/* Language selector as a separate row */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-slate-600">Language:</span>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languageOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center space-x-2">
                      <span>{option.flag}</span>
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Mode:</span>
            <div className="inline-flex rounded-md overflow-hidden border">
              <button
                type="button"
                className={`px-3 py-1 text-sm ${karaokeMode === 'voice' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-slate-50'}`}
                onClick={() => setKaraokeMode('voice')}
              >
                Live Voice Check
              </button>
              <button
                type="button"
                className={`px-3 py-1 text-sm ${karaokeMode === 'manual' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-slate-50'}`}
                onClick={() => setKaraokeMode('manual')}
              >
                Auto-Read
              </button>
            </div>
          </div>

          {karaokeMode === 'voice' ? (
            <LiveConsentKaraoke
              className="mt-1"
              words={currentScript.words}
              lines={consentLines}
              language={language === 'ms' ? 'ms-MY' : (language === 'zh') ? 'zh-CN' : 'en-US'}
              sentenceMode={true}
              sentenceThreshold={0.7}
              externalFinal={externalFinal}
              externalInterim={externalInterim}
              ignoreBracketed={true}
              requirePDPAKeyword={true}
              onCompleted={() => {
                try { setConsentCompleted(true); } catch { }
                onConsentComplete();
              }}
            />
          ) : (
            <DeterministicKaraoke
              title={currentScript.title}
              words={currentScript.words}
              // Provide internal WPM per language to enable auto-advance; comment out to force manual only
              wpm={karaokeWPM}
              language={language as 'en' | 'ms' | 'zh'}
              onCompleted={() => {
                try { setConsentCompleted(true); } catch { }
                onConsentComplete();
              }}
            />
          )}
        </CardContent>
      </Card>
    )
  };

    return (
      <div className="max-w-4xl mx-auto px-3 py-4 sm:p-6 space-y-6">
        {/* <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Language Selection & Consent Script
          </h1>
        </div> */}

        {renderSeparateRowApproach()}
      </div>
    );
  };


  const getWordStatus = (index: any) => {
    if (spokenWords.has(index)) return 'completed';
    if (index === currentWordIndex && isVerifying) return 'current';
    return 'pending';
  };

  const formatTimestamp = (timestamp: any) => {
    return timestamp.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Auto-scroll transcript panel to bottom on new entries
  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    try {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } catch {
      el.scrollTop = el.scrollHeight;
    }
  }, [transcript.length]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Consent Area */}
      <div className="lg:col-span-2 space-y-6">
        {/* Consent Section (single collapsible card) */}
        <Card className={consentCompleted ? "border-green-300 bg-green-50" : undefined}>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {consentCompleted && <CheckCircle className="h-5 w-5 text-green-600" />}
              Step 1: Consent {consentCompleted ? 'Completed' : 'Script'}
            </CardTitle>
            <div className="flex items-center gap-2">
              {consentCompleted && (
                <Badge className="bg-green-100 text-green-800 border-green-300">Completed</Badge>
              )}
              <Button
                variant={consentCollapsed ? "outline" : "ghost"}
                size="sm"
                className="h-fit inline-flex items-center justify-center w-fit whitespace-nowrap shrink-0 text-xs font-medium px-2 py-0.5"
                onClick={() => setConsentCollapsed((v) => !v)}
              >
                {consentCollapsed ? (
                  <span className="inline-flex items-center gap-1"><ChevronDown className="h-3 w-3" /> Expand</span>
                ) : (
                  <span className="inline-flex items-center gap-1"><ChevronUp className="h-3 w-3" /> Minimize</span>
                )}
              </Button>
            </div>
          </CardHeader>
          {!consentCollapsed && (
            <CardContent className="space-y-2">
              {/* Language Selection */}
              <CombinedLanguageConsentPreview completedOverride={!!consentCompleted} />
            </CardContent>
          )}
        </Card>
        {/* Recording Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Consultation Playback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-4">
              <p className="text-sm text-slate-600">
                Play a consultation in {languageOptions.find(l => l.value === language)?.label}
              </p>

              <Button
                size="lg"
                onClick={handlePlaySampleConsultation}
                disabled={!consentCompleted}
                title={!consentCompleted ? 'Complete consent to enable playback' : undefined}
                className={`w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full transition-all duration-300 ${
                  !consentCompleted
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : isPlayingAudio
                      ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                      : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isPlayingAudio ? (
                  <div className="flex flex-col items-center">
                    <Square className="h-8 w-8 mb-2" />
                    <span className="text-sm">Stop</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Play className="h-8 w-8 mb-2" />
                    <span className="text-sm">Play</span>
                  </div>
                )}
              </Button>
            </div>

            {isPlayingAudio && (
              <div className="text-center">
                <div className="flex items-center justify-center space-x-2 text-blue-600">
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                  <span>Playing consultation...</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Live Transcript Sidebar */}
      {(isPlayingAudio || transcript.length > 0) && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Live Transcript</CardTitle>
              <p className="text-sm text-slate-600">
                Real-time transcript synchronized with audio playback
              </p>
            </CardHeader>
            <CardContent>
              <div ref={transcriptRef} className="h-64 sm:h-72 md:h-80 lg:h-96 overflow-y-auto space-y-3 bg-slate-50 p-4 rounded-lg">
                {transcript.length === 0 ? (
                  <div className="text-center text-slate-500 py-8">
                    <Mic className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Transcript will appear here...</p>
                  </div>
                ) : (
                  transcript.map((line: any, index: any) => {
                    return (
                      <div key={index} className="animate-fade-in">
                        <div className="flex items-start space-x-2">
                          <Badge
                            variant={line.speaker === 'Doctor' || line.speaker === 'Doktor' || line.speaker === '医生' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {line.speaker}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            {formatTimestamp(new Date())}
                          </span>
                        </div>
                        <p className="mt-1 text-slate-700">{line.text}</p>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>

      {recordingComplete && (
        <div className="text-center">
          <Button onClick={onNext} className="bg-green-600 hover:bg-green-700 w-full">
            Complete Consultation
          </Button>
        </div>
      )}
      </div>
      )}
      {/* Hidden audio element for consultation playback */}
      <audio ref={audioRef as any} className="hidden" preload="auto" />
    </div>
  );
}