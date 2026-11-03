import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { startGoogle, type OAuthIntent } from '../lib/googleAuth';
import { useAuth } from '../state/AuthContext';
import { ErrorText, PrimaryButton } from '../ui/components';
import { colors } from '../ui/theme';

export function LoginScreen() {
  const { entryError, clearEntryError } = useAuth();
  const [error, setError] = useState(entryError);
  const [busy, setBusy] = useState<OAuthIntent | null>(null);

  useEffect(() => {
    if (entryError) setError(entryError);
  }, [entryError]);

  const start = async (intent: OAuthIntent) => {
    setError('');
    clearEntryError();
    setBusy(intent);
    try {
      await startGoogle(intent);
    } catch (err) {
      setBusy(null);
      setError(err instanceof Error ? err.message : 'Could not start Google.');
    }
  };

  return (
    <View style={styles.center}>
      <View style={styles.actions}>
        <PrimaryButton
          label={busy === 'signup' ? 'Signing up…' : 'Sign up'}
          onPress={() => void start('signup')}
          disabled={busy !== null}
          fill
        />
        <PrimaryButton
          label={busy === 'login' ? 'Signing in…' : 'Sign in'}
          onPress={() => void start('login')}
          disabled={busy !== null}
          fill
        />
        <ErrorText>{error}</ErrorText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  actions: {
    width: '100%',
    maxWidth: 420,
    gap: 12,
  },
});
