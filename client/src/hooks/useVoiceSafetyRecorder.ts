import { useCallback, useEffect, useRef, useState } from 'react';
import { voiceRecordingAPI, VoiceRecordingSession } from '../api/voiceRecording';

type Options = {
  session: VoiceRecordingSession | null;
  onSessionUpdate: (s: VoiceRecordingSession | null) => void;
  enabled: boolean;
};

/** Background voice chunks — like a Twitch live VOD buffer. */
export function useVoiceSafetyRecorder({ session, onSessionUpdate, enabled }: Options) {
  const [recording, setRecording] = useState(false);
  const [muted, setMuted] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkTimerRef = useRef<number | null>(null);

  const stopStream = useCallback(() => {
    if (chunkTimerRef.current) {
      clearInterval(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }
    if (mediaRef.current && mediaRef.current.state !== 'inactive') {
      mediaRef.current.stop();
    }
    mediaRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setRecording(false);
  }, []);

  const uploadBlob = useCallback(
    async (blob: Blob) => {
      if (!session?.id || session.status === 'muted_sensitive') return;
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      try {
        const { session: updated } = await voiceRecordingAPI.uploadChunk(session.id, dataUrl);
        onSessionUpdate(updated);
      } catch {
        /* retry next chunk */
      }
    },
    [session, onSessionUpdate]
  );

  const startRecorder = useCallback(async () => {
    if (!session?.id || session.consentSteps < 3 || session.status === 'pending_consent') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : undefined });
      mediaRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) uploadBlob(e.data);
      };
      rec.start(30000);
      setRecording(true);
      chunkTimerRef.current = window.setInterval(() => {
        if (rec.state === 'recording') rec.requestData();
      }, 30000);
    } catch {
      alert('Microphone access is needed for safety recording.');
    }
  }, [session, uploadBlob]);

  useEffect(() => {
    if (!enabled || !session) {
      stopStream();
      return;
    }
    if (session.status === 'recording' && !recording) {
      startRecorder();
    }
    if (session.status === 'muted_sensitive') {
      setMuted(true);
      if (mediaRef.current?.state === 'recording') mediaRef.current.pause();
    } else {
      setMuted(false);
      if (mediaRef.current?.state === 'paused') mediaRef.current.resume();
    }
    if (session.status === 'completed' || session.status === 'expired') {
      stopStream();
    }
  }, [session, enabled, recording, startRecorder, stopStream]);

  useEffect(() => () => stopStream(), [stopStream]);

  return { recording, muted, stopStream };
}
