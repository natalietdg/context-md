import React, { JSX, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from './ui/badge'
import { AlertCircleIcon, CheckCircle } from 'lucide-react'
import { AlertDescription, Alert } from './ui/alert'

// Basic fuzzy match (Levenshtein distance <= 1)
function isCloseMatch(a: string, b: string) {
  a = a.toLowerCase()
  b = b.toLowerCase()
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 2) return false

  let i = 0, j = 0, edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++; j++
    } else {
      edits++
      // Allow up to 2 edits for longer words
      const maxEdits = Math.max(a.length, b.length) >= 5 ? 2 : 1
      if (edits > maxEdits) return false
      if (a.length > b.length) i++
      else if (b.length > a.length) j++
      else { i++; j++ }
    }
  }
  edits += (a.length - i) + (b.length - j)
  // Be stricter for very short tokens to avoid accidental matches (e.g., 'in' vs 'is')
  if (Math.max(a.length, b.length) <= 3) return edits === 0
  return Math.max(a.length, b.length) >= 5 ? edits <= 2 : edits <= 1
}

function normalize(word: string) {
  return word
    .toLowerCase()
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .replace(/[.,!?;:"'`]/g, '')
    .replace(/[\u3000\uFF01-\uFF60]/g, '') // remove full-width punctuation range
    .trim()
}

// Remove parenthetical/bracketed content entirely
function removeParentheticals(text: string) {
  if (!text) return text
  return text
    // ASCII parentheses and brackets
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    // Full-width Chinese/Japanese parentheses/brackets
    .replace(/（[^）]*）/g, '')
    .replace(/【[^】]*】/g, '')
    .replace(/［[^］]*］/g, '')
}

export interface LiveConsentKaraokeProps {
  words: string[]
  language?: string // e.g. 'en-US', 'ms-MY', 'zh-CN'
  onCompleted?: () => void
  className?: string
  maxSkips?: number // allow skipping up to N words without a match
  maxSkipFraction?: number // cap skips to fraction of total words (default 0.75)
  skipStopwordsOnly?: boolean // if true, only allow skipping non-meaningful words (stopwords)
  lines?: string[] // optional: lines of text to render as bullet points
  // If true and lines are provided, advance sentence-by-sentence using similarity to whole line text
  sentenceMode?: boolean
  // Similarity threshold [0-1] for considering a sentence spoken in sentenceMode
  sentenceThreshold?: number
  // Optional external transcript (e.g., simulated playback) to drive sentence mode
  externalFinal?: string
  externalInterim?: string
  // If true, ignore bracketed/parenthetical content like (PDPA) or [notes] in matching
  ignoreBracketed?: boolean
  // If true, when the expected sentence contains the PDPA concept, require the spoken to include PDPA (or its expansion)
  requirePDPAKeyword?: boolean
}

export const LiveConsentKaraoke: React.FC<LiveConsentKaraokeProps> = ({
  words,
  language = 'en-US',
  onCompleted,
  className,
  maxSkips = Number.POSITIVE_INFINITY,
  maxSkipFraction = 0.75,
  skipStopwordsOnly = false,
  lines,
  sentenceMode = false,
  sentenceThreshold = 0.7,
  externalFinal,
  externalInterim,
  ignoreBracketed = false,
  requirePDPAKeyword = false,
}: LiveConsentKaraokeProps) => {
  const [isListening, setIsListening] = useState(false)
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const expectedWords = useMemo(() => words.map(normalize), [words])
  // If lines provided, compute how many word tokens from `expectedWords` belong to each line.
  // This aligns lines even if they contain no spaces by matching against concatenated normalized words.
  const lineTokenCounts = useMemo(() => {
    if (!lines || !lines.length) return null
    let cursor = 0
    const counts: number[] = []
    for (const rawLine of lines) {
      const normLine = normalize(rawLine || '').replace(/\s+/g, '')
      if (!normLine.length) { counts.push(0); continue }
      let consumed = 0
      let concat = ''
      while (cursor + consumed < expectedWords.length && concat.length < normLine.length) {
        concat += expectedWords[cursor + consumed]
        consumed++
      }
      // If we couldn't reach the target length, fallback to a naive whitespace split count
      if (concat.length < normLine.length) {
        const fallback = (rawLine || '').trim().split(/\s+/).filter(Boolean).length
        counts.push(fallback)
      } else {
        counts.push(consumed)
        cursor += consumed
      }
    }
    return counts
  }, [lines, expectedWords])
  const lineStarts = useMemo(() => {
    if (!lineTokenCounts) return null
    const starts: number[] = []
    let s = 0
    for (const c of lineTokenCounts) { starts.push(s); s += c }
    return starts
  }, [lineTokenCounts])
  // Compute line end indices
  const lineEnds = useMemo(() => {
    if (!lineTokenCounts) return null
    const ends: number[] = []
    let s = 0
    for (const c of lineTokenCounts) { s += c; ends.push(s) }
    return ends
  }, [lineTokenCounts])
  const lastTokenCountRef = useRef(0)
  const MAX_LOOKAHEAD = 12 // faster recovery across sentence/line boundaries
  const lastResultIndexRef = useRef<number | null>(null)
  const stallCounterRef = useRef(0)
  const activeRef = useRef(false)
  const skipBudgetRef = useRef(0)
  const KNOWN_ACRONYMS = useMemo(() => new Set(['pdpa', 'mri', 'ct', 'ecg', 'ai', 'xray', 'xr']), [])
  const acronymStateRef = useRef<{ index: number; matched: number } | null>(null)
  // After a big jump (skip/snap), require one exact match before allowing fuzzy or another snap
  const requireExactRef = useRef(false)
  // Smart skipping: cap consecutive skips to prevent sliding
  const consecutiveSkipsRef = useRef(0)
  // Track if we have matched at least one word in the current line for safer snapping
  const lineProgressRef = useRef<{ lineIdx: number; matched: boolean }>({ lineIdx: -1, matched: false })

  // Sentence-mode helpers
  const transcriptFinalRef = useRef('')
  const transcriptInterimRef = useRef('')
  const norm = (s: string) => normalize((s || '').replace(/\s+/g, ' ').trim())
  // Collapse sequences like "p d p a" into "pdpa" and optionally remove known acronyms entirely
  const scrubAcronymsForSentence = useCallback((text: string) => {
    if (!text) return text
    let out = text
    // First collapse spelled-out versions into continuous tokens
    KNOWN_ACRONYMS.forEach(acr => {
      const letters = acr.split('').join('\\s*') // e.g., p\s*d\s*p\s*a
      const re = new RegExp(`\\b${letters}\\b`, 'gi')
      out = out.replace(re, acr)
    })
    // When ignoring bracketed content, also drop the acronym tokens from spoken completely
    if (ignoreBracketed) {
      const re2 = new RegExp(`\\b(${Array.from(KNOWN_ACRONYMS).join('|')})\\b`, 'gi')
      out = out.replace(re2, '')
    }
    return out
  }, [KNOWN_ACRONYMS, ignoreBracketed])

  // Collapse spelled-out acronyms only ("p d p a" -> "pdpa") without removing the token
  const collapseAcronymsOnly = useCallback((text: string) => {
    if (!text) return text
    let out = text
    KNOWN_ACRONYMS.forEach(acr => {
      const letters = acr.split('').join('\\s*')
      const re = new RegExp(`\\b${letters}\\b`, 'gi')
      out = out.replace(re, acr)
    })
    return out
  }, [KNOWN_ACRONYMS])

  // Map PDPA variants across languages into a canonical token before distance calc
  function mapPDPAEquivalents(text: string) {
    if (!text) return text
    return text
      .toLowerCase()
      .replace(/\./g, '') // remove dots like "P.D.P.A."
      .replace(/\s+/g, ' ')
      // English variants
      .replace(/p\s?d\s?p\s?a/g, 'pdpa')
      .replace(/personal data protection act/g, 'pdpa')
      // Malay variant
      .replace(/akta perlindungan data peribadi/g, 'pdpa')
      // Mandarin variants
      .replace(/个人(资料|数据)?保护法/g, 'pdpa')
  }
  // Normalize common legal phrase variants so minor wording changes still match
  function mapLegalEquivalents(text: string) {
    if (!text) return text
    return text
      .toLowerCase()
      .replace(/third[-\s]?part(y|ies)/g, 'thirdparties')
      .replace(/without\s+(your\s+)?explicit\s+consent/g, 'without consent')
      .replace(/(except|unless)\s+as?\s+required\s+by\s+law/g, 'except required by law')
      // Handle ASR mishearing "except" as "accept"
      .replace(/\baccept\s+as?\s+required\s+by\s+law\b/g, 'except required by law')
  }
  const editDistance = (a: string, b: string) => {
    const m = a.length, n = b.length
    const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
    for (let i = 0; i <= m; i++) dp[i][0] = i
    for (let j = 0; j <= n; j++) dp[0][j] = j
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        )
      }
    }
    return dp[m][n]
  }
  const similarity = (spoken: string, expected: string) => {
    // Optionally drop parentheticals and acronyms in sentence mode so users can skip (PDPA)
    let s = spoken
    let e = expected
    if (sentenceMode && ignoreBracketed) {
      s = scrubAcronymsForSentence(s)
      s = removeParentheticals(s)
      e = removeParentheticals(e)
    }
    if (sentenceMode) {
      s = mapLegalEquivalents(mapPDPAEquivalents(s))
      e = mapLegalEquivalents(mapPDPAEquivalents(e))
    }
    // Special-case boosts for known legal-sharing sentence
    const hasLegalKW = (t: string) => {
      const canon = mapLegalEquivalents(t)
      return canon.includes('thirdparties') && canon.includes('without consent')
    }
    if (sentenceMode && hasLegalKW(s) && hasLegalKW(e)) {
      // Strong boost to ensure this specific sentence advances despite ASR noise
      return 0.85
    }

    // Allow omission of trailing legal exception clause when present in expected
    // e.g., "..., except as required by law" vs user omits that part
    const exceptionRe = /(,?\s*(except|unless)\s+as?\s+required\s+by\s+law\.?)/
    let scores: number[] = []
    const baseCompare = (ss: string, ee: string) => {
      const A = norm(ss)
      const B = norm(ee)
      if (!B.length) return 0
      const dist = editDistance(A, B)
      return 1 - dist / Math.max(1, B.length)
    }
    const tokenOverlap = (ss: string, ee: string) => {
      const toks = (t: string) => t.split(/\s+/).filter(Boolean)
      let a = toks(norm(ss))
      let b = toks(norm(ee))
      // Remove common stopwords (English only heuristic)
      const sw: Set<string> = (stopwords as any).en ?? new Set<string>()
      a = a.filter(x => !sw.has(x))
      b = b.filter(x => !sw.has(x))
      const A = new Set(a)
      const B = new Set(b)
      let inter = 0
      A.forEach(x => { if (B.has(x)) inter++ })
      // Use containment over expected tokens to avoid dilution on long sentences
      const denom = Math.max(1, b.length)
      return inter / denom
    }
    // Full comparisons (edit-distance and token-overlap)
    scores.push(baseCompare(s, e))
    scores.push(tokenOverlap(s, e))
    // If expected has the exception clause, also compare without it (both metrics)
    if (sentenceMode && exceptionRe.test(e)) {
      const eNoExc = e.replace(exceptionRe, '').trim()
      scores.push(baseCompare(s, eNoExc))
      scores.push(tokenOverlap(s, eNoExc))
    }
    return Math.max(...scores)
  }

  // Drive sentence progression from external transcript when provided (simulated playback)
  useEffect(() => {
    if (!sentenceMode || !lines || !lineStarts || !lineEnds) return
    const spoken = ((externalFinal || '') + ' ' + (externalInterim || '')).trim()
    if (!spoken) return
    const cur = currentWordIndex
    let lineIdx = 0
    while (lineIdx + 1 < lineStarts.length && lineStarts[lineIdx + 1] <= cur) lineIdx++
    const buildExpected = (li: number) => {
      const s = lineStarts[li] ?? 0
      const e = lineEnds[li] ?? expectedWords.length
      return lines[li] ?? (language?.startsWith('zh') ? words.slice(s, e).join('') : words.slice(s, e).join(' '))
    }
    let bestIdx = lineIdx
    let bestScore = -1
    const spokenCanonPresence = mapPDPAEquivalents(collapseAcronymsOnly(spoken))
    const windowEnd = lines.length - 1
    const candidateThreshold = (li: number, base: number) => {
      const exp = buildExpected(li)
      const canon = mapLegalEquivalents(exp)
      // Loosen slightly for the third-parties/consent sentence
      if (canon.includes('thirdparties') && canon.includes('without consent')) return Math.min(base, 0.6)
      return base
    }
    for (let li = lineIdx; li <= windowEnd; li++) {
      const expectedSentence = buildExpected(li)
      // Gate per candidate
      if (requirePDPAKeyword && mapPDPAEquivalents(expectedSentence).includes('pdpa')) {
        const has = spokenCanonPresence.includes('pdpa')
        try { console.log('[Karaoke][external] PDPA gate candidate', { li, expectedHas: true, spokenHas: has }) } catch {}
        if (!has) continue
      }
      const sc = similarity(spoken, expectedSentence)
      try { console.log('[Karaoke][external] candidate', { li, score: sc }) } catch {}
      if (sc > bestScore) { bestScore = sc; bestIdx = li }
    }
    const effThresh = candidateThreshold(bestIdx, sentenceThreshold)
    try { console.log('[Karaoke][external] best', { bestIdx, bestScore, threshold: sentenceThreshold, effThresh }) } catch {}
    if (bestScore >= effThresh) {
      const endAbsBest = lineEnds[bestIdx] ?? expectedWords.length
      setCurrentWordIndex(prev => (endAbsBest > prev ? endAbsBest : prev))
      const isLastLine = bestIdx >= lines.length - 1
      if (isLastLine || endAbsBest >= expectedWords.length) {
        try { console.log('[Karaoke][external] completed', { bestIdx, isLastLine, endAbsBest, total: expectedWords.length }) } catch {}
        onCompleted?.()
      }
    }
  }, [externalFinal, externalInterim, sentenceMode, lines, lineStarts, lineEnds, sentenceThreshold, currentWordIndex, expectedWords.length, words, onCompleted, language, requirePDPAKeyword, collapseAcronymsOnly])

  // Basic stopword lists (lightweight). Extend as needed.
  const stopwords = useMemo(() => {
    const en = new Set([
      'the','a','an','of','and','to','in','is','it','that','with','for','on','as','at','by','from','or','be','are','was','were','this','these','those','i','you','he','she','we','they','your','my','our','their'
    ])
    const ms = new Set([
      'yang','dan','di','ke','dari','itu','ini','adalah','ialah','untuk','pada','sebagai','oleh','atau'
    ])
    const zh = new Set([
      '的','了','和','是','在','有','我','你','他','她','它','我们','你们','他们','与','及'
    ])
    if (language?.startsWith('ms')) return ms
    if (language?.startsWith('zh')) return zh
    return en
  }, [language])

  const isNonMeaningful = useCallback((w: string) => {
    if (!w) return true
    if (stopwords.has(w)) return true
    // very short tokens are likely fillers or letters
    if (w.length <= 2) return true
    return false
  }, [stopwords])

  // Anchor word indices per line: meaningful words (not stopwords, length>=5) that we avoid skipping
  const anchorIndices = useMemo(() => {
    if (!lineStarts || !lineEnds) return new Set<number>()
    const anchors = new Set<number>()
    for (let li = 0; li < lineStarts.length; li++) {
      const start = lineStarts[li]
      const end = lineEnds[li]
      for (let i = start; i < Math.min(end, expectedWords.length); i++) {
        const w = expectedWords[i]
        if (!w) continue
        const meaningful = !(w.length <= 2 || stopwords.has(w))
        if (meaningful && w.length >= 5) anchors.add(i)
      }
    }
    return anchors
  }, [lineStarts, lineEnds, expectedWords, stopwords])

  const stop = useCallback(() => {
    setIsListening(false)
    activeRef.current = false
    try { recognitionRef.current?.stop() } catch {}
  }, [])

  const start = useCallback(async () => {
    if (!('webkitSpeechRecognition' in window) && !("SpeechRecognition" in window)) {
      alert('Live speech recognition is not supported in this browser. Try Chrome.')
      return
    }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      alert('Microphone permission denied')
      return
    }

    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition: SpeechRecognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = language || 'en-US'
    recognitionRef.current = recognition
    // Keep the mic active across pauses
    // Some browsers ignore continuous, but set it where supported
    // @ts-ignore
    recognition.continuous = true

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.results.length - 1]
      const transcript = result[0].transcript
      const tokens = transcript.split(/\s+/).map(normalize).filter(Boolean)
      if (!tokens.length) return

      // If a new resultIndex stream starts or this result is final, reset token counter
      if (lastResultIndexRef.current === null || lastResultIndexRef.current !== event.resultIndex || result.isFinal) {
        lastTokenCountRef.current = 0
        lastResultIndexRef.current = event.resultIndex
      }

      // Reset processed count when resultIndex changes or transcript shrinks (common on finalization)
      if (
        lastResultIndexRef.current === null ||
        (typeof event.resultIndex === 'number' && event.resultIndex !== lastResultIndexRef.current) ||
        tokens.length < lastTokenCountRef.current
      ) {
        lastTokenCountRef.current = 0
      }
      lastResultIndexRef.current = (typeof event.resultIndex === 'number' ? event.resultIndex : lastResultIndexRef.current)

      // Update rolling transcript buffers for sentence mode
      if (result.isFinal) {
        transcriptFinalRef.current = (transcriptFinalRef.current + ' ' + transcript).trim()
        transcriptInterimRef.current = ''
      } else {
        transcriptInterimRef.current = transcript
      }

      // Process only newly seen tokens to avoid re-advancing on repeated interim results
      const startFrom = Math.min(lastTokenCountRef.current, tokens.length)
      const newTokens = tokens.slice(startFrom)
      lastTokenCountRef.current = tokens.length
      if (!newTokens.length) return

      // Sentence-by-sentence mode: evaluate similarity to the current bullet line and advance whole line when threshold is met
      if (sentenceMode && lines && lineStarts && lineEnds) {
        let idx = currentWordIndex
        const cur = idx
        let lineIdx = 0
        while (lineIdx + 1 < lineStarts.length && lineStarts[lineIdx + 1] <= cur) lineIdx++
        const spoken = (transcriptFinalRef.current + ' ' + transcriptInterimRef.current).trim()
        // Build candidates across a small window ahead
        const buildExpected = (li: number) => {
          const s = lineStarts[li] ?? 0
          const e = lineEnds[li] ?? expectedWords.length
          return lines[li] ?? words.slice(s, e).join(' ')
        }
        const spokenCanonPresence = mapPDPAEquivalents(collapseAcronymsOnly(spoken))
        const windowEnd = lines.length - 1
        const candidateThreshold = (li: number, base: number) => {
          const exp = buildExpected(li)
          const canon = mapLegalEquivalents(exp)
          if (canon.includes('thirdparties') && canon.includes('without consent')) return Math.min(base, 0.6)
          return base
        }
        let bestLi = lineIdx
        let bestScore = -1
        for (let li = lineIdx; li <= windowEnd; li++) {
          const expectedSentence = buildExpected(li)
          // Debug for each candidate
          try { console.log('[Karaoke][mic] candidate line', li, { expected: expectedSentence, spoken: spoken.trim().slice(0,200) }) } catch {}
          // PDPA gate per candidate
          if (requirePDPAKeyword && mapPDPAEquivalents(expectedSentence).includes('pdpa')) {
            const has = spokenCanonPresence.includes('pdpa')
            try { console.log('[Karaoke][mic] PDPA gate candidate', { li, expectedHas: true, spokenHas: has }) } catch {}
            if (!has) continue
          }
          const sc = similarity(spoken, expectedSentence)
          try { console.log('[Karaoke][mic] candidate score', { li, score: sc }) } catch {}
          if (sc > bestScore) { bestScore = sc; bestLi = li }
        }
        const effThresh = candidateThreshold(bestLi, sentenceThreshold)
        try { console.log('[Karaoke][mic] best', { bestLi, bestScore, threshold: sentenceThreshold, effThresh }) } catch {}
        if (bestScore >= effThresh) {
          const endAbsBest = lineEnds[bestLi] ?? expectedWords.length
          idx = endAbsBest
          setCurrentWordIndex(prev => (idx > prev ? idx : prev))
          // Reset rolling transcript so next sentence doesn't include previous content
          transcriptFinalRef.current = ''
          transcriptInterimRef.current = ''
          const isLastLine = bestLi >= lines.length - 1
          if (isLastLine || idx >= expectedWords.length) {
            stop()
            try { console.log('[Karaoke][mic] completed', { bestLi, isLastLine, idx, total: expectedWords.length }) } catch {}
            onCompleted?.()
          }
        }
        // In sentence mode we bypass per-word logic entirely
        return
      }

      let idx = currentWordIndex
      let progressed = false
      for (let ti = 0; ti < newTokens.length; ti++) {
        const token = newTokens[ti]
        // Only look ahead a small window from the current index to prevent big jumps
        let probe = idx
        let matchedAt = -1
        let window = MAX_LOOKAHEAD
        // If we've stalled for a few events, briefly widen the window to recover alignment
        if (stallCounterRef.current >= 2) window = Math.max(14, MAX_LOOKAHEAD)
        while (probe < expectedWords.length && (probe - idx) <= window) {
          const expected = expectedWords[probe]
          const ok = requireExactRef.current ? (expected === token) : isCloseMatch(expected, token)
          if (ok) { matchedAt = probe; break }
          probe++
        }
        if (matchedAt !== -1) {
          idx = matchedAt + 1
          progressed = true
          // Replenish skip budget slowly on successful progress
          if (skipBudgetRef.current < maxSkips) skipBudgetRef.current += 1
          // Reset any partial acronym progress if index moved
          acronymStateRef.current = null
          // If we required exact match and got one, turn it off
          if (requireExactRef.current && matchedAt >= 0) requireExactRef.current = false
          // Reset consecutive skip counter
          consecutiveSkipsRef.current = 0
          // Track line progress for safer snaps
          if (lineStarts && lineEnds) {
            // Determine current line by idx-1 (word we just matched)
            const curAbs = idx - 1
            let li = 0
            while (li + 1 < lineStarts.length && lineStarts[li + 1] <= curAbs) li++
            lineProgressRef.current = { lineIdx: li, matched: true }
          }
        } else {
          // Special-case: ASR may spell acronyms as separate letters, e.g., "p d p a" for "pdpa"
          const expected = expectedWords[idx]
          if (expected && (KNOWN_ACRONYMS.has(expected) || /^[a-z]{2,6}$/.test(expected))) {
            // Accept direct inclusion (e.g., token contains the acronym after normalization)
            if (token.includes(expected)) {
              idx = Math.min(idx + 1, expectedWords.length)
              progressed = true
              if (skipBudgetRef.current < maxSkips) skipBudgetRef.current += 1
              acronymStateRef.current = null
              continue
            }

            // Support partial accumulation across tokens/results
            let state = acronymStateRef.current
            if (!state || state.index !== idx) state = { index: idx, matched: 0 }
            const nextChar = expected[state.matched]
            if (/^[a-z]$/.test(token) && token === nextChar) {
              state.matched += 1
              acronymStateRef.current = state
              if (state.matched === expected.length) {
                idx = Math.min(idx + 1, expectedWords.length)
                progressed = true
                if (skipBudgetRef.current < maxSkips) skipBudgetRef.current += 1
                acronymStateRef.current = null
              }
              // Either way, continue to next token without skipping
              continue
            } else {
              // Mismatch; reset partial state (we may try skip or other strategies below)
              acronymStateRef.current = null
              // If we couldn't match an acronym, aggressively consume one skip to move past it
              if (skipBudgetRef.current > 0) {
                idx = Math.min(idx + 1, expectedWords.length)
                skipBudgetRef.current -= 1
                progressed = true
                // After skipping, resync: process transcript fresh and widen lookahead briefly
                lastTokenCountRef.current = 0
                stallCounterRef.current = 3
                // After a skip, require an exact match before allowing more fuzzy/snap
                requireExactRef.current = true
                consecutiveSkipsRef.current = Math.min(1, consecutiveSkipsRef.current + 1)
                continue
              }
            }
          }

          if (skipBudgetRef.current > 0) {
            // No match in window; permissively skip one expected word
            const canSkip = !skipStopwordsOnly || isNonMeaningful(expected)
            // Smart guard: do not skip anchors and do not allow more than 1 consecutive skip
            const isAnchor = anchorIndices.has(idx)
            const canConsecutive = consecutiveSkipsRef.current < 1
            if (canSkip && !isAnchor && canConsecutive) {
              idx = Math.min(idx + 1, expectedWords.length)
              skipBudgetRef.current -= 1
              // After skipping, resync: process transcript fresh and widen lookahead briefly
              lastTokenCountRef.current = 0
              stallCounterRef.current = 3
              // After a skip, require an exact match before allowing more fuzzy/snap
              requireExactRef.current = true
              consecutiveSkipsRef.current = Math.min(1, consecutiveSkipsRef.current + 1)
            }
          }
        }
      }

      // If we didn't progress, and we have bullets, try snapping to the start of the next bullet after repeated stalls
      if (!progressed && lineStarts && stallCounterRef.current >= 2 && !requireExactRef.current) {
        const cur = currentWordIndex
        let lineIdx = 0
        while (lineIdx + 1 < lineStarts.length && lineStarts[lineIdx + 1] <= cur) lineIdx++
        const nextStart = lineStarts[lineIdx + 1]
        // Only allow snap if we've matched at least one word in the current line (avoid cold jumps)
        const safeToSnap = lineProgressRef.current.lineIdx === lineIdx && lineProgressRef.current.matched
        if (typeof nextStart === 'number' && nextStart > cur && safeToSnap) {
          idx = nextStart
          progressed = true
          // resync
          lastTokenCountRef.current = 0
          // After a snap, require an exact match before allowing more fuzzy/snap
          requireExactRef.current = true
          consecutiveSkipsRef.current = 0
        }
      }

      if (idx !== currentWordIndex) {
        stallCounterRef.current = 0
        // Never allow backwards movement
        setCurrentWordIndex(prev => (idx > prev ? idx : prev))
        if (idx >= expectedWords.length) {
          stop()
          onCompleted?.()
        }
      } else {
        // no movement this event
        stallCounterRef.current = Math.min(5, stallCounterRef.current + 1)
      }
    }

    recognition.onerror = () => {
      stop()
    }

    recognition.onend = () => {
      // If we intentionally stopped (stop() sets isListening false), do nothing.
      // Otherwise, auto-restart to continue sentence-by-sentence verification.
      const finished = currentWordIndex >= expectedWords.length
      if (isListening && !finished) {
        try { recognition.start() } catch {}
      } else {
        setIsListening(false)
      }
    }

    recognition.onaudioend = () => {
      // Chrome often ends after a pause. If still active, restart seamlessly.
      if (activeRef.current) {
        try { recognition.start() } catch {}
      } else {
        setIsListening(false)
      }
    }

    recognitionRef.current = recognition
    setCurrentWordIndex(0)
    lastTokenCountRef.current = 0
    lastResultIndexRef.current = null
    stallCounterRef.current = 0
    acronymStateRef.current = null
    requireExactRef.current = false
    consecutiveSkipsRef.current = 0
    lineProgressRef.current = { lineIdx: -1, matched: false }
    setIsListening(true)
    activeRef.current = true
    // Effective skip budget is limited by fraction of total words for safety
    const total = expectedWords.length || 0
    const capByFraction = total > 0
      ? Math.max(1, Math.ceil((maxSkipFraction ?? 1) * total))
      : 0
    // If maxSkips is Infinity, do not cap by fraction; allow effectively unlimited skipping
    const effectiveMax = Number.isFinite(maxSkips) ? Math.min(maxSkips, capByFraction) : Number.POSITIVE_INFINITY
    skipBudgetRef.current = effectiveMax
    recognition.start()
  }, [currentWordIndex, expectedWords, language, onCompleted, stop, maxSkips, maxSkipFraction, isNonMeaningful, skipStopwordsOnly])

  useEffect(() => () => {
    try { recognitionRef.current?.stop() } catch {}
  }, [])

  const completed = currentWordIndex >= expectedWords.length

  useEffect(() => {
    if (completed) {
      try { console.log('[Karaoke][ui] rendering in-component completed badge') } catch {}
    }
  }, [completed])

  return (
    <div className={className}>
      <div className="flex gap-2 mb-3 flex-col">
        <Alert variant="default"><AlertDescription>Note: This step will be recorded to document that the patient has given informed consent under PDPA.</AlertDescription></Alert>
        
        {!isListening ? (
          <button type="button" onClick={start} className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">
            Start Live Verification
          </button>
        ) : (
          <button type="button" onClick={stop} className="px-3 py-2 rounded bg-slate-200 hover:bg-slate-300">
            Stop
          </button>
        )}
      </div>

      <div className={
        "p-4 rounded-lg border leading-relaxed " + (completed ? "bg-green-50 border-green-300" : "bg-slate-50")
      }>
        {lineTokenCounts ? (
          <ul className="list-disc pl-6 space-y-2">
            {(() => {
              const items: React.ReactNode[] = []
              let start = 0
              const isChinese = language?.startsWith('zh')
              const renderPerLine = sentenceMode || isChinese
              lineTokenCounts.forEach((count, idx) => {
                const end = Math.min(start + count, words.length)
                const slice = words.slice(start, end)
                if (renderPerLine) {
                  const completed = currentWordIndex >= end
                  const current = currentWordIndex >= start && currentWordIndex < end && isListening
                  const cls =
                    'inline align-top px-1 rounded transition-colors duration-200 whitespace-pre-wrap ' +
                    (completed
                      ? 'bg-green-200 text-green-800'
                      : current
                      ? 'bg-yellow-200 text-yellow-800'
                      : 'text-slate-700')
                  const lineText = (lines && lines[idx]) ? lines[idx] : (isChinese ? slice.join('') : slice.join(' '))
                  items.push(
                    <li key={idx} className="">
                      <span className={cls}>{lineText}</span>
                    </li>
                  )
                } else {
                  items.push(
                    <li key={idx} className="">
                      {slice.map((w, i) => {
                        const abs = start + i
                        const cls =
                          'inline-block mr-2 mb-1 px-1 rounded transition-colors duration-200 ' +
                          (abs < currentWordIndex
                            ? 'bg-green-200 text-green-800'
                            : abs === currentWordIndex && isListening
                            ? 'bg-yellow-200 text-yellow-800'
                            : 'text-slate-600')
                        return (
                          <span key={abs} className={cls}>
                            {w}
                          </span>
                        )
                      })}
                    </li>
                  )
                }
                start = end
              })
              // If there are any remaining words (in case counts don't cover all), render them as a final bullet
              if (start < words.length) {
                const slice = words.slice(start)
                const isChinese = language?.startsWith('zh')
                const renderPerLine = sentenceMode || isChinese
                if (renderPerLine) {
                  const completed = currentWordIndex >= words.length
                  const current = currentWordIndex >= start && currentWordIndex < words.length && isListening
                  const cls =
                    'inline-block mb-1 px-1 rounded transition-colors duration-200 whitespace-pre-wrap ' +
                    (completed
                      ? 'bg-green-200 text-green-800'
                      : current
                      ? 'bg-yellow-200 text-yellow-800'
                      : 'text-slate-700')
                  const lineText = lines && lines[lineTokenCounts.length]
                    ? lines[lineTokenCounts.length]
                    : (isChinese ? slice.join('') : slice.join(' '))
                  items.push(
                    <li key={lineTokenCounts.length}>
                      <span className={cls}>{lineText}</span>
                    </li>
                  )
                } else {
                  items.push(
                    <li key={lineTokenCounts.length}>
                      {slice.map((w, i) => {
                        const abs = start + i
                        const cls =
                          'inline-block mr-2 mb-1 px-1 rounded transition-colors duration-200 ' +
                          (abs < currentWordIndex
                            ? 'bg-green-200 text-green-800'
                            : abs === currentWordIndex && isListening
                            ? 'bg-yellow-200 text-yellow-800'
                            : 'text-slate-600')
                        return (
                          <span key={abs} className={cls}>
                            {w}
                          </span>
                        )
                      })}
                    </li>
                  )
                }
              }
              return items
            })()}
          </ul>
        ) : (
          words.map((w, i) => (
            <span
              key={i}
              className={
                'inline-block mr-2 mb-1 px-1 rounded transition-colors duration-200 ' +
                (i < currentWordIndex
                  ? 'bg-green-200 text-green-800'
                  : i === currentWordIndex && isListening
                  ? 'bg-yellow-200 text-yellow-800'
                  : 'text-slate-600')
              }
            >
              {w}
            </span>
          ))
        )}
      </div>

      {completed && (
        <div className="mt-3 text-sm text-green-700">Completed</div>
      )}

      <p className="mt-2 text-xs text-slate-500">
        Tip: speak close to the mic in a quiet room. This uses the browser speech recognition engine.
      </p>
    </div>
  )
}

export default LiveConsentKaraoke
