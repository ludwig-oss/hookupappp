import { useCallback, useEffect, useRef, useState } from 'react';
import { startCamera, stopCamera } from '../lib/faceScan';

type Props = {
  onCaptured: (selfie: string, descriptor?: number[]) => void | Promise<void>;
  busy?: boolean;
};

export default function RecoverySelfieCapture({ onCaptured, busy }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const video = videoRef.current;
        if (!video) return;
        streamRef.current = await startCamera(video);
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) setError('Allow camera access to take a selfie.');
      }
    })();
    return () => {
      cancelled = true;
      stopCamera(streamRef.current);
      streamRef.current = null;
    };
  }, []);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !ready) return;
    setError('');
    setCapturing(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 480;
      canvas.height = video.videoHeight || 360;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not capture photo');
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      const selfie = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      await onCaptured(selfie);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not take selfie');
    } finally {
      setCapturing(false);
    }
  }, [onCaptured, ready]);

  return (
    <div>
      <video ref={videoRef} playsInline muted style={{ width: '100%', borderRadius: 12, background: '#111' }} />
      {error && <div className="error-message" style={{ marginTop: 8 }}>{error}</div>}
      <button type="button" className="auth-button" disabled={!ready || capturing || busy} onClick={capture} style={{ marginTop: 12 }}>
        {capturing || busy ? 'Checking…' : 'Take selfie & send'}
      </button>
    </div>
  );
}
