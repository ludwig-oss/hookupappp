import { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { connectionsAPI, NearbyUser, VenueCount, Buzz } from '../../api/connections';
import { openChatWithUser } from '../../lib/openChat';
import { formatAxiosError } from '../../lib/apiError';
import { markLocationGranted, clearLocationGranted, isLocationGranted, readStoredCoords, nearbyRadiusForCoords, resolveWorkingCoords, requestGpsFromUserTap } from '../../lib/locationSession';
import './Widget.css';

const NEARBY_DISCOVERY_RADIUS_M = 500;

const locationApi = {
  getMyLocation: () => connectionsAPI.getMyLocation(),
  forwardGeocode: (q: string) => connectionsAPI.forwardGeocode(q),
  updateLocation: (data: Parameters<typeof connectionsAPI.updateLocation>[0]) =>
    connectionsAPI.updateLocation(data),
};

const VENUE_RADIUS_OPTIONS = [
  { value: 500, label: '500 m' },
  { value: 1000, label: '1 km' },
  { value: 2000, label: '2 km' },
  { value: 5000, label: '5 km' },
];

export interface PlaceCountOnly {
  venue: string;
  venueType: string;
  location: { lat: number; lon: number };
  count: number;
}

const PLACE_TYPES = [
  { value: 'bar', label: 'Bar' },
  { value: 'supermarket', label: 'Supermarket' },
  { value: 'mall', label: 'Mall' },
  { value: 'park', label: 'Park' },
  { value: 'amusement_park', label: 'Amusement park' },
  { value: 'cinema', label: 'Cinema' },
  { value: 'club', label: 'Club / Nightclub' },
  { value: 'cafe', label: 'Café' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'gym', label: 'Gym / Fitness' },
  { value: 'museum', label: 'Museum / Gallery' },
  { value: 'library', label: 'Library' },
  { value: 'theatre', label: 'Theatre' },
  { value: 'shopping', label: 'Shopping (any)' },
];

const ConnectionsWidget = () => {
  const { user, updateUser } = useContext(AuthContext);
  const [view, setView] = useState<'main' | 'nearby' | 'venues' | 'buzzes' | 'search_places'>('main');
  const [venues, setVenues] = useState<VenueCount[]>([]);
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [buzzes, setBuzzes] = useState<{ received: Buzz[]; sent: Buzz[] }>({ received: [], sent: [] });
  const [location, setLocation] = useState<{ lat: number; lon: number; accuracy?: number } | null>(null);
  const [connectionsVisible, setConnectionsVisible] = useState(true);
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [venueRadius, setVenueRadius] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [comfortingMessage, setComfortingMessage] = useState<string | null>(null);
  const locationWatchRef = useRef<number | null>(null);
  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const buzzInitializedRef = useRef(false);
  const knownBuzzIdsRef = useRef<Set<string>>(new Set());

  const [searchPlaceQuery, setSearchPlaceQuery] = useState('');
  const [searchPlaceType, setSearchPlaceType] = useState('bar');
  const [searchPlaceResults, setSearchPlaceResults] = useState<PlaceCountOnly[]>([]);
  const [searchPlaceLocationName, setSearchPlaceLocationName] = useState<string | null>(null);
  const [searchPlaceMostConcentrated, setSearchPlaceMostConcentrated] = useState<PlaceCountOnly | null>(null);
  const [searchPlacesLoading, setSearchPlacesLoading] = useState(false);
  const [locationDeclined, setLocationDeclined] = useState(false);
  const [requestingLocation, setRequestingLocation] = useState(false);

  const fetchPlaceLabel = async (lat: number, lon: number) => {
    try {
      const { city, country, displayName } = await connectionsAPI.reverseGeocode(lat, lon);
      if (city && country) setPlaceLabel(`${city}, ${country}`);
      else if (displayName) setPlaceLabel(displayName);
      else setPlaceLabel(null);
    } catch {
      setPlaceLabel(null);
    }
  };

  const pushLocation = useCallback(async (coords: { lat: number; lon: number; accuracy?: number }, visible?: boolean) => {
    if (!user?.id) return;
    const vis = visible ?? connectionsVisible;
    await connectionsAPI.updateLocation({
      lat: coords.lat,
      lon: coords.lon,
      accuracy: coords.accuracy,
      userId: user.id,
      connectionsVisible: vis,
    });
    updateUser({ connectionsVisible: vis });
  }, [user?.id, connectionsVisible, updateUser]);

  const ensureLocation = useCallback(async (): Promise<{ lat: number; lon: number; accuracy?: number }> => {
    const { coords, error } = await requestGpsFromUserTap();
    if (!coords) {
      throw new Error(error || 'Location needed to see who is nearby.');
    }
    setLocation(coords);
    setLocationDeclined(false);
    setError('');
    fetchPlaceLabel(coords.lat, coords.lon);
    pushLocation(coords, true).catch(() => {});
    setConnectionsVisible(true);
    return coords;
  }, [pushLocation]);

  const requestLocationAccess = useCallback(async () => {
    setRequestingLocation(true);
    setError('');
    setLocationDeclined(false);
    try {
      await ensureLocation();
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Could not get location'));
    } finally {
      setRequestingLocation(false);
    }
  }, [ensureLocation]);

  const loadBuzzes = useCallback(async () => {
    if (!user?.id) return;
    try {
      const response = await connectionsAPI.getMyBuzzes(user.id);
      setBuzzes(response);
      const pending = response.received.filter((b) => b.status === 'pending');
      const pendingIds = new Set(pending.map((b) => b.id));
      if (buzzInitializedRef.current) {
        const newBuzzes = pending.filter((b) => !knownBuzzIdsRef.current.has(b.id));
        if (newBuzzes.length > 0) {
          setComfortingMessage('Someone nearby showed interest — respond below.');
          setTimeout(() => setComfortingMessage(null), 6000);
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
              new Notification('Hook Up', { body: 'Someone nearby wants to connect!' });
            } catch {
              /* ignore */
            }
          }
        }
      } else {
        buzzInitializedRef.current = true;
      }
      knownBuzzIdsRef.current = pendingIds;
    } catch (err) {
      console.error('Failed to load buzzes:', err);
    }
  }, [user?.id]);

  const refreshNearby = useCallback(async (coords?: { lat: number; lon: number; accuracy?: number }) => {
    if (!user?.id) return;
    const loc = coords || location;
    if (!loc) return;
    const radiusCoords = readStoredCoords() || loc;
    try {
      await pushLocation(loc, connectionsVisible);
      const response = await connectionsAPI.getNearby({
        lat: loc.lat,
        lon: loc.lon,
        radius: nearbyRadiusForCoords(radiusCoords),
        userId: user.id,
      });
      setNearbyUsers(response.users);
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Could not refresh nearby'));
    }
  }, [user?.id, location, connectionsVisible, pushLocation]);

  useEffect(() => {
    if (user?.id) {
      connectionsAPI.getPrefs().then((p) => {
        setConnectionsVisible(p.connectionsVisible);
      }).catch(() => {});
      loadBuzzes();
    }
    return () => {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
      }
      if (locationWatchRef.current != null && navigator?.geolocation) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
      }
    };
  }, [user?.id, loadBuzzes]);

  useEffect(() => {
    if (!user?.id) return;
    resolveWorkingCoords(
      {
        userId: user.id,
        city: (user as { city?: string }).city,
        country: (user as { country?: string }).country,
      },
      locationApi
    ).then((coords) => {
      if (coords && !location) {
        setLocation(coords);
        fetchPlaceLabel(coords.lat, coords.lon);
        pushLocation(coords, true).catch(() => {});
      }
    });
  }, [user?.id, user?.city, user?.country]);

  useEffect(() => {
    if (!user?.id || location) return;
    if (isLocationGranted()) {
      const stored = readStoredCoords();
      if (stored) {
        setLocation(stored);
        fetchPlaceLabel(stored.lat, stored.lon);
        pushLocation(stored, true).catch(() => {});
      }
      return;
    }
    resolveWorkingCoords(
      {
        userId: user.id,
        city: (user as { city?: string }).city,
        country: (user as { country?: string }).country,
      },
      locationApi
    ).then((coords) => {
      if (!coords) return;
      setLocation(coords);
      fetchPlaceLabel(coords.lat, coords.lon);
      pushLocation(coords, true).catch(() => {});
    });
  }, [user?.id, location, pushLocation]);

  useEffect(() => {
    if (location && user?.id) {
      pushLocation(location).catch(() => {});
      locationIntervalRef.current = setInterval(() => {
        pushLocation(location).catch(() => {});
      }, 30000);
    }
    return () => {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
      }
    };
  }, [location, user?.id, pushLocation]);

  useEffect(() => {
    if (!location || !user?.id) return;
    refreshNearby(location);
    loadBuzzes();
    const nearbyPoll = setInterval(() => {
      refreshNearby(location);
      loadBuzzes();
    }, 15000);
    return () => clearInterval(nearbyPoll);
  }, [location, user?.id, refreshNearby, loadBuzzes]);

  const refreshNearbyList = async () => {
    if (!user?.id) return;
    if (!location) {
      await requestLocationAccess();
      return;
    }
    setLoading(true);
    setError('');
    try {
      await refreshNearby(location);
      await loadBuzzes();
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Could not refresh nearby'));
    } finally {
      setLoading(false);
    }
  };

  const loadVenues = async () => {
    if (!location || !user?.id) return;
    setLoading(true);
    setError('');
    try {
      const response = await connectionsAPI.getVenues({
        lat: location.lat,
        lon: location.lon,
        radius: venueRadius,
        userId: user.id,
      });
      setVenues(response.venues);
      setView('venues');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load venues');
    } finally {
      setLoading(false);
    }
  };

  const searchPlaces = async () => {
    const q = searchPlaceQuery.trim();
    if (!q || !user?.id) return;
    setSearchPlacesLoading(true);
    setError('');
    setSearchPlaceResults([]);
    setSearchPlaceLocationName(null);
    setSearchPlaceMostConcentrated(null);
    try {
      const response = await connectionsAPI.searchPlaces({ q, type: searchPlaceType });
      setSearchPlaceResults(response.places || []);
      setSearchPlaceLocationName(response.locationName || null);
      setSearchPlaceMostConcentrated(response.mostConcentrated ?? null);
      if (response.message) setError(response.message);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Search failed');
    } finally {
      setSearchPlacesLoading(false);
    }
  };

  const handleSendBuzz = async (toUserId: string) => {
    if (!user?.id) return;
    if (!location) {
      setError('Turn on location (or wait a moment for GPS) to show interest to nearby people.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await connectionsAPI.sendBuzz({
        toUserId,
        location: {
          lat: location.lat,
          lon: location.lon,
        },
        userId: user.id,
      });
      await loadBuzzes();
      await refreshNearby();
      const chatId = (result as { chatUserId?: string }).chatUserId;
      if (chatId) {
        openChatWithUser(chatId);
        setComfortingMessage("It's a match! They're in your Communications — start chatting.");
      } else {
        setComfortingMessage("Interest sent! When they respond Yes or Talk later, they'll appear in Communications.");
      }
      setTimeout(() => setComfortingMessage(null), 4000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send buzz');
    } finally {
      setLoading(false);
    }
  };

  const handleRespondBuzz = async (buzzId: string, response: 'accepted' | 'rejected' | 'talk_later') => {
    setLoading(true);
    setError('');
    try {
      const result = await connectionsAPI.respondBuzz({ buzzId, response });
      if (response === 'rejected' && result.comfortingMessage) {
        setComfortingMessage(result.comfortingMessage);
        setTimeout(() => setComfortingMessage(null), 8000);
      }
      if (response === 'accepted' || response === 'talk_later') {
        const chatId = (result as any).chatUserId;
        setComfortingMessage(response === 'talk_later'
          ? "They're in your Communications. Chat when you're both ready!"
          : "They're in your Communications. You can start chatting now!");
        setTimeout(() => setComfortingMessage(null), 5000);
        if (chatId) {
          openChatWithUser(chatId);
        }
      }
      await loadBuzzes();
      await refreshNearby();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to respond');
    } finally {
      setLoading(false);
    }
  };

  const nearbyIds = new Set(nearbyUsers.map((u) => u.id));
  const pendingBuzzNotNearby = buzzes.received.filter(
    (b) => b.status === 'pending' && !nearbyIds.has(b.fromUserId)
  );

  const renderPersonActions = (personId: string, receivedBuzz?: Buzz) => {
    const buzz = receivedBuzz || buzzes.received.find((b) => b.fromUserId === personId && b.status === 'pending');
    const alreadyBuzzed = buzzes.sent.some((b) => b.toUserId === personId && b.status === 'pending');

    if (buzz) {
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          <button type="button" onClick={() => handleRespondBuzz(buzz.id, 'accepted')} className="send-btn" disabled={loading} style={{ background: 'rgba(16, 185, 129, 0.2)', border: '2px solid #10b981', color: '#10b981', fontSize: '11px', padding: '6px 10px', fontFamily: 'Orbitron, monospace', fontWeight: 'bold' }}>Yes</button>
          <button type="button" onClick={() => handleRespondBuzz(buzz.id, 'rejected')} className="send-btn" disabled={loading} style={{ background: 'rgba(239, 68, 68, 0.2)', border: '2px solid #ef4444', color: '#ef4444', fontSize: '11px', padding: '6px 10px', fontFamily: 'Orbitron, monospace', fontWeight: 'bold' }}>No</button>
          <button type="button" onClick={() => handleRespondBuzz(buzz.id, 'talk_later')} className="send-btn" disabled={loading} style={{ background: 'rgba(245, 158, 11, 0.2)', border: '2px solid #f59e0b', color: '#f59e0b', fontSize: '11px', padding: '6px 10px', fontFamily: 'Orbitron, monospace', fontWeight: 'bold' }}>Talk later</button>
        </div>
      );
    }
    if (alreadyBuzzed) {
      return <span style={{ fontSize: '12px', color: '#9ca3af', fontFamily: 'Orbitron, monospace' }}>Interest sent</span>;
    }
    return (
      <button type="button" onClick={() => handleSendBuzz(personId)} className="send-btn" disabled={loading} style={{ background: 'rgba(0, 0, 0, 0.4)', border: '2px solid #ff00ff', color: '#ff00ff', fontSize: '12px', padding: '8px 14px', fontFamily: 'Orbitron, monospace', fontWeight: 'bold', boxShadow: '0 0 10px rgba(255, 0, 255, 0.3)' }}>
        Show interest
      </button>
    );
  };

  const renderLocationPrompt = () => {
    if (location) return null;
    return (
      <div
        style={{
          marginBottom: 14,
          padding: '14px 12px',
          borderRadius: 10,
          border: '2px solid rgba(255, 107, 157, 0.5)',
          background: 'rgba(255, 107, 157, 0.12)',
        }}
      >
        <p style={{ margin: '0 0 8px', fontWeight: 700, color: '#fff', fontFamily: 'Orbitron, monospace', fontSize: 13 }}>
          Use your location?
        </p>
        <p style={{ margin: '0 0 12px', fontSize: 12, color: '#d1d5db', lineHeight: 1.45 }}>
          See who&apos;s nearby and match with people around you. Tap <strong>Yes</strong> — your phone will ask to allow location (you can say no there too).
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="auth-button"
            disabled={requestingLocation || loading}
            onClick={requestLocationAccess}
            style={{ flex: 1, minWidth: 120, margin: 0 }}
          >
            {requestingLocation ? 'Waiting…' : 'Yes, use location'}
          </button>
          <button
            type="button"
            className="auth-button secondary"
            disabled={requestingLocation || loading}
            onClick={() => {
              setLocationDeclined(true);
              clearLocationGranted();
            }}
            style={{ flex: 1, minWidth: 100, margin: 0, background: 'rgba(255,255,255,0.1)' }}
          >
            No thanks
          </button>
        </div>
        {locationDeclined && (
          <p style={{ margin: '10px 0 0', fontSize: 11, color: '#9ca3af' }}>
            Location off — you can still browse. Tap &quot;Yes, use location&quot; anytime to turn it on.
          </p>
        )}
      </div>
    );
  };

  const renderNearbyList = () => {
    if (!location) {
      return (
        <p style={{ color: '#9ca3af', fontSize: '12px', fontFamily: 'Orbitron, monospace', textAlign: 'center', padding: '12px 0' }}>
          Turn on location above to see who&apos;s nearby.
        </p>
      );
    }
    if (nearbyUsers.length === 0 && pendingBuzzNotNearby.length === 0) {
      return (
        <p style={{ color: '#9ca3af', fontSize: '12px', fontFamily: 'Orbitron, monospace', textAlign: 'center', padding: '20px 0' }}>
          No one nearby right now. The list updates automatically — check again in a moment.
        </p>
      );
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflowY: 'auto' }}>
        {pendingBuzzNotNearby.map((buzz) => (
          <div
            key={buzz.id}
            style={{
              padding: '12px',
              border: '2px solid rgba(255, 0, 255, 0.45)',
              borderRadius: '12px',
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              background: 'rgba(0, 0, 0, 0.4)',
            }}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(255, 0, 255, 0.5)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255, 0, 255, 0.1)' }}>
              {buzz.fromUserProfilePicture ? (
                <img src={buzz.fromUserProfilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '20px', color: '#ff00ff' }}>?</span>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', fontFamily: 'Orbitron, monospace' }}>Someone interested</div>
              <div style={{ fontSize: '11px', color: '#ff00ff', marginTop: 4 }}>Wants to connect — respond below</div>
            </div>
            {renderPersonActions(buzz.fromUserId, buzz)}
          </div>
        ))}
        {nearbyUsers.map((nearbyUser) => (
          <div
            key={nearbyUser.id}
            style={{
              padding: '12px',
              border: '2px solid rgba(0, 212, 255, 0.3)',
              borderRadius: '12px',
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              background: 'rgba(0, 0, 0, 0.4)',
              boxShadow: '0 0 15px rgba(0, 212, 255, 0.2)',
            }}
          >
            <div className="user-avatar" style={{ width: '56px', height: '56px', flexShrink: 0, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(255, 0, 255, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', background: 'rgba(255, 0, 255, 0.1)' }}>
              {nearbyUser.profilePicture ? (
                <img src={nearbyUser.profilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '24px', color: '#ff00ff' }}>?</span>
              )}
              {nearbyUser.isOnline && (
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: '12px',
                  height: '12px',
                  background: '#10b981',
                  border: '2px solid #0a0a1a',
                  borderRadius: '50%',
                  boxShadow: '0 0 10px rgba(16, 185, 129, 0.6)',
                }} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff', fontFamily: 'Orbitron, monospace' }}>
                Nearby match
              </div>
              <div style={{ fontSize: '11px', color: nearbyUser.isOnline ? '#10b981' : '#9ca3af', marginTop: 4 }}>
                {nearbyUser.isOnline ? 'Active nearby · your type' : 'Recently nearby · your type'}
              </div>
            </div>
            {renderPersonActions(nearbyUser.id)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="widget">
      <h2 className="widget-title">
        <span>🔗</span> Connections
      </h2>

      {error && <div className="error-message">{error}</div>}
      {comfortingMessage && (
        <div className="comforting-message" style={{
          padding: '12px',
          background: 'rgba(255, 0, 255, 0.2)',
          border: '2px solid #ff00ff',
          borderRadius: '8px',
          marginBottom: '12px',
          color: '#ff00ff',
          fontSize: '14px',
          fontFamily: 'Orbitron, monospace',
          boxShadow: '0 0 15px rgba(255, 0, 255, 0.3)',
        }}>
          {comfortingMessage}
        </div>
      )}

      {view === 'main' && (
        <div className="improvement-content">
          {placeLabel && (
            <p style={{ marginBottom: '12px', color: '#00d4ff', fontFamily: 'Orbitron, monospace', fontSize: '13px', textShadow: '0 0 8px rgba(0, 212, 255, 0.5)' }}>
              📍 {placeLabel}
            </p>
          )}
          <p style={{ marginBottom: '14px', color: '#9ca3af', fontFamily: 'Orbitron, monospace', fontSize: '12px' }}>
            Nearby people update automatically. Send interest and wait for their response — mutual interest adds you both to Communications.
          </p>
          {renderLocationPrompt()}
          {buzzes.received.some((b) => b.status === 'pending') && (
            <div
              style={{
                marginBottom: 14,
                padding: '10px 12px',
                borderRadius: 10,
                border: '2px solid #ff00ff',
                background: 'rgba(255, 0, 255, 0.15)',
                color: '#ff00ff',
                fontSize: 12,
                fontFamily: 'Orbitron, monospace',
                fontWeight: 700,
              }}
            >
              🔔 {buzzes.received.filter((b) => b.status === 'pending').length} nearby interest
              {buzzes.received.filter((b) => b.status === 'pending').length === 1 ? '' : 's'} — respond below
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <strong style={{ color: '#00d4ff', fontSize: 13, fontFamily: 'Orbitron, monospace', display: 'block', marginBottom: 8 }}>
              Nearby now{buzzes.received.filter((b) => b.status === 'pending').length > 0 || nearbyUsers.length > 0
                ? ` · ${nearbyUsers.length} visible${buzzes.received.filter((b) => b.status === 'pending').length > 0 ? ` · ${buzzes.received.filter((b) => b.status === 'pending').length} buzz` : ''}`
                : ''}
            </strong>
            {renderNearbyList()}
          </div>

          <button
            type="button"
            onClick={refreshNearbyList}
            className="select-user-btn"
            disabled={loading}
            style={{
              width: '100%',
              marginBottom: 14,
              background: 'rgba(0, 212, 255, 0.08)',
              border: '1px solid rgba(0, 212, 255, 0.45)',
              color: '#00d4ff',
              fontFamily: 'Orbitron, monospace',
              fontWeight: 'bold',
              fontSize: 12,
            }}
          >
            {loading ? 'Refreshing…' : '↻ Refresh nearby list'}
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '10px', color: '#9ca3af', fontFamily: 'Orbitron, monospace', display: 'block', marginBottom: '4px' }}>Venues radius</label>
              <select
                value={venueRadius}
                onChange={(e) => setVenueRadius(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: 'rgba(0,0,0,0.5)',
                  border: '2px solid rgba(0, 212, 255, 0.5)',
                  borderRadius: '6px',
                  color: '#00d4ff',
                  fontFamily: 'Orbitron, monospace',
                  fontSize: '12px',
                }}
              >
                {VENUE_RADIUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <button onClick={loadVenues} className="select-user-btn" disabled={loading || !location} style={{
              background: 'rgba(0, 0, 0, 0.4)',
              border: '2px solid #00d4ff',
              color: '#00d4ff',
              fontFamily: 'Orbitron, monospace',
              fontWeight: 'bold',
              boxShadow: '0 0 15px rgba(0, 212, 255, 0.3)',
            }}>
              {loading ? 'Loading...' : `📍 Real venues (${venueRadius >= 1000 ? venueRadius / 1000 + ' km' : venueRadius + ' m'})`}
            </button>
            <button onClick={() => setView('search_places')} className="select-user-btn" style={{
              background: 'rgba(0, 0, 0, 0.4)',
              border: '2px solid #00d4ff',
              color: '#00d4ff',
              fontFamily: 'Orbitron, monospace',
              fontWeight: 'bold',
              boxShadow: '0 0 15px rgba(0, 212, 255, 0.3)',
            }}>
              🔍 Search places (see count of your preferences)
            </button>
            <button onClick={() => { setView('buzzes'); loadBuzzes(); }} className="select-user-btn" style={{
              background: 'rgba(0, 0, 0, 0.4)',
              border: '2px solid #ff00ff',
              color: '#ff00ff',
              fontFamily: 'Orbitron, monospace',
              fontWeight: 'bold',
              boxShadow: '0 0 15px rgba(255, 0, 255, 0.3)',
            }}>
              🔔 My Buzzes ({buzzes.received.length + buzzes.sent.length})
            </button>
          </div>
        </div>
      )}

      {view === 'search_places' && (
        <div className="improvement-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <button onClick={() => { setView('main'); setSearchPlaceResults([]); setSearchPlaceMostConcentrated(null); setError(''); }} className="back-btn" style={{
              background: 'rgba(0, 0, 0, 0.4)', border: '2px solid #00d4ff', color: '#00d4ff',
              fontFamily: 'Orbitron, monospace', padding: '8px 16px', borderRadius: '6px',
            }}>← Back</button>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#00d4ff', fontFamily: 'Orbitron, monospace' }}>Search real places</h3>
          </div>
          <p style={{ marginBottom: '12px', color: '#9ca3af', fontSize: '12px', fontFamily: 'Orbitron, monospace' }}>
            Enter a city or location (e.g. Berlin, London). Choose type. See how many of your preferences are at each real place.
          </p>
          <input
            type="text"
            placeholder="e.g. Berlin, Central Park, London"
            value={searchPlaceQuery}
            onChange={(e) => setSearchPlaceQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchPlaces()}
            style={{
              width: '100%', padding: '12px', marginBottom: '10px',
              background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(0, 212, 255, 0.5)', borderRadius: '8px',
              color: '#fff', fontFamily: 'Orbitron, monospace', fontSize: '14px',
            }}
          />
          <select
            value={searchPlaceType}
            onChange={(e) => setSearchPlaceType(e.target.value)}
            style={{
              width: '100%', padding: '10px', marginBottom: '12px',
              background: 'rgba(0,0,0,0.5)', border: '2px solid rgba(0, 212, 255, 0.5)', borderRadius: '8px',
              color: '#00d4ff', fontFamily: 'Orbitron, monospace', fontSize: '13px',
            }}
          >
            {PLACE_TYPES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button onClick={searchPlaces} disabled={searchPlacesLoading || !searchPlaceQuery.trim()} className="select-user-btn" style={{
            width: '100%', marginBottom: '16px',
            background: 'rgba(0, 212, 255, 0.2)', border: '2px solid #00d4ff', color: '#00d4ff',
            fontFamily: 'Orbitron, monospace', fontWeight: 'bold',
          }}>
            {searchPlacesLoading ? 'Searching...' : 'Search'}
          </button>
          {searchPlaceLocationName && (
            <p style={{ marginBottom: '12px', color: '#00d4ff', fontSize: '12px', fontFamily: 'Orbitron, monospace' }}>
              Location: {searchPlaceLocationName}
            </p>
          )}
          {searchPlaceMostConcentrated && (
            <div style={{
              marginBottom: '14px', padding: '14px', borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(255, 0, 255, 0.2), rgba(0, 212, 255, 0.15))',
              border: '2px solid rgba(255, 0, 255, 0.6)',
              boxShadow: '0 0 20px rgba(255, 0, 255, 0.25)',
            }}>
              <div style={{ fontSize: '11px', color: '#ff00ff', fontFamily: 'Orbitron, monospace', marginBottom: '6px', textTransform: 'uppercase' }}>
                Hottest spot — most of your preferences here
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff', fontFamily: 'Orbitron, monospace' }}>{searchPlaceMostConcentrated.venue}</span>
                <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#ff00ff' }}>{searchPlaceMostConcentrated.count}</span>
              </div>
            </div>
          )}
          {searchPlaceResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '360px', overflowY: 'auto' }}>
              {searchPlaceResults.map((place, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '14px', border: '2px solid rgba(0, 212, 255, 0.3)', borderRadius: '10px',
                    background: 'rgba(0, 0, 0, 0.4)',
                  }}
                >
                  <span style={{ fontSize: '14px', color: '#fff', fontFamily: 'Orbitron, monospace' }}>{place.venue}</span>
                  <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#ff00ff', minWidth: '32px', textAlign: 'right' }}>{place.count}</span>
                </div>
              ))}
            </div>
          )}
          {searchPlaceResults.length === 0 && searchPlaceLocationName && !searchPlacesLoading && (
            <p style={{ color: '#9ca3af', fontSize: '12px', fontFamily: 'Orbitron, monospace' }}>No {searchPlaceType.replace('_', ' ')}s found in this area, or no app users there yet.</p>
          )}
        </div>
      )}

      {view === 'venues' && (
        <div className="improvement-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <button onClick={() => setView('main')} className="back-btn" style={{
              background: 'rgba(0, 0, 0, 0.4)',
              border: '2px solid #00d4ff',
              color: '#00d4ff',
              fontFamily: 'Orbitron, monospace',
              padding: '8px 16px',
              borderRadius: '6px',
            }}>← Back</button>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#00d4ff', fontFamily: 'Orbitron, monospace', textShadow: '0 0 10px rgba(0, 212, 255, 0.5)' }}>Real venues nearby</h3>
          </div>
          {venues.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#9ca3af', padding: '20px', fontFamily: 'Orbitron, monospace' }}>
              No venues in this radius. Try a larger radius or another location (worldwide).
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
              {venues.map((venue, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '16px',
                    border: '2px solid rgba(0, 212, 255, 0.3)',
                    borderRadius: '12px',
                    background: 'rgba(0, 0, 0, 0.4)',
                    boxShadow: '0 0 15px rgba(0, 212, 255, 0.2)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '16px', color: '#fff', fontFamily: 'Orbitron, monospace' }}>{venue.venue}</h4>
                    <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#ff00ff', textShadow: '0 0 10px rgba(255, 0, 255, 0.6)' }}>
                      {venue.count}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af', fontFamily: 'Orbitron, monospace' }}>
                    {venue.venueType} • {venue.count} {venue.count === 1 ? 'person' : 'people'} from the app nearby
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'nearby' && (
        <div className="improvement-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <button type="button" onClick={() => setView('main')} className="back-btn" style={{
              background: 'rgba(0, 0, 0, 0.4)',
              border: '2px solid #00d4ff',
              color: '#00d4ff',
              fontFamily: 'Orbitron, monospace',
              padding: '8px 16px',
              borderRadius: '6px',
            }}>← Back</button>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#00d4ff', fontFamily: 'Orbitron, monospace' }}>People nearby</h3>
          </div>
          <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#9ca3af', fontFamily: 'Orbitron, monospace' }}>
            Scroll the list, tap <strong style={{ color: '#ff00ff' }}>Show interest</strong>, then wait for Yes or No. Both interested → Communications.
          </p>
          {renderNearbyList()}
        </div>
      )}

      {view === 'buzzes' && (
        <div className="improvement-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <button onClick={() => setView('main')} className="back-btn">← Back</button>
            <h3 style={{ margin: 0, fontSize: '18px' }}>My Buzzes</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {buzzes.received.length > 0 && (
              <div>
                <h4 style={{ fontSize: '14px', marginBottom: '8px', color: '#00d4ff', fontFamily: 'Orbitron, monospace' }}>Received ({buzzes.received.length})</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {buzzes.received.map((buzz) => (
                    <div key={buzz.id} style={{ padding: '12px', border: '2px solid rgba(0, 212, 255, 0.3)', borderRadius: '12px', background: 'rgba(0, 0, 0, 0.4)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(255, 0, 255, 0.5)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255, 0, 255, 0.1)' }}>
                        {buzz.fromUserProfilePicture ? (
                          <img src={buzz.fromUserProfilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: '20px', color: '#ff00ff' }}>?</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        <button onClick={() => handleRespondBuzz(buzz.id, 'accepted')} className="send-btn" disabled={loading} style={{ background: 'rgba(16, 185, 129, 0.2)', border: '2px solid #10b981', color: '#10b981', fontSize: '11px', padding: '6px 10px', fontFamily: 'Orbitron, monospace', fontWeight: 'bold' }}>Yes</button>
                        <button onClick={() => handleRespondBuzz(buzz.id, 'rejected')} className="send-btn" disabled={loading} style={{ background: 'rgba(239, 68, 68, 0.2)', border: '2px solid #ef4444', color: '#ef4444', fontSize: '11px', padding: '6px 10px', fontFamily: 'Orbitron, monospace', fontWeight: 'bold' }}>No</button>
                        <button onClick={() => handleRespondBuzz(buzz.id, 'talk_later')} className="send-btn" disabled={loading} style={{ background: 'rgba(245, 158, 11, 0.2)', border: '2px solid #f59e0b', color: '#f59e0b', fontSize: '11px', padding: '6px 10px', fontFamily: 'Orbitron, monospace', fontWeight: 'bold' }}>Talk later</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {buzzes.sent.length > 0 && (
              <div>
                <h4 style={{ fontSize: '14px', marginBottom: '8px', color: '#ff00ff', fontFamily: 'Orbitron, monospace' }}>Sent ({buzzes.sent.length})</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {buzzes.sent.map((buzz) => (
                    <div key={buzz.id} style={{ padding: '12px', border: '2px solid rgba(255, 0, 255, 0.3)', borderRadius: '8px', background: 'rgba(0, 0, 0, 0.4)', boxShadow: '0 0 15px rgba(255, 0, 255, 0.2)' }}>
                      <p style={{ margin: 0, fontSize: '12px', color: '#fff', fontFamily: 'Orbitron, monospace' }}>
                        Status: <span style={{
                          color: buzz.status === 'accepted' || buzz.status === 'talk_later' ? '#10b981' : buzz.status === 'rejected' ? '#ef4444' : '#ff00ff',
                          textShadow: buzz.status === 'accepted' || buzz.status === 'talk_later' ? '0 0 10px rgba(16, 185, 129, 0.6)' : buzz.status === 'rejected' ? '0 0 10px rgba(239, 68, 68, 0.6)' : '0 0 10px rgba(255, 0, 255, 0.6)',
                        }}>
                          {buzz.status === 'talk_later' ? 'Talk later' : buzz.status}
                        </span>
                      </p>
                      {buzz.status === 'rejected' && buzz.comfortingMessageForSender && (
                        <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#ff00ff', fontFamily: 'Orbitron, monospace', fontStyle: 'italic' }}>{buzz.comfortingMessageForSender}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {buzzes.received.length === 0 && buzzes.sent.length === 0 && (
              <p style={{ textAlign: 'center', color: '#9ca3af', padding: '20px', fontFamily: 'Orbitron, monospace' }}>
                No buzzes yet. Start buzzing nearby users!
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectionsWidget;
