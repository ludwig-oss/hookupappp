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
  const [lastLoc, setLastLoc] = useState<{ lat: number; lon: number } | null>(null);

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
      if (data.settings.lastLocation) setLastLoc(data.settings.lastLocation);
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

  const resolveCoords = useCallback(async (): Promise<{ lat: number; lon: number }> => {
    const fromUser = (user as { location?: { lat?: number; lon?: number } } | null)?.location;
    const fallback =
      lastLoc ||
      (typeof fromUser?.lat === 'number' && typeof fromUser?.lon === 'number'
        ? { lat: fromUser.lat, lon: fromUser.lon }
        : { lat: 52.3676, lon: 4.9041 });

    if (!navigator.geolocation) return fallback;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        });
      });
      return { lat: pos.coords.latitude, lon: pos.coords.longitude };
    } catch {
      return fallback;
    }
  }, [lastLoc, user]);

  const trigger = useCallback(async () => {
    if (busy || !user?.id) return;
    setBusy(true);
    setListen(false);
    try {
      const { lat, lon } = await resolveCoords();
      const res = await personalSafetyAPI.trigger(lat, lon, 'secret_word', word || undefined);
      window.dispatchEvent(new CustomEvent('safety:signal-changed'));
      const n = res.nearbyNotified ?? 0;
      alert(
        n > 0
          ? `Help is on the way — ${n} nearby people got your location and can text you. Open Personal safety shield for False alarm.`
          : `Safety signal sent. Helpers will see your pin. Open Personal safety shield for status.`
      );
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
  }, [busy, user?.id, word, resolveCoords]);

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
