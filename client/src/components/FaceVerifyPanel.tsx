import { useCallback, useEffect, useRef, useState } from 'react';
import {
  captureFaceWithOpenEyes,
  faceScanSupported,
  loadFaceModels,
  startCamera,
  stopCamera,
  type ScanProgress,
} from '../lib/faceScan';
import './FaceVerifyPanel.css';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  onCaptured: (descriptor: number[]) => void | Promise<void>;
};

export default function FaceVerifyPanel({ open, title, onClose, onCaptured }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<ScanProgress>({ status: 'loading', hint: 'Starting camera…' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const cleanup = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopCamera(streamRef.current);
    streamRef.current = null;
  }, []);

  const onCapturedRef = useRef(onCaptured);
  onCapturedRef.current = onCaptured;

  useEffect(() => {
    if (!open) {
      cleanup();
      return;
    }

    if (!faceScanSupported()) {
      setError('Camera not available. Use a phone with a front camera.');
      return;
    }

    let cancelled = false;
    setError('');
    setBusy(true);
    setProgress({ status: 'loading', hint: 'Starting camera…' });

    (async () => {
      try {
        await loadFaceModels();
        const video = videoRef.current;
        if (!video || cancelled) return;
        streamRef.current = await startCamera(video);
        setProgress({ status: 'no_face', hint: 'Center your face — both eyes open' });

        const controller = new AbortController();
        abortRef.current = controller;
        const { descriptor } = await captureFaceWithOpenEyes(video, setProgress, controller.signal);
        if (cancelled) return;
        setBusy(false);
        await onCapturedRef.current(descriptor);
      } catch (e: unknown) {
        if (cancelled) return;
        setBusy(false);
        setError(e instanceof Error ? e.message : 'Face scan failed');
        setProgress({ status: 'error', hint: 'Try again' });
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [open, cleanup]);

  if (!open) return null;

  return (
    <div className="face-verify-overlay" role="dialog" aria-modal="true">
      <div className="face-verify-card">
        <h2>{title}</h2>
        <p className="face-verify-hint">{progress.hint}</p>
        <div className={`face-verify-ring face-verify-${progress.status}`}>
          <video ref={videoRef} className="face-verify-video" playsInline muted />
        </div>
        <p className="face-verify-note">We check that both eyes are open and your face is unique — not a photo or look-alike.</p>
        {error && <div className="error-message">{error}</div>}
        <div className="face-verify-actions">
          <button type="button" className="auth-button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
