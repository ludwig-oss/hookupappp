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

/** 50 m nearby. Indoor GPS is noisy, so pad by reported accuracy (cap 250 m). City-typed coords stay wider. */
export const NEARBY_TARGET_M = 50;

export function nearbyRadiusForCoords(coords: StoredCoords | null): number {
  if (!coords) return NEARBY_TARGET_M;
  if (coords.source === 'profile' || coords.source === 'server') return 12_000;
  if (typeof coords.accuracy === 'number' && coords.accuracy > 3000) return 12_000;
  const pad = typeof coords.accuracy === 'number' ? Math.max(0, coords.accuracy) : 80;
  return Math.min(250, NEARBY_TARGET_M + pad);
}

export function startGpsWatch(onFix: (coords: StoredCoords) => void): () => void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return () => {};
  let lastAt = 0;
  let lastLat = 0;
  let lastLon = 0;
  const id = navigator.geolocation.watchPosition(
    (pos) => {
      const coords = coordsFromPosition(pos);
      const now = Date.now();
      const moved =
        Math.abs(coords.lat - lastLat) > 0.0002 || Math.abs(coords.lon - lastLon) > 0.0002;
      if (!moved && now - lastAt < 15_000) return;
      lastAt = now;
      lastLat = coords.lat;
      lastLon = coords.lon;
      markLocationGranted(coords);
      onFix(coords);
    },
    () => {
      /* keep watching — indoor GPS often errors once then succeeds */
    },
    { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 }
  );
  return () => {
    try {
      navigator.geolocation.clearWatch(id);
    } catch {
      /* ignore */
    }
  };
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
    return 'GPS did not come through. Type your city and country below and tap Save — nearby still works.';
  }
  if (code === 2) {
    return 'Could not find GPS. Type your city and country below and tap Save.';
  }
  if (code === 3) {
    return 'GPS timed out. Type your city and country below and tap Save.';
  }
  return 'Could not get GPS. Type your city and country below and tap Save.';
}

function coordsFromPosition(pos: GeolocationPosition): StoredCoords {
  return {
    lat: pos.coords.latitude,
    lon: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    source: 'gps',
  };
}

/** Call only from a tap (Yes / Use my location) so the phone can show Allow. */
export function requestGpsFromUserTap(): Promise<{ coords: StoredCoords | null; error?: string }> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ coords: null, error: 'This browser cannot use GPS. Type your city and country, then Save.' });
      return;
    }

    let settled = false;
    let watchId: number | null = null;
    let deniedTimer: ReturnType<typeof setTimeout> | null = null;

    const finish = (coords: StoredCoords | null, error?: string) => {
      if (settled) return;
      settled = true;
      if (deniedTimer) clearTimeout(deniedTimer);
      if (watchId != null) {
        try {
          navigator.geolocation.clearWatch(watchId);
        } catch {
          /* ignore */
        }
      }
      if (coords) markLocationGranted(coords);
      resolve({ coords, error });
    };

    const onOk = (pos: GeolocationPosition) => finish(coordsFromPosition(pos));

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 25000,
      maximumAge: 15_000,
    };

    // iOS Safari often succeeds with watchPosition after a false first "denied".
    try {
      watchId = navigator.geolocation.watchPosition(
        onOk,
        (err) => {
          if (err?.code === 1) {
            if (deniedTimer) clearTimeout(deniedTimer);
            deniedTimer = setTimeout(() => {
              if (!settled) finish(null, geolocationErrorMessage(err));
            }, 2500);
            return;
          }
          if (err?.code === 2 || err?.code === 3) {
            navigator.geolocation.getCurrentPosition(
              onOk,
              (err2) => finish(null, geolocationErrorMessage(err2)),
              { enableHighAccuracy: false, timeout: 20000, maximumAge: 600_000 }
            );
          }
        },
        options
      );
    } catch {
      finish(null, 'Could not start GPS. Type your city and country below and tap Save.');
      return;
    }

    navigator.geolocation.getCurrentPosition(onOk, () => {
      /* watchPosition above is the fallback */
    }, options);

    window.setTimeout(() => {
      if (!settled) finish(null, 'GPS is taking too long. Type your city and country below and tap Save.');
    }, 28000);
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
