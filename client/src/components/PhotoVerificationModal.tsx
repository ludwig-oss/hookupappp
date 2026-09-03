import { useCallback, useEffect, useRef, useState } from 'react';
import {
  captureFaceWithOpenEyes,
  captureVideoJpeg,
  extractFaceDescriptorFromImage,
  faceScanSupported,
  facesMatch,
  loadFaceModels,
  startCamera,
  stopCamera,
  type ScanProgress,
} from '../lib/faceScan';
import './PhotoVerificationModal.css';

export type PhotoVerificationSubmit = (
  selfieImages: string[],
  extras: { faceDescriptor: number[]; profileFaceDescriptor: number[] }
) => Promise<void>;

interface PhotoVerificationModalProps {
  onClose: () => void;
  onVerified: () => void;
  onSubmit: PhotoVerificationSubmit;
  profilePictureUrl?: string | null;
  /** When true, the user cannot dismiss until they verify (shadow-ban lock). */
  blocking?: boolean;
}

export default function PhotoVerificationModal({
  onClose,
  onVerified,
  onSubmit,
  profilePictureUrl,
  blocking = false,
}: PhotoVerificationModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<ScanProgress>({ status: 'loading', hint: 'Loading face check…' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<'prepare' | 'scan' | 'done'>('prepare');

  const cleanup = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopCamera(streamRef.current);
    streamRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const handleClose = () => {
    if (blocking || submitting) return;
    cleanup();
    onClose();
  };

  const runScan = async () => {
    if (!profilePictureUrl) {
      setError('Upload a visible profile photo of your face first. We compare a live selfie to that photo so others know it is really you.');
      return;
    }
    if (!faceScanSupported()) {
      setError('Camera is needed. Use a phone or laptop with a front camera.');
      return;
    }
    setError(null);
    setSubmitting(true);
    setPhase('scan');
    setProgress({ status: 'loading', hint: 'Reading your profile photo…' });
    try {
      await loadFaceModels();
      const profileDescriptor = await extractFaceDescriptorFromImage(profilePictureUrl);
      if (!profileDescriptor) {
        throw new Error('No face found in your visible profile photo. Upload a clear photo of your face, then try again.');
      }

      const video = videoRef.current;
      if (!video) throw new Error('Camera is not ready.');
      streamRef.current = await startCamera(video);
      setProgress({ status: 'no_face', hint: 'Center your face — both eyes open' });

      const controller = new AbortController();
      abortRef.current = controller;
      const { descriptor } = await captureFaceWithOpenEyes(video, setProgress, controller.signal);

      if (!facesMatch(descriptor, profileDescriptor)) {
        throw new Error('That live selfie does not match your visible profile photo. Use your own photo — this is required to prevent catfishing.');
      }

      const still = captureVideoJpeg(video);
      if (!still) throw new Error('Could not capture a selfie still. Try again.');

      setProgress({ status: 'capturing', hint: 'Matching your selfie to your profile photo…' });
      await onSubmit([still], { faceDescriptor: descriptor, profileFaceDescriptor: profileDescriptor });
      cleanup();
      setPhase('done');
      onVerified();
    } catch (e: unknown) {
      cleanup();
      setPhase('prepare');
      setError(e instanceof Error ? e.message : 'Verification failed. Try again in better lighting.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="photo-verification-overlay"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-verify-title"
    >
      <div className="photo-verification-modal" onClick={(e) => e.stopPropagation()}>
        {!blocking && (
          <button type="button" className="photo-verification-close" onClick={handleClose} aria-label="Close">
            ×
          </button>
        )}
        <h3 id="photo-verify-title" className="photo-verification-title">Prove it&apos;s you</h3>
        <p className="photo-verification-subtitle">
          For safety and catfishing prevention, we match a live selfie to the profile photo others see. Keep both eyes open and face the camera.
        </p>
        {profilePictureUrl && (
          <div className="photo-verification-profile-preview">
            <img src={profilePictureUrl} alt="Your visible profile photo" />
            <span>Visible profile photo</span>
          </div>
        )}
        {error && <div className="photo-verification-error">{error}</div>}
        <div className="photo-verification-video-wrap">
          <video ref={videoRef} autoPlay playsInline muted className="photo-verification-video" />
          {phase === 'scan' && (
            <div className="photo-verification-step-badge">{progress.hint}</div>
          )}
        </div>
        <p className="photo-verification-instruction">
          {phase === 'scan' ? progress.hint : 'We compare this live scan to the photo above. A photo of a photo will not pass.'}
        </p>
        <div className="photo-verification-actions">
          <button
            type="button"
            className="photo-verification-btn primary"
            onClick={runScan}
            disabled={submitting}
          >
            {submitting ? 'Scanning…' : 'Take live selfie & match'}
          </button>
        </div>
        <p className="photo-verification-privacy">
          Selfies are used only to confirm your profile photo is you. This is required after one month so people cannot catfish.
        </p>
      </div>
    </div>
  );
}
