import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import { connectionsAPI, type Buzz, type NearbyUser } from '../api/connections';
import { relationshipAPI, type RelationshipState } from '../api/relationship';
import { formatAxiosError } from '../lib/apiError';
import { useAuth } from '../state/AuthContext';
import { Card, ErrorText, Muted, PrimaryButton, Screen, Title } from '../ui/components';
import { colors } from '../ui/theme';

export function ConnectionsScreen() {
  const { user } = useAuth();
  const [nearby, setNearby] = useState<NearbyUser[]>([]);
  const [received, setReceived] = useState<Buzz[]>([]);
  const [relationship, setRelationship] = useState<RelationshipState | null>(null);
  const [place, setPlace] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError('');
    try {
      const rel = await relationshipAPI.getMyRelationship().catch(() => ({ relationship: null }));
      setRelationship(rel.relationship);
      const buzzes = await connectionsAPI.getMyBuzzes(user.id);
      setReceived(buzzes.received || []);
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
        if (ip.city) setPlace([ip.city, ip.country].filter(Boolean).join(', '));
      }
      if (lat == null || lon == null) {
        setError('Location is unavailable. Allow location access or try again.');
        return;
      }
      setCoords({ lat, lon });
      await connectionsAPI.updateLocation({ lat, lon, userId: user.id, connectionsVisible: true });
      const geo = await connectionsAPI.reverseGeocode(lat, lon).catch(() => null);
      if (geo?.displayName) setPlace(geo.displayName);
      const found = await connectionsAPI.getNearby({ lat, lon, userId: user.id, radius: 2000 });
      setNearby(found.users || []);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not load people nearby.'));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const buzz = async (toUserId: string) => {
    if (!user?.id || !coords) return;
    try {
      await connectionsAPI.sendBuzz({ toUserId, userId: user.id, location: coords });
      await refresh();
    } catch (err) {
      setError(formatAxiosError(err, 'Could not send a buzz.'));
    }
  };

  const respond = async (buzzId: string, response: 'accepted' | 'rejected' | 'talk_later') => {
    try {
      await connectionsAPI.respondBuzz({ buzzId, response });
      await refresh();
    } catch (err) {
      setError(formatAxiosError(err, 'Could not respond to that buzz.'));
    }
  };

  return (
    <Screen>
      <Title subtitle={place || 'People around you, using the same connections API.'}>Connections</Title>
      {relationship?.status === 'active' ? (
        <Card>
          <Text style={styles.name}>In a relationship{relationship.partnerName ? ` with ${relationship.partnerName}` : ''}</Text>
          <Muted>Nearby discovery stays available. The website locks some dating tools while this is active.</Muted>
        </Card>
      ) : null}
      <PrimaryButton label={loading ? 'Refreshing…' : 'Refresh nearby'} onPress={() => void refresh()} loading={loading} />
      <ErrorText>{error}</ErrorText>
      {received.filter((item) => item.status === 'pending').map((item) => (
        <Card key={item.id}>
          <Text style={styles.name}>{item.fromUserName || item.fromUsername || 'Someone'} buzzed you</Text>
          <View style={styles.row}>
            <View style={styles.flex}><PrimaryButton label="Accept" tone="ok" onPress={() => void respond(item.id, 'accepted')} /></View>
            <View style={styles.flex}><PrimaryButton label="Later" tone="ghost" onPress={() => void respond(item.id, 'talk_later')} /></View>
            <View style={styles.flex}><PrimaryButton label="No" tone="danger" onPress={() => void respond(item.id, 'rejected')} /></View>
          </View>
        </Card>
      ))}
      {nearby.length === 0 && !loading ? <Muted>No one is in range right now.</Muted> : null}
      {nearby.map((person) => (
        <Card key={person.id}>
          <Text style={styles.name}>{person.name}</Text>
          <Muted>{person.username ? `@${person.username}` : person.isOnline ? 'Online' : 'Nearby'}</Muted>
          <PrimaryButton label="Buzz" onPress={() => void buzz(person.id)} />
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { color: colors.text, fontSize: 17, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
