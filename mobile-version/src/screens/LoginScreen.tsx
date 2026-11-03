import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { authAPI } from '../api/auth';
import { formatAxiosError } from '../lib/apiError';
import type { AuthStackParamList } from '../navigation/types';
import { useAuth } from '../state/AuthContext';
import { ErrorText, Field, PrimaryButton, Screen, Title } from '../ui/components';
import { colors } from '../ui/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [usePin, setUsePin] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    const id = identifier.trim();
    if (!id) {
      setError(usePin ? 'Enter your username.' : 'Enter your username, email, or phone number.');
      return;
    }
    setLoading(true);
    try {
      const response = usePin
        ? await authAPI.loginWithPin(id, pin.trim(), stayLoggedIn)
        : await authAPI.login({ identifier: id, username: id, password, stayLoggedIn });
      if (!response.token || !response.user) throw new Error('Invalid login response');
      login(response.user, response.token, { stayLoggedIn });
    } catch (err) {
      setError(formatAxiosError(err, 'Those credentials did not match an account.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Title subtitle="Same account as the website. Password or PIN.">Welcome back</Title>
      <View style={styles.row}>
        <Pressable onPress={() => setUsePin(false)} style={[styles.chip, !usePin && styles.chipOn]}>
          <Text style={styles.chipText}>Password</Text>
        </Pressable>
        <Pressable onPress={() => setUsePin(true)} style={[styles.chip, usePin && styles.chipOn]}>
          <Text style={styles.chipText}>PIN</Text>
        </Pressable>
      </View>
      <Field
        label={usePin ? 'Username' : 'Username, email, or phone'}
        value={identifier}
        onChangeText={setIdentifier}
        autoComplete="username"
      />
      {usePin ? (
        <Field label="PIN" value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry />
      ) : (
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
      )}
      <Pressable onPress={() => setStayLoggedIn((v) => !v)} style={styles.checkRow}>
        <View style={[styles.box, stayLoggedIn && styles.boxOn]} />
        <Text style={styles.checkLabel}>Stay signed in on this device</Text>
      </Pressable>
      <ErrorText>{error}</ErrorText>
      <PrimaryButton label="Sign in" onPress={() => void submit()} loading={loading} />
      <PrimaryButton label="Forgot password" tone="ghost" onPress={() => navigation.navigate('ForgotPassword')} />
      <PrimaryButton label="Create account" tone="ghost" onPress={() => navigation.navigate('Signup')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 10,
    alignItems: 'center',
  },
  chipOn: { backgroundColor: colors.accentDeep, borderColor: colors.accent },
  chipText: { color: colors.text, fontWeight: '700' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  box: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: colors.muted },
  boxOn: { backgroundColor: colors.accent },
  checkLabel: { color: colors.text, fontSize: 15 },
});
