import { useEffect, useRef, useState } from 'react';
type Result = ArrayLike<{ transcript: string }> & { isFinal?: boolean };
type Recognition = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: ((e: { resultIndex?: number; results: ArrayLike<Result> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error?: string }) => void) | null };
function speechCtor(): (new () => Recognition) | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
/** Browser speech recognition plus an actual microphone analyser. No synthetic level data. */
export function useGuideMicrophone(onText: (text: string) => void) {
  const [listening, setListening] = useState(false), [pending, setPending] = useState(false), [level, setLevel] = useState(0), [error, setError] = useState('');
  const callback = useRef(onText); callback.current = onText;
  const rec = useRef<Recognition | null>(null), stream = useRef<MediaStream | null>(null), audio = useRef<AudioContext | null>(null), frame = useRef(0), generation = useRef(0), alive = useRef(true), running = useRef(false);
  const clearMeter = () => {
    cancelAnimationFrame(frame.current); stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    void audio.current?.close().catch(() => {}); audio.current = null;
    if (alive.current) { setListening(false); setPending(false); setLevel(0); }
    running.current = false;
  };
  const stop = () => { generation.current++; rec.current?.stop(); clearMeter(); };
  useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current++; rec.current?.stop(); clearMeter(); }; }, []);
  const start = async () => {
    if (running.current) return;
    const Ctor = speechCtor();
    if (!Ctor || !navigator.mediaDevices?.getUserMedia) { setError('Voice input is not available in this browser. Please type instead.'); return; }
    const session = ++generation.current;
    running.current = true; setPending(true); setError('');
    try {
      const input = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current || session !== generation.current) { input.getTracks().forEach(track => track.stop()); return; }
      stream.current = input;
      const context = new AudioContext(); audio.current = context; await context.resume();
      if (!alive.current || session !== generation.current) { clearMeter(); return; }
      const analyser = context.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = .8;
      context.createMediaStreamSource(input).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      let last = 0;
      const meter = (time: number) => {
        if (!alive.current || session !== generation.current) return;
        if (time - last > 40 && !document.hidden) {
          analyser.getFloatTimeDomainData(samples);
          const rms = Math.sqrt(samples.reduce((sum, n) => sum + n * n, 0) / samples.length);
          const db = 20 * Math.log10(Math.max(.00001, rms));
          setLevel(Math.max(0, Math.min(1, (db + 48) / 48))); last = time;
        }
        frame.current = requestAnimationFrame(meter);
      };
      const r = new Ctor(); rec.current = r;
      r.lang = navigator.language || 'en-US'; r.interimResults = false; r.continuous = true;
      r.onresult = e => { for (let i = e.resultIndex ?? 0; i < e.results.length; i++) { const result = e.results[i]; if (result.isFinal === false) continue; const text = result[0]?.transcript?.trim(); if (text) callback.current(text); } };
      r.onend = clearMeter;
      r.onerror = e => { clearMeter(); if (alive.current) setError(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Microphone access is off.' : 'Voice input stopped. Please try again or type instead.'); };
      r.start(); setListening(true); setPending(false); frame.current = requestAnimationFrame(meter);
    } catch (e) {
      clearMeter(); if (alive.current && session === generation.current) setError(e instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(e.name) ? 'Microphone access is off.' : 'Microphone could not start. Please type instead.');
    }
  };
  return { listening, pending, level, error, supported: !!speechCtor(), start, stop, toggle: () => running.current ? stop() : void start() };
}
