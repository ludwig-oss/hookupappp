import { pickRandomVenues, type DateVenueOption } from '../constants/dateVenues.js';
import { fetchVenuesByType, type OsmVenue } from '../utils/overpass.js';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'ASWP/1.0 (meetup date venues)';

function mapOsmType(venueType: string): DateVenueOption['type'] {
  const t = venueType.toLowerCase();
  if (t.includes('park') || t.includes('garden')) return 'park';
  if (t.includes('cafe') || t.includes('coffee') || t.includes('tea')) return 'coffee';
  if (t.includes('market')) return 'market';
  if (t.includes('water') || t.includes('beach') || t.includes('pier') || t.includes('harbour') || t.includes('harbor'))
    return 'waterfront';
  if (t.includes('boardwalk') || t.includes('promenade')) return 'boardwalk';
  return 'plaza';
}

function osmToDateVenue(v: OsmVenue, i: number): DateVenueOption {
  const type = mapOsmType(v.venueType);
  return {
    id: `osm-${v.id}-${Date.now()}-${i}`,
    name: v.name,
    type,
    description: `Real place near your meet area (${v.venueType}). Public and talk-friendly.`,
    estimatedCost: type === 'coffee' ? '$4–10 each' : 'Free–low',
    splitBillNote: 'Each pays your own.',
  };
}

export async function geocodeCityLabel(q: string): Promise<{ lat: number; lon: number; label: string } | null> {
  const query = q.trim();
  if (!query) return null;
  try {
    const url = `${NOMINATIM_URL}/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const first = Array.isArray(data) ? data[0] : null;
    if (!first?.lat || !first?.lon) return null;
    return {
      lat: parseFloat(first.lat),
      lon: parseFloat(first.lon),
      label: String(first.display_name || query),
    };
  } catch {
    return null;
  }
}

/** Live OSM parks / plazas / coffee-to-go near lat/lon for meetup shuffle. */
export async function fetchRealDateVenues(
  lat: number,
  lon: number,
  count = 40
): Promise<DateVenueOption[]> {
  const radius = 3500;
  const [parks, cafes, plazas] = await Promise.all([
    fetchVenuesByType(lat, lon, radius, 'park'),
    fetchVenuesByType(lat, lon, radius, 'cafe'),
    fetchVenuesByType(lat, lon, Math.min(radius, 2500), 'shopping').then((list) =>
      list.filter((v) => /plaza|square|market|mall/i.test(v.name + v.venueType)).slice(0, 15)
    ),
  ]);
  const merged: OsmVenue[] = [];
  const seen = new Set<string>();
  for (const v of [...parks, ...cafes, ...plazas]) {
    const key = `${v.lat.toFixed(4)}-${v.lon.toFixed(4)}-${v.name.toLowerCase()}`;
    if (seen.has(key)) continue;
    if (!v.name || v.name.length < 2) continue;
    seen.add(key);
    merged.push(v);
  }
  // Fisher–Yates
  for (let i = merged.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [merged[i], merged[j]] = [merged[j], merged[i]];
  }
  const real = merged.slice(0, count).map(osmToDateVenue);
  if (real.length >= 8) return real;
  // Pad with catalog so shuffle never feels empty
  const pad = pickRandomVenues(Math.max(0, count - real.length));
  return [...real, ...pad].slice(0, count);
}

export async function resolveMeetupVenues(opts: {
  city?: string;
  country?: string;
  lat?: number;
  lon?: number;
  count?: number;
}): Promise<{ venues: DateVenueOption[]; source: 'osm' | 'catalog'; label?: string }> {
  const count = opts.count ?? 40;
  let lat = opts.lat;
  let lon = opts.lon;
  let label: string | undefined;

  if ((!Number.isFinite(lat) || !Number.isFinite(lon)) && (opts.city || opts.country)) {
    const q = [opts.city, opts.country].filter(Boolean).join(', ');
    const geo = await geocodeCityLabel(q);
    if (geo) {
      lat = geo.lat;
      lon = geo.lon;
      label = geo.label;
    }
  }

  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    const venues = await fetchRealDateVenues(lat!, lon!, count);
    const hasOsm = venues.some((v) => v.id.startsWith('osm-'));
    return { venues, source: hasOsm ? 'osm' : 'catalog', label };
  }

  return { venues: pickRandomVenues(count), source: 'catalog' };
}
