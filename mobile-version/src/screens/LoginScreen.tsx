import { useEffect, useRef, useState } from 'react';
import { Image, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri, ResponseType } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import {
  exchangeGoogleIdToken,
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_IOS_URL_SCHEME,
  GOOGLE_WEB_CLIENT_ID,
  rememberGoogleIntent,
  signInWithGoogleInExpoGo,
  type OAuthIntent,
} from '../lib/googleAuth';
import { useAuth } from '../state/AuthContext';

WebBrowser.maybeCompleteAuthSession();

const TERMS_URL = 'https://hookupapp.dev/terms';
const PRIVACY_URL = 'https://hookupapp.dev/privacy';

export function LoginScreen() {
  const { login, entryError, clearEntryError } = useAuth();
  const [error, setError] = useState(entryError);
  const [busy, setBusy] = useState(false);
  const intentRef = useRef<OAuthIntent>('signup');
  const handledToken = useRef('');

  const isBrowser = Platform.OS === 'web' && typeof window !== 'undefined';
  const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    selectAccount: true,
    ...(isBrowser
      ? {
          responseType: ResponseType.IdToken,
          shouldAutoExchangeCode: false,
          redirectUri: `${window.location.origin}/auth/oauth-return/google`,
        }
      : {
          redirectUri: makeRedirectUri({
            native:
              Platform.OS === 'ios'
                ? `${GOOGLE_IOS_URL_SCHEME}:/oauth2redirect`
                : 'app.hookup.mobile:/oauthredirect',
          }),
        }),
  });

  useEffect(() => {
    if (entryError) setError(entryError);
  }, [entryError]);

  useEffect(() => {
    if (response?.type !== 'success') {
      if (response?.type === 'error') {
        setBusy(false);
        setError(response.error?.message || 'Google sign-in failed. Try again.');
      }
      return;
    }
    const idToken = response.authentication?.idToken || response.params.id_token;
    if (!idToken || handledToken.current === idToken) return;
    handledToken.current = idToken;
    void (async () => {
      try {
        const session = await exchangeGoogleIdToken(idToken, intentRef.current);
        login(session.user, session.token, { stayLoggedIn: true });
      } catch (err) {
        handledToken.current = '';
        setBusy(false);
        setError(err instanceof Error ? err.message : 'Google sign-in failed.');
      }
    })();
  }, [login, response]);

  const start = async () => {
    setError('');
    clearEntryError();
    intentRef.current = 'signup';
    rememberGoogleIntent('signup');
    setBusy(true);
    try {
      if (inExpoGo) {
        const session = await signInWithGoogleInExpoGo('signup');
        if (!session) {
          setBusy(false);
          return;
        }
        login(session.user, session.token, { stayLoggedIn: true });
        return;
      }
      const result = await promptAsync();
      if (result.type === 'cancel' || result.type === 'dismiss') setBusy(false);
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
        <Text style={styles.logo}>Hook Up</Text>
        <View style={styles.hero}>
          <Text style={styles.tagline}>Find Your Match</Text>
          <Text style={styles.sub}>Real connections. Real moments.</Text>
          <GoogleButton
            label={busy ? 'Opening Google…' : 'Sign up or Sign in with Google'}
            disabled={busy || (!inExpoGo && !request)}
            onPress={() => void start()}
          />
          <Text style={styles.caption}>New users will automatically create an account.</Text>
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

function GoogleButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.googleBtn, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <View style={styles.gBadge}>
        <Text style={styles.gLetter}>G</Text>
      </View>
      <Text style={styles.googleLabel} numberOfLines={2}>
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
  logo: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    paddingTop: 8,
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
});
