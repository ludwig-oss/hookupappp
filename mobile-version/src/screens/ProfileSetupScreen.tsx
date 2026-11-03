import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { dateMatchAPI } from '../api/dateMatch';
import { discoverAPI, LOOKING_FOR_OPTIONS } from '../api/discover';
import { profileAPI } from '../api/profile';
import { walkMatchAPI } from '../api/walkMatch';
import { formatAxiosError } from '../lib/apiError';
import { useAuth } from '../state/AuthContext';
import { getAuthToken, getStayLoggedIn } from '../session/authStorage';
import { ErrorText, Field, Muted, PrimaryButton, Screen, Title } from '../ui/components';
import { colors } from '../ui/theme';

const ORIENTATIONS = ['straight', 'gay', 'lesbian', 'bisexual', 'pansexual'] as const;

export function ProfileSetupScreen() {
  const { user, login, logout, updateUser } = useAuth();
  const [photo, setPhoto] = useState<string | null>(null);
  const [age, setAge] = useState(user?.age ? String(user.age) : '');
  const [city, setCity] = useState(user?.city || '');
  const [country, setCountry] = useState(user?.country || '');
  const [gender, setGender] = useState(user?.gender === 'male' || user?.gender === 'female' ? user.gender : '');
  const [orientation, setOrientation] = useState<(typeof ORIENTATIONS)[number] | ''>('');
  const [lookingFor, setLookingFor] = useState<string[]>(user?.dateLookingFor || []);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const pickPhoto = async (fromCamera: boolean) => {
    setError('');
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(fromCamera ? 'Camera permission is required for a profile photo.' : 'Photo permission is required.');
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.6,
          base64: true,
        });
    if (result.canceled || !result.assets[0]?.base64) return;
    const asset = result.assets[0];
    const mime = asset.mimeType || 'image/jpeg';
    setPhoto(`data:${mime};base64,${asset.base64}`);
  };

  const toggleLooking = (id: string) => {
    setLookingFor((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const finish = async () => {
    if (!user?.id) return;
    if (!photo) {
      setError('A still photo with your head visible is required.');
      return;
    }
    if (gender !== 'female' && gender !== 'male') {
      setError('Choose Female or Male.');
      return;
    }
    const ageNumber = Number(age);
    if (!Number.isFinite(ageNumber) || ageNumber < 18) {
      setError('Enter an age of 18 or older.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      updateUser({ gender, dateLookingFor: lookingFor, age: ageNumber, city: city.trim(), country: country.trim() });
      await profileAPI.updateProfile({
        gender,
        age: ageNumber,
        city: city.trim() || undefined,
        country: country.trim() || undefined,
      });
      if (orientation) {
        await discoverAPI.setPreference({ orientation, userId: user.id }).catch(() => undefined);
      }
      if (lookingFor.length) {
        await dateMatchAPI.saveLookingFor(lookingFor).catch(() => undefined);
      }
      await walkMatchAPI.updateSettings({ gender, age: ageNumber }).catch(() => undefined);
      const response = await profileAPI.completeProfileSetup(photo, user.id);
      const token = getAuthToken() || '';
      login(
        {
          ...user,
          profileSetupComplete: true,
          profilePicture: response.user?.profilePicture ?? user.profilePicture,
          gender,
          age: ageNumber,
          city: city.trim(),
          country: country.trim(),
          dateLookingFor: lookingFor,
        },
        token,
        { stayLoggedIn: getStayLoggedIn() }
      );
    } catch (err) {
      setError(formatAxiosError(err, 'Could not finish profile setup.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Title subtitle="Chest-up photo, then the same profile fields the website asks for.">Finish your profile</Title>
      {photo ? <Image source={{ uri: photo }} style={styles.preview} /> : <View style={styles.previewEmpty}><Text style={styles.previewText}>No photo yet</Text></View>}
      <View style={styles.row}>
        <View style={styles.flex}><PrimaryButton label="Camera" tone="ghost" onPress={() => void pickPhoto(true)} /></View>
        <View style={styles.flex}><PrimaryButton label="Library" tone="ghost" onPress={() => void pickPhoto(false)} /></View>
      </View>
      <Field label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" />
      <Field label="City" value={city} onChangeText={setCity} autoCapitalize="words" />
      <Field label="Country" value={country} onChangeText={setCountry} autoCapitalize="words" />
      <Muted>Gender</Muted>
      <ChoiceRow options={['female', 'male']} selected={gender} onSelect={setGender} />
      <Muted>Orientation</Muted>
      <ChoiceRow options={[...ORIENTATIONS]} selected={orientation} onSelect={(value) => setOrientation(value as (typeof ORIENTATIONS)[number])} />
      <Muted>Looking for</Muted>
      <ChoiceRow options={[...LOOKING_FOR_OPTIONS]} selected={lookingFor} multiple onSelect={toggleLooking} />
      <ErrorText>{error}</ErrorText>
      <PrimaryButton label="Save and continue" onPress={() => void finish()} loading={loading} />
      <PrimaryButton label="Sign out" tone="danger" onPress={logout} />
    </Screen>
  );
}

function ChoiceRow({
  options,
  selected,
  onSelect,
  multiple = false,
}: {
  options: string[];
  selected: string | string[];
  onSelect: (value: string) => void;
  multiple?: boolean;
}) {
  return (
    <View style={styles.wrap}>
      {options.map((option) => {
        const on = multiple ? (selected as string[]).includes(option) : selected === option;
        return (
          <Pressable key={option} onPress={() => onSelect(option)} style={[styles.chip, on && styles.chipOn]}>
            <Text style={styles.chipText}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { width: 160, height: 160, borderRadius: 80, alignSelf: 'center' },
  previewEmpty: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  previewText: { color: colors.muted },
  row: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: colors.accentDeep, borderColor: colors.accent },
  chipText: { color: colors.text, textTransform: 'capitalize' },
});
