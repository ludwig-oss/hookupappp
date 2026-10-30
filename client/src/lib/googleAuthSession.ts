import { AsyncStorage } from './asyncStorage';
import { fashionAPI, type WardrobeItem } from '../api/fashion';
import { eventsAPI, type Event } from '../api/events';
import { dateMatchAPI } from '../api/dateMatch';

/** One date-arena row as returned by dateMatchAPI.mine(). */
export type MatchingRow = { match: unknown; other: unknown };

export type MatchingRecords = {
  active: MatchingRow[];
  pending: MatchingRow[];
  past: MatchingRow[];
};

/** Permanent device copy of a Google account, keyed by verified email. */
export type GoogleDeviceProfile = {
  userId: string;
  email: string;
  name: string;
  avatar: string | null;
  created_at: string;
  wardrobe: WardrobeItem[];
  calendar: Event[];
  matching: MatchingRecords;
};

type GoogleSignUpRecord = {
  email?: string | null;
  uid?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
};

type LiveSnapshot = {
  wardrobe: { ok: boolean; items: WardrobeItem[] };
  calendar: { ok: boolean; events: Event[] };
  matching: { ok: boolean; records: MatchingRecords };
};

const PROFILE_PREFIX = '@user_profile_data_';
const LAST_EMAIL_KEY = '@last_known_secure_email';
const SESSION_KEY = '@active_session_token';

const emptyMatching = (): MatchingRecords => ({ active: [], pending: [], past: [] });

function profileKey(email: string): string {
  return `${PROFILE_PREFIX}${email.trim().toLowerCase()}`;
}

function welcomeNewCloset(): void {
  if (typeof window === 'undefined') return;
  window.alert(
    "Welcome! We didn't find an existing closet for this Google account. Let's build your new wardrobe profile!"
  );
}

function asMatching(value: unknown): MatchingRecords {
  const row = (value || {}) as Partial<MatchingRecords>;
  return {
    active: Array.isArray(row.active) ? row.active : [],
    pending: Array.isArray(row.pending) ? row.pending : [],
    past: Array.isArray(row.past) ? row.past : [],
  };
}

function hasMatching(records: MatchingRecords): boolean {
  return records.active.length > 0 || records.pending.length > 0 || records.past.length > 0;
}

function asProfile(raw: string | null): GoogleDeviceProfile | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GoogleDeviceProfile>;
    const email = String(parsed.email || '').trim().toLowerCase();
    const userId = String(parsed.userId || '').trim();
    if (!email || !userId) return null;
    return {
      userId,
      email,
      name: parsed.name || '',
      avatar: parsed.avatar ?? null,
      created_at: parsed.created_at || new Date().toISOString(),
      wardrobe: Array.isArray(parsed.wardrobe) ? parsed.wardrobe : [],
      calendar: Array.isArray(parsed.calendar) ? parsed.calendar : [],
      matching: asMatching(parsed.matching),
    };
  } catch {
    return null;
  }
}

async function readProfile(email: string): Promise<GoogleDeviceProfile | null> {
  return asProfile(await AsyncStorage.getItem(profileKey(email)));
}

async function writeProfile(profile: GoogleDeviceProfile): Promise<void> {
  const email = profile.email.trim().toLowerCase();
  await AsyncStorage.setItem(profileKey(email), JSON.stringify({ ...profile, email }));
  await AsyncStorage.setItem(LAST_EMAIL_KEY, email);
  await AsyncStorage.setItem(SESSION_KEY, profile.userId);
}

/** Reads the account's current closet, calendar, and matches. A failed request stays `ok: false` so a snapshot is not blanked. */
async function fetchLiveRecords(): Promise<LiveSnapshot> {
  const [wardrobe, calendar, matching] = await Promise.all([
    fashionAPI
      .wardrobe()
      .then((result) => ({ ok: true as const, items: result.items || [] }))
      .catch(() => ({ ok: false as const, items: [] as WardrobeItem[] })),
    eventsAPI
      .myEvents()
      .then((result) => ({ ok: true as const, events: result.events || [] }))
      .catch(() => ({ ok: false as const, events: [] as Event[] })),
    dateMatchAPI
      .mine()
      .then((result) => ({ ok: true as const, records: asMatching(result) }))
      .catch(() => ({ ok: false as const, records: emptyMatching() })),
  ]);
  return { wardrobe, calendar, matching };
}

async function pushWardrobe(items: WardrobeItem[]): Promise<WardrobeItem[]> {
  for (const item of items) {
    if (!item.title || !item.imageUrl) continue;
    try {
      await fashionAPI.saveUpload({
        title: item.title,
        imageUrl: item.imageUrl,
        kind: item.kind,
        pieceSlot: item.pieceSlot,
        worn: item.worn,
        group: item.group,
        event: item.event,
        pieces: item.pieces,
        notes: item.notes,
      });
    } catch {
      /* The device copy remains the record if the server write fails. */
    }
  }
  try {
    const again = await fashionAPI.wardrobe();
    if (again.items?.length) return again.items;
  } catch {
    /* keep the saved closet */
  }
  return items;
}

/** Records saved for this verified email, or null when this device has no closet for them. */
export async function restoredRecordsForEmail(email: string): Promise<Pick<
  GoogleDeviceProfile,
  'wardrobe' | 'calendar' | 'matching'
> | null> {
  const profile = await readProfile(email);
  if (!profile) return null;
  return {
    wardrobe: profile.wardrobe,
    calendar: profile.calendar,
    matching: profile.matching,
  };
}

export const handleGoogleAuthSessionFix = {
  /** First Google sign-up on this device. Does not replace a profile already stored for this email. */
  async linkGoogleAccountOnSignUp(googleUserRecord: GoogleSignUpRecord): Promise<GoogleDeviceProfile | undefined> {
    try {
      const email = String(googleUserRecord.email || '').trim().toLowerCase();
      const uid = String(googleUserRecord.uid || '').trim();
      if (!email || !uid) return undefined;

      const existing = await readProfile(email);
      if (existing) {
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
        wardrobe: [],
        calendar: [],
        matching: emptyMatching(),
      };
      await writeProfile(permanentProfile);
      return permanentProfile;
    } catch (e) {
      console.error('Critical: Failed to lock in Google Sign-up parameters.', e);
      return undefined;
    }
  },

  /**
   * Copies the live wardrobe, calendar, and matches into the email profile.
   * A failed read leaves the previous copy of that collection in place.
   */
  async archiveLiveRecords(googleEmail: string): Promise<GoogleDeviceProfile | undefined> {
    try {
      const email = String(googleEmail || '').trim().toLowerCase();
      const existing = await readProfile(email);
      if (!existing) return undefined;
      const live = await fetchLiveRecords();
      const next: GoogleDeviceProfile = {
        ...existing,
        wardrobe: live.wardrobe.ok ? live.wardrobe.items : existing.wardrobe,
        calendar: live.calendar.ok ? live.calendar.events : existing.calendar,
        matching: live.matching.ok ? live.matching.records : existing.matching,
      };
      await writeProfile(next);
      return next;
    } catch (e) {
      console.error('Could not archive Google account records before sign-out.', e);
      return undefined;
    }
  },

  /**
   * Returning Google sign-in. Looks up the verified email and puts that closet back.
   * Does not create a second profile when one is already stored.
   */
  async syncGoogleAccountOnSignIn(
    googleEmail: string,
    options?: { welcomeIfEmpty?: boolean }
  ): Promise<GoogleDeviceProfile | null | undefined> {
    try {
      const normalizedEmail = String(googleEmail || '').trim().toLowerCase();
      if (!normalizedEmail) return null;
      const existing = await readProfile(normalizedEmail);
      if (!existing) {
        // A new phone has no local closet yet. The account still lives on the server,
        // so only a first signup with nothing saved should see the new-wardrobe note.
        if (options?.welcomeIfEmpty) {
          const live = await fetchLiveRecords();
          const hasServer =
            (live.wardrobe.ok && live.wardrobe.items.length > 0) ||
            (live.calendar.ok && live.calendar.events.length > 0) ||
            (live.matching.ok && hasMatching(live.matching.records));
          if (!hasServer) welcomeNewCloset();
        }
        return null;
      }

      const live = await fetchLiveRecords();
      let wardrobe = live.wardrobe.ok && live.wardrobe.items.length ? live.wardrobe.items : existing.wardrobe;
      const calendar = live.calendar.ok && live.calendar.events.length ? live.calendar.events : existing.calendar;
      const matching =
        live.matching.ok && hasMatching(live.matching.records) ? live.matching.records : existing.matching;

      if (live.wardrobe.ok && live.wardrobe.items.length === 0 && existing.wardrobe.length > 0) {
        wardrobe = await pushWardrobe(existing.wardrobe);
      }

      const restored: GoogleDeviceProfile = {
        ...existing,
        wardrobe,
        calendar,
        matching,
      };
      await writeProfile(restored);
      return restored;
    } catch (e) {
      console.error('Could not reconcile secure sign-in records.', e);
      return undefined;
    }
  },

  /**
   * Drops the active session token only.
   * Never call AsyncStorage.clear() / localStorage.clear() here — that would wipe every saved closet.
   */
  async safeSignOut(): Promise<void> {
    try {
      await AsyncStorage.removeItem(SESSION_KEY);
    } catch (e) {
      console.error('Failed to safely sign out session keys.', e);
    }
  },
};
