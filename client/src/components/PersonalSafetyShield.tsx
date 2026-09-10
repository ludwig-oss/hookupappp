import { useCallback, useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { personalSafetyAPI, ShieldSettings } from '../api/personalSafety';
import { safetyAPI, type EmergencyContact } from '../api/safety';
import { useVolumeTripleSOS } from '../hooks/useVolumeTripleSOS';
import { useScreenTapSOS } from '../hooks/useScreenTapSOS';
import { speechRecognitionSupported, speechRecognitionSupportHint, ensureMicPermission } from '../hooks/useActivationWordListener';
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
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await personalSafetyAPI.getSettings();
      setSettings(data.settings);
      setReady(data.ready.ready);
      setMissing(data.ready.missing);
      setActiveId(data.activeSignal?.id || null);
      if (data.settings.activationSecret) setActivationSecret(data.settings.activationSecret);
      safetyAPI.getEmergencyContacts().then((r) => setContacts(r.contacts || [])).catch(() => {});

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
      const fromUser = (user as { location?: { lat?: number; lon?: number } } | null)?.location;
      const fallback =
        settings?.lastLocation ||
        (typeof fromUser?.lat === 'number' && typeof fromUser?.lon === 'number'
          ? { lat: fromUser.lat, lon: fromUser.lon }
          : null);
      if (!navigator.geolocation) {
        if (fallback) return resolve(fallback);
        reject(new Error('Turn on location to arm the shield.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
        (err) => {
          if (fallback) resolve(fallback);
          else reject(new Error(err.message || 'Could not get GPS. Allow location and try again.'));
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
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
        setStatus(
          res.nearbyNotified > 0
            ? `Help is on the way — ${res.nearbyNotified} nearby people got your exact location. They can text you to check in. False alarm cancels the alert.`
            : `Help signal sent. Nearby helpers will see your pin when they are online. Keep the app open.`
        );
        window.dispatchEvent(new CustomEvent('safety:signal-changed'));
        // Do not auto-dial emergency services — user can call from the alert screen if needed
      } catch (e: unknown) {
        setStatus((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Could not send safety signal.');
      } finally {
        setSending(false);
      }
    },
    [user?.id, sending, settings?.lastLocation, user]
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
      const micOk = await ensureMicPermission();
      window.dispatchEvent(new CustomEvent('safety:settings-changed'));
      await load();
      if (!speechRecognitionSupported()) {
        setStatus(`Word saved. ${speechRecognitionSupportHint()} Use the Help button if you need it.`);
      } else if (!micOk) {
        setStatus('Word saved. Allow the microphone when asked so voice detection can stay on.');
      } else {
        setStatus('Word saved. Voice detector is on for this device (PC or phone) while the app is open — shout your word to activate.');
      }
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
      {settings?.hasActivationSecret && settings.enableSecretWord && !activeId && (
        <span className="pss-status-chip">
          {speechRecognitionSupported()
            ? 'Voice detector on · listening for your word'
            : 'Activation word saved · voice needs Chrome/Edge'}
        </span>
      )}
      {settings?.armed && !activeId && <span className="pss-status-chip">Shield armed</span>}
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
            <label className="pss-hint">Shout this word to turn the shield on. Listening stays on while the app is open (PC or phone).</label>
            <input
              className="pss-input"
              value={activationSecret}
              onChange={(e) => setActivationSecret(e.target.value)}
              placeholder="e.g. red bicycle"
            />
            <p className="pss-hint" style={{ marginTop: 8 }}>{speechRecognitionSupportHint()}</p>
            {!speechRecognitionSupported() && (
              <p className="pss-setup-warn">Voice detection needs Chrome or Edge with a microphone.</p>
            )}
            <button type="button" className="pss-btn safe" disabled={sending} onClick={saveSetup}>
              Save word &amp; keep listening on
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
                    setSending(true);
                    setStatus('');
                    try {
                      // Optional appearance prompt — never block arming if skipped/timed out
                      await Promise.race([
                        askWhatYouAreWearing(),
                        new Promise<null>((r) => setTimeout(() => r(null), 25000)),
                      ]);
                      const { lat, lon } = await getLocation();
                      const res = await personalSafetyAPI.arm(lat, lon);
                      setSettings(res.settings);
                      setStatus(res.message || 'Shield armed. Shout your word or tap Help if you need it.');
                      window.dispatchEvent(new CustomEvent('safety:settings-changed'));
                    } catch (e: unknown) {
                      const msg =
                        (e as { response?: { data?: { error?: string } }; message?: string })?.response?.data
                          ?.error ||
                        (e as { message?: string })?.message ||
                        'Could not arm — allow location and set your activation word.';
                      setStatus(msg);
                    } finally {
                      setSending(false);
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
              <div className="pss-section-title">Emergency contact (Hook Up user)</div>
              <p className="pss-hint">
                Paste a friend&apos;s account user id so they get your pin in-app. Phone contacts from Safety plans still
                work for meetup check-ins.
                {contacts.length > 0 ? ` You have ${contacts.length} phone contact(s) on file.` : ''}
              </p>
              <input
                className="pss-input"
                value={settings?.emergencyContactUserId || ''}
                placeholder="Friend’s user id (optional)"
                onChange={(e) =>
                  setSettings((s) => (s ? { ...s, emergencyContactUserId: e.target.value || null } : s))
                }
                onBlur={async (e) => {
                  const v = e.target.value.trim() || null;
                  try {
                    const r = await personalSafetyAPI.updateSettings({ emergencyContactUserId: v });
                    setSettings(r.settings);
                  } catch {
                    setStatus('Could not save emergency contact.');
                  }
                }}
              />
            </div>

            <div className="pss-section">
              <div className="pss-section-title">Need help now</div>
              <button type="button" className="pss-btn primary" disabled={sending || !canTrigger} onClick={() => triggerSignal('help_button')}>
                Help — send safety signal
              </button>
              {!armed && (
                <p className="pss-hint" style={{ marginTop: 8 }}>
                  Tip: arm the shield when you go out, or tap Help anytime if the help button is enabled.
                </p>
              )}
            </div>
          </>
        )}

        {activeId && (
          <div className="pss-section">
            <div className="pss-section-title">Help is on the way</div>
            <p className="pss-hint">
              Nearby people and your emergency contact can see your exact pin and may text to ask if you are OK. Stay where you can reply if it is safe.
            </p>
            <div className="pss-section-title">False alarm?</div>
            <p className="pss-hint">
              Tap below if you are safe. Everyone who received your alert gets an all-clear.
            </p>
            <button type="button" className="pss-btn safe" disabled={sending} onClick={cancelFalseAlarm}>
              False alarm — notify everyone
            </button>
            <a className="pss-btn primary" style={{ display: 'block', textAlign: 'center', marginTop: 10, textDecoration: 'none' }} href="tel:112">
              Call local emergency (optional)
            </a>
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
