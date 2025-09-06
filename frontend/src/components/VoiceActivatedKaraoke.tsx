import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type VoiceActivatedKaraokeProps = {
  words: string[];
  className?: string;
  onCompleted?: () => void;
  onRecordingStart?: () => void;
  onRecordingStop?: (payload: { audioBlob: Blob; wordTimestamps: Array<{ index: number; timeMs: number }> }) => void;
};

// Simple RMS over a Float32Array buffer
function computeRMS(buf: Float32Array) {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = buf[i];
    sum += v * v;
  }
  return Math.sqrt(sum / buf.length) || 0;
}

export default function VoiceActivatedKaraoke({ words, className, onCompleted, onRecordingStart, onRecordingStop }: VoiceActivatedKaraokeProps) {
  const [idx, setIdx] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [noiseFloor, setNoiseFloor] = useState(0.01); // default low noise
  const [sensitivity, setSensitivity] = useState(2.5); // multiplier above noise to count as speech

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const srcRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const wordTimestampsRef = useRef<Array<{ index: number; timeMs: number }>>([]);

  // VAD params
  const minActiveMs = 120; // require this much continuous activity to trigger
  const hangoverMs = 350;  // min time between triggers
  const lastActiveStartRef = useRef<number>(0);
  const lastTriggerTimeRef = useRef<number>(-Infinity);
  const inActivityRef = useRef<boolean>(false);

  const cleanupAudio = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    try { analyserRef.current?.disconnect(); } catch {}
    try { srcRef.current?.disconnect(); } catch {}
    try { audioCtxRef.current?.close(); } catch {}
    analyserRef.current = null;
    srcRef.current = null;
    audioCtxRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(async () => {
    setIsRunning(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    cleanupAudio();
  }, [cleanupAudio]);

  const finalizeRecording = useCallback(() => {
    const audioBlob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || "audio/webm" });
    onRecordingStop?.({ audioBlob, wordTimestamps: wordTimestampsRef.current.slice() });
    // reset buffers
    chunksRef.current = [];
    wordTimestampsRef.current = [];
  }, [onRecordingStop]);

  // Calibrate noise floor for ~800ms
  const calibrate = useCallback(async () => {
    if (isRunning) return; // avoid conflicting with live run
    setIsCalibrating(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const src = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);

      const buf = new Float32Array(analyser.fftSize);
      const samples: number[] = [];
      const start = performance.now();
      while (performance.now() - start < 800) {
        analyser.getFloatTimeDomainData(buf);
        samples.push(computeRMS(buf));
        await new Promise(r => setTimeout(r, 50));
      }
      const avg = samples.reduce((a, b) => a + b, 0) / Math.max(1, samples.length);
      setNoiseFloor(Math.max(0.005, avg));
      try { stream.getTracks().forEach(t => t.stop()); } catch {}
      try { await audioCtx.close(); } catch {}
    } catch (e) {
      // ignore
    } finally {
      setIsCalibrating(false);
    }
  }, [isRunning]);

  const start = useCallback(async () => {
    if (isRunning) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const src = audioCtx.createMediaStreamSource(stream);
      srcRef.current = src;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      src.connect(analyser);

      // Start recording
      chunksRef.current = [];
      wordTimestampsRef.current = [];
      startTimeRef.current = performance.now();
      let mr: MediaRecorder | null = null;
      try {
        mr = new MediaRecorder(stream);
      } catch (_) {
        // If this fails, try without options fallback was already used
      }
      mediaRecorderRef.current = mr;
      if (mr) {
        mr.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };
        mr.onstop = finalizeRecording;
        mr.start(1000);
      }

      onRecordingStart?.();
      setIsRunning(true);
      inActivityRef.current = false;
      lastTriggerTimeRef.current = -Infinity;
      lastActiveStartRef.current = 0;

      const buf = new Float32Array(analyser.fftSize);
      const loop = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getFloatTimeDomainData(buf);
        const rms = computeRMS(buf);
        const threshold = noiseFloor * sensitivity;
        const now = performance.now();

        if (rms > threshold) {
          if (!inActivityRef.current) {
            inActivityRef.current = true;
            lastActiveStartRef.current = now;
          } else {
            // stayed active long enough, trigger once
            if (now - lastActiveStartRef.current >= minActiveMs && now - lastTriggerTimeRef.current >= hangoverMs) {
              lastTriggerTimeRef.current = now;
              setIdx((prev) => {
                const next = prev + 1;
                wordTimestampsRef.current.push({ index: next - 1, timeMs: now - startTimeRef.current });
                if (next >= words.length) {
                  // complete
                  stopRecording();
                  onCompleted?.();
                }
                return Math.min(next, words.length);
              });
            }
          }
        } else {
          inActivityRef.current = false;
        }

        if (isRunning) {
          rafRef.current = requestAnimationFrame(loop);
        }
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      setIsRunning(false);
    }
  }, [finalizeRecording, noiseFloor, onCompleted, onRecordingStart, sensitivity, stopRecording, words.length]);

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  const stop = useCallback(() => {
    stopRecording();
  }, [stopRecording]);

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-3">
        {!isRunning ? (
          <button type="button" onClick={start} className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Start (mic)</button>
        ) : (
          <button type="button" onClick={stop} className="px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700">Stop</button>
        )}
        <button type="button" onClick={calibrate} disabled={isRunning || isCalibrating} className="px-3 py-2 rounded border border-slate-300 hover:bg-slate-50">
          {isCalibrating ? 'Calibrating…' : 'Calibrate noise'}
        </button>
        <div className="text-xs text-slate-600">Noise floor: {noiseFloor.toFixed(3)} • Sensitivity×{sensitivity.toFixed(1)}</div>
      </div>

      <div className="p-4 bg-slate-50 rounded-lg border leading-relaxed">
        {words.map((w, i) => (
          <span
            key={i}
            className={
              'inline-block mr-2 mb-1 px-1 rounded transition-colors duration-200 ' +
              (i < idx ? 'bg-green-200 text-green-800' : i === idx && isRunning ? 'bg-yellow-200 text-yellow-800' : 'text-slate-600')
            }
          >
            {w}
          </span>
        ))}
      </div>

      <p className="mt-2 text-xs text-slate-500">Advances on detected voice energy. Use quiet room, calibrate first. Manual overrides still available elsewhere.</p>
    </div>
  );
}
