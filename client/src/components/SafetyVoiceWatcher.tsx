import { useCallback, useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { personalSafetyAPI } from '../api/personalSafety';
import {
  ensureMicPermission,
  speechRecognitionSupported,
  speechRecognitionSupportHint,
  useActivationWordListener,
} from '../hooks/useActivationWordListener';

/** Always-on listener so shouting the activation word works even when the shield panel is closed. */
export default function SafetyVoiceWatcher() {
  const { user } = useContext(AuthContext);
  const [word, setWord] = useState<string | null>(null);
  const [listen, setListen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [micStatus, setMicStatus] = useState<'off' | 'listening' | 'blocked' | 'unsupported'>('off');

  const load = useCallback(async () => {
    if (!user?.id) {
      setListen(false);
      setWord(null);
      return;
    }
    try {
      const data = await personalSafetyAPI.getSettings();
      const secret = (data.settings.activationSecret || '').trim();
      setWord(secret || null);
      // Always on whenever a secret word is enabled and no active signal
      const shouldListen = Boolean(secret && data.settings.enableSecretWord && !data.activeSignal);
      setListen(shouldListen);
      if (shouldListen && speechRecognitionSupported()) {
        void ensureMicPermission();
      }
    } catch {
      /* silent */
    }
  }, [user?.id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    const onRefresh = () => load();
    window.addEventListener('safety:settings-changed', onRefresh);
    window.addEventListener('safety:signal-changed', onRefresh);
    return () => {
      clearInterval(t);
      window.removeEventListener('safety:settings-changed', onRefresh);
      window.removeEventListener('safety:signal-changed', onRefresh);
    };
  }, [load]);

  // Re-arm listening when user returns to the app
  useEffect(() => {
    const kick = () => {
      if (listen) void ensureMicPermission().then(() => load());
    };
    document.addEventListener('visibilitychange', kick);
    window.addEventListener('focus', kick);
    return () => {
      document.removeEventListener('visibilitychange', kick);
      window.removeEventListener('focus', kick);
    };
  }, [listen, load]);

  const trigger = useCallback(async () => {
    if (busy || !user?.id) return;
    setBusy(true);
    setListen(false);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Location is required to send a safety signal.'));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 5000,
        });
      });
      const res = await personalSafetyAPI.trigger(
        pos.coords.latitude,
        pos.coords.longitude,
        'secret_word',
        word || undefined
      );
      window.dispatchEvent(new CustomEvent('safety:signal-changed'));
      alert(res.message);
      window.location.href = `tel:${res.policeNumber}`;
    } catch (e: unknown) {
      alert(
        (e as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error ||
          (e as { message?: string })?.message ||
          'Could not send safety signal.'
      );
      setListen(true);
    } finally {
      setBusy(false);
    }
  }, [busy, user?.id, word]);

  useActivationWordListener(
    word,
    listen && speechRecognitionSupported() && !busy,
    trigger,
    setMicStatus
  );

  if (!user?.id || !listen) return null;

  const label =
    micStatus === 'listening'
      ? 'Safety mic on — listening for your word'
      : micStatus === 'blocked'
        ? 'Safety mic blocked — allow microphone'
        : micStatus === 'unsupported'
          ? 'Voice detector unsupported in this browser'
          : 'Starting safety mic…';

  return (
    <div
      role="status"
      aria-live="polite"
      title={speechRecognitionSupportHint()}
      style={{
        position: 'fixed',
        left: 12,
        bottom: 12,
        zIndex: 9998,
        maxWidth: 'min(280px, calc(100vw - 24px))',
        padding: '8px 12px',
        borderRadius: 10,
        fontSize: 11,
        lineHeight: 1.35,
        fontFamily: 'system-ui, sans-serif',
        color: micStatus === 'listening' ? '#fecdd3' : '#fde68a',
        background: 'rgba(10, 8, 14, 0.88)',
        border: `1px solid ${micStatus === 'listening' ? 'rgba(255, 107, 157, 0.55)' : 'rgba(251, 191, 36, 0.55)'}`,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        pointerEvents: 'none',
      }}
    >
      {label}
    </div>
  );
}
