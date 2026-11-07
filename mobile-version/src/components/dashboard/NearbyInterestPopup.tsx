import { useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { connectionsAPI, type NearbyUser } from '../../api/connections';
import { formatAxiosError } from '../../lib/apiError';

/** Same nearby interest card as the website, from any dashboard tab. */
export function NearbyInterestPopup({
  userId,
  onOpenChat,
}: {
  userId: string;
  onOpenChat: (otherUserId: string) => void;
}) {
  const [person, setPerson] = useState<NearbyUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const later = useRef<Set<string>>(new Set());
  const denied = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const look = async () => {
      if (denied.current) return;
      const perm = await Location.getForegroundPermissionsAsync();
      let granted = perm.granted;
      if (!granted && perm.canAskAgain) {
        const asked = await Location.requestForegroundPermissionsAsync();
        granted = asked.granted;
      }
      if (!granted) {
        denied.current = true;
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (cancelled) return;
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      await connectionsAPI.updateLocation({
        lat,
        lon,
        accuracy: pos.coords.accuracy ?? undefined,
        userId,
        connectionsVisible: true,
      });
      const { users } = await connectionsAPI.getNearby({ lat, lon, userId, radius: 500 });
      if (cancelled) return;
      const next = (users || []).find((item) => !later.current.has(item.id)) || null;
      setPerson((current) => current || next);
    };
    void look().catch(() => undefined);
    const timer = setInterval(() => {
      void look().catch(() => undefined);
    }, 20000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [userId]);

  const dismiss = () => {
    if (person) later.current.add(person.id);
    setPerson(null);
    setError('');
  };

  const send = async () => {
    if (!person) return;
    setBusy(true);
    setError('');
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const result = await connectionsAPI.sendBuzz({
        toUserId: person.id,
        userId,
        location: { lat: pos.coords.latitude, lon: pos.coords.longitude },
      });
      const chatId = result.chatUserId;
      later.current.add(person.id);
      setPerson(null);
      if (chatId) onOpenChat(chatId);
    } catch (err) {
      setError(formatAxiosError(err, 'Could not send interest.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={Boolean(person)} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.badge}>NEARBY · YOUR TYPE</Text>
          <Text style={styles.title}>Someone matching you is nearby</Text>
          <Text style={styles.sub}>Show interest once. They only need to accept. No need for them to send interest back.</Text>
          {person?.profilePicture ? (
            <Image source={{ uri: person.profilePicture }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar} />
          )}
          <Text style={styles.name}>{person?.name || 'Someone'}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Pressable onPress={dismiss} style={styles.ghost}>
              <Text style={styles.ghostText}>Later</Text>
            </Pressable>
            <Pressable onPress={() => void send()} disabled={busy} style={styles.primary}>
              <Text style={styles.primaryText}>{busy ? 'Sending…' : 'Show interest'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,0,255,0.55)',
    backgroundColor: '#2a1048',
    padding: 18,
    gap: 8,
  },
  badge: { color: '#d8b4fe', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  sub: { color: '#e9d5ff', fontSize: 14, lineHeight: 20 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#4c1d95', alignSelf: 'flex-start' },
  name: { color: '#fff', fontSize: 16, fontWeight: '700' },
  error: { color: '#fda4af', fontSize: 13 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  ghost: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', backgroundColor: '#3b0764' },
  ghostText: { color: '#fff', fontWeight: '700' },
  primary: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', backgroundColor: '#ec4899' },
  primaryText: { color: '#fff', fontWeight: '800' },
});
