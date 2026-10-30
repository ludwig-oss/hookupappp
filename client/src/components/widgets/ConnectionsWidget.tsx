import { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { connectionsAPI, NearbyUser, VenueCount, Buzz } from '../../api/connections';
import { openChatWithUser } from '../../lib/openChat';
import { formatAxiosError } from '../../lib/apiError';
import { markLocationGranted, clearLocationGranted, isLocationGranted, readStoredCoords, nearbyPeopleRadiusMeters, resolveWorkingCoords, requestGpsFromUserTap, startGpsWatch } from '../../lib/locationSession';
import { askNotifyPermission, notifyDevice } from '../../lib/deviceNotify';
import { hasHandledNearbyPerson, markProximityBannerShown, NEARBY_HANDLED_EVENT, takeConnectionsStartView } from '../../lib/proximitySession';
import './Widget.css';

const locationApi = {
  getMyLocation: () => connectionsAPI.getMyLocation(),
  forwardGeocode: (q: string) => connectionsAPI.forwardGeocode(q),
  updateLocation: (data: Parameters<typeof connectionsAPI.updateLocation>[0]) =>
    connectionsAPI.updateLocation(data),
  locateByIp: () => connectionsAPI.locateByIp(),
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
  preferenceHits?: number;
}

const NEARBY_PAGE_SIZE = 10;

function isCrowdedPlaceLabel(label: string | null | undefined): boolean {
  if (!label) return false;
  return /club|nightclub|disco|lounge|train|station|subway|metro|tram|platform|transit|bus\s*(stop|station)|airport/i.test(label);
}

function personMatchesQuery(q: string, name?: string | null, username?: string | null): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [name, username].some((v) => String(v || '').toLowerCase().includes(s));
}

const PLACE_TYPES = [
  { value: 'none', label: 'None — any place / shop' },
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
  const { user } = useContext(AuthContext);
  const [view, setView] = useState<'main' | 'nearby' | 'venues' | 'buzzes' | 'search_places'>(() => takeConnectionsStartView() || 'main');
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
  const [searchPlaceType, setSearchPlaceType] = useState('none');
  const [searchPlaceResults, setSearchPlaceResults] = useState<PlaceCountOnly[]>([]);
  const [searchPlaceLocationName, setSearchPlaceLocationName] = useState<string | null>(null);
  const [searchPlaceMostConcentrated, setSearchPlaceMostConcentrated] = useState<PlaceCountOnly | null>(null);
  const [searchPlacesLoading, setSearchPlacesLoading] = useState(false);
  const [showPreferenceRankList, setShowPreferenceRankList] = useState(false);
  const [locationDeclined, setLocationDeclined] = useState(false);
  const [requestingLocation, setRequestingLocation] = useState(false);
  const [placeCity, setPlaceCity] = useState(() => String((user as { city?: string } | null)?.city || ''));
  const [placeCountry, setPlaceCountry] = useState(() => String((user as { country?: string } | null)?.country || ''));
  const [handledRev, setHandledRev] = useState(0);
  const [personSearch, setPersonSearch] = useState('');
  const [listPage, setListPage] = useState(0);
  const [buzzPage, setBuzzPage] = useState(0);

  useEffect(() => {
    const onHandled = () => setHandledRev((n) => n + 1);
    window.addEventListener(NEARBY_HANDLED_EVENT, onHandled);
    return () => window.removeEventListener(NEARBY_HANDLED_EVENT, onHandled);
  }, []);

  const fetchPlaceLabel = async (lat: number, lon: number) => {
    try {
      const { city, country, displayName } = await connectionsAPI.reverseGeocode(lat, lon);
      if (city && country) setPlaceLabel(`${city}, ${country}`);
      else if (displayName) setPlaceLabel(displayName);
      else setPlaceLabel(null);
      if (city) setPlaceCity((prev) => prev || city);
      if (country) setPlaceCountry((prev) => prev || country);
      if ((city || country) && user?.id) {
        connectionsAPI.updateLocation({
          lat,
          lon,
          userId: user.id,
          connectionsVisible: true,
          city: city || undefined,
          country: country || undefined,
        }).catch(() => {});
      }
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
  }, [user?.id, connectionsVisible]);

  const applyCoords = useCallback((coords: { lat: number; lon: number; accuracy?: number }) => {
    setLocation(coords);
    setLocationDeclined(false);
    setError('');
    fetchPlaceLabel(coords.lat, coords.lon);
    pushLocation(coords, true).catch(() => {});
    setConnectionsVisible(true);
  }, [pushLocation]);

  const ensureLocation = useCallback(async (): Promise<{ lat: number; lon: number; accuracy?: number; source?: string }> => {
    const { coords, error } = await requestGpsFromUserTap();
    if (coords) {
      applyCoords(coords);
      return coords;
    }
    const fallback = await resolveWorkingCoords(
      {
        userId: user?.id,
        city: placeCity.trim() || (user as { city?: string })?.city,
        country: placeCountry.trim() || (user as { country?: string })?.country,
        ignoreCache: true,
        allowIp: true,
      },
      locationApi
    );
    if (fallback) {
      if (fallback.city) setPlaceCity((prev) => prev || fallback.city || '');
      if (fallback.country) setPlaceCountry((prev) => prev || fallback.country || '');
      applyCoords(fallback);
      if (fallback.source !== 'gps') {
        setComfortingMessage('Location on. People near you can show up now — tap Yes on the other phone too.');
        setTimeout(() => setComfortingMessage(null), 6000);
      }
      return fallback;
    }
    throw new Error(error || 'Type your city and country below, then tap Save.');
  }, [applyCoords, user?.id, user, placeCity, placeCountry]);

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

  const applyCoordsRef = useRef(applyCoords);
  applyCoordsRef.current = applyCoords;

  useEffect(() => {
    askNotifyPermission();
    let stop = () => {};
    const beginWatch = () => {
      stop();
      stop = startGpsWatch((coords) => {
        applyCoordsRef.current(coords);
      });
    };
    if (isLocationGranted() || readStoredCoords()) {
      beginWatch();
    } else if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((p) => {
        if (p.state === 'granted') beginWatch();
      }).catch(() => {});
    }
    return () => stop();
  }, []);

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
          notifyDevice('Hook Up', 'Someone nearby wants to connect!', 'interest');
        }
      } else {
        buzzInitializedRef.current = true;
      }
      knownBuzzIdsRef.current = pendingIds;
    } catch (err) {
      console.error('Failed to load buzzes:', err);
    }
  }, [user?.id]);

  const refreshNearby = useCallback(async (coords?: { lat: number; lon: number; accuracy?: number }, opts?: { silent?: boolean }) => {
    if (!user?.id) return;
    const loc = coords || location;
    if (!loc) return;
    const radiusCoords = readStoredCoords() || loc;
    try {
      const response = await connectionsAPI.getNearby({
        lat: loc.lat,
        lon: loc.lon,
        radius: nearbyPeopleRadiusMeters(radiusCoords),
        accuracy: radiusCoords.accuracy,
        userId: user.id,
      });
      setNearbyUsers(response.users);
      if (!opts?.silent) setError('');
    } catch (err: unknown) {
      // Background polls must not yank the Search places screen with a red banner
      if (!opts?.silent) {
        setError(formatAxiosError(err, 'Could not refresh nearby'));
      }
    }
  }, [user?.id, location]);

  useEffect(() => {
    const city = (user as { city?: string } | null)?.city;
    const country = (user as { country?: string } | null)?.country;
    if (city && !placeCity) setPlaceCity(city);
    if (country && !placeCountry) setPlaceCountry(country);
  }, [user, placeCity, placeCountry]);

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
        allowIp: true,
      },
      locationApi
    ).then((coords) => {
      if (coords && !location) {
        setLocation(coords);
        if (coords.city) setPlaceCity((prev) => prev || coords.city || '');
        if (coords.country) setPlaceCountry((prev) => prev || coords.country || '');
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
        allowIp: true,
      },
      locationApi
    ).then((coords) => {
      if (!coords) return;
      setLocation(coords);
      if (coords.city) setPlaceCity((prev) => prev || coords.city || '');
      if (coords.country) setPlaceCountry((prev) => prev || coords.country || '');
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
      // Silent while searching places so errors don't flash the form back to "failed"
      refreshNearby(location, { silent: view === 'search_places' || view === 'venues' });
      loadBuzzes();
    }, 5000);
    return () => clearInterval(nearbyPoll);
  }, [location, user?.id, refreshNearby, loadBuzzes, view]);

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
    try {
      const response = await connectionsAPI.searchPlaces({ q, type: searchPlaceType });
      setSearchPlaceResults(response.places || []);
      setSearchPlaceLocationName(response.locationName || null);
      setSearchPlaceMostConcentrated(response.mostConcentrated ?? null);
      if (response.message) setError(response.message);
    } catch (err: unknown) {
      setError(formatAxiosError(err, 'Search failed'));
    } finally {
      setSearchPlacesLoading(false);
    }
  };

  const handleSendBuzz = async (toUserId: string) => {
    if (!user?.id) return;
    const incoming = buzzes.received.some((b) => b.fromUserId === toUserId && b.status === 'pending');
    if (!location && !incoming) {
      setError('Turn on location (or wait a moment for GPS) to show interest to nearby people.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await connectionsAPI.sendBuzz({
        toUserId,
        location: location
          ? {
              lat: location.lat,
              lon: location.lon,
            }
          : undefined,
        userId: user.id,
      });
      markProximityBannerShown('nearby-match', toUserId);
      await loadBuzzes();
      await refreshNearby();
      const chatId = (result as { chatUserId?: string }).chatUserId;
      if (chatId) {
        notifyDevice('Hook Up', "It's a match — they're in Communications.", 'matches');
        openChatWithUser(chatId);
        setComfortingMessage("It's a match! They're in your Communications — start chatting.");
      } else {
        notifyDevice('Hook Up', 'Interest sent. You join Communications only if they show interest too.', 'interest');
        setComfortingMessage('Interest sent. You both join Communications only if they show interest too.');
      }
      setTimeout(() => setComfortingMessage(null), 4000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send buzz');
    } finally {
      setLoading(false);
    }
  };

  const handlePassNearby = (personId: string) => {
    markProximityBannerShown('nearby-match', personId);
    setComfortingMessage('Passed. The next person nearby can fill this slot.');
    setTimeout(() => setComfortingMessage(null), 2500);
  };

  const handleRespondBuzz = async (buzzId: string, response: 'accepted' | 'rejected' | 'talk_later') => {
    setLoading(true);
    setError('');
    try {
      const result = await connectionsAPI.respondBuzz({ buzzId, response });
      const otherId = buzzes.received.find((b) => b.id === buzzId)?.fromUserId;
      if (otherId) {
        markProximityBannerShown('buzz-incoming', otherId);
        markProximityBannerShown('nearby-match', otherId);
      }
      if (response === 'rejected' && result.comfortingMessage) {
        setComfortingMessage(result.comfortingMessage);
        setTimeout(() => setComfortingMessage(null), 8000);
      }
      if (response === 'accepted' || response === 'talk_later') {
        const chatId = (result as any).chatUserId;
        notifyDevice('Hook Up', "They're in Communications. You can talk now.", 'matches');
        setComfortingMessage(response === 'talk_later'
          ? "They're in your Communications. Chat when you're both ready!"
          : "They're in your Communications. You can start chatting now!");
        setTimeout(() => setComfortingMessage(null), 5000);
        if (chatId) {
          openChatWithUser(chatId);
        }
      } else {
        notifyDevice('Hook Up', 'Declined. They were not added to chat.', 'interest');
      }
      await loadBuzzes();
      await refreshNearby();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to respond');
    } finally {
      setLoading(false);
    }
  };

  const visibleNearbyUsers = nearbyUsers.filter((u) => {
    void handledRev;
    // Pending incoming belongs in the accept list only — not “show interest” nearby
    if (buzzes.received.some((b) => b.fromUserId === u.id && b.status === 'pending')) return false;
    if (hasHandledNearbyPerson(u.id)) return false;
    if (buzzes.sent.some((b) => b.toUserId === u.id)) return false;
    return true;
  });
  const pendingBuzzNotNearby = buzzes.received.filter((b) => b.status === 'pending');
  const searchedIncoming = pendingBuzzNotNearby.filter((b) =>
    personMatchesQuery(personSearch, b.fromUserName, b.fromUsername)
  );
  const searchedNearby = visibleNearbyUsers.filter((u) =>
    personMatchesQuery(personSearch, u.name, u.username)
  );
  const remainingCount = searchedIncoming.length + searchedNearby.length;
  const crowdedVenue = isCrowdedPlaceLabel(placeLabel);
  const isCrowded = remainingCount > NEARBY_PAGE_SIZE || crowdedVenue;
  const maxListPage = Math.max(0, Math.ceil(remainingCount / NEARBY_PAGE_SIZE) - 1);
  const safeListPage = Math.min(listPage, maxListPage);
  const pageIncoming = searchedIncoming.slice(
    safeListPage * NEARBY_PAGE_SIZE,
    Math.min(searchedIncoming.length, safeListPage * NEARBY_PAGE_SIZE + NEARBY_PAGE_SIZE)
  );
  const nearbyStart = Math.max(0, safeListPage * NEARBY_PAGE_SIZE - searchedIncoming.length);
  const nearbySlots = NEARBY_PAGE_SIZE - pageIncoming.length;
  const pageNearby = searchedNearby.slice(nearbyStart, nearbyStart + nearbySlots);

  useEffect(() => {
    if (listPage > maxListPage) setListPage(maxListPage);
  }, [listPage, maxListPage]);

  const renderPersonActions = (personId: string, receivedBuzz?: Buzz) => {
    const buzz = receivedBuzz || buzzes.received.find((b) => b.fromUserId === personId && b.status === 'pending');
    const alreadyBuzzed = buzzes.sent.some((b) => b.toUserId === personId);

    if (buzz) {
      return (
        <div className="nearby-person-actions">
          <button type="button" onClick={() => handleSendBuzz(personId)} className="send-btn" disabled={loading} style={{ background: 'rgba(16, 185, 129, 0.2)', border: '2px solid #10b981', color: '#10b981', fontSize: '11px', padding: '6px 10px', fontFamily: 'Orbitron, monospace', fontWeight: 'bold' }}>Show interest too</button>
          <button type="button" onClick={() => handleRespondBuzz(buzz.id, 'rejected')} className="send-btn" disabled={loading} style={{ background: 'rgba(239, 68, 68, 0.2)', border: '2px solid #ef4444', color: '#ef4444', fontSize: '11px', padding: '6px 10px', fontFamily: 'Orbitron, monospace', fontWeight: 'bold' }}>No</button>
        </div>
      );
    }
    if (alreadyBuzzed) {
      return <span style={{ fontSize: '12px', color: '#9ca3af', fontFamily: 'Orbitron, monospace' }}>Interest sent</span>;
    }
    return (
      <div className="nearby-person-actions">
        <button type="button" onClick={() => handleSendBuzz(personId)} className="send-btn" disabled={loading} style={{ background: 'rgba(0, 0, 0, 0.4)', border: '2px solid #ff00ff', color: '#ff00ff', fontSize: '12px', padding: '8px 14px', fontFamily: 'Orbitron, monospace', fontWeight: 'bold', boxShadow: '0 0 10px rgba(255, 0, 255, 0.3)' }}>
          Show interest
        </button>
        <button type="button" onClick={() => handlePassNearby(personId)} className="send-btn" disabled={loading} style={{ background: 'rgba(239, 68, 68, 0.15)', border: '2px solid #ef4444', color: '#ef4444', fontSize: '11px', padding: '8px 12px', fontFamily: 'Orbitron, monospace', fontWeight: 'bold' }}>
          Pass
        </button>
      </div>
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
        <p style={{ margin: '0 0 6px', fontWeight: 700, color: '#fff', fontFamily: 'Orbitron, monospace', fontSize: 12 }}>
          Nearby (50 m)
        </p>
        <p style={{ margin: '0 0 8px', fontSize: 11, color: '#d1d5db', lineHeight: 1.4 }}>
          Tap Yes so we can find people next to you, including indoors.
        </p>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            disabled={requestingLocation || loading}
            onClick={() => {
              askNotifyPermission();
              requestLocationAccess();
            }}
            style={{
              flex: 1,
              margin: 0,
              padding: '7px 10px',
              fontSize: 12,
              fontFamily: 'Orbitron, monospace',
              fontWeight: 700,
              borderRadius: 8,
              border: '1px solid #00d4ff',
              background: 'rgba(0, 212, 255, 0.15)',
              color: '#00d4ff',
            }}
          >
            {requestingLocation ? '…' : 'Yes'}
          </button>
          <button
            type="button"
            disabled={requestingLocation || loading}
            onClick={() => {
              setLocationDeclined(true);
              clearLocationGranted();
            }}
            style={{
              flex: 1,
              margin: 0,
              padding: '7px 10px',
              fontSize: 12,
              fontFamily: 'Orbitron, monospace',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.25)',
              background: 'rgba(255,255,255,0.08)',
              color: '#d1d5db',
            }}
          >
            No
          </button>
        </div>
        <p style={{ margin: '14px 0 8px', fontSize: 12, color: '#d1d5db' }}>
          Or type your city — works even if GPS does not.
        </p>
        <input
          className="profile-input"
          value={placeCity}
          onChange={(e) => setPlaceCity(e.target.value)}
          placeholder="City"
          style={{ width: '100%', marginBottom: 6, padding: 10 }}
        />
        <input
          className="profile-input"
          value={placeCountry}
          onChange={(e) => setPlaceCountry(e.target.value)}
          placeholder="Country"
          style={{ width: '100%', marginBottom: 8, padding: 10 }}
        />
        <button
          type="button"
          disabled={requestingLocation || loading}
          onClick={async () => {
            const city = placeCity.trim();
            const country = placeCountry.trim();
            if (!city && !country) {
              setError('Type your city and country, then tap Save.');
              return;
            }
            if (!user?.id) return;
            setRequestingLocation(true);
            setError('');
            try {
              const coords = await resolveWorkingCoords(
                { userId: user.id, city, country, placeFirst: true, ignoreCache: true },
                locationApi
              );
              if (!coords) {
                setError('Could not find that place. Check the spelling.');
                return;
              }
              applyCoords(coords);
            } catch (err: unknown) {
              setError(formatAxiosError(err, 'Could not save that place'));
            } finally {
              setRequestingLocation(false);
            }
          }}
          style={{ width: '100%', margin: 0 }}
        >
          {requestingLocation ? 'Saving…' : 'Save city'}
        </button>
        {locationDeclined && (
          <p style={{ margin: '10px 0 0', fontSize: 11, color: '#9ca3af' }}>
            Location off — you can still browse. Tap Yes or Save city anytime.
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
    if (visibleNearbyUsers.length === 0 && pendingBuzzNotNearby.length === 0) {
      return (
        <p style={{ color: '#9ca3af', fontSize: '12px', fontFamily: 'Orbitron, monospace', textAlign: 'center', padding: '20px 0' }}>
          No one nearby yet. The other phone has to tap Yes too — this list refreshes every few seconds.
        </p>
      );
    }
    const pageCount = maxListPage + 1;
    return (
      <div>
        <p style={{ margin: '0 0 10px', fontSize: 11, color: '#9ca3af', fontFamily: 'Orbitron, monospace', lineHeight: 1.45 }}>
          Showing {Math.min(NEARBY_PAGE_SIZE, remainingCount)} of {remainingCount} here
          {crowdedVenue ? ' — packed spot (club, train, station).' : '.'}
          {' '}Respond (interest or pass) and the next person fills this list. Scroll this page, then react to anyone you want.
        </p>
        {remainingCount > 0 && (
          <input
            type="search"
            value={personSearch}
            onChange={(e) => {
              setPersonSearch(e.target.value);
              setListPage(0);
            }}
            placeholder="Search that person (name or username)"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              marginBottom: 10,
              padding: '10px 12px',
              borderRadius: 8,
              border: '2px solid rgba(0, 212, 255, 0.45)',
              background: 'rgba(0,0,0,0.45)',
              color: '#fff',
              fontFamily: 'Orbitron, monospace',
              fontSize: 12,
            }}
          />
        )}
        {personSearch.trim() && remainingCount === 0 && (
          <p style={{ color: '#f59e0b', fontSize: 12, fontFamily: 'Orbitron, monospace', textAlign: 'center', padding: '8px 0' }}>
            No match for that search. Try another name or username.
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflowY: 'auto' }}>
          {pageIncoming.map((buzz) => (
            <div
              key={buzz.id}
              className="nearby-person"
              style={{ border: '2px solid rgba(255, 0, 255, 0.45)' }}
            >
              <div className="nearby-person-main">
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(255, 0, 255, 0.5)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255, 0, 255, 0.1)' }}>
                  {buzz.fromUserProfilePicture ? (
                    <img src={buzz.fromUserProfilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '20px', color: '#ff00ff' }}>?</span>
                  )}
                </div>
                <div className="nearby-person-copy">
                  <div className="nearby-person-name" style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', fontFamily: 'Orbitron, monospace' }}>
                    {buzz.fromUsername ? `@${buzz.fromUsername}` : buzz.fromUserName || 'Someone interested'}
                  </div>
                  <div className="nearby-person-status" style={{ fontSize: '11px', color: '#ff00ff', marginTop: 4 }}>Show interest too for Communications — skip if not</div>
                </div>
              </div>
              {renderPersonActions(buzz.fromUserId, buzz)}
            </div>
          ))}
          {pageNearby.map((nearbyUser) => (
            <div
              key={nearbyUser.id}
              className="nearby-person"
              style={{
                border: '2px solid rgba(0, 212, 255, 0.3)',
                boxShadow: '0 0 15px rgba(0, 212, 255, 0.2)',
              }}
            >
              <div className="nearby-person-main">
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
                <div className="nearby-person-copy">
                  <div className="nearby-person-name" style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff', fontFamily: 'Orbitron, monospace' }}>
                    {nearbyUser.username ? `@${nearbyUser.username}` : nearbyUser.name || 'Nearby match'}
                  </div>
                  <div className="nearby-person-status" style={{ fontSize: '11px', color: nearbyUser.isOnline ? '#10b981' : '#9ca3af', marginTop: 4 }}>
                    {nearbyUser.isOnline ? 'Active nearby · your type' : 'Recently nearby · your type'}
                  </div>
                </div>
              </div>
              {renderPersonActions(nearbyUser.id)}
            </div>
          ))}
        </div>
        {(isCrowded || remainingCount > NEARBY_PAGE_SIZE) && pageCount > 1 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
            <button
              type="button"
              disabled={safeListPage <= 0}
              onClick={() => setListPage((p) => Math.max(0, p - 1))}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 8,
                border: '2px solid rgba(0, 212, 255, 0.45)',
                background: 'rgba(0, 0, 0, 0.4)',
                color: '#00d4ff',
                fontFamily: 'Orbitron, monospace',
                fontWeight: 700,
                fontSize: 12,
                opacity: safeListPage <= 0 ? 0.4 : 1,
              }}
            >
              Previous
            </button>
            <button
              type="button"
              disabled={safeListPage >= maxListPage}
              onClick={() => setListPage((p) => Math.min(maxListPage, p + 1))}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: 8,
                border: '2px solid #ff00ff',
                background: 'rgba(255, 0, 255, 0.18)',
                color: '#ff6bff',
                fontFamily: 'Orbitron, monospace',
                fontWeight: 700,
                fontSize: 12,
                boxShadow: '0 0 14px rgba(255, 0, 255, 0.25)',
                opacity: safeListPage >= maxListPage ? 0.4 : 1,
              }}
            >
              Next page
            </button>
          </div>
        )}
        {(isCrowded || remainingCount > NEARBY_PAGE_SIZE) && pageCount > 1 && (
          <p style={{ margin: '8px 0 0', textAlign: 'center', fontSize: 11, color: '#9ca3af', fontFamily: 'Orbitron, monospace' }}>
            Page {safeListPage + 1} of {pageCount}
          </p>
        )}
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
            Nearby people update automatically. Show interest once — they only Accept or Decline (no need to send interest back).
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
              Nearby now{remainingCount > 0
                ? ` · ${Math.min(NEARBY_PAGE_SIZE, remainingCount)} on this list${remainingCount > NEARBY_PAGE_SIZE ? ` · ${remainingCount} total` : ''}${pendingBuzzNotNearby.length > 0 ? ` · ${pendingBuzzNotNearby.length} showed interest` : ''}`
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
            Type any place, park, shop, or city. Leave type on None to search everything (live map). Or pick a type to filter.
          </p>
          <input
            type="text"
            placeholder="Search a place…"
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff', fontFamily: 'Orbitron, monospace' }}>{searchPlaceMostConcentrated.venue}</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#ff00ff' }}>
                    {searchPlaceMostConcentrated.preferenceHits ?? searchPlaceMostConcentrated.count}
                  </div>
                  <div style={{ fontSize: 10, color: '#f9a8d4' }}>preference matches</div>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>{searchPlaceMostConcentrated.count} people nearby</div>
                </div>
              </div>
            </div>
          )}
          {searchPlaceResults.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowPreferenceRankList((v) => !v)}
                className="select-user-btn"
                style={{
                  width: '100%',
                  marginBottom: 10,
                  border: '2px solid #00d4ff',
                  color: '#00d4ff',
                  background: 'rgba(0,0,0,0.35)',
                  fontFamily: 'Orbitron, monospace',
                }}
              >
                {showPreferenceRankList ? 'Hide preference ranking' : 'Open preference ranking (high → low)'}
              </button>
              {showPreferenceRankList && (
                <div style={{
                  marginBottom: 12,
                  padding: 12,
                  borderRadius: 10,
                  border: '1px solid rgba(0,212,255,0.35)',
                  background: 'rgba(0,0,0,0.45)',
                  maxHeight: 280,
                  overflowY: 'auto',
                }}>
                  <p style={{ margin: '0 0 8px', fontSize: 12, color: '#00d4ff', fontFamily: 'Orbitron, monospace' }}>
                    Where your preferences rank highest
                  </p>
                  {[...searchPlaceResults]
                    .sort((a, b) => (b.preferenceHits ?? b.count) - (a.preferenceHits ?? a.count) || b.count - a.count)
                    .map((place, idx) => (
                      <div
                        key={`rank-${place.venue}-${idx}`}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 8,
                          padding: '8px 0',
                          borderBottom: '1px solid rgba(255,255,255,0.08)',
                          fontFamily: 'Orbitron, monospace',
                          fontSize: 12,
                          color: '#e5e7eb',
                        }}
                      >
                        <span>#{idx + 1} {place.venue}</span>
                        <span style={{ color: '#ff00ff', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {place.preferenceHits ?? place.count} prefs · {place.count} people
                        </span>
                      </div>
                    ))}
                </div>
              )}
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
                    <span style={{ fontSize: '14px', color: '#fff', fontFamily: 'Orbitron, monospace' }}>
                      {place.venue}
                      {place.venueType ? (
                        <span style={{ display: 'block', fontSize: '11px', color: '#9ca3af', marginTop: 2 }}>{place.venueType}</span>
                      ) : null}
                    </span>
                    <div style={{ textAlign: 'right', minWidth: 72 }}>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ff00ff' }}>
                        {place.preferenceHits ?? place.count}
                      </div>
                      <div style={{ fontSize: 10, color: '#f9a8d4' }}>prefs</div>
                      <div style={{ fontSize: 10, color: '#9ca3af' }}>{place.count} nearby</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {searchPlaceResults.length === 0 && searchPlaceLocationName && !searchPlacesLoading && (
            <p style={{ color: '#9ca3af', fontSize: '12px', fontFamily: 'Orbitron, monospace' }}>
              {searchPlaceType === 'none'
                ? 'No matching places found here yet, or no app users nearby. Try another name — results use the live map.'
                : `No ${searchPlaceType.replace('_', ' ')}s found in this area, or no app users there yet.`}
            </p>
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
            Ten people at a time. Scroll, show interest or pass, and the next person fills in. In a packed club or train, use Next page or search.
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
                  {(() => {
                    const pending = buzzes.received.filter((b) => b.status === 'pending');
                    const settled = buzzes.received.filter((b) => b.status !== 'pending');
                    const maxP = Math.max(0, Math.ceil(pending.length / NEARBY_PAGE_SIZE) - 1);
                    const page = Math.min(buzzPage, maxP);
                    const shownPending = pending.slice(page * NEARBY_PAGE_SIZE, page * NEARBY_PAGE_SIZE + NEARBY_PAGE_SIZE);
                    const rows = [...shownPending, ...settled];
                    return (
                      <>
                        {pending.length > NEARBY_PAGE_SIZE && (
                          <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', fontFamily: 'Orbitron, monospace' }}>
                            Pending interest: 10 at a time. Respond and the next person fills in, or Next page.
                          </p>
                        )}
                        {rows.map((buzz) => (
                    <div key={buzz.id} className="nearby-person" style={{ border: '2px solid rgba(0, 212, 255, 0.3)' }}>
                      <div className="nearby-person-main">
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(255, 0, 255, 0.5)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255, 0, 255, 0.1)' }}>
                          {buzz.fromUserProfilePicture ? (
                            <img src={buzz.fromUserProfilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ fontSize: '20px', color: '#ff00ff' }}>?</span>
                          )}
                        </div>
                        <div className="nearby-person-copy nearby-person-name" style={{ fontSize: 12, color: '#fff', fontFamily: 'Orbitron, monospace' }}>
                          {buzz.fromUsername ? `@${buzz.fromUsername}` : buzz.status === 'pending' ? 'Pending interest' : buzz.status}
                        </div>
                      </div>
                      {buzz.status === 'pending' ? (
                      <div className="nearby-person-actions">
                        <button onClick={() => handleRespondBuzz(buzz.id, 'accepted')} className="send-btn" disabled={loading} style={{ background: 'rgba(16, 185, 129, 0.2)', border: '2px solid #10b981', color: '#10b981', fontSize: '11px', padding: '6px 10px', fontFamily: 'Orbitron, monospace', fontWeight: 'bold' }}>Yes</button>
                        <button onClick={() => handleRespondBuzz(buzz.id, 'rejected')} className="send-btn" disabled={loading} style={{ background: 'rgba(239, 68, 68, 0.2)', border: '2px solid #ef4444', color: '#ef4444', fontSize: '11px', padding: '6px 10px', fontFamily: 'Orbitron, monospace', fontWeight: 'bold' }}>No</button>
                        <button onClick={() => handleRespondBuzz(buzz.id, 'talk_later')} className="send-btn" disabled={loading} style={{ background: 'rgba(245, 158, 11, 0.2)', border: '2px solid #f59e0b', color: '#f59e0b', fontSize: '11px', padding: '6px 10px', fontFamily: 'Orbitron, monospace', fontWeight: 'bold' }}>Talk later</button>
                      </div>
                      ) : null}
                    </div>
                        ))}
                        {pending.length > NEARBY_PAGE_SIZE && (
                          <button
                            type="button"
                            disabled={page >= maxP}
                            onClick={() => setBuzzPage((p) => Math.min(maxP, p + 1))}
                            style={{
                              padding: '10px',
                              borderRadius: 8,
                              border: '2px solid #ff00ff',
                              background: 'rgba(255, 0, 255, 0.18)',
                              color: '#ff6bff',
                              fontFamily: 'Orbitron, monospace',
                              fontWeight: 700,
                              fontSize: 12,
                            }}
                          >
                            Next page
                          </button>
                        )}
                      </>
                    );
                  })()}
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
