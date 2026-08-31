export type StoredCoords = { lat: number; lon: number; accuracy?: number; source?: 'gps' | 'storage' | 'server' | 'profile' };

const GRANTED_KEY = 'hookup:locationGranted';
const COORDS_KEY = 'hookup:lastCoords';

function writeBoth(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / blocked */
  }
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function readBoth(key: string): string | null {
  try {
    const v = localStorage.getItem(key);
    if (v != null) return v;
  } catch {
    /* ignore */
  }
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function markLocationGranted(coords: StoredCoords): void {
  writeBoth(GRANTED_KEY, '1');
  writeBoth(COORDS_KEY, JSON.stringify(coords));
}

export function clearLocationGranted(): void {
  try {
    localStorage.removeItem(GRANTED_KEY);
    localStorage.removeItem(COORDS_KEY);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem(GRANTED_KEY);
    sessionStorage.removeItem(COORDS_KEY);
  } catch {
    /* ignore */
  }
}

/** True once we have usable coords (GPS, saved, server, or profile city). */
export function isLocationGranted(): boolean {
  return readStoredCoords() != null || readBoth(GRANTED_KEY) === '1';
}

export function readStoredCoords(): StoredCoords | null {
  const raw = readBoth(COORDS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredCoords;
    if (typeof parsed.lat !== 'number' || typeof parsed.lon !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Wider search when coords come from profile/IP (laptop/tablet without GPS). */
export function nearbyRadiusForCoords(coords: StoredCoords | null): number {
  if (!coords) return 500;
  if (coords.source === 'profile' || coords.source === 'server') return 12_000;
  if (typeof coords.accuracy === 'number' && coords.accuracy > 3000) return 12_000;
  return 500;
}

function tryGps(timeoutMs = 20000, highAccuracy = false): Promise<StoredCoords | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          source: 'gps',
        });
      },
      () => resolve(null),
      { enableHighAccuracy: highAccuracy, timeout: timeoutMs, maximumAge: 60_000 }
    );
  });
}

export function geolocationErrorMessage(err: GeolocationPositionError | null | undefined): string {
  const code = err?.code;
  if (code === 1) {
    return 'Location is blocked for this site. Phone: tap the lock or “aA” next to the address → Location → Allow. Computer: click the padlock in the address bar → Location → Allow. Then tap the button again.';
  }
  if (code === 2) {
    return 'Could not find your position. On a phone, turn on Location Services and Wi‑Fi. On a laptop, allow location or type your city and country, then Save.';
  }
  if (code === 3) {
    return 'Location timed out. Tap again, or type your city and country and Save — that works on phones and computers.';
  }
  return 'Could not get GPS. Type your city and country and Save — nearby still works on phones and computers.';
}

/** Call only from a tap (Yes / Use my location) so iPhone/Android show Allow / Once / While using. */
export function requestGpsFromUserTap(): Promise<{ coords: StoredCoords | null; error?: string }> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ coords: null, error: 'This browser cannot use GPS. Type your city and country, then Save.' });
      return;
    }
    const finish = (coords: StoredCoords | null, error?: string) => {
      if (coords) markLocationGranted(coords);
      resolve({ coords, error });
    };
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        finish({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          source: 'gps',
        });
      },
      (err) => {
        if (err?.code === 3) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              finish({
                lat: pos.coords.latitude,
                lon: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                source: 'gps',
              });
            },
            (err2) => finish(null, geolocationErrorMessage(err2)),
            { enableHighAccuracy: false, timeout: 25000, maximumAge: 120_000 }
          );
          return;
        }
        finish(null, geolocationErrorMessage(err));
      },
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 30_000 }
    );
  });
}

export type ResolveCoordsOptions = {
  userId?: string;
  city?: string;
  country?: string;
  /** Try browser GPS even if cached coords exist (default false). */
  refreshGps?: boolean;
};

/**
 * Resolve coords on phone, tablet, or laptop:
 * cached → GPS → server last location → geocode profile city.
 */
export async function resolveWorkingCoords(
  options: ResolveCoordsOptions,
  api?: {
    getMyLocation: () => Promise<{ lat: number | null; lon: number | null; accuracy?: number | null }>;
    forwardGeocode: (q: string) => Promise<{ lat: number | null; lon: number | null }>;
    updateLocation: (data: {
      lat: number;
      lon: number;
      accuracy?: number;
      userId: string;
      connectionsVisible?: boolean;
    }) => Promise<unknown>;
  }
): Promise<StoredCoords | null> {
  if (!options.refreshGps) {
    const cached = readStoredCoords();
    if (cached) return cached;
  }

  if (options.refreshGps) {
    const gps = await tryGps(20000, false);
    if (gps) {
      markLocationGranted(gps);
      if (options.userId && api) {
        api.updateLocation({ ...gps, userId: options.userId, connectionsVisible: true }).catch(() => {});
      }
      return gps;
    }
  }

  if (options.userId && api) {
    try {
      const srv = await api.getMyLocation();
      if (srv.lat != null && srv.lon != null && Number.isFinite(srv.lat) && Number.isFinite(srv.lon)) {
        const coords: StoredCoords = {
          lat: srv.lat,
          lon: srv.lon,
          accuracy: srv.accuracy ?? undefined,
          source: 'server',
        };
        markLocationGranted(coords);
        return coords;
      }
    } catch {
      /* offline */
    }
  }

  const place = [options.city, options.country].filter(Boolean).join(', ').trim();
  if (place && options.userId && api) {
    try {
      const geo = await api.forwardGeocode(place);
      if (geo.lat != null && geo.lon != null && Number.isFinite(geo.lat) && Number.isFinite(geo.lon)) {
        const coords: StoredCoords = {
          lat: geo.lat,
          lon: geo.lon,
          accuracy: 10_000,
          source: 'profile',
        };
        markLocationGranted(coords);
        api.updateLocation({ ...coords, userId: options.userId, connectionsVisible: true }).catch(() => {});
        return coords;
      }
    } catch {
      /* geocode failed */
    }
  }

  return readStoredCoords();
}
