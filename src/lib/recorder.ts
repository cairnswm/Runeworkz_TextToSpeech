/** Decode recorded audio (webm/mp4) and re-encode it as 16-bit mono PCM WAV, which servers can validate reliably. */
export async function blobToWav(blob: Blob): Promise<Blob> {
  const ctx = new AudioContext();
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const channels = buf.numberOfChannels;
    const len = buf.length;
    const mono = new Float32Array(len);
    for (let c = 0; c < channels; c++) {
      const data = buf.getChannelData(c);
      for (let i = 0; i < len; i++) mono[i] += data[i] / channels;
    }
    const out = new DataView(new ArrayBuffer(44 + len * 2));
    const str = (o: number, s: string) => [...s].forEach((ch, i) => out.setUint8(o + i, ch.charCodeAt(0)));
    str(0, 'RIFF');
    out.setUint32(4, 36 + len * 2, true);
    str(8, 'WAVE');
    str(12, 'fmt ');
    out.setUint32(16, 16, true);
    out.setUint16(20, 1, true);
    out.setUint16(22, 1, true);
    out.setUint32(24, buf.sampleRate, true);
    out.setUint32(28, buf.sampleRate * 2, true);
    out.setUint16(32, 2, true);
    out.setUint16(34, 16, true);
    str(36, 'data');
    out.setUint32(40, len * 2, true);
    for (let i = 0; i < len; i++) {
      const s = Math.max(-1, Math.min(1, mono[i]));
      out.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Blob([out], { type: 'audio/wav' });
  } finally {
    void ctx.close();
  }
}
