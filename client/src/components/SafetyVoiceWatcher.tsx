import { useCallback, useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { personalSafetyAPI } from '../api/personalSafety';
import { speechRecognitionSupported, useActivationWordListener } from '../hooks/useActivationWordListener';

/** Always-on listener so shouting the activation word works even when the shield panel is closed. */
export default function SafetyVoiceWatcher() {
  const { user } = useContext(AuthContext);
  const [word, setWord] = useState<string | null>(null);
  const [listen, setListen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await personalSafetyAPI.getSettings();
      const secret = data.settings.activationSecret || '';
      setWord(secret || null);
      setListen(Boolean(secret && data.settings.enableSecretWord && !data.activeSignal));
    } catch {
      /* silent */
    }
  }, [user?.id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 45000);
    const onRefresh = () => load();
    window.addEventListener('safety:settings-changed', onRefresh);
    window.addEventListener('safety:signal-changed', onRefresh);
    return () => {
      clearInterval(t);
      window.removeEventListener('safety:settings-changed', onRefresh);
      window.removeEventListener('safety:signal-changed', onRefresh);
    };
  }, [load]);

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
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 });
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
      alert((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Could not send safety signal.');
      setListen(true);
    } finally {
      setBusy(false);
    }
  }, [busy, user?.id, word]);

  useActivationWordListener(word, listen && speechRecognitionSupported() && !busy, trigger);

  return null;
}
