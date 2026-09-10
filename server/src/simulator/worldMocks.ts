import bcrypt from 'bcryptjs';
import type { User } from '../models/user.js';
import type { UserPreference, LookingForOption } from '../models/discover.js';

/** Prefix so mock IDs never collide with real accounts and are easy to strip on write. */
export const SIM_ID_PREFIX = 'sim_';

export function isSimulatorUserId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(SIM_ID_PREFIX);
}

/** Known password for every mock account (local simulator only). */
export const SIMULATOR_PASSWORD = 'MockPass1!';

type CitySeed = {
  city: string;
  country: string;
  lat: number;
  lon: number;
};

/** Real cities worldwide — enough spread for Connections / search-places testing. */
const CITIES: CitySeed[] = [
  { city: 'Berlin', country: 'Germany', lat: 52.52, lon: 13.405 },
  { city: 'Paris', country: 'France', lat: 48.8566, lon: 2.3522 },
  { city: 'London', country: 'United Kingdom', lat: 51.5074, lon: -0.1278 },
  { city: 'Madrid', country: 'Spain', lat: 40.4168, lon: -3.7038 },
  { city: 'Rome', country: 'Italy', lat: 41.9028, lon: 12.4964 },
  { city: 'Amsterdam', country: 'Netherlands', lat: 52.3676, lon: 4.9041 },
  { city: 'New York', country: 'United States', lat: 40.7128, lon: -74.006 },
  { city: 'Los Angeles', country: 'United States', lat: 34.0522, lon: -118.2437 },
  { city: 'Chicago', country: 'United States', lat: 41.8781, lon: -87.6298 },
  { city: 'Toronto', country: 'Canada', lat: 43.6532, lon: -79.3832 },
  { city: 'Mexico City', country: 'Mexico', lat: 19.4326, lon: -99.1332 },
  { city: 'São Paulo', country: 'Brazil', lat: -23.5505, lon: -46.6333 },
  { city: 'Buenos Aires', country: 'Argentina', lat: -34.6037, lon: -58.3816 },
  { city: 'Lagos', country: 'Nigeria', lat: 6.5244, lon: 3.3792 },
  { city: 'Nairobi', country: 'Kenya', lat: -1.2921, lon: 36.8219 },
  { city: 'Cairo', country: 'Egypt', lat: 30.0444, lon: 31.2357 },
  { city: 'Cape Town', country: 'South Africa', lat: -33.9249, lon: 18.4241 },
  { city: 'Dubai', country: 'United Arab Emirates', lat: 25.2048, lon: 55.2708 },
  { city: 'Istanbul', country: 'Turkey', lat: 41.0082, lon: 28.9784 },
  { city: 'Moscow', country: 'Russia', lat: 55.7558, lon: 37.6173 },
  { city: 'Mumbai', country: 'India', lat: 19.076, lon: 72.8777 },
  { city: 'Delhi', country: 'India', lat: 28.6139, lon: 77.209 },
  { city: 'Bangkok', country: 'Thailand', lat: 13.7563, lon: 100.5018 },
  { city: 'Singapore', country: 'Singapore', lat: 1.3521, lon: 103.8198 },
  { city: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503 },
  { city: 'Seoul', country: 'South Korea', lat: 37.5665, lon: 126.978 },
  { city: 'Shanghai', country: 'China', lat: 31.2304, lon: 121.4737 },
  { city: 'Sydney', country: 'Australia', lat: -33.8688, lon: 151.2093 },
  { city: 'Melbourne', country: 'Australia', lat: -37.8136, lon: 144.9631 },
  { city: 'Auckland', country: 'New Zealand', lat: -36.8509, lon: 174.7645 },
];

const FIRST = [
  'Ava', 'Noah', 'Mia', 'Leo', 'Sofia', 'Kai', 'Luna', 'Omar', 'Iris', 'Diego',
  'Hana', 'Ezra', 'Nina', 'Jamal', 'Yuki', 'Amir', 'Clara', 'Mateo', 'Zara', 'Felix',
];
const LAST = [
  'Chen', 'Silva', 'Nguyen', 'Patel', 'Kim', 'Garcia', 'Schmidt', 'Okoye', 'Rossi', 'Ali',
];

const ORIENTATIONS: UserPreference['orientation'][] = [
  'straight',
  'straight',
  'straight',
  'gay',
  'lesbian',
  'bisexual',
  'pansexual',
];

const LOOKING: LookingForOption[][] = [
  ['dating'],
  ['casual'],
  ['serious'],
  ['friends'],
  ['dating', 'casual'],
  ['serious', 'dating'],
];

const GENDERS = ['female', 'male', 'female', 'male', 'other'] as const;

function jitter(n: number, spread = 0.035): number {
  return n + (Math.random() - 0.5) * spread * 2;
}

export type WorldMockBundle = {
  users: User[];
  preferences: UserPreference[];
  passwordPlain: string;
};

/**
 * Build N in-memory mock users with live-ish locations worldwide.
 * Never written to disk — process exit clears them.
 */
export function buildWorldMocks(count = 50): WorldMockBundle {
  const passwordHash = bcrypt.hashSync(SIMULATOR_PASSWORD, 8);
  const now = Date.now();
  const users: User[] = [];
  const preferences: UserPreference[] = [];

  for (let i = 0; i < count; i++) {
    const place = CITIES[i % CITIES.length];
    const id = `${SIM_ID_PREFIX}${String(i + 1).padStart(3, '0')}`;
    const username = `mock_user_${i + 1}`;
    const gender = GENDERS[i % GENDERS.length];
    const orientation = ORIENTATIONS[i % ORIENTATIONS.length];
    const lookingFor = LOOKING[i % LOOKING.length];
    const lat = jitter(place.lat);
    const lon = jitter(place.lon);
    const name = `${FIRST[i % FIRST.length]} ${LAST[i % LAST.length]}`;

    users.push({
      id,
      email: `mock${i + 1}@simulator.local`,
      password: passwordHash,
      name,
      username,
      phoneNumber: null,
      profilePicture: `https://i.pravatar.cc/150?u=${id}`,
      highlights: [],
      stories: [],
      closeFriendIds: [],
      disappearingPhotos: [],
      profileSetupComplete: true,
      improvementCategories: ['dating-apps', 'texting'],
      location: {
        lat,
        lon,
        updatedAt: new Date(now - (i % 20) * 60_000),
      },
      resetToken: null,
      resetTokenExpiry: null,
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationTokenExpiry: null,
      emailVerificationCode: null,
      emailVerificationCodeExpiry: null,
      blockedUsers: [],
      mutedUsers: [],
      unmatchedUsers: [],
      profiles: [],
      bio: `Simulator mock in ${place.city}. Testing only.`,
      age: 22 + (i % 18),
      gender,
      country: place.country,
      city: place.city,
      passwordHint1: 'mock',
      passwordHint2: 'pass',
      passwordHint3: 'sim',
      connectionsVisible: true,
      nearbyDiscoverable: true,
      outdoorWalkEnabled: true,
      createdAt: new Date(now - i * 86_400_000).toISOString(),
      aiGuideId: 'amara',
      dateLookingFor: lookingFor.includes('casual')
        ? ['casual_dating']
        : lookingFor.includes('serious')
          ? ['serious_relationship']
          : ['see_where_it_goes'],
    });

    preferences.push({
      userId: id,
      orientation,
      lookingFor,
      city: place.city,
      lastActiveAt: new Date(now - (i % 15) * 60_000),
    });
  }

  return { users, preferences, passwordPlain: SIMULATOR_PASSWORD };
}
