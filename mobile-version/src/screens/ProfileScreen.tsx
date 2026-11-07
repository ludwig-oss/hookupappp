import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, Text } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { profileAPI } from '../api/profile';
import { formatAxiosError } from '../lib/apiError';
import type { AppStackParamList } from '../navigation/types';
import { onPhotoLockRequired } from '../session/photoLock';
import { useAuth } from '../state/AuthContext';
import { useEffect } from 'react';
import { ProfilePosts } from '../components/dashboard/ProfilePosts';
import { Card, ErrorText, Field, Muted, PrimaryButton, Screen, Title } from '../ui/components';
import { colors } from '../ui/theme';

type ProfileLink = 'Discover' | 'DateMatch' | 'Compatibility' | 'Safety' | 'Settings';

const LINKS: Array<{ route: ProfileLink; label: string; hint: string }> = [
  { route: 'Discover', label: 'Discover', hint: 'Search a city and show interest' },
  { route: 'DateMatch', label: 'Date match', hint: 'Search and respond to dates' },
  { route: 'Compatibility', label: 'Compatibility', hint: 'Take the quiz' },
  { route: 'Safety', label: 'Safety shield', hint: 'Arm, disarm, or call for help' },
  { route: 'Settings', label: 'Settings', hint: 'Notifications and privacy' },
];

export function ProfileScreen({ showShortcuts = true }: { showShortcuts?: boolean }) {
  const { user, logout, updateUser } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [city, setCity] = useState(user?.city || '');
  const [country, setCountry] = useState(user?.country || '');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => onPhotoLockRequired(() => setNotice('Photo verification is required before some actions.')), []);

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

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const save = async () => {
    setSaving(true);
    setError('');
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

  return (
    <Screen>
      <Title subtitle={user?.username ? `@${user.username}` : 'Your account'}>Profile</Title>
      {user?.profilePicture ? <Image source={{ uri: user.profilePicture }} style={styles.avatar} /> : null}
      {user?.photoVerifiedAt ? <Muted>Photo verified</Muted> : null}
      {notice ? <Muted>{notice}</Muted> : null}
      <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
      <Field label="Bio" value={bio} onChangeText={setBio} multiline />
      <Field label="City" value={city} onChangeText={setCity} autoCapitalize="words" />
      <Field label="Country" value={country} onChangeText={setCountry} autoCapitalize="words" />
      <ErrorText>{error}</ErrorText>
      <PrimaryButton label="Save profile" onPress={() => void save()} loading={saving} />
      {user?.id ? <ProfilePosts userId={user.id} /> : null}
      {showShortcuts
        ? LINKS.map((link) => (
            <Pressable key={link.route} onPress={() => navigation.navigate(link.route)}>
              <Card>
                <Text style={styles.link}>{link.label}</Text>
                <Muted>{link.hint}</Muted>
              </Card>
            </Pressable>
          ))
        : null}
      <PrimaryButton label="Sign out" tone="danger" onPress={logout} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 96, height: 96, borderRadius: 48, alignSelf: 'center' },
  link: { color: colors.text, fontSize: 17, fontWeight: '700' },
});
