import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Calendar, ChevronDown, ChevronUp, AlertTriangle, User, CheckCircle } from 'lucide-react';
import { ConsultationEntry, mockHistory } from '../utils/history';

export default function PatientHistory({ language }: { language?: string }) {
  const [entries, setEntries] = useState<ConsultationEntry[]>(() => mockHistory());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const onSaved = (e: Event) => {
      const ce = e as CustomEvent<ConsultationEntry>;
      const entry = ce.detail;
      if (!entry) return;
      setEntries((prev) => [entry, ...prev].sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime()));
      // Keep collapsed by default after save so summary/boxes show first
      setExpanded((prev) => ({ ...prev, [entry.id]: false }));
    };
    window.addEventListener('consultation:saved', onSaved as EventListener);
    return () => window.removeEventListener('consultation:saved', onSaved as EventListener);
  }, []);

  const items = useMemo(() => entries.sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime()), [entries]);

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const summaryKey = useMemo(() => {
    const lang = (language || 'en').toLowerCase();
    if (lang.startsWith('zh') || lang === 'cn' || lang === 'zh-cn' || lang === 'zh_sg') return 'chinese' as const;
    if (lang.startsWith('ms') || lang.startsWith('id') || lang.includes('malay')) return 'malay' as const;
    return 'english' as const;
  }, [language]);

  // --- Transcript Highlighter ---
  const highlightMap = useMemo(() => {
    const en = [
      // Medications
      { label: 'med', pattern: /(paracetamol|nsai?ds?|amlodipine|lozenges|physiotherapy|ace inhibitors?|enalapril|lisinopril|ramipril)/gi },
      // Symptoms
      { label: 'sym', pattern: /(fever|sore throat|cough|runny nose|breathing|ankle swelling|dizziness|back pain|numbness|weakness|headache|achy|aches|tired|fatigue|fatigued)/gi },
      // Diagnoses
      { label: 'dx',  pattern: /(viral upper respiratory tract infection|hypertension)/gi },
      // Caveats/Cautions
      { label: 'cav', pattern: /(heavy lifting|red flags|renal impairment|gastric|ulcer|gerd|reflux)/gi },
      // Vitals/Exam findings
      { label: 'vit', pattern: /(\b\d{2,3}(?:\.\d)?°c\b|\b\d{2,3}\/\d{2,3}\b|throat is red|tonsillar swelling|no pus|erythema|swollen)/gi },
    ];
    const ms = [
      { label: 'med', pattern: /(parasetamol|nsaid|fisioterapi|amlodipine)/gi },
      { label: 'sym', pattern: /(demam|sakit tekak|batuk|hingus|sesak nafas|bengkak buku lali|pening|sakit belakang|kebas|lemah|sengal|letih|keletihan)/gi },
      { label: 'dx',  pattern: /(jangkitan (saluran )?pernafasan atas|hipertensi)/gi },
      { label: 'cav', pattern: /(angkat berat|tanda amaran|buah pinggang|gastrik|ulser|refluks)/gi },
      { label: 'vit', pattern: /(\b\d{2,3}(?:\.\d)?°c\b|tekak merah|bengkak tonsil|tiada nanah)/gi },
    ];
    const zh = [
      { label: 'med', pattern: /(对乙酰氨基酚|扑热息痛|氨氯地平|含片|物理治疗|ACE抑制剂)/g },
      { label: 'sym', pattern: /(发烧|喉咙痛|咳嗽|流鼻涕|呼吸(困难)?|踝部水肿|头晕|下背痛|麻木|无力|酸痛|疲倦|疲劳)/g },
      { label: 'dx',  pattern: /(上呼吸道(病毒)?感染|高血压)/g },
      { label: 'cav', pattern: /(搬重物|警示征象|肾(功能)?(受损)?|胃(病)?|溃疡|反流)/g },
      { label: 'vit', pattern: /(\b\d{2,3}(?:\.\d)?°C\b|咽部充血|扁桃体(轻度)?肿大|无脓|没有脓)/g },
    ];
    return { english: en, malay: ms, chinese: zh } as const;
  }, []);

  const escapeHtml = (s: string) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const highlightTranscript = (text: string, lang: 'english' | 'malay' | 'chinese') => {
    let out = escapeHtml(text);
    const rules = highlightMap[lang] || [];
    for (const r of rules) {
      const cls = r.label === 'med' ? 'bg-emerald-100 text-emerald-900'
        : r.label === 'sym' ? 'bg-amber-100 text-amber-900'
        : r.label === 'dx'  ? 'bg-blue-100 text-blue-900'
        : r.label === 'vit' ? 'bg-violet-100 text-violet-900'
        : 'bg-rose-100 text-rose-900';
      out = out.replace(r.pattern, (m) => `<span class="px-1 rounded ${cls}">${m}</span>`);
    }
    return out;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <User className="h-6 w-6 text-blue-600" />
        <h2 className="text-slate-900">Patient History</h2>
        <Badge variant="outline" className="ml-2 border-slate-300">{items.length} consultations</Badge>
      </div>
      {/* Consent recorded label (most recent entry) */}
      {items.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span>
            Consent recorded: {formatDateTime(items[0].dateISO)}
          </span>
        </div>
      )}

      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />
        <div className="space-y-4">
          {items.map((it) => {
            const isOpen = !!expanded[it.id];
            const isLatest = items.length > 0 && it.id === items[0].id;
            const hasConflicts = !!(((it.warnings && it.warnings.length > 0) || (it as any).warningsI18n));
            return (
              <div key={it.id} className="relative pl-10">
                <div className={"absolute left-3 top-2 h-3 w-3 rounded-full ring-4 ring-white border " + (isLatest ? 'bg-blue-600 border-blue-300' : 'bg-slate-400 border-slate-300')} />
                <Card className={(isLatest ? 'border-blue-300 ring-1 ring-blue-200 shadow-sm bg-white' : 'border-slate-200 bg-slate-50') }>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-slate-900 text-base flex items-center gap-2">
                          {it.title}
                          {isLatest && (<span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">Current</span>)}
                          {hasConflicts && (<span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">Conflicts</span>)}
                        </CardTitle>
                        <div className="mt-1 text-sm text-slate-600 flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDateTime(it.dateISO)}</span>
                          <span>•</span>
                          <span>{it.doctor}</span>
                        </div>
                      </div>
                      <button
                        className="text-sm inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-slate-50"
                        onClick={() => setExpanded((prev) => ({ ...prev, [it.id]: !isOpen }))}
                        aria-expanded={isOpen}
                      >
                        {isOpen ? (<><ChevronUp className="h-4 w-4" /> Collapse</>) : (<><ChevronDown className="h-4 w-4" /> Expand</>)}
                      </button>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="p-3 rounded border bg-slate-50">
                        <div className="text-xs text-slate-500 mb-1">Symptoms</div>
                        <div className="space-y-1">
                          <div className="text-sm text-slate-800 whitespace-pre-wrap">{it.highlightsI18n?.symptoms?.english || it.highlights?.symptoms || '—'}</div>
                          {summaryKey !== 'english' && (
                            <div className="text-sm text-slate-800 whitespace-pre-wrap">
                              {summaryKey === 'malay' ? (it.highlightsI18n?.symptoms?.malay || '—') : (it.highlightsI18n?.symptoms?.chinese || '—')}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="p-3 rounded border bg-slate-50">
                        <div className="text-xs text-slate-500 mb-1">Treatments</div>
                        <div className="space-y-1">
                          <div className="text-sm text-slate-800 whitespace-pre-wrap">{it.highlightsI18n?.treatments?.english || it.highlights?.treatments || '—'}</div>
                          {summaryKey !== 'english' && (
                            <div className="text-sm text-slate-800 whitespace-pre-wrap">
                              {summaryKey === 'malay' ? (it.highlightsI18n?.treatments?.malay || '—') : (it.highlightsI18n?.treatments?.chinese || '—')}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="p-3 rounded border bg-slate-50">
                        <div className="text-xs text-slate-500 mb-1">Caveats</div>
                        <div className="space-y-1">
                          <div className="text-sm text-slate-800 whitespace-pre-wrap">{it.highlightsI18n?.caveats?.english || it.highlights?.caveats || '—'}</div>
                          {summaryKey !== 'english' && (
                            <div className="text-sm text-slate-800 whitespace-pre-wrap">
                              {summaryKey === 'malay' ? (it.highlightsI18n?.caveats?.malay || '—') : (it.highlightsI18n?.caveats?.chinese || '—')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {(((it.warnings && it.warnings.length > 0) || (it as any).warningsI18n)) && (
                      <Alert className="border-amber-200 bg-amber-50">
                        <AlertDescription className="text-amber-900">
                          <strong className="inline-flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Conflicts</strong>
                          {(() => {
                            const wi = (it as any).warningsI18n as { english?: string[]; malay?: string[]; chinese?: string[] } | undefined;
                            const english = wi?.english || it.warnings || [];
                            const selected = summaryKey === 'malay' ? (wi?.malay || []) : (summaryKey === 'chinese' ? (wi?.chinese || []) : []);
                            const rows = english.length > 0 ? english : [];
                            return (
                              <ul className="list-disc pl-6 mt-1 space-y-1">
                                {rows.map((enW, i) => (
                                  <li key={i}>
                                    <div className="whitespace-pre-wrap">{enW}</div>
                                    {summaryKey !== 'english' && selected[i] && (
                                      <div className="whitespace-pre-wrap">{selected[i]}</div>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            );
                          })()}
                        </AlertDescription>
                      </Alert>
                    )}

                    {isOpen && (
                      <div className="pt-3 border-t space-y-3">
                        <div>
                          <h4 className="text-sm text-slate-900 mb-1">Full Transcript</h4>
                          {(() => {
                            const t = (it as any).transcripts?.[summaryKey] || (summaryKey !== 'english' ? (it as any).transcripts?.english : undefined) || it.transcript;
                            const html = t ? highlightTranscript(t, summaryKey) : '';
                            return (
                              <div
                                className="p-3 bg-white rounded border text-sm text-slate-800 whitespace-pre-wrap max-h-64 overflow-auto"
                                dangerouslySetInnerHTML={{ __html: html || '—' }}
                              />
                            );
                          })()}
                        </div>
                        {(() => {
                          const en = it.summary?.english || '';
                          const sel = summaryKey === 'malay' ? (it.summary?.malay || '') : summaryKey === 'chinese' ? (it.summary?.chinese || '') : '';
                          const combined = summaryKey === 'english' ? en : [en, sel].filter(Boolean).join('\n\n');
                          const title = summaryKey === 'english' ? 'Summary (EN)' : summaryKey === 'malay' ? 'Summary (EN + MS)' : 'Summary (EN + ZH)';
                          return (
                            <div className="p-3 rounded border bg-white ring-2 ring-blue-500">
                              <div className="text-xs text-slate-500 mb-1">{title}</div>
                              <div className="text-sm text-slate-800 whitespace-pre-wrap">{combined || '—'}</div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
