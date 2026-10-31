import { useEffect, useState } from 'react';
import { Download, Loader, Play } from 'lucide-react';
import { api } from '../lib/api';
import { useAlert } from '../context/AlertContext';
import { errMsg } from '../lib/format';
import type { AudioOutput } from '../lib/types';
import { Button } from './ui';

/** Audio downloads need auth headers, so the file is fetched as a blob on demand. */
export default function AudioPlayer({ spaceId, audio }: { spaceId: string; audio: AudioOutput }) {
  const { notify } = useAlert();
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  const fetchBlob = async () => {
    setBusy(true);
    try {
      const blob = await api.downloadAudio(spaceId, audio.id);
      const u = URL.createObjectURL(blob);
      setUrl(u);
      return u;
    } catch (e) {
      notify(errMsg(e));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    const u = url ?? (await fetchBlob());
    if (!u) return;
    const a = document.createElement('a');
    a.href = u;
    a.download = `${audio.name ?? audio.type}-${audio.id.slice(0, 8)}.${audio.format}`;
    a.click();
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {url ? (
        <audio controls autoPlay src={url} className="h-9 max-w-full" />
      ) : (
        <Button variant="secondary" size="sm" onClick={fetchBlob} disabled={busy}>
          {busy ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} Play
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={download} aria-label="Download">
        <Download className="w-3.5 h-3.5" /> Download
      </Button>
    </div>
  );
}
