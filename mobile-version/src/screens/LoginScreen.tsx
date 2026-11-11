import { useEffect, useState } from 'react';
import { Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import {
  rememberGoogleIntent,
  signInWithGoogleOnPhone,
  startGoogle,
  type OAuthIntent,
} from '../lib/googleAuth';
import { useAuth } from '../state/AuthContext';
import { PrivacyPolicyCopy } from '../components/PrivacyPolicyCopy';

WebBrowser.maybeCompleteAuthSession();

const TERMS_URL = 'https://hookupapp.dev/terms';

export function LoginScreen() {
  const { login, entryError, clearEntryError } = useAuth();
  const [error, setError] = useState(entryError);
  const [busy, setBusy] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const isBrowser = Platform.OS === 'web' && typeof window !== 'undefined';

  useEffect(() => {
    if (entryError) setError(entryError);
  }, [entryError]);

  const start = async (intent: OAuthIntent) => {
    setError('');
    clearEntryError();
    rememberGoogleIntent(intent);
    setBusy(true);
    try {
      if (isBrowser) {
        await startGoogle(intent);
        return;
      }
      const session = await signInWithGoogleOnPhone(intent);
      if (!session) {
        setBusy(false);
        return;
      }
      login(session.user, session.token, { stayLoggedIn: true });
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : 'Could not start Google.');
    }
  };

  return (
    <View style={styles.screen}>
      <Image source={require('../../assets/landing-hero.png')} style={[StyleSheet.absoluteFill, styles.photo]} resizeMode="cover" />
      <View style={[StyleSheet.absoluteFill, styles.shade]} />
      <View style={styles.glow} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.brand}>
          <Image source={require('../../assets/icon.png')} style={styles.brandIcon} accessibilityLabel="Hook Up logo" />
          <Text style={styles.logo}>Hook Up</Text>
        </View>
        <View style={styles.hero}>
          <Image source={require('../../assets/icon.png')} style={styles.heroMark} accessibilityLabel="Hook Up" />
          <Text style={styles.tagline}>Find Your Match</Text>
          <Text style={styles.sub}>Real connections. Real moments.</Text>
          <GoogleButton
            label={busy ? 'Opening Google…' : 'Sign up with Google'}
            disabled={busy}
            onPress={() => void start('signup')}
          />
          <GoogleButton
            label={busy ? 'Opening Google…' : 'Sign in with Google'}
            tone="ghost"
            disabled={busy}
            onPress={() => void start('login')}
          />
          <Text style={styles.caption}>Pick the Google email already on this phone. Hook Up never asks for a password.</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
        <View style={styles.legal}>
          <Text style={styles.legalLink} onPress={() => void Linking.openURL(TERMS_URL)}>
            Terms of Service
          </Text>
          <Text style={styles.legalSep}>·</Text>
          <Text style={styles.legalLink} onPress={() => setPrivacyOpen(true)}>
            Privacy Policy
          </Text>
        </View>
      </SafeAreaView>
      <Modal visible={privacyOpen} animationType="slide" onRequestClose={() => setPrivacyOpen(false)}>
        <SafeAreaView style={styles.policyScreen}>
          <Pressable onPress={() => setPrivacyOpen(false)} style={styles.policyClose}>
            <Text style={styles.legalLink}>Close</Text>
          </Pressable>
          <ScrollView contentContainerStyle={styles.policyBody}>
            <PrivacyPolicyCopy />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function GoogleButton({
  label,
  onPress,
  disabled,
  tone = 'solid',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'solid' | 'ghost';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.googleBtn,
        tone === 'ghost' && styles.googleBtnGhost,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.gBadge}>
        <Text style={styles.gLetter}>G</Text>
      </View>
      <Text style={[styles.googleLabel, tone === 'ghost' && styles.googleLabelGhost]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
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
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 8 },
  brandIcon: { width: 36, height: 36, borderRadius: 10 },
  heroMark: {
    width: 96,
    height: 96,
    borderRadius: 24,
    marginBottom: 4,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  logo: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
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
    marginBottom: 12,
    textAlign: 'center',
  },
  googleBtnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#fff',
  },
  googleLabelGhost: { color: '#fff' },
  googleBtn: {
    width: '100%',
    maxWidth: 340,
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  gBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gLetter: { color: '#4285F4', fontSize: 20, fontWeight: '700' },
  googleLabel: { color: '#1f1f1f', fontSize: 15, fontWeight: '600', flexShrink: 1, textAlign: 'center' },
  caption: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 340,
  },
  error: { color: '#ffb4c8', fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 340 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.65 },
  legal: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingBottom: 8 },
  legalLink: { color: 'rgba(255,255,255,0.72)', fontSize: 13 },
  legalSep: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  policyScreen: { flex: 1, backgroundColor: '#0a0514' },
  policyClose: { paddingHorizontal: 20, paddingVertical: 12 },
  policyBody: { paddingHorizontal: 20, paddingBottom: 32 },
});
