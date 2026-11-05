import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { connectionsAPI } from '../../api/connections';
import { improvementAPI } from '../../api/improvement';
import { postsAPI, type DatingPost } from '../../api/posts';
import { profileAPI, type ProfileData } from '../../api/profile';
import { useAuth } from '../../state/AuthContext';

type Props = {
  onSignOut: () => void;
  onOpenSettings: () => void;
};

const COUNTRY_TO_ISO: Record<string, string> = {
  usa: 'us', 'united states': 'us', us: 'us', america: 'us', 'united states of america': 'us',
  uk: 'gb', 'united kingdom': 'gb', britain: 'gb', england: 'gb', gb: 'gb', 'great britain': 'gb',
  canada: 'ca', germany: 'de', deutschland: 'de', de: 'de', france: 'fr', spain: 'es', italy: 'it',
  japan: 'jp', china: 'cn', india: 'in', brazil: 'br', mexico: 'mx', netherlands: 'nl', holland: 'nl',
  belgium: 'be', switzerland: 'ch', austria: 'at', portugal: 'pt', greece: 'gr', poland: 'pl',
  sweden: 'se', norway: 'no', denmark: 'dk', finland: 'fi', ireland: 'ie', australia: 'au',
  'south korea': 'kr', korea: 'kr', turkey: 'tr', turkiye: 'tr', ukraine: 'ua', russia: 'ru',
};

function flagCode(country: string): string | null {
  const key = country.trim().toLowerCase();
  return key ? COUNTRY_TO_ISO[key] ?? null : null;
}

async function pickImageDataUrl(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Photos', 'Allow photo access to update your profile.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    base64: true,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  if (asset.base64) return `data:image/jpeg;base64,${asset.base64}`;
  return asset.uri;
}

export function ProfilePanel({ onSignOut, onOpenSettings }: Props) {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [age, setAge] = useState(user?.age != null ? String(user.age) : '');
  const [country, setCountry] = useState(user?.country || '');
  const [city, setCity] = useState(user?.city || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [locating, setLocating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [match, setMatch] = useState(0);
  const [posts, setPosts] = useState<DatingPost[]>([]);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setError('');
    try {
      const me = await profileAPI.getCurrentUser();
      const extra = me as ProfileData & { age?: number | string; country?: string; city?: string };
      setProfile(me);
      setAge(extra.age != null && extra.age !== '' ? String(extra.age) : '');
      setCountry(extra.country || '');
      setCity(extra.city || '');
      updateUser({
        name: me.name,
        email: me.email,
        profilePicture: me.profilePicture,
        city: extra.city,
        country: extra.country,
        age: extra.age,
        photoVerifiedAt: me.photoVerifiedAt,
      });
    } catch {
      setError('Could not refresh your profile. Showing the Google account on this phone.');
    }
    try {
      const imp = await improvementAPI.getUserImprovement(user.id);
      setMatch(Math.round(imp.improvementPercentage || 0));
    } catch {
      setMatch(0);
    }
    try {
      const mine = await postsAPI.getPostsByUser(user.id);
      setPosts(mine.posts || []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, updateUser]);

  useEffect(() => {
    void load();
  }, [load]);

  const name = profile?.name || user?.name || 'Zorp';
  const email = profile?.email || user?.email || '';
  const picture = profile?.profilePicture || user?.profilePicture || '';
  const verified = Boolean(profile?.photoVerifiedAt || user?.photoVerifiedAt);
  const stories = profile?.stories || [];
  const highlights = profile?.highlights || [];
  const code = flagCode(country);

  const save = async () => {
    setSaving('saving');
    setError('');
    try {
      const ageNum = age.trim() ? Number(age) : undefined;
      await profileAPI.updateProfile({
        age: ageNum != null && Number.isFinite(ageNum) ? ageNum : undefined,
        country: country.trim(),
        city: city.trim(),
      });
      updateUser({ age: age.trim(), country: country.trim(), city: city.trim() });
      setSaving('saved');
    } catch {
      setSaving('error');
      setError('Could not save those details.');
    }
  };

  const useLocation = async () => {
    setLocating(true);
    setError('');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setError('Location permission is off.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const geo = await connectionsAPI.reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      if (geo.city) setCity(geo.city);
      if (geo.country) setCountry(geo.country);
    } catch {
      setError('Could not detect your location.');
    } finally {
      setLocating(false);
    }
  };

  const changePhoto = async () => {
    if (!user?.id) return;
    const data = await pickImageDataUrl();
    if (!data) return;
    setUploading(true);
    setError('');
    try {
      const res = await profileAPI.uploadProfilePicture(data, user.id);
      setProfile((prev) => (prev ? { ...prev, profilePicture: res.profilePicture } : prev));
      updateUser({ profilePicture: res.profilePicture });
    } catch {
      setError('Could not update your photo.');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = () => {
    if (!user?.id || !picture) return;
    Alert.alert('Remove photo?', 'Your profile picture will be cleared.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setUploading(true);
            try {
              await profileAPI.uploadProfilePicture('', user.id);
              setProfile((prev) => (prev ? { ...prev, profilePicture: null } : prev));
              updateUser({ profilePicture: null });
            } catch {
              setError('Could not remove your photo.');
            } finally {
              setUploading(false);
            }
          })();
        },
      },
    ]);
  };

  const addStory = async () => {
    const data = await pickImageDataUrl();
    if (!data) return;
    setUploading(true);
    try {
      await profileAPI.addStory(data, 'all');
      await load();
    } catch {
      setError('Could not add that story.');
    } finally {
      setUploading(false);
    }
  };

  const addHighlight = async () => {
    if (!user?.id) return;
    const data = await pickImageDataUrl();
    if (!data) return;
    setUploading(true);
    try {
      await profileAPI.addHighlight(data, user.id);
      await load();
    } catch {
      setError('Could not add that highlight.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <View style={styles.avatarWrap}>
          <View style={styles.glow} />
          <Pressable onPress={() => void changePhoto()} style={styles.avatar} disabled={uploading}>
            {picture ? (
              <Image source={{ uri: picture }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarFallback}>👤</Text>
            )}
          </Pressable>
        </View>
        <View style={styles.avatarActions}>
          <Pressable style={styles.cyanBtn} onPress={() => void changePhoto()} disabled={uploading}>
            <Text style={styles.cyanBtnText}>{uploading ? 'LOADING' : 'CHANGE'}</Text>
          </Pressable>
          {picture ? (
            <Pressable style={styles.cyanBtn} onPress={removePhoto} disabled={uploading}>
              <Text style={styles.cyanBtnText}>REMOVE</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.nameRow}>
          <Text style={styles.name}>{name}</Text>
          {verified ? (
            <View style={styles.verified}>
              <Text style={styles.verifiedText}>✓ Photo verified</Text>
            </View>
          ) : null}
        </View>
        {email ? <Text style={styles.email}>{email}</Text> : null}

        <TextInput
          value={age}
          onChangeText={setAge}
          placeholder="Age"
          placeholderTextColor="rgba(0,212,255,0.5)"
          keyboardType="number-pad"
          style={styles.input}
        />
        <View style={styles.countryRow}>
          <View style={styles.flagBox}>
            {code ? (
              <Image source={{ uri: `https://flagcdn.com/w40/${code}.png` }} style={styles.flag} />
            ) : (
              <Text style={styles.flagEmoji}>🌍</Text>
            )}
          </View>
          <TextInput
            value={country}
            onChangeText={setCountry}
            placeholder="Country"
            placeholderTextColor="rgba(0,212,255,0.5)"
            style={[styles.input, styles.countryInput]}
          />
        </View>
        <TextInput
          value={city}
          onChangeText={setCity}
          placeholder="City"
          placeholderTextColor="rgba(0,212,255,0.5)"
          style={styles.input}
        />
        {city ? <Text style={styles.detail}>📍 {city}</Text> : null}

        <Pressable style={styles.locationBtn} onPress={() => void useLocation()} disabled={locating}>
          <Text style={styles.locationText}>{locating ? 'Detecting…' : '📍 Use my location'}</Text>
        </Pressable>
        <Pressable style={styles.saveBtn} onPress={() => void save()} disabled={saving === 'saving'}>
          <Text style={styles.saveText}>
            {saving === 'saving' ? 'Saving...' : saving === 'saved' ? 'Saved!' : saving === 'error' ? 'Retry' : 'Save'}
          </Text>
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>STORIES</Text>
            <Pressable style={styles.plus} onPress={() => void addStory()} disabled={uploading}>
              <Text style={styles.plusText}>+</Text>
            </Pressable>
          </View>
          <Text style={styles.note}>Stories disappear after 24 hours.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            <Pressable style={styles.storyCol} onPress={() => void addStory()} disabled={uploading}>
              <View style={styles.storyAdd}>
                <Text style={styles.storyPlus}>+</Text>
              </View>
              <Text style={styles.storyLabel}>Add story</Text>
            </Pressable>
            {stories.map((story) => (
              <View key={story.id} style={styles.storyCol}>
                <View style={styles.storyRing}>
                  <Image source={{ uri: story.mediaUrl }} style={styles.storyImage} />
                </View>
                <Text style={styles.storyLabel}>{story.audience === 'closeFriends' ? 'Close' : 'Story'}</Text>
              </View>
            ))}
          </ScrollView>
          <Pressable style={styles.friends} onPress={() => setFriendsOpen((v) => !v)}>
            <Text style={styles.friendsText}>Who can see close-friend stories</Text>
          </Pressable>
          {friendsOpen ? (
            <Text style={styles.note}>
              Only people you add here will see stories you post as Close friends only. Everyone else cannot see them.
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>HIGHLIGHTS</Text>
            <Pressable style={styles.plus} onPress={() => void addHighlight()} disabled={uploading}>
              <Text style={styles.plusText}>+</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {highlights.map((item) => {
              const cover = item.coverImage || item.items?.[0]?.imageUrl || item.imageUrl;
              return cover ? (
                <Image key={item.id} source={{ uri: cover }} style={styles.highlight} />
              ) : null;
            })}
            {highlights.length === 0 ? (
              <Pressable style={styles.highlightEmpty} onPress={() => void addHighlight()}>
                <Text style={styles.highlightPlus}>+</Text>
                <Text style={styles.highlightLabel}>ADD HIGHLIGHT</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>⭐ PUBLIC FIGURE / CELEBRITY</Text>
          <Text style={styles.body}>
            For celebrities, politicians, musicians, athletes and other public figures. Your profile and name will be blurred to others until they connect with you and sign an NDA. You get a gold star ✓ and control who can see your identity.
          </Text>
          <Pressable style={styles.locationBtn} onPress={() => setApplyOpen((v) => !v)}>
            <Text style={styles.locationText}>{applyOpen ? 'Hide application' : 'Apply for verification'}</Text>
          </Pressable>
          {applyOpen ? (
            <Text style={styles.note}>
              Pick a level, match a live selfie to this photo, and add an ID photo with sensitive details hidden. Then add public profile links or a photo only you can take.
            </Text>
          ) : null}
        </View>

        <Pressable style={styles.reports} onPress={() => setReportsOpen((v) => !v)}>
          <Text style={styles.reportsTitle}>STAMPED REPORTS</Text>
          <Text style={styles.reportsChevron}>{reportsOpen ? '▾' : '▸'}</Text>
        </Pressable>
        {reportsOpen ? (
          <Text style={styles.body}>
            Go to your doctor, get tested, and keep a photo of each stamped report. Matches can request these only after you plan a meetup.
          </Text>
        ) : null}

        <Text style={styles.match}>{loading ? '…' : `${match}% MATCH`}</Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.sectionTitle}>POSTS</Text>
        {posts.length === 0 ? (
          <Text style={styles.empty}>You have not posted yet.</Text>
        ) : (
          posts.map((post) => (
            <View key={post.id} style={styles.post}>
              {post.contentType === 'image' && post.content ? (
                <Image source={{ uri: post.content }} style={styles.postImage} />
              ) : null}
              <Text style={styles.postText}>{post.title || (post.contentType === 'text' ? post.content : 'Shared a post')}</Text>
              <Text style={styles.note}>♥ {post.likes || 0}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.block}>
        <Text style={styles.sectionTitle}>REVIEWS</Text>
        <Text style={styles.note}>
          Reviews cannot be deleted — not by you, and not by anyone else. You can reply once to each review. False or malicious claims may lead to ban or suspension.
        </Text>
        <Text style={styles.empty}>No reviews yet.</Text>
      </View>

      <View style={styles.account}>
        <Pressable style={styles.locationBtn} onPress={onOpenSettings}>
          <Text style={styles.locationText}>⚙️ Settings</Text>
        </Pressable>
        <Pressable style={styles.saveBtn} onPress={onSignOut}>
          <Text style={styles.saveText}>Log out</Text>
        </Pressable>
      </View>
      {loading ? <ActivityIndicator color="#00d4ff" style={styles.spinner} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#1a0a12',
    paddingBottom: 28,
  },
  card: {
    marginHorizontal: 8,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#ff8fab',
    backgroundColor: 'rgba(42, 16, 32, 0.92)',
  },
  avatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    height: 236,
  },
  glow: {
    position: 'absolute',
    width: 200,
    height: 240,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 212, 255, 0.18)',
    shadowColor: '#ff00ff',
    shadowOpacity: 0.9,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  avatar: {
    width: 168,
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.7)',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarFallback: { fontSize: 54 },
  avatarActions: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 14 },
  cyanBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#00d4ff',
    backgroundColor: 'rgba(0,212,255,0.2)',
  },
  cyanBtnText: { color: '#00d4ff', fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 6 },
  name: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    textShadowColor: 'rgba(255,255,255,0.45)',
    textShadowRadius: 8,
  },
  verified: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(34,197,94,0.25)',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  verifiedText: { color: '#22c55e', fontSize: 12, fontWeight: '600' },
  email: { color: '#00d4ff', fontSize: 13, marginBottom: 10, textAlign: 'center' },
  input: {
    width: '100%',
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.3)',
    backgroundColor: 'rgba(0,0,0,0.4)',
    color: '#00d4ff',
    fontSize: 12,
    textAlign: 'center',
  },
  countryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  countryInput: { flex: 1 },
  flagBox: {
    width: 40,
    height: 28,
    marginBottom: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.3)',
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  flag: { width: 36, height: 24 },
  flagEmoji: { fontSize: 16 },
  detail: { color: '#00d4ff', textAlign: 'center', marginBottom: 8, fontSize: 14 },
  locationBtn: {
    marginTop: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.5)',
    backgroundColor: 'rgba(0,212,255,0.15)',
    alignItems: 'center',
  },
  locationText: { color: '#00d4ff', fontWeight: '700', fontSize: 13 },
  saveBtn: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#ff6b9d',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
  },
  saveText: { color: '#fff', fontWeight: '700' },
  error: { color: '#ff6b6b', textAlign: 'center', marginTop: 8, fontSize: 13 },
  section: { marginTop: 18 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: {
    color: '#00d4ff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
    textShadowColor: 'rgba(0,212,255,0.5)',
    textShadowRadius: 8,
  },
  plus: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#00d4ff',
    backgroundColor: 'rgba(0,212,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: { color: '#00d4ff', fontSize: 20, fontWeight: '700', marginTop: -2 },
  note: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginBottom: 8, lineHeight: 16 },
  row: { gap: 14, paddingVertical: 8 },
  storyCol: { alignItems: 'center', width: 76 },
  storyAdd: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#00d4ff',
    backgroundColor: 'rgba(0,212,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyPlus: { color: '#00d4ff', fontSize: 28, fontWeight: '700' },
  storyRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    padding: 3,
    backgroundColor: '#00d4ff',
    overflow: 'hidden',
  },
  storyImage: { width: '100%', height: '100%', borderRadius: 36 },
  storyLabel: { color: '#fff', fontSize: 10, opacity: 0.85, textAlign: 'center', marginTop: 6 },
  friends: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.25)',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  friendsText: { color: '#00d4ff', fontSize: 13 },
  highlight: { width: 120, height: 160, borderRadius: 8 },
  highlightEmpty: {
    width: 120,
    height: 160,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#00d4ff',
    backgroundColor: 'rgba(0,212,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightPlus: { color: '#00d4ff', fontSize: 40, fontWeight: '300' },
  highlightLabel: { color: '#00d4ff', fontSize: 10, letterSpacing: 1, marginTop: 6 },
  infoCard: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.3)',
    backgroundColor: 'rgba(0,0,0,0.2)',
    gap: 8,
  },
  body: { color: 'rgba(255,255,255,0.8)', fontSize: 12, lineHeight: 18 },
  reports: {
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.3)',
    backgroundColor: 'rgba(0,0,0,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reportsTitle: { color: '#00d4ff', fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  reportsChevron: { color: '#00d4ff', fontSize: 16 },
  match: {
    marginTop: 18,
    marginBottom: 8,
    textAlign: 'center',
    color: '#00d4ff',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 2,
    textShadowColor: '#00d4ff',
    textShadowRadius: 16,
  },
  block: { marginTop: 18, paddingHorizontal: 20 },
  empty: { color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 6 },
  post: {
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,143,171,0.4)',
  },
  postImage: { width: '100%', height: 180 },
  postText: { color: '#fff', padding: 10, fontSize: 14 },
  account: { marginTop: 22, paddingHorizontal: 20, gap: 8 },
  spinner: { marginTop: 12 },
});
