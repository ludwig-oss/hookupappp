import { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { profileAPI } from '../../api/profile';
import { formatAxiosError } from '../../lib/apiError';
import { useAuth } from '../../state/AuthContext';
import { Field, Hint, NeonButton, Notice, shell } from './chrome';

export function ProfilePanel({ onSignOut }: { onSignOut: () => void }) {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [city, setCity] = useState(user?.city || '');
  const [country, setCountry] = useState(user?.country || '');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const me = (await profileAPI.getCurrentUser()) as {
        name?: string;
        bio?: string;
        city?: string;
        country?: string;
        profilePicture?: string | null;
        photoVerifiedAt?: string | null;
      };
      setName(me.name || '');
      setBio(me.bio || '');
      setCity(me.city || '');
      setCountry(me.country || '');
      updateUser({
        name: me.name,
        bio: me.bio,
        city: me.city,
        country: me.country,
        profilePicture: me.profilePicture,
        photoVerifiedAt: me.photoVerifiedAt,
      });
    } catch (err) {
      setError(formatAxiosError(err, 'Could not refresh your profile.'));
    }
  }, [updateUser]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await profileAPI.updateProfile({
        name: name.trim(),
        bio: bio.trim(),
        city: city.trim(),
        country: country.trim(),
      });
      updateUser({ name: name.trim(), bio: bio.trim(), city: city.trim(), country: country.trim() });
      setNotice('Profile saved.');
    } catch (err) {
      setError(formatAxiosError(err, 'Could not save your profile.'));
    } finally {
      setSaving(false);
    }
  };

  const display = user?.name || name || 'Your profile';

  return (
    <View style={styles.wrap}>
      {user?.profilePicture ? (
        <Image source={{ uri: user.profilePicture }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.fallback]}>
          <Text style={styles.fallbackText}>{display.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      <Text style={styles.name}>{display}</Text>
      {user?.username ? <Text style={styles.handle}>@{user.username}</Text> : null}
      {user?.photoVerifiedAt ? <Text style={styles.verified}>Photo verified</Text> : null}
      <Hint>Photo, city, and bio. Open the menu for Compatibility, Highlights, Safety, and Help.</Hint>
      {notice ? <Notice>{notice}</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
      <Field label="Bio" value={bio} onChangeText={setBio} multiline />
      <Field label="City" value={city} onChangeText={setCity} autoCapitalize="words" />
      <Field label="Country" value={country} onChangeText={setCountry} autoCapitalize="words" />
      <NeonButton label={saving ? 'Saving…' : 'Save profile'} onPress={() => void save()} disabled={saving} />
      <NeonButton label="Logout" tone="danger" onPress={onSignOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12, gap: 12, maxWidth: 420, alignSelf: 'center', width: '100%' },
  avatar: { width: 88, height: 88, borderRadius: 44, alignSelf: 'center' },
  fallback: {
    backgroundColor: shell.bar,
    borderWidth: 1,
    borderColor: shell.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: { color: shell.white, fontSize: 32, fontWeight: '700' },
  name: { color: shell.white, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  handle: { color: shell.muted, fontSize: 14, textAlign: 'center', marginTop: -6 },
  verified: { color: shell.ok, fontSize: 12, textAlign: 'center', fontWeight: '700', marginTop: -6 },
});
