import { AsyncStorage } from './asyncStorage';

/** Permanent device copy of a Google account. Keyed by email so logout cannot erase it. */
export type GoogleDeviceProfile = {
  userId: string;
  email: string;
  name: string;
  avatar: string | null;
  created_at: string;
};

type GoogleSignUpRecord = {
  email?: string | null;
  uid?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
};

const PROFILE_PREFIX = '@user_profile_data_';
const LAST_EMAIL_KEY = '@last_known_secure_email';
const SESSION_KEY = '@active_session_token';

function profileKey(email: string): string {
  return `${PROFILE_PREFIX}${email.trim().toLowerCase()}`;
}

function welcomeNewCloset(): void {
  if (typeof window === 'undefined') return;
  window.alert(
    "Welcome! We didn't find an existing closet for this Google account. Let's build your new wardrobe profile!"
  );
}

export const handleGoogleAuthSessionFix = {
  /** First Google sign-up on this device. Does not replace a profile already stored for this email. */
  async linkGoogleAccountOnSignUp(googleUserRecord: GoogleSignUpRecord): Promise<GoogleDeviceProfile | undefined> {
    try {
      const email = String(googleUserRecord.email || '').trim().toLowerCase();
      const uid = String(googleUserRecord.uid || '').trim();
      if (!email || !uid) return undefined;

      const existingRaw = await AsyncStorage.getItem(profileKey(email));
      if (existingRaw) {
        const existing = JSON.parse(existingRaw) as GoogleDeviceProfile;
        await AsyncStorage.setItem(LAST_EMAIL_KEY, email);
        await AsyncStorage.setItem(SESSION_KEY, existing.userId);
        return existing;
      }

      const permanentProfile: GoogleDeviceProfile = {
        userId: uid,
        email,
        name: googleUserRecord.displayName || '',
        avatar: googleUserRecord.photoURL || null,
        created_at: new Date().toISOString(),
      };
      await AsyncStorage.setItem(profileKey(email), JSON.stringify(permanentProfile));
      await AsyncStorage.setItem(LAST_EMAIL_KEY, email);
      await AsyncStorage.setItem(SESSION_KEY, uid);
      return permanentProfile;
    } catch (e) {
      console.error('Critical: Failed to lock in Google Sign-up parameters.', e);
      return undefined;
    }
  },

  /** Returning Google sign-in. Reads the saved profile and does not write over it. */
  async syncGoogleAccountOnSignIn(googleEmail: string): Promise<GoogleDeviceProfile | null | undefined> {
    try {
      const normalizedEmail = String(googleEmail || '').trim().toLowerCase();
      if (!normalizedEmail) return null;
      const existingProfileString = await AsyncStorage.getItem(profileKey(normalizedEmail));
      if (existingProfileString) {
        const profile = JSON.parse(existingProfileString) as GoogleDeviceProfile;
        await AsyncStorage.setItem(SESSION_KEY, profile.userId);
        return profile;
      }
      welcomeNewCloset();
      return null;
    } catch (e) {
      console.error('Could not reconcile secure sign-in records.', e);
      return undefined;
    }
  },

  /** Drops the active session token only. Leaves every saved profile in place. */
  async safeSignOut(): Promise<void> {
    try {
      await AsyncStorage.removeItem(SESSION_KEY);
    } catch (e) {
      console.error('Failed to safely sign out session keys.', e);
    }
  },
};
