import { useState, useEffect, useRef } from 'react';
import './PhotoVerificationModal.css';

const STEPS: { key: 'left' | 'center' | 'right'; label: string; instruction: string }[] = [
  { key: 'left', label: 'Look left', instruction: 'Turn your face slowly to the left, then tap Capture' },
  { key: 'center', label: 'Look at camera', instruction: 'Look straight at the camera and tap Capture' },
  { key: 'right', label: 'Look right', instruction: 'Turn your face slowly to the right, then tap Capture' },
];

interface PhotoVerificationModalProps {
  onClose: () => void;
  onVerified: () => void;
  onSubmit: (selfieImages: string[]) => Promise<void>;
}

export default function PhotoVerificationModal({ onClose, onVerified, onSubmit }: PhotoVerificationModalProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [captured, setCaptured] = useState<Record<string, string>>({});
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let s: MediaStream | null = null;
    (async () => {
      try {
        s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch {
        setError('Camera access is needed. Please allow camera and try again.');
      }
    })();
    return () => { if (s) s.getTracks().forEach(t => t.stop()); };
  }, []);

  useEffect(() => {
    if (stream && videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  const currentStep = STEPS[stepIndex];
  const allCaptured = STEPS.every(s => captured[s.key]);

  const handleCapture = () => {
    if (!videoRef.current || !stream) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const base64 = dataUrl.split(',')[1];
    if (!base64) return;
    setCaptured(prev => ({ ...prev, [currentStep.key]: base64 }));
    if (stepIndex < STEPS.length - 1) setStepIndex(stepIndex + 1);
  };

  const handleSubmit = async () => {
    if (!allCaptured) return;
    const order = STEPS.map(s => captured[s.key]).filter(Boolean);
    if (order.length !== 3) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(order);
      stream?.getTracks().forEach(t => t.stop());
      onVerified();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Verification failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="photo-verification-overlay" onClick={onClose}>
      <div className="photo-verification-modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="photo-verification-close" onClick={onClose} aria-label="Close">×</button>
        <h3 className="photo-verification-title">Verify it&apos;s you</h3>
        <p className="photo-verification-subtitle">Prevent catfishing: take a quick selfie scan so we can confirm your photos are really you. Your profile will show a green verified badge.</p>
        {error && <div className="photo-verification-error">{error}</div>}
        {!stream ? (
          <p className="photo-verification-loading">Starting camera…</p>
        ) : (
          <>
            <div className="photo-verification-video-wrap">
              <video ref={videoRef} autoPlay playsInline muted className="photo-verification-video" />
              <div className="photo-verification-step-badge">Step {stepIndex + 1} of 3: {currentStep.label}</div>
            </div>
            <p className="photo-verification-instruction">{currentStep.instruction}</p>
            <div className="photo-verification-actions">
              {!allCaptured ? (
                <button type="button" className="photo-verification-btn primary" onClick={handleCapture}>Capture</button>
              ) : (
                <button type="button" className="photo-verification-btn primary" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Verifying…' : 'Submit verification'}
                </button>
              )}
              {Object.keys(captured).length > 0 && !allCaptured && (
                <button type="button" className="photo-verification-btn secondary" onClick={() => setStepIndex(Math.min(stepIndex + 1, STEPS.length - 1))}>Skip to next</button>
              )}
            </div>
          </>
        )}
        <p className="photo-verification-privacy">Selfies are used only to verify your profile photo. We may review them to prevent abuse.</p>
      </div>
    </div>
  );
}
