import { useCallback, useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { personalSafetyAPI, ShieldSettings } from '../api/personalSafety';
import { useVolumeTripleSOS } from '../hooks/useVolumeTripleSOS';
import { useScreenTapSOS } from '../hooks/useScreenTapSOS';
import './PersonalSafetyShield.css';

export default function PersonalSafetyShield() {
  const { user } = useContext(AuthContext);
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<ShieldSettings | null>(null);
  const [ready, setReady] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [nearby, setNearby] = useState<Array<{ id: string; userName: string; lat: number; lon: number; appearanceDescription?: string }>>([]);
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [activationSecret, setActivationSecret] = useState('');
  const [cancelSecret, setCancelSecret] = useState('');
  const [appearance, setAppearance] = useState('');
  const [cancelInput, setCancelInput] = useState('');
  const [phraseInput, setPhraseInput] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await personalSafetyAPI.getSettings();
      setSettings(data.settings);
      setReady(data.ready.ready);
      setMissing(data.ready.missing);
      setActiveId(data.activeSignal?.id || null);
      setAppearance(data.settings.appearanceDescription || '');

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
    return () => clearInterval(t);
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
    setSending(true);
    try {
      await personalSafetyAPI.updateSettings({
        activationSecret,
        cancelSecret,
        appearanceDescription: appearance,
        enableHelpButton: true,
        enableScreenTaps: true,
        enableVolumeTaps: true,
        enableSecretWord: true,
        screenTapCount: 5,
        autoArmWhenOutside: true,
      });
      setShowSetup(false);
      setActivationSecret('');
      setCancelSecret('');
      await load();
      setStatus('Safety shield configured. Arm it when you go out.');
    } finally {
      setSending(false);
    }
  };

  const cancelFalseAlarm = async () => {
    if (!cancelInput.trim()) return;
    setSending(true);
    try {
      const res = await personalSafetyAPI.cancelFalseAlarm(cancelInput.trim());
      setActiveId(null);
      setCancelInput('');
      setStatus(res.message);
      await load();
    } catch (e: unknown) {
      setStatus((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Wrong cancel phrase.');
    } finally {
      setSending(false);
    }
  };

  const tryPhraseTrigger = async () => {
    if (!phraseInput.trim()) return;
    await triggerSignal('secret_word', phraseInput.trim());
    setPhraseInput('');
  };

  if (!user?.id) return null;

  return (
    <div className="personal-safety-shield">
      {settings?.armed && !activeId && (
        <span className="pss-status-chip">Shield armed · {settings.screenTapCount} taps · volume ×3 · secret word</span>
      )}
      {activeId && <span className="pss-status-chip">Safety signal active — server keeps alerting if phone dies</span>}

      <button
        type="button"
        className={`pss-fab ${settings?.armed ? 'armed' : ''} ${activeId ? 'active-alert' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label="Personal safety shield"
      >
        <span>{activeId ? '🆘' : settings?.armed ? '🛡️' : '⚙️'}</span>
        <span>{activeId ? 'Signal active' : settings?.armed ? 'Shield on' : 'Safety shield'}</span>
      </button>

      {open && (
        <div className="pss-panel" role="dialog">
          <h3>Personal safety shield</h3>
          <p className="pss-hint">
            Not an amber alert — your <strong>safety signal</strong>. Share exact location with nearby users, your emergency contact, and police. Configure secret activate &amp; cancel phrases.
          </p>

          {!ready && !showSetup && (
            <>
              <p className="pss-setup-warn">Setup needed: {missing.join(', ')}</p>
              <button type="button" className="pss-btn primary" onClick={() => setShowSetup(true)}>
                Configure triggers
              </button>
            </>
          )}

          {showSetup && (
            <div className="pss-section">
              <div className="pss-section-title">Your secrets (only you know)</div>
              <label className="pss-hint">Activation — shout, type, or custom phrase</label>
              <input className="pss-input" value={activationSecret} onChange={(e) => setActivationSecret(e.target.value)} placeholder="e.g. red bicycle" />
              <label className="pss-hint">Cancel — false alarm (notifies everyone)</label>
              <input className="pss-input" value={cancelSecret} onChange={(e) => setCancelSecret(e.target.value)} placeholder="e.g. all clear pineapple" />
              <label className="pss-hint">What you&apos;re wearing / how you look</label>
              <input className="pss-input" value={appearance} onChange={(e) => setAppearance(e.target.value)} placeholder="Red jacket, blue jeans, white sneakers" />
              <button type="button" className="pss-btn safe" disabled={sending} onClick={saveSetup}>Save setup</button>
            </div>
          )}

          {ready && !activeId && (
            <>
              <div className="pss-section">
                <div className="pss-section-title">Triggers</div>
                <p className="pss-hint">Help button · {settings?.screenTapCount} screen taps · volume down ×3 · secret word</p>
                {!settings?.armed ? (
                  <button
                    type="button"
                    className="pss-btn safe"
                    disabled={sending}
                    onClick={async () => {
                      try {
                        const { lat, lon } = await getLocation();
                        const res = await personalSafetyAPI.arm(lat, lon);
                        setSettings(res.settings);
                        setStatus(res.message);
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
                <input className="pss-input" value={phraseInput} onChange={(e) => setPhraseInput(e.target.value)} placeholder="Or type your secret activation phrase" />
                <button type="button" className="pss-btn" disabled={sending || !phraseInput.trim()} onClick={tryPhraseTrigger}>
                  Activate with secret phrase
                </button>
              </div>
            </>
          )}

          {activeId && (
            <div className="pss-section">
              <div className="pss-section-title">False alarm?</div>
              <p className="pss-hint">Enter your private cancel phrase — nearby users get &quot;false alarm — all clear&quot;.</p>
              <input className="pss-input" type="password" value={cancelInput} onChange={(e) => setCancelInput(e.target.value)} placeholder="Cancel secret" />
              <button type="button" className="pss-btn safe" disabled={sending} onClick={cancelFalseAlarm}>
                Cancel — false alarm
              </button>
              <button
                type="button"
                className="pss-btn ghost"
                disabled={sending}
                onClick={async () => {
                  await personalSafetyAPI.resolve(activeId);
                  setActiveId(null);
                  setStatus('Signal resolved — you are safe.');
                  load();
                }}
              >
                I&apos;m safe — end signal
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
          <button type="button" className="pss-btn ghost" style={{ marginTop: 8 }} onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}
