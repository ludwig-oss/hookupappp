export type StoredCoords = { lat: number; lon: number; accuracy?: number };

const GRANTED_KEY = 'hookup:locationGranted';
const COORDS_KEY = 'hookup:lastCoords';

export function markLocationGranted(coords: StoredCoords): void {
  try {
    sessionStorage.setItem(GRANTED_KEY, '1');
    sessionStorage.setItem(COORDS_KEY, JSON.stringify(coords));
  } catch {
    /* ignore */
  }
}

export function clearLocationGranted(): void {
  try {
    sessionStorage.removeItem(GRANTED_KEY);
    sessionStorage.removeItem(COORDS_KEY);
  } catch {
    /* ignore */
  }
}

export function isLocationGranted(): boolean {
  try {
    return sessionStorage.getItem(GRANTED_KEY) === '1';
  } catch {
    return false;
  }
}

export function readStoredCoords(): StoredCoords | null {
  try {
    const raw = sessionStorage.getItem(COORDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredCoords;
    if (typeof parsed.lat !== 'number' || typeof parsed.lon !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}
