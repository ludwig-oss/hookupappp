import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { safetyAPI, MeetupPlan } from '../api/safety';
import { voiceRecordingAPI } from '../api/voiceRecording';
import VoiceSafetyPanel from './VoiceSafetyPanel';
import './DateSafetyMonitor.css';

function playAmberAlert() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, 800);
  } catch {
    /* ignore */
  }
}

export default function DateSafetyMonitor() {
  const { user } = useContext(AuthContext);
  const [dueCheckIn, setDueCheckIn] = useState<MeetupPlan | null>(null);
  const [dangerAlerts, setDangerAlerts] = useState<MeetupPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [trailView, setTrailView] = useState<{ planId: string; trail: Array<{ lat: number; lon: number; dwellMinutes?: number; label?: string }>; daterName?: string } | null>(null);
  const [ok360, setOk360] = useState('');
  const [loading, setLoading] = useState(false);
  const [emergencyPin, setEmergencyPin] = useState('');
  const [emergencyAudio, setEmergencyAudio] = useState<Array<{ id: string; audioDataUrl?: string | null }>>([]);
  const watchRef = useRef<number | null>(null);

  const poll = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await safetyAPI.pollDateSafety();
      if (data.dueCheckIns?.length) setDueCheckIn(data.dueCheckIns[0]);
      if (data.dangerAlerts?.length) {
        setDangerAlerts(data.dangerAlerts);
        playAmberAlert();
      }
      if (data.activeSessions?.length) setActivePlanId(data.activeSessions[0].id);
    } catch {
      /* silent */
    }
  }, [user?.id]);

  useEffect(() => {
    poll();
    const t = setInterval(poll, 45000);
    return () => clearInterval(t);
  }, [poll]);

  useEffect(() => {
    if (!activePlanId || !navigator.geolocation) return;
    const postLoc = (lat: number, lon: number, accuracy?: number) => {
      safetyAPI.postLocation(activePlanId, lat, lon, accuracy).catch(() => {});
    };
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => postLoc(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
      () => {},
      { enableHighAccuracy: true, maximumAge: 30000 }
    );
    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, [activePlanId]);

  const respondCheckIn = async (isSafe: boolean, datePartnerOk?: boolean) => {
    if (!dueCheckIn) return;
    setLoading(true);
    try {
      await safetyAPI.submitCheckIn(dueCheckIn.id, isSafe, datePartnerOk);
      setDueCheckIn(null);
    } finally {
      setLoading(false);
    }
  };

  const openTrail = async (planId: string) => {
    setLoading(true);
    try {
      const res = await safetyAPI.getEmergencyTrail(planId);
      setTrailView({ planId, trail: res.trail, daterName: res.daterName });
    } catch (e: unknown) {
      alert((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Could not load trail');
    } finally {
      setLoading(false);
    }
  };

  const submitOkRest = async () => {
    if (!dueCheckIn || !ok360.trim()) return;
    setLoading(true);
    try {
      await safetyAPI.submitOkRest(dueCheckIn.id, ok360.trim());
      setDueCheckIn(null);
      setOk360('');
    } finally {
      setLoading(false);
    }
  };

  const unlockEmergencyRecording = async (planId: string) => {
    if (!emergencyPin.trim()) {
      alert('Enter the PIN your contact gave you.');
      return;
    }
    setLoading(true);
    try {
      const res = await voiceRecordingAPI.emergencyAccess(planId, emergencyPin.trim());
      setEmergencyAudio(res.chunks.filter((c) => c.audioDataUrl));
      alert(res.message);
    } catch (e: unknown) {
      alert((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Access denied');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {activePlanId && (
        <div className="date-safety-voice-wrap">
          <VoiceSafetyPanel mode="date" planId={activePlanId} />
        </div>
      )}
      {dueCheckIn && (
        <div className="date-safety-overlay">
          <div className="date-safety-card">
            <p className="date-safety-title">Safety check-in (every 2 hours)</p>
            <p className="date-safety-body">Are you safe? Is your date OK?</p>
            <div className="date-safety-actions">
              <button type="button" disabled={loading} onClick={() => respondCheckIn(true, true)}>
                Yes, we&apos;re OK
              </button>
              <button type="button" disabled={loading} className="danger" onClick={() => respondCheckIn(false)}>
                Not safe — alert contact
              </button>
            </div>
            <details style={{ marginTop: 12 }}>
              <summary>I&apos;m OK for the rest of the date (360° video)</summary>
              <textarea
                value={ok360}
                onChange={(e) => setOk360(e.target.value)}
                placeholder="Paste 360° video data URL or upload link as proof"
                rows={2}
                style={{ width: '100%', marginTop: 8 }}
              />
              <button type="button" disabled={loading || !ok360.trim()} onClick={submitOkRest} style={{ marginTop: 8 }}>
                Submit &amp; pause check-ins
              </button>
            </details>
          </div>
        </div>
      )}

      {dangerAlerts.map((p) => (
        <div key={p.id} className="date-safety-amber">
          <p className="amber-title">Safety signal — date help</p>
          <p>Your contact may need help. View their safety trail (red dots = stops).</p>
          <button type="button" disabled={loading} onClick={() => openTrail(p.id)}>
            View safety trail
          </button>
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: 12 }}>Voice recording (PIN required — missing/emergency only):</p>
            <input
              type="password"
              placeholder="Emergency PIN"
              value={emergencyPin}
              onChange={(e) => setEmergencyPin(e.target.value)}
              style={{ marginRight: 8, padding: 6 }}
            />
            <button type="button" disabled={loading} onClick={() => unlockEmergencyRecording(p.id)}>
              Unlock recording
            </button>
            {emergencyAudio.map((c) =>
              c.audioDataUrl ? <audio key={c.id} controls src={c.audioDataUrl} style={{ display: 'block', width: '100%', marginTop: 6 }} /> : null
            )}
          </div>
        </div>
      ))}

      {trailView && (
        <div className="date-safety-overlay">
          <div className="date-safety-card trail-card">
            <p className="date-safety-title">Trail — {trailView.daterName || 'Contact'}</p>
            <p className="date-safety-body">Red dots = stops. Numbers = minutes at each spot.</p>
            <ul className="trail-list">
              {trailView.trail.map((pt, i) => (
                <li key={i} className="trail-dot">
                  <span className="dot" />
                  {pt.lat.toFixed(5)}, {pt.lon.toFixed(5)}
                  {pt.dwellMinutes ? ` · ${pt.dwellMinutes} min` : ''}
                  {pt.label ? ` · ${pt.label}` : ''}
                  <a
                    href={`https://www.google.com/maps?q=${pt.lat},${pt.lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Map
                  </a>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setTrailView(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
