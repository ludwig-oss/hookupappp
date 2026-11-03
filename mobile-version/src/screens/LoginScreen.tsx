import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { prefetchGoogle, startGoogle, type OAuthIntent } from '../lib/googleAuth';
import { useAuth } from '../state/AuthContext';

const TERMS_URL = 'https://hookupapp.dev/terms';
const PRIVACY_URL = 'https://hookupapp.dev/privacy';

export function LoginScreen() {
  const { entryError, clearEntryError } = useAuth();
  const [error, setError] = useState(entryError);
  const [busy, setBusy] = useState<OAuthIntent | null>(null);

  useEffect(() => {
    prefetchGoogle('signup');
    prefetchGoogle('login');
  }, []);

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
      setError(err instanceof Error ? err.message : 'Could not start. Try again.');
    }
  };

  return (
    <View style={styles.screen}>
      <Image source={require('../../assets/landing-hero.png')} style={[StyleSheet.absoluteFill, styles.photo]} resizeMode="cover" />
      <View style={[StyleSheet.absoluteFill, styles.shade]} />
      <View style={styles.glow} />
      <SafeAreaView style={styles.safe}>
        <Text style={styles.logo}>Hook Up</Text>
        <View style={styles.hero}>
          <Text style={styles.tagline}>Find Your Match</Text>
          <Text style={styles.sub}>Real connections. Real moments.</Text>
          <Pressable
            style={({ pressed }) => [styles.cta, pressed && styles.pressed, busy !== null && styles.disabled]}
            disabled={busy !== null}
            onPress={() => void start('signup')}
          >
            <Text style={styles.ctaText}>{busy === 'signup' ? 'Signing up…' : 'Create Account'}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.login, pressed && styles.pressed, busy !== null && styles.disabled]}
            disabled={busy !== null}
            onPress={() => void start('login')}
          >
            <Text style={styles.loginText}>{busy === 'login' ? 'Signing in…' : 'Log in'}</Text>
          </Pressable>
          <Text style={styles.google}>Continues with Google</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
        <View style={styles.legal}>
          <Text style={styles.legalLink} onPress={() => void Linking.openURL(TERMS_URL)}>
            Terms of Service
          </Text>
          <Text style={styles.legalSep}>·</Text>
          <Text style={styles.legalLink} onPress={() => void Linking.openURL(PRIVACY_URL)}>
            Privacy Policy
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a0514' },
  photo: { opacity: 0.55 },
  shade: { backgroundColor: 'rgba(12, 4, 18, 0.72)' },
  glow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255, 107, 157, 0.28)',
    top: '18%',
    alignSelf: 'center',
  },
  safe: { flex: 1, paddingHorizontal: 24, paddingBottom: 12 },
  logo: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    paddingTop: 8,
  },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  tagline: {
    color: '#fff',
    fontSize: 46,
    fontWeight: '800',
    letterSpacing: -1.2,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 18,
  },
  sub: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 18,
    textAlign: 'center',
  },
  cta: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#e45486',
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#ff6b9d',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  ctaText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  login: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 28,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  loginText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  google: { color: 'rgba(255,255,255,0.72)', fontSize: 13, marginTop: 4 },
  error: { color: '#ffb4c8', fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 340 },
  pressed: { opacity: 0.88, transform: [{ translateY: -1 }] },
  disabled: { opacity: 0.7 },
  legal: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingBottom: 8 },
  legalLink: { color: 'rgba(255,255,255,0.72)', fontSize: 13 },
  legalSep: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
});
