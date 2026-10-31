import { useEffect, useRef, useState } from 'react';
import { Mic, Square, RotateCcw } from 'lucide-react';
import { blobToWav } from '../lib/recorder';
import { Button } from './ui';

/** Read-aloud passage: varied vowels, consonants, questions and statements, about 25 seconds at a natural pace. */
export const RECORDING_SCRIPT =
  'The quick brown fox jumps over the lazy dog, while a gentle breeze carries the scent of fresh rain across the valley. ' +
  'On Thursday morning, I walked to the market and bought five ripe peaches, two loaves of bread, and a small jar of honey. ' +
  'Have you ever noticed how quiet the city becomes just before sunrise? ' +
  'It is a simple pleasure, really, to sit by the window with a warm cup of tea and listen to the world slowly wake up.';

const MIN_SECONDS = 10;
const MAX_SECONDS = 60;

interface Props {
  onRecorded: (file: File | null) => void;
}

export default function VoiceRecorder({ onRecorded }: Props) {
  const [state, setState] = useState<'idle' | 'recording' | 'processing' | 'done'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number>();

  const cleanup = () => {
    window.clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
  };
  useEffect(() => cleanup, []);
  useEffect(() => () => void (previewUrl && URL.revokeObjectURL(previewUrl)), [previewUrl]);

  const start = async () => {
    setError(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
    } catch {
      setError('Microphone access was denied or no microphone was found.');
      return;
    }
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream.current);
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      cleanup();
      setState('processing');
      try {
        const wav = await blobToWav(new Blob(chunks, { type: rec.mimeType }));
        setPreviewUrl(URL.createObjectURL(wav));
        onRecorded(new File([wav], 'recording.wav', { type: 'audio/wav' }));
        setState('done');
      } catch {
        setError('Could not process the recording. Please try again.');
        setState('idle');
      }
    };
    recorder.current = rec;
    rec.start();
    setSeconds(0);
    setState('recording');
    timer.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  useEffect(() => {
    if (state === 'recording' && seconds >= MAX_SECONDS) recorder.current?.stop();
  }, [seconds, state]);

  const reset = () => {
    setPreviewUrl(null);
    setSeconds(0);
    setState('idle');
    onRecorded(null);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">Read this aloud</p>
        <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{RECORDING_SCRIPT}</p>
      </div>
      <ul className="text-xs text-slate-500 dark:text-slate-400 list-disc pl-4 space-y-0.5">
        <li>Record in a quiet room, 15–20 cm from the microphone.</li>
        <li>Speak naturally in your normal voice, aiming for at least {MIN_SECONDS} seconds.</li>
        <li>Avoid background music, echo and other voices.</li>
      </ul>

      {state === 'idle' && (
        <Button type="button" variant="secondary" onClick={start}>
          <Mic className="w-4 h-4" /> Start recording
        </Button>
      )}
      {state === 'recording' && (
        <div className="flex items-center gap-3">
          <Button type="button" variant="danger" onClick={() => recorder.current?.stop()}>
            <Square className="w-4 h-4" /> Stop
          </Button>
          <span className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse-slow" />
            {seconds}s {seconds < MIN_SECONDS && <span className="text-slate-400">(keep reading…)</span>}
          </span>
        </div>
      )}
      {state === 'processing' && <p className="text-sm text-slate-500 dark:text-slate-400">Processing recording…</p>}
      {state === 'done' && previewUrl && (
        <div className="space-y-2">
          <audio controls src={previewUrl} className="w-full h-9" />
          {seconds < MIN_SECONDS && (
            <p className="text-xs text-amber-600 dark:text-amber-400">This recording is short. Longer samples usually clone better.</p>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={reset}>
            <RotateCcw className="w-3.5 h-3.5" /> Record again
          </Button>
        </div>
      )}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
