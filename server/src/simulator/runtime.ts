import {
  buildWorldMocks,
  isSimulatorUserId,
  SIMULATOR_PASSWORD,
  type WorldMockBundle,
} from './worldMocks.js';
import type { User } from '../models/user.js';
import type { UserPreference } from '../models/discover.js';

let active = false;
let bundle: WorldMockBundle | null = null;
/** In-memory overrides for mock users (never flushed to disk). */
const userOverrides = new Map<string, User>();
const prefOverrides = new Map<string, UserPreference>();

export function isSimulatorEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  const v = (process.env.SIMULATOR || process.env.MOCK_USERS || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

export function ensureSimulatorStarted(): void {
  if (!isSimulatorEnabled()) {
    active = false;
    bundle = null;
    userOverrides.clear();
    prefOverrides.clear();
    return;
  }
  if (active && bundle) return;
  const count = Math.min(200, Math.max(10, Number(process.env.SIMULATOR_COUNT || 50) || 50));
  bundle = buildWorldMocks(count);
  userOverrides.clear();
  prefOverrides.clear();
  active = true;
  console.log('');
  console.log('🧪 SIMULATOR ON — in-memory world mocks (NOT written to users.json)');
  console.log(`   ${bundle.users.length} fake users worldwide. Password for all: ${SIMULATOR_PASSWORD}`);
  console.log('   Example login: username mock_user_1');
  console.log('   Mock celebs: celeb_1 … (blurred + gold star). Password: same MockPass1!');
  console.log('   Stop: kill this process or start without SIMULATOR=1 — mocks vanish.');
  console.log('');
  void import('./interactions.js').then(({ startSimulatorInteractions }) => {
    startSimulatorInteractions();
  });
  void import('./contentSeed.js').then(({ seedSimulatorSocialContent }) => {
    void seedSimulatorSocialContent();
  });
}

export function stopSimulator(): void {
  void import('./interactions.js').then(({ stopSimulatorInteractions, purgeSimulatorInteractions }) => {
    stopSimulatorInteractions();
    void purgeSimulatorInteractions();
  });
  active = false;
  bundle = null;
  userOverrides.clear();
  prefOverrides.clear();
  console.log('🧪 SIMULATOR OFF — mocks discarded (nothing persisted).');
}

export { isSimulatorUserId, SIMULATOR_PASSWORD };

export function getSimulatorUsers(): User[] {
  ensureSimulatorStarted();
  if (!active || !bundle) return [];
  return bundle.users.map((u) => {
    const over = userOverrides.get(u.id);
    return over ? { ...over } : { ...u };
  });
}

export function getSimulatorPreferences(): UserPreference[] {
  ensureSimulatorStarted();
  if (!active || !bundle) return [];
  return bundle.preferences.map((p) => {
    const over = prefOverrides.get(p.userId);
    return over ? { ...over } : { ...p };
  });
}

/** Merge disk users with simulator users. Simulator rows win on id collision. */
export function mergeUsersWithSimulator(diskUsers: User[]): User[] {
  if (!isSimulatorEnabled()) return diskUsers;
  ensureSimulatorStarted();
  const sims = getSimulatorUsers();
  if (!sims.length) return diskUsers;
  const real = diskUsers.filter((u) => !isSimulatorUserId(u.id));
  return [...real, ...sims];
}

/** Persist only real users to disk; keep mock mutations in RAM. */
export function splitUsersForWrite(all: User[]): { disk: User[]; mockTouched: number } {
  const disk: User[] = [];
  let mockTouched = 0;
  for (const u of all) {
    if (isSimulatorUserId(u.id)) {
      userOverrides.set(u.id, u);
      mockTouched++;
    } else {
      disk.push(u);
    }
  }
  return { disk, mockTouched };
}

export function mergePreferencesWithSimulator(diskPrefs: UserPreference[]): UserPreference[] {
  if (!isSimulatorEnabled()) return diskPrefs;
  ensureSimulatorStarted();
  const sims = getSimulatorPreferences();
  if (!sims.length) return diskPrefs;
  const real = diskPrefs.filter((p) => !isSimulatorUserId(p.userId));
  return [...real, ...sims];
}

export function splitPreferencesForWrite(all: UserPreference[]): {
  disk: UserPreference[];
  mockTouched: number;
} {
  const disk: UserPreference[] = [];
  let mockTouched = 0;
  for (const p of all) {
    if (isSimulatorUserId(p.userId)) {
      prefOverrides.set(p.userId, p);
      mockTouched++;
    } else {
      disk.push(p);
    }
  }
  return { disk, mockTouched };
}
