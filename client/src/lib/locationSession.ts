export type StoredCoords = {
  lat: number;
  lon: number;
  accuracy?: number;
  source?: 'gps' | 'storage' | 'server' | 'profile' | 'ip';
  city?: string;
  country?: string;
};

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

/**
 * Ask the server for a wide enough circle.
 * GPS stays about a block (indoor pins drift). City or IP pins cover the same metro
 * so two phones still see each other when GPS never arrives.
 */
export function nearbyPeopleRadiusMeters(coords: StoredCoords | null): number {
  if (!coords) return NEARBY_TARGET_M;
  const acc = typeof coords.accuracy === 'number' && Number.isFinite(coords.accuracy) ? coords.accuracy : 0;
  const coarse =
    coords.source === 'profile' || coords.source === 'server' || coords.source === 'ip' || acc >= 1500;
  if (coarse) return 80_000;
  return Math.max(NEARBY_TARGET_M, Math.min(500, NEARBY_TARGET_M + acc));
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
    const watches: number[] = [];
    let denyTimer: ReturnType<typeof setTimeout> | null = null;

    const finish = (coords: StoredCoords | null, error?: string) => {
      if (settled) return;
      settled = true;
      if (denyTimer) clearTimeout(denyTimer);
      for (const id of watches) {
        try {
          navigator.geolocation.clearWatch(id);
        } catch {
          /* ignore */
        }
      }
      if (coords) markLocationGranted(coords);
      resolve({ coords, error });
    };

    const onOk = (pos: GeolocationPosition) => finish(coordsFromPosition(pos));

    // A first "denied" often fires while the Allow sheet is still open. Do not give up in 2 seconds.
    const noteProblem = (err: GeolocationPositionError) => {
      if (settled) return;
      const giveUp = () => {
        if (!settled) finish(null, geolocationErrorMessage(err));
      };
      if (err?.code === 1) {
        try {
          const q = navigator.permissions?.query?.({ name: 'geolocation' as PermissionName });
          q?.then((p) => {
            if (p.state === 'denied') giveUp();
          }).catch(() => {});
        } catch {
          /* permissions API missing — timer below still ends the wait */
        }
        if (!denyTimer) denyTimer = setTimeout(giveUp, 8000);
        return;
      }
      if (!denyTimer) denyTimer = setTimeout(giveUp, 4000);
    };

    const precise: PositionOptions = { enableHighAccuracy: true, timeout: 20000, maximumAge: 15_000 };
    const loose: PositionOptions = { enableHighAccuracy: false, timeout: 12000, maximumAge: 120_000 };

    try {
      watches.push(navigator.geolocation.watchPosition(onOk, noteProblem, precise));
    } catch {
      finish(null, 'Could not start GPS. Type your city and country below and tap Save.');
      return;
    }

    // Indoor / blocked high-accuracy often still returns a wifi fix.
    navigator.geolocation.getCurrentPosition(onOk, noteProblem, loose);

    window.setTimeout(() => {
      if (!settled) finish(null, 'GPS is taking too long. Type your city and country below and tap Save.');
    }, 18000);
  });
}

export type ResolveCoordsOptions = {
  userId?: string;
  city?: string;
  country?: string;
  /** Try browser GPS even if cached coords exist (default false). */
  refreshGps?: boolean;
  /** Yes / Save city should not reuse a pin from somewhere else. */
  ignoreCache?: boolean;
  /** Geocode the typed city before GPS, cache, or IP. */
  placeFirst?: boolean;
  /** When GPS is blocked, use the network location so the other phone can see you. */
  allowIp?: boolean;
};

type LocationApi = {
  getMyLocation: () => Promise<{ lat: number | null; lon: number | null; accuracy?: number | null; city?: string; country?: string }>;
  forwardGeocode: (q: string) => Promise<{ lat: number | null; lon: number | null }>;
  updateLocation: (data: {
    lat: number;
    lon: number;
    accuracy?: number;
    userId: string;
    connectionsVisible?: boolean;
    city?: string;
    country?: string;
  }) => Promise<unknown>;
  locateByIp?: () => Promise<{
    lat: number | null;
    lon: number | null;
    accuracy?: number;
    city?: string;
    country?: string;
  }>;
};

async function geocodePlace(place: string, userId: string, api: LocationApi, city?: string, country?: string): Promise<StoredCoords | null> {
  try {
    const geo = await api.forwardGeocode(place);
    if (geo.lat != null && geo.lon != null && Number.isFinite(geo.lat) && Number.isFinite(geo.lon)) {
      const coords: StoredCoords = {
        lat: geo.lat,
        lon: geo.lon,
        accuracy: 10_000,
        source: 'profile',
        city,
        country,
      };
      markLocationGranted(coords);
      await api.updateLocation({
        lat: coords.lat,
        lon: coords.lon,
        accuracy: coords.accuracy,
        userId,
        connectionsVisible: true,
        city,
        country,
      }).catch(() => {});
      return coords;
    }
  } catch {
    /* geocode failed */
  }
  return null;
}

/**
 * Resolve coords on phone, tablet, or laptop.
 * Yes (allowIp): network location, then city, then last saved pin.
 * Save city (placeFirst): the place they typed.
 */
export async function resolveWorkingCoords(
  options: ResolveCoordsOptions,
  api?: LocationApi
): Promise<StoredCoords | null> {
  const place = [options.city, options.country].filter(Boolean).join(', ').trim();

  if (options.placeFirst && place && options.userId && api) {
    const pinned = await geocodePlace(place, options.userId, api, options.city, options.country);
    if (pinned) return pinned;
  }

  if (!options.refreshGps && !options.ignoreCache && !options.placeFirst) {
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

  if (options.allowIp && options.userId && api?.locateByIp) {
    try {
      const ip = await api.locateByIp();
      if (ip.lat != null && ip.lon != null && Number.isFinite(ip.lat) && Number.isFinite(ip.lon)) {
        const coords: StoredCoords = {
          lat: ip.lat,
          lon: ip.lon,
          accuracy: ip.accuracy ?? 8000,
          source: 'ip',
          city: ip.city || options.city,
          country: ip.country || options.country,
        };
        markLocationGranted(coords);
        await api.updateLocation({
          lat: coords.lat,
          lon: coords.lon,
          accuracy: coords.accuracy,
          userId: options.userId,
          connectionsVisible: true,
          city: coords.city,
          country: coords.country,
        }).catch(() => {});
        return coords;
      }
    } catch {
      /* IP lookup failed — try city */
    }
  }

  if (!options.placeFirst && place && options.userId && api) {
    const pinned = await geocodePlace(place, options.userId, api, options.city, options.country);
    if (pinned) return pinned;
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
          city: srv.city,
          country: srv.country,
        };
        markLocationGranted(coords);
        return coords;
      }
    } catch {
      /* offline */
    }
  }

  if (options.ignoreCache || options.placeFirst) return null;
  return readStoredCoords();
}
