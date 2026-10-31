import { useEffect, useRef, useState } from 'react';
import { Loader, Pause, Play } from 'lucide-react';
import { api } from '../lib/api';
import { useAlert } from '../context/AlertContext';
import { errMsg } from '../lib/format';
import type { Voice } from '../lib/types';
import { Button } from './ui';

// one voice plays at a time
let stopCurrent: (() => void) | null = null;

/** Fetches the sample from the space route with the tenant and auth headers, then plays it as a blob. */
export default function VoicePreview({ spaceId, voice }: { spaceId: string; voice: Voice }) {
  const { notify } = useAlert();
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const audio = useRef<HTMLAudioElement | null>(null);
  const objectUrl = useRef<string | null>(null);

  const stop = () => {
    audio.current?.pause();
    setState('idle');
  };

  useEffect(
    () => () => {
      audio.current?.pause();
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );

  if (!voice.hasSample) return null;

  const toggle = async () => {
    if (state === 'playing') return stop();
    stopCurrent?.();
    try {
      if (!audio.current) {
        setState('loading');
        const blob = await api.voiceSample(spaceId, voice.id);
        objectUrl.current = URL.createObjectURL(blob);
        const src = objectUrl.current;
        const a = new Audio(src);
        a.onended = () => setState('idle');
        a.onerror = () => {
          setState('idle');
          notify('Could not play this voice sample.');
        };
        audio.current = a;
      }
      audio.current.currentTime = 0;
      await audio.current.play();
      stopCurrent = stop;
      setState('playing');
    } catch (e) {
      setState('idle');
      notify(errMsg(e));
    }
  };

  return (
    <Button variant="secondary" size="sm" onClick={toggle} aria-label={`${state === 'playing' ? 'Stop' : 'Play'} ${voice.name}`}>
      {state === 'loading' ? <Loader className="w-3.5 h-3.5 animate-spin" /> : state === 'playing' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
      {state === 'playing' ? 'Stop' : 'Preview'}
    </Button>
  );
}
