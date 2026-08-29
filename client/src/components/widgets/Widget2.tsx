import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { nearbyAPI, NearbyUser, BuzzRequest } from '../../api/nearby';
import { openChatWithUser } from '../../lib/openChat';
import './Widget.css';

const Widget2 = () => {
  const { user } = useContext(AuthContext);
  const [geoEnabled, setGeoEnabled] = useState(false);
  const [geoError, setGeoError] = useState<string>('');
  const [coords, setCoords] = useState<{ lat: number; lon: number; accuracy?: number } | null>(null);
  const [manualCoords, setManualCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [nearby, setNearby] = useState<NearbyUser[]>([]);
  const [incoming, setIncoming] = useState<BuzzRequest[]>([]);
  const [outgoing, setOutgoing] = useState<BuzzRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string>('');
  const [uplift, setUplift] = useState<string>('');
  const watchIdRef = useRef<number | null>(null);

  const activeCoords = useMemo(() => coords ?? (manualCoords ? { ...manualCoords } : null), [coords, manualCoords]);

  useEffect(() => {
    if (!user?.id) return;
    // Poll buzz inbox/outbox
    const tick = async () => {
      try {
        const b = await nearbyAPI.getBuzz(user.id);
        setIncoming(b.incoming);
        setOutgoing(b.outgoing);
      } catch {
        // ignore
      }
    };
    tick();
    const interval = window.setInterval(tick, 2500);
    return () => window.clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;
    if (!activeCoords) return;
    // Poll nearby list and push location
    const tick = async () => {
      try {
        await nearbyAPI.updateLocation(user.id, activeCoords.lat, activeCoords.lon, activeCoords.accuracy);
        const res = await nearbyAPI.getNearbyUsers(user.id, activeCoords.lat, activeCoords.lon);
        setNearby(res.nearby);
      } catch (e) {
        // ignore
      }
    };
    tick();
    const interval = window.setInterval(tick, 3000);
    return () => window.clearInterval(interval);
  }, [user, activeCoords]);

  const enableGeolocation = () => {
    setGeoError('');
    setUplift('');
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported in this browser.');
      return;
    }

    setGeoEnabled(true);
    // One-shot first
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => setGeoError(err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    // Continuous watch for moving scenarios (bus/train)
    try {
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          setCoords({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        (err) => setGeoError(err.message),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
      watchIdRef.current = id;
    } catch {
      // ignore
    }
  };

  const disableGeolocation = () => {
    setGeoEnabled(false);
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setCoords(null);
  };

  const sendBuzz = async (toUserId: string) => {
    if (!user?.id) return;
    setLoading(true);
    setToast('');
    try {
      const res = await nearbyAPI.sendBuzz(user.id, toUserId);
      const chatId = (res as { chatUserId?: string }).chatUserId;
      if (chatId) openChatWithUser(chatId);
      setToast(chatId ? "It's a match! Open Communications to chat." : 'Buzz sent!');
      const b = await nearbyAPI.getBuzz(user.id);
      setIncoming(b.incoming);
      setOutgoing(b.outgoing);
    } catch (e: any) {
      setToast(e?.response?.data?.error || 'Failed to send buzz');
    } finally {
      setLoading(false);
      window.setTimeout(() => setToast(''), 2000);
    }
  };

  const respond = async (buzzId: string, value: 'yes' | 'no' | 'later') => {
    if (!user?.id) return;
    setLoading(true);
    setToast('');
    setUplift('');
    try {
      const res = await nearbyAPI.respondBuzz(user.id, buzzId, value);
      if (res.buzz.responseMessage) {
        if (value === 'no') setUplift(res.buzz.responseMessage);
        else setToast(res.buzz.responseMessage);
      }

      // On yes/later: tell Chat widget who to open
      if (value === 'yes' || value === 'later') {
        const senderId = (res as { chatUserId?: string }).chatUserId
          || incoming.find(b => b.id === buzzId)?.fromUserId;
        if (senderId) openChatWithUser(senderId);
      }

      const b = await nearbyAPI.getBuzz(user.id);
      setIncoming(b.incoming);
      setOutgoing(b.outgoing);
    } catch (e: any) {
      setToast(e?.response?.data?.error || 'Failed to respond');
    } finally {
      setLoading(false);
      window.setTimeout(() => setToast(''), 2500);
    }
  };

  const setManual = (latStr: string, lonStr: string) => {
    const lat = Number(latStr);
    const lon = Number(lonStr);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return;
    setManualCoords({ lat, lon });
  };

  return (
    <div className="widget">
      <h2 className="widget-title">
        <span>📍</span> Nearby Buzz (50m)
      </h2>
      <div className="widget-content">
        <p style={{ marginBottom: 12, color: '#6b7280' }}>
          See active users within 50 meters and “buzz” them to show interest.
        </p>

        {toast && <div className="success-toast">{toast}</div>}
        {uplift && <div className="uplift-message">{uplift}</div>}

        <div className="nearby-controls">
          {!geoEnabled ? (
            <button className="select-user-btn" onClick={enableGeolocation}>
              Enable Live Location
            </button>
          ) : (
            <button className="back-btn" onClick={disableGeolocation}>
              Disable Location
            </button>
          )}
          {geoError && <div className="error-message" style={{ marginTop: 12 }}>{geoError}</div>}

          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: 'pointer', color: '#374151', fontWeight: 600 }}>
              GPS weak indoors? Use manual location (test/fallback)
            </summary>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <input
                className="nearby-input"
                placeholder="lat"
                onChange={(e) => setManualCoords((prev) => ({ lat: Number(e.target.value || prev?.lat), lon: prev?.lon ?? 0 }))}
              />
              <input
                className="nearby-input"
                placeholder="lon"
                onChange={(e) => setManualCoords((prev) => ({ lat: prev?.lat ?? 0, lon: Number(e.target.value || prev?.lon) }))}
              />
              <button
                className="send-btn"
                onClick={() => {
                  const lat = manualCoords?.lat ?? 0;
                  const lon = manualCoords?.lon ?? 0;
                  setManual(String(lat), String(lon));
                }}
              >
                Use Manual
              </button>
              <button className="back-btn" onClick={() => setManualCoords(null)}>Clear</button>
            </div>
            <p style={{ marginTop: 8, color: '#6b7280', fontSize: 12 }}>
              This helps inside buildings/underground when GPS accuracy is limited.
            </p>
          </details>
        </div>

        <div className="nearby-section">
          <h4 style={{ margin: '16px 0 10px', color: '#1f2937' }}>Active nearby users</h4>
          {!activeCoords ? (
            <p className="no-users">Enable location (or manual fallback) to see nearby users.</p>
          ) : nearby.length === 0 ? (
            <p className="no-users">No active users within 50m right now.</p>
          ) : (
            <div className="users-list" style={{ maxHeight: 220 }}>
              {nearby.map((u) => (
                <div key={u.id} className="user-item">
                  <div className="user-avatar">
                    {u.profilePicture ? <img src={u.profilePicture} alt={u.name} /> : <div className="avatar-placeholder">{u.name[0]}</div>}
                  </div>
                  <div className="user-details" style={{ flex: 1 }}>
                    <h4>{u.name} <span style={{ color: '#6b7280', fontWeight: 500 }}>@{u.username}</span></h4>
                    <p style={{ fontSize: 12 }}>{u.distanceMeters}m away {u.accuracy ? `(±${Math.round(u.accuracy)}m)` : ''}</p>
                  </div>
                  <button className="send-btn" disabled={loading} onClick={() => sendBuzz(u.id)}>
                    Buzz
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="nearby-section">
          <h4 style={{ margin: '18px 0 10px', color: '#1f2937' }}>Buzz requests</h4>
          {incoming.length === 0 ? (
            <p className="no-users">No new buzzes.</p>
          ) : (
            <div className="buzz-list">
              {incoming.map((b) => (
                <div key={b.id} className="buzz-item">
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, color: '#374151' }}>
                      Someone nearby is interested in you.
                    </p>
                    <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 12 }}>
                      Choose a response:
                    </p>
                  </div>
                  <div className="buzz-actions">
                    <button className="send-btn" disabled={loading} onClick={() => respond(b.id, 'yes')}>
                      Yes
                    </button>
                    <button className="back-btn" disabled={loading} onClick={() => respond(b.id, 'later')}>
                      Talk later
                    </button>
                    <button className="danger-btn" disabled={loading} onClick={() => respond(b.id, 'no')}>
                      No
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h4 style={{ margin: '18px 0 10px', color: '#1f2937' }}>Your recent buzzes</h4>
          {outgoing.length === 0 ? (
            <p className="no-users">No buzzes sent yet.</p>
          ) : (
            <div className="buzz-list">
              {outgoing.slice(0, 5).map((b) => (
                <div key={b.id} className="buzz-item">
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, color: '#374151' }}>
                      Status: <strong>{b.status}</strong>
                    </p>
                    {b.responseMessage && (
                      <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 12 }}>
                        {b.responseMessage}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Widget2;


