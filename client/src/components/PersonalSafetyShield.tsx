import { useCallback, useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { personalSafetyAPI, ShieldSettings } from '../api/personalSafety';
import { useVolumeTripleSOS } from '../hooks/useVolumeTripleSOS';
import { useScreenTapSOS } from '../hooks/useScreenTapSOS';
import { speechRecognitionSupported } from '../hooks/useActivationWordListener';
import { askWhatYouAreWearing } from './AppearanceSafetyPrompt';
import './PersonalSafetyShield.css';

export default function PersonalSafetyShield({ visible = false }: { visible?: boolean }) {
  const { user } = useContext(AuthContext);
  const [settings, setSettings] = useState<ShieldSettings | null>(null);
  const [ready, setReady] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [nearby, setNearby] = useState<Array<{ id: string; userName: string; lat: number; lon: number; appearanceDescription?: string }>>([]);
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [activationSecret, setActivationSecret] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await personalSafetyAPI.getSettings();
      setSettings(data.settings);
      setReady(data.ready.ready);
      setMissing(data.ready.missing);
      setActiveId(data.activeSignal?.id || null);
      if (data.settings.activationSecret) setActivationSecret(data.settings.activationSecret);

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const poll = await personalSafetyAPI.poll(pos.coords.latitude, pos.coords.longitude);
            setNearby(poll.nearbySignals || []);
            if (poll.myActiveSignal) setActiveId(poll.myActiveSignal.id);

            if (data.settings.autoArmWhenOutside && data.ready.ready && !data.settings.armed && !data.activeSignal) {
              await personalSafetyAPI.arm(pos.coords.latitude, pos.coords.longitude);
              const refreshed = await personalSafetyAPI.getSettings();
              setSettings(refreshed.settings);
            }
          },
          () => {}
        );
      }
    } catch {
      /* silent */
    }
  }, [user?.id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    const onChange = () => load();
    window.addEventListener('safety:signal-changed', onChange);
    window.addEventListener('safety:settings-changed', onChange);
    return () => {
      clearInterval(t);
      window.removeEventListener('safety:signal-changed', onChange);
      window.removeEventListener('safety:settings-changed', onChange);
    };
  }, [load]);

  const getLocation = () =>
    new Promise<{ lat: number; lon: number }>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
        reject,
        { enableHighAccuracy: true, timeout: 15000 }
      );
    });

  const triggerSignal = useCallback(
    async (via: 'help_button' | 'secret_word' | 'screen_taps' | 'volume_taps' | 'custom_phrase', phrase?: string) => {
      if (!user?.id || sending) return;
      setSending(true);
      setStatus('');
      try {
        const { lat, lon } = await getLocation();
        const res = await personalSafetyAPI.trigger(lat, lon, via, phrase);
        setActiveId(res.alert.id);
        setStatus(res.message);
        window.dispatchEvent(new CustomEvent('safety:signal-changed'));
        window.location.href = `tel:${res.policeNumber}`;
      } catch (e: unknown) {
        setStatus((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Could not send safety signal.');
      } finally {
        setSending(false);
      }
    },
    [user?.id, sending]
  );

  const armed = settings?.armed ?? false;
  const canTrigger = ready && (armed || settings?.enableHelpButton);

  useVolumeTripleSOS(() => {
    if (settings?.enableVolumeTaps && canTrigger) triggerSignal('volume_taps');
  }, !!(settings?.enableVolumeTaps && canTrigger));

  useScreenTapSOS(
    () => {
      if (settings?.enableScreenTaps && armed) triggerSignal('screen_taps');
    },
    settings?.screenTapCount || 5,
    !!(settings?.enableScreenTaps && armed && !activeId)
  );

  const saveSetup = async () => {
    if (activationSecret.trim().length < 3) {
      setStatus('Pick a word only you would shout — at least 3 letters.');
      return;
    }
    setSending(true);
    try {
      await personalSafetyAPI.updateSettings({
        activationSecret: activationSecret.trim(),
        enableHelpButton: true,
        enableScreenTaps: true,
        enableVolumeTaps: true,
        enableSecretWord: true,
        screenTapCount: 5,
        autoArmWhenOutside: true,
      });
      setShowSetup(false);
      window.dispatchEvent(new CustomEvent('safety:settings-changed'));
      await load();
      setStatus(
        speechRecognitionSupported()
          ? 'Word saved. This device will listen — shout it to activate.'
          : 'Word saved. Voice detection is not available in this browser; use the Help button if you need it.'
      );
    } finally {
      setSending(false);
    }
  };

  const cancelFalseAlarm = async () => {
    setSending(true);
    try {
      const res = await personalSafetyAPI.cancelFalseAlarm();
      setActiveId(null);
      setStatus(res.message);
      window.dispatchEvent(new CustomEvent('safety:signal-changed'));
      await load();
    } catch (e: unknown) {
      setStatus((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Could not cancel.');
    } finally {
      setSending(false);
    }
  };

  if (!user?.id || !visible) return null;

  return (
    <div className="personal-safety-shield pss-embed">
      {settings?.armed && !activeId && (
        <span className="pss-status-chip">
          Shield armed
          {speechRecognitionSupported() && settings.hasActivationSecret ? ' · listening for your word' : ''}
        </span>
      )}
      {activeId && <span className="pss-status-chip">Safety signal active — tap False alarm if you are safe</span>}

      <div className="pss-panel" role="dialog">
        <h3>Personal safety shield</h3>
        <p className="pss-hint">
          Not an amber alert — your <strong>safety signal</strong>. Share exact location with nearby users, your emergency contact, and police. Shout your secret word to activate. False alarm is a button that tells everyone who got the alert.
        </p>

        {!ready && !showSetup && (
          <>
            <p className="pss-setup-warn">Setup needed: {missing.join(', ')}</p>
            <button type="button" className="pss-btn primary" onClick={() => setShowSetup(true)}>
              Set your activation word
            </button>
          </>
        )}

        {showSetup && (
          <div className="pss-section">
            <div className="pss-section-title">Your activation word (only you know)</div>
            <label className="pss-hint">Shout this word to turn the shield on. This device listens after you save.</label>
            <input
              className="pss-input"
              value={activationSecret}
              onChange={(e) => setActivationSecret(e.target.value)}
              placeholder="e.g. red bicycle"
            />
            {!speechRecognitionSupported() && (
              <p className="pss-setup-warn">Voice detection needs Chrome or Edge with a microphone.</p>
            )}
            <button type="button" className="pss-btn safe" disabled={sending} onClick={saveSetup}>
              Save word &amp; start listening
            </button>
          </div>
        )}

        {ready && !activeId && (
          <>
            <div className="pss-section">
              <div className="pss-section-title">Triggers</div>
              <p className="pss-hint">
                Shout your word · Help button · {settings?.screenTapCount} screen taps · volume down ×3
              </p>
              {ready && (
                <button type="button" className="pss-btn ghost" onClick={() => setShowSetup(true)}>
                  Change activation word
                </button>
              )}
              {!settings?.armed ? (
                <button
                  type="button"
                  className="pss-btn safe"
                  disabled={sending}
                  onClick={async () => {
                    try {
                      await askWhatYouAreWearing();
                      const { lat, lon } = await getLocation();
                      const res = await personalSafetyAPI.arm(lat, lon);
                      setSettings(res.settings);
                      setStatus(res.message);
                      window.dispatchEvent(new CustomEvent('safety:settings-changed'));
                    } catch (e: unknown) {
                      setStatus((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Could not arm');
                    }
                  }}
                >
                  I&apos;m going out — arm shield
                </button>
              ) : (
                <button type="button" className="pss-btn ghost" onClick={() => personalSafetyAPI.disarm().then(load)}>
                  Disarm (home safe)
                </button>
              )}
            </div>

            <div className="pss-section">
              <div className="pss-section-title">Need help now</div>
              <button type="button" className="pss-btn primary" disabled={sending || !canTrigger} onClick={() => triggerSignal('help_button')}>
                Help — send safety signal
              </button>
            </div>
          </>
        )}

        {activeId && (
          <div className="pss-section">
            <div className="pss-section-title">False alarm?</div>
            <p className="pss-hint">
              Tap the button if you are safe. Everyone who received your alert gets an all-clear.
            </p>
            <button type="button" className="pss-btn safe" disabled={sending} onClick={cancelFalseAlarm}>
              False alarm — notify everyone
            </button>
          </div>
        )}

        {nearby.length > 0 && (
          <div className="pss-nearby">
            <strong>Nearby safety signals</strong>
            {nearby.map((s) => (
              <div key={s.id} style={{ marginTop: 6 }}>
                {s.userName} — {s.appearanceDescription || 'No description'}
                <br />
                <a href={`https://www.google.com/maps?q=${s.lat},${s.lon}`} target="_blank" rel="noopener noreferrer">
                  Open exact location
                </a>
              </div>
            ))}
          </div>
        )}

        {status && <p className="pss-hint" style={{ color: '#86efac', marginTop: 10 }}>{status}</p>}
      </div>
    </div>
  );
}
