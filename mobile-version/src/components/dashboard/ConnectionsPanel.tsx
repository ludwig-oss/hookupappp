import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { connectionsAPI, type Buzz, type NearbyUser, type VenueCount } from '../../api/connections';
import { formatAxiosError } from '../../lib/apiError';
import { Field, Hint, NeonButton, Notice, PanelTitle, PersonRow, StageFrame, shell } from './chrome';

const RADII = [
  { value: 500, label: '500 m' },
  { value: 1000, label: '1 km' },
  { value: 2000, label: '2 km' },
  { value: 5000, label: '5 km' },
];

const PLACE_TYPES = [
  { value: 'none', label: 'Any place' },
  { value: 'bar', label: 'Bar' },
  { value: 'cafe', label: 'Café' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'club', label: 'Club' },
  { value: 'park', label: 'Park' },
  { value: 'gym', label: 'Gym' },
];

type ViewId = 'main' | 'venues' | 'search' | 'buzzes';

type PlaceHit = {
  venue: string;
  venueType: string;
  count: number;
  preferenceHits?: number;
};

export function ConnectionsPanel({
  userId,
  refreshToken,
  onOpenChat,
}: {
  userId: string;
  refreshToken: number;
  onOpenChat: (userId: string) => void;
}) {
  const [view, setView] = useState<ViewId>('main');
  const [placeLabel, setPlaceLabel] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [nearby, setNearby] = useState<NearbyUser[]>([]);
  const [buzzes, setBuzzes] = useState<{ received: Buzz[]; sent: Buzz[] }>({ received: [], sent: [] });
  const [venues, setVenues] = useState<VenueCount[]>([]);
  const [radius, setRadius] = useState(1000);
  const [query, setQuery] = useState('');
  const [placeType, setPlaceType] = useState('none');
  const [places, setPlaces] = useState<PlaceHit[]>([]);
  const [hottest, setHottest] = useState<PlaceHit | null>(null);
  const [placeName, setPlaceName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadMain = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let lat: number | null = null;
      let lon: number | null = null;
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.granted) {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
      } else {
        const ip = await connectionsAPI.locateByIp();
        lat = ip.lat;
        lon = ip.lon;
        if (ip.city) setPlaceLabel([ip.city, ip.country].filter(Boolean).join(', '));
      }
      if (lat == null || lon == null) throw new Error('Allow location, then tap refresh.');
      setCoords({ lat, lon });
      await connectionsAPI.updateLocation({ lat, lon, userId, connectionsVisible: true });
      const geo = await connectionsAPI.reverseGeocode(lat, lon).catch(() => null);
      if (geo?.city || geo?.displayName) {
        setPlaceLabel(geo.city && geo.country ? `${geo.city}, ${geo.country}` : geo.displayName);
      }
      const [found, mine] = await Promise.all([
        connectionsAPI.getNearby({ lat, lon, userId, radius: 2000 }),
        connectionsAPI.getMyBuzzes(userId),
      ]);
      setNearby(found.users || []);
      setBuzzes({ received: mine.received || [], sent: mine.sent || [] });
    } catch (err) {
      setError(formatAxiosError(err, 'Could not load people nearby.'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadMain();
  }, [loadMain, refreshToken]);

  const buzz = async (toUserId: string) => {
    if (!coords) return;
    setError('');
    try {
      const res = await connectionsAPI.sendBuzz({ toUserId, userId, location: coords });
      if (res.openChat && res.chatUserId) onOpenChat(res.chatUserId);
      await loadMain();
    } catch (err) {
      setError(formatAxiosError(err, 'Could not send a buzz.'));
    }
  };

  const respond = async (buzzId: string, response: 'accepted' | 'rejected' | 'talk_later') => {
    setError('');
    try {
      const res = await connectionsAPI.respondBuzz({ buzzId, response });
      if (res.openChat && res.chatUserId) onOpenChat(res.chatUserId);
      await loadMain();
    } catch (err) {
      setError(formatAxiosError(err, 'Could not respond to that buzz.'));
    }
  };

  const loadVenues = async () => {
    if (!coords) {
      setError('Location is still loading.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await connectionsAPI.getVenues({ ...coords, radius, userId });
      setVenues(res.venues || []);
      setView('venues');
    } catch (err) {
      setError(formatAxiosError(err, 'Could not load venues.'));
    } finally {
      setLoading(false);
    }
  };

  const searchPlaces = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await connectionsAPI.searchPlaces({ q: query.trim(), type: placeType });
      setPlaces(res.places || []);
      setHottest(res.mostConcentrated || null);
      setPlaceName(res.locationName || '');
    } catch (err) {
      setError(formatAxiosError(err, 'Could not search places.'));
    } finally {
      setLoading(false);
    }
  };

  const pending = buzzes.received.filter((item) => item.status === 'pending');
  const radiusLabel = radius >= 1000 ? `${radius / 1000} km` : `${radius} m`;

  return (
    <StageFrame>
      <PanelTitle icon="🔗">Connections</PanelTitle>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {loading ? <ActivityIndicator color={shell.cyan} /> : null}

      {view === 'main' ? (
        <>
          {placeLabel ? <Text style={styles.place}>📍 {placeLabel}</Text> : null}
          <Hint>Nearby people update when you refresh. Show interest once — they only Accept or Decline.</Hint>
          {pending.length > 0 ? (
            <Notice tone="magenta">
              {`🔔 ${pending.length} nearby interest${pending.length === 1 ? '' : 's'} — respond below`}
            </Notice>
          ) : null}
          <Text style={styles.section}>Nearby now{nearby.length ? ` · ${nearby.length}` : ''}</Text>
          {nearby.length === 0 && !loading ? <Hint>No one is in range right now.</Hint> : null}
          {nearby.map((person) => (
            <PersonRow
              key={person.id}
              name={person.username ? `@${person.username}` : person.name || 'Nearby match'}
              meta={person.isOnline ? 'Active nearby · your type' : 'Recently nearby · your type'}
              action="Buzz"
              onAction={() => void buzz(person.id)}
            />
          ))}
          {pending.map((item) => (
            <View key={item.id} style={styles.buzzCard}>
              <Text style={styles.personName}>{item.fromUserName || item.fromUsername || 'Someone'} buzzed you</Text>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <NeonButton label="Accept" tone="cyan" onPress={() => void respond(item.id, 'accepted')} />
                </View>
                <View style={styles.flex}>
                  <NeonButton label="Later" tone="ghost" onPress={() => void respond(item.id, 'talk_later')} />
                </View>
                <View style={styles.flex}>
                  <NeonButton label="No" tone="danger" onPress={() => void respond(item.id, 'rejected')} />
                </View>
              </View>
            </View>
          ))}
          <NeonButton label={loading ? 'Refreshing…' : '↻ Refresh nearby list'} onPress={() => void loadMain()} disabled={loading} />
          <Text style={styles.fieldLabel}>Venues radius</Text>
          <View style={styles.chips}>
            {RADII.map((item) => (
              <Pressable
                key={item.value}
                onPress={() => setRadius(item.value)}
                style={[styles.chip, radius === item.value && styles.chipOn]}
              >
                <Text style={[styles.chipText, radius === item.value && styles.chipTextOn]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          <NeonButton label={loading ? 'Loading...' : `📍 Real venues (${radiusLabel})`} onPress={() => void loadVenues()} disabled={loading || !coords} />
          <NeonButton label="🔍 Search places (see count of your preferences)" onPress={() => setView('search')} />
          <NeonButton
            label={`🔔 My Buzzes (${buzzes.received.length + buzzes.sent.length})`}
            tone="magenta"
            onPress={() => setView('buzzes')}
          />
        </>
      ) : null}

      {view === 'venues' ? (
        <>
          <NeonButton label="← Back" tone="ghost" onPress={() => setView('main')} />
          <Text style={styles.section}>Real venues nearby</Text>
          {venues.length === 0 ? <Hint>No venues in this radius. Try a larger radius.</Hint> : null}
          {venues.map((venue) => (
            <View key={`${venue.venue}-${venue.location.lat}`} style={styles.placeCard}>
              <View style={styles.flex}>
                <Text style={styles.personName}>{venue.venue}</Text>
                <Text style={styles.meta}>{venue.venueType}</Text>
              </View>
              <Text style={styles.count}>{venue.count}</Text>
            </View>
          ))}
        </>
      ) : null}

      {view === 'search' ? (
        <>
          <NeonButton
            label="← Back"
            tone="ghost"
            onPress={() => {
              setView('main');
              setPlaces([]);
              setHottest(null);
            }}
          />
          <Text style={styles.section}>Search real places</Text>
          <Hint>Type any place, park, shop, or city. Leave type on Any place, or pick a type to filter.</Hint>
          <Field placeholder="Search a place…" value={query} onChangeText={setQuery} autoCapitalize="words" />
          <View style={styles.chips}>
            {PLACE_TYPES.map((item) => (
              <Pressable
                key={item.value}
                onPress={() => setPlaceType(item.value)}
                style={[styles.chip, placeType === item.value && styles.chipOn]}
              >
                <Text style={[styles.chipText, placeType === item.value && styles.chipTextOn]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          <NeonButton label={loading ? 'Searching...' : 'Search'} onPress={() => void searchPlaces()} disabled={loading || !query.trim()} />
          {placeName ? <Text style={styles.place}>Location: {placeName}</Text> : null}
          {hottest ? (
            <View style={styles.hot}>
              <Text style={styles.hotLabel}>Hottest spot — most of your preferences here</Text>
              <Text style={styles.personName}>{hottest.venue}</Text>
              <Text style={styles.count}>{hottest.preferenceHits ?? hottest.count} prefs · {hottest.count} nearby</Text>
            </View>
          ) : null}
          {places.map((place) => (
            <View key={place.venue} style={styles.placeCard}>
              <View style={styles.flex}>
                <Text style={styles.personName}>{place.venue}</Text>
                {place.venueType ? <Text style={styles.meta}>{place.venueType}</Text> : null}
              </View>
              <Text style={styles.count}>{place.preferenceHits ?? place.count}</Text>
            </View>
          ))}
        </>
      ) : null}

      {view === 'buzzes' ? (
        <>
          <NeonButton label="← Back" tone="ghost" onPress={() => setView('main')} />
          <Text style={styles.section}>My Buzzes</Text>
          {buzzes.received.length + buzzes.sent.length === 0 ? <Hint>No buzzes yet.</Hint> : null}
          {buzzes.received.map((item) => (
            <PersonRow
              key={item.id}
              name={item.fromUserName || item.fromUsername || 'Someone'}
              meta={`Received · ${item.status}`}
            />
          ))}
          {buzzes.sent.map((item) => (
            <PersonRow key={item.id} name="You sent a buzz" meta={item.status} />
          ))}
        </>
      ) : null}
    </StageFrame>
  );
}

const styles = StyleSheet.create({
  place: { color: shell.cyan, fontSize: 13, fontWeight: '700' },
  section: { color: shell.cyan, fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  fieldLabel: { color: shell.faint, fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipOn: { borderColor: shell.cyan, backgroundColor: 'rgba(0, 212, 255, 0.16)' },
  chipText: { color: shell.text, fontSize: 12 },
  chipTextOn: { color: shell.cyan, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  buzzCard: { gap: 8, paddingVertical: 8 },
  personName: { color: shell.white, fontSize: 15, fontWeight: '700' },
  meta: { color: shell.faint, fontSize: 11, marginTop: 2 },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(0, 212, 255, 0.3)',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  count: { color: shell.magenta, fontSize: 18, fontWeight: '700' },
  hot: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 0, 255, 0.6)',
    backgroundColor: 'rgba(255, 0, 255, 0.16)',
    gap: 4,
  },
  hotLabel: { color: shell.magenta, fontSize: 11, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
});
