import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { authAPI } from '../api/auth';
import { DEFAULT_IMPROVEMENT_CATEGORIES } from '../constants/improvementCategories';
import { formatAxiosError } from '../lib/apiError';
import type { AuthStackParamList } from '../navigation/types';
import { useAuth } from '../state/AuthContext';
import { ErrorText, Field, Muted, PrimaryButton, Screen, Title } from '../ui/components';
import { colors } from '../ui/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

export function SignupScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleCategory = (id: string) => {
    setCategories((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submit = async () => {
    setError('');
    if (!name.trim() || !username.trim() || password.length < 6) {
      setError('Name, username, and a password of at least 6 characters are required.');
      return;
    }
    setLoading(true);
    try {
      const available = await authAPI.checkUsernameAvailable(username.trim());
      if (!available.available) {
        setError(available.reason || 'That username is taken.');
        return;
      }
      const response = await authAPI.signup({
        name: name.trim(),
        username: username.trim(),
        password,
        email: email.trim() || undefined,
        improvementCategories: categories,
      });
      if (response.requiresVerification && !response.token) {
        setError(response.message || 'Check your email to verify this account, then sign in.');
        return;
      }
      if (!response.token || !response.user) throw new Error(response.message || 'Could not create the account.');
      login(response.user, response.token, { stayLoggedIn: true });
    } catch (err) {
      setError(formatAxiosError(err, 'Could not create the account.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Title subtitle="Creates the same account the website uses.">Create account</Title>
      <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
      <Field label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" />
      <Field label="Email (optional)" value={email} onChangeText={setEmail} keyboardType="email-address" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <Muted>What do you want to get better at? Optional.</Muted>
      <View style={styles.wrap}>
        {DEFAULT_IMPROVEMENT_CATEGORIES.map((category) => {
          const on = categories.includes(category.id);
          return (
            <Pressable key={category.id} onPress={() => toggleCategory(category.id)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={styles.chipText}>
                {category.icon} {category.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <ErrorText>{error}</ErrorText>
      <PrimaryButton label="Create account" onPress={() => void submit()} loading={loading} />
      <PrimaryButton label="I already have an account" tone="ghost" onPress={() => navigation.navigate('Login')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.bgRaised,
  },
  chipOn: { backgroundColor: colors.accentDeep, borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: 13 },
});
