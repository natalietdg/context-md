import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import enWav from "../script-wav/en.wav";
import msWav from "../script-wav/ms.wav";
import zhWav from "../script-wav/zh.mp3";

export type DeterministicKaraokeProps = {
  title?: string;
  words: string[];
  onCompleted?: () => void;
  wpm?: number; // optional auto-advance speed; if omitted, fully manual
  autoStart?: boolean; // if true and wpm provided, start auto-advance immediately
  className?: string;
  language?: "en" | "ms" | "zh"; // selects audio from script-wav
  wordTimestamps?: number[]; // precise per-word timestamps (seconds)
};

// Utility to normalize tokens for consistent comparisons if needed later
function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, "")
    .trim();
}

/**
 * Stable, cross-browser karaoke highlighter that does NOT use SpeechRecognition.
 * - Advance with Space/Enter or click/tap any word
 * - Backspace goes back
 * - Optional auto-advance via WPM (words per minute)
 * - Accessible: exposes current word via aria-live
 */
export default function DeterministicKaraoke({
  title,
  words,
  onCompleted,
  wpm,
  autoStart = false,
  className,
  language = "en",
  wordTimestamps,
}: DeterministicKaraokeProps) {
  const [idx, setIdx] = useState(0);
  const [running, setRunning] = useState(Boolean(wpm && autoStart));
  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioSrc = useMemo(() => {
    switch (language) {
      case "ms": return msWav;
      case "zh": return zhWav;
      case "en":
      default: return enWav;
    }
  }, [language]);

  useEffect(() => {
    // Stop audio when language changes or on unmount
    setIsPlaying(false);
    try { audioRef.current?.pause(); audioRef.current && (audioRef.current.currentTime = 0); } catch {}
  }, [language]);

  // Keep audio in lockstep with karaoke auto-advance state
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (running) {
      a.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      try { a.pause(); } catch {}
      setIsPlaying(false);
    }
  }, [running]);

  // Auto-advance interval based on WPM if provided and running (disabled when timestamps provided)
  useEffect(() => {
    if (wordTimestamps && wordTimestamps.length === words.length) return; // timestamps drive progress instead
    if (!running) return;
    // If audio duration is known, prefer syncing via timeupdate below instead of WPM interval
    const a = audioRef.current;
    if (a && isFinite(a.duration) && a.duration > 0) return;
    if (!wpm) return;
    const msPerWord = Math.max(120, Math.round(60000 / wpm));
    const t = setInterval(() => advance(1), msPerWord);
    return () => clearInterval(t);
  }, [wpm, running, idx, wordTimestamps, words.length]);

  // Prefer syncing progress to the audio's currentTime when available (independent of `running`)
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const hasTS = Boolean(wordTimestamps && wordTimestamps.length === words.length);
    const onTime = () => {
      const t = a.currentTime;
      let nextIdx = idx;
      if (hasTS) {
        // Find the last word whose timestamp is <= current time
        const ts = wordTimestamps!;
        let i = nextIdx;
        while (i + 1 < ts.length && ts[i + 1] <= t + 0.02) i++;
        nextIdx = i;
      } else if (isFinite(a.duration) && a.duration > 0 && words.length > 0) {
        const spw = a.duration / words.length;
        nextIdx = Math.min(words.length - 1, Math.max(0, Math.floor(t / Math.max(0.0001, spw))));
      } else {
        return; // fall back to WPM interval effect
      }
      setIdx((prev) => (nextIdx > prev ? nextIdx : prev));
    };
    a.addEventListener("timeupdate", onTime);
    return () => a.removeEventListener("timeupdate", onTime);
  }, [words.length, wordTimestamps, idx]);

  // High-frequency sync while playing to avoid visible pauses between timeupdate events
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    let rafId = 0;
    const hasTS = Boolean(wordTimestamps && wordTimestamps.length === words.length);
    const tick = () => {
      if (!a.paused && !a.ended) {
        const t = a.currentTime;
        if (hasTS) {
          const ts = wordTimestamps!;
          // Binary search would be ideal; linear is fine for short scripts
          let i = idx;
          while (i + 1 < ts.length && ts[i + 1] <= t + 0.02) i++;
          if (i > idx) setIdx(i);
        } else if (isFinite(a.duration) && a.duration > 0 && words.length > 0) {
          const spw = a.duration / words.length;
          const nextIdx = Math.min(words.length - 1, Math.max(0, Math.floor(t / Math.max(0.0001, spw))));
          if (nextIdx > idx) setIdx(nextIdx);
        }
      }
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [isPlaying, words.length, wordTimestamps, idx]);

  const completed = idx >= words.length;

  const advance = useCallback(
    (delta: number) => {
      setIdx((prev) => {
        const next = Math.min(words.length, Math.max(0, prev + delta));
        // If this is the first move from not-started to started, kick off audio
        if (prev === 0 && next > 0) {
          const a = audioRef.current;
          if (a && a.paused) {
            a.play().then(() => setIsPlaying(true)).catch(() => {});
          }
        }
        // Seek audio to align with next index when possible
        const a = audioRef.current;
        if (a && next >= 0 && next < words.length) {
          const hasTS = wordTimestamps && wordTimestamps.length === words.length;
          if (hasTS) {
            const t = Math.max(0, wordTimestamps![next]);
            try {
              const maxT = isFinite(a.duration) && a.duration > 0 ? Math.min(t, a.duration - 0.05) : t;
              a.currentTime = maxT;
            } catch {}
          } else {
            const spw = wpm
              ? 60 / wpm
              : (isFinite(a.duration) && a.duration > 0 && words.length > 0)
              ? a.duration / words.length
              : null;
            if (spw) {
              const t = next * spw;
              try {
                const maxT = isFinite(a.duration) && a.duration > 0 ? Math.min(t, a.duration - 0.05) : t;
                a.currentTime = Math.max(0, maxT);
              } catch {}
            }
          }
        }
        if (next === words.length && prev !== words.length) {
          // Do not pause here; let audio continue and trigger completion on onEnded
        }
        return next;
      });
    },
    [words.length, onCompleted, wpm, wordTimestamps]
  );

  const reset = useCallback(() => {
    setIdx(0);
    setRunning(Boolean(wpm && autoStart));
    try { if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; } } catch {}
    setIsPlaying(false);
  }, [wpm, autoStart]);

  // Keyboard controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing in inputs/textareas
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.code === "Space" || e.code === "Enter" || e.key === " ") {
        e.preventDefault();
        advance(1);
      } else if (e.code === "Backspace") {
        e.preventDefault();
        advance(-1);
      } else if (e.code === "ArrowRight") {
        advance(1);
      } else if (e.code === "ArrowLeft") {
        advance(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance]);

  // Scroll current word into view smoothly
  useEffect(() => {
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-word-index='${idx}']`);
    if (el) {
      el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }
  }, [idx]);

  const wordNodes = useMemo(() => {
    return words.map((w, i) => {
      const status = i < idx ? "completed" : i === idx ? "current" : "pending";
      const base = "inline-block mr-2 mb-1 px-1 rounded transition-colors duration-200 cursor-pointer select-none";
      const cls =
        status === "completed"
          ? "bg-green-200 text-green-800"
          : status === "current"
          ? "bg-yellow-200 text-yellow-900 animate-pulse"
          : "text-slate-700 hover:bg-slate-100";
      return (
        <span
          role={i === idx ? "mark" : undefined}
          aria-live={i === idx ? "polite" : undefined}
          aria-atomic={i === idx ? true : undefined}
          key={i}
          data-word-index={i}
          onClick={() => {
            setIdx(i);
            const a = audioRef.current;
            if (!a) return;
            // derive seconds-per-word
            const hasTS = wordTimestamps && wordTimestamps.length === words.length;
            if (hasTS) {
              const seekTo = Math.max(0, wordTimestamps![i]);
              const doSeekPlay = () => {
                try {
                  const maxT = isFinite(a.duration) && a.duration > 0 ? Math.min(seekTo, a.duration - 0.05) : seekTo;
                  a.currentTime = maxT;
                } catch {}
                setRunning(true);
                const onSeeked = () => {
                  setIdx(Math.min(i + 1, words.length - 1));
                  a.removeEventListener('seeked', onSeeked);
                };
                a.addEventListener('seeked', onSeeked);
                a.play().then(() => { setIsPlaying(true); }).catch(() => {});
              };
              if (!isFinite(a.duration) || a.duration <= 0) {
                const onReady = () => {
                  a.removeEventListener('loadedmetadata', onReady);
                  a.removeEventListener('canplay', onReady);
                  doSeekPlay();
                };
                a.addEventListener('loadedmetadata', onReady);
                a.addEventListener('canplay', onReady);
              } else {
                doSeekPlay();
              }
            } else {
              const spw = wpm
                ? 60 / wpm
                : (isFinite(a.duration) && a.duration > 0 && words.length > 0)
                ? a.duration / words.length
                : null;
              if (spw) {
                const seekTo = i * spw;
                const doSeekPlay = () => {
                  try {
                    const maxT = isFinite(a.duration) && a.duration > 0 ? Math.min(seekTo, a.duration - 0.05) : seekTo;
                    a.currentTime = Math.max(0, maxT);
                  } catch {}
                  setRunning(true);
                  const onSeeked = () => {
                    setIdx(Math.min(i + 1, words.length - 1));
                    a.removeEventListener('seeked', onSeeked);
                  };
                  a.addEventListener('seeked', onSeeked);
                  a.play().then(() => { setIsPlaying(true); }).catch(() => {});
                };
                if (!isFinite(a.duration) || a.duration <= 0) {
                  const onReady = () => {
                    a.removeEventListener('loadedmetadata', onReady);
                    a.removeEventListener('canplay', onReady);
                    doSeekPlay();
                  };
                  a.addEventListener('loadedmetadata', onReady);
                  a.addEventListener('canplay', onReady);
                } else {
                  doSeekPlay();
                }
              } else {
                // No timing info; still resume and advance highlight immediately
                setRunning(true);
                a.play().then(() => { setIsPlaying(true); }).catch(() => {});
                setIdx(Math.min(i + 1, words.length - 1));
              }
            }
          }}
          className={`${base} ${cls}`}
          title={`Word ${i + 1} of ${words.length}`}
        >
          {w}
        </span>
      );
    });
  }, [words, idx, running, wpm, wordTimestamps]);

  return (
    <div className={className}>
      {title && <h3 className="text-base font-medium mb-2">{title}</h3>}

      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          className={`px-3 py-1 rounded text-white ${running ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}
          onClick={() => setRunning((v) => !v)}
          disabled={!wpm}
          title={wpm ? "Toggle auto-advance" : "Provide wpm to enable auto-advance"}
        >
          {running ? "Pause" : "Start"}
        </button>
        <button
          type="button"
          className="px-3 py-1 rounded border border-slate-300 hover:bg-slate-50"
          onClick={reset}
        >
          Reset
        </button>
        <div className="text-xs text-slate-600 ml-2">Audio: {language.toUpperCase()}</div>
      </div>

      <div
        ref={containerRef}
        className="p-4 bg-slate-50 rounded-lg border leading-relaxed max-h-56 overflow-y-auto"
        aria-label="Consent script karaoke"
      >
        {wordNodes}
      </div>

      {completed && (
        <div className="mt-3 text-sm text-green-700">Completed</div>
      )}

      {/* Hidden audio element used by the play/pause control above */}
      <audio
        ref={audioRef}
        src={audioSrc}
        preload="auto"
        onEnded={() => {
          setIsPlaying(false);
          setIdx(words.length);
          onCompleted?.();
        }}
        className="hidden"
      />
    </div>
  );
}
