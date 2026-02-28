/**
 * Fetch real-world points of interest (venues) from OpenStreetMap via Overpass API.
 * Works worldwide with no API key.
 */

const OVERPASS_URL = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';

export interface OsmVenue {
  id: number;
  name: string;
  venueType: string;
  lat: number;
  lon: number;
}

/** OSM tag filters by place type for search (real places worldwide) */
export const VENUE_TYPE_OVERPASS: Record<string, string> = {
  bar: 'node(around:${r},${lat},${lon})["amenity"~"bar|pub"]; way(around:${r},${lat},${lon})["amenity"~"bar|pub"];',
  supermarket: 'node(around:${r},${lat},${lon})["shop"~"supermarket"]; way(around:${r},${lat},${lon})["shop"~"supermarket"];',
  mall: 'node(around:${r},${lat},${lon})["shop"~"mall|department_store"]; way(around:${r},${lat},${lon})["shop"~"mall|department_store"];',
  park: 'node(around:${r},${lat},${lon})["leisure"~"park|garden"]; way(around:${r},${lat},${lon})["leisure"~"park|garden"];',
  amusement_park: 'node(around:${r},${lat},${lon})["leisure"~"theme_park|water_park"]; way(around:${r},${lat},${lon})["leisure"~"theme_park|water_park"];',
  cinema: 'node(around:${r},${lat},${lon})["amenity"~"cinema"]; way(around:${r},${lat},${lon})["amenity"~"cinema"];',
  club: 'node(around:${r},${lat},${lon})["amenity"~"nightclub|social_club"]; way(around:${r},${lat},${lon})["amenity"~"nightclub|social_club"];',
  cafe: 'node(around:${r},${lat},${lon})["amenity"~"cafe|coffee_house"]; way(around:${r},${lat},${lon})["amenity"~"cafe|coffee_house"];',
  restaurant: 'node(around:${r},${lat},${lon})["amenity"~"restaurant|fast_food"]; way(around:${r},${lat},${lon})["amenity"~"restaurant|fast_food"];',
  gym: 'node(around:${r},${lat},${lon})["leisure"~"fitness_centre|sports_centre"]; way(around:${r},${lat},${lon})["leisure"~"fitness_centre|sports_centre"];',
  museum: 'node(around:${r},${lat},${lon})["tourism"~"museum|gallery"]; way(around:${r},${lat},${lon})["tourism"~"museum|gallery"];',
  library: 'node(around:${r},${lat},${lon})["amenity"~"library"]; way(around:${r},${lat},${lon})["amenity"~"library"];',
  theatre: 'node(around:${r},${lat},${lon})["amenity"~"theatre"]; way(around:${r},${lat},${lon})["amenity"~"theatre"];',
  shopping: 'node(around:${r},${lat},${lon})["shop"]; way(around:${r},${lat},${lon})["shop"];',
};

function parseOsmElement(el: any): { name: string; venueType: string; lat: number; lon: number } | null {
  const tags = el.tags || {};
  const amenity = tags.amenity || '';
  const shop = tags.shop || '';
  const leisure = tags.leisure || '';
  const tourism = tags.tourism || '';
  const venueType = amenity || shop || leisure || tourism || 'place';
  const name = tags.name || tags['name:en'] || venueType;
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat == null || lon == null) return null;
  return { name, venueType, lat, lon };
}

/**
 * Query Overpass for amenities (cafes, restaurants, bars, etc.) within radius (meters) of lat, lon.
 * Returns real-world POIs with name and type.
 */
export async function fetchNearbyVenues(
  lat: number,
  lon: number,
  radiusMeters: number
): Promise<OsmVenue[]> {
  const query = `
[out:json][timeout:15];
(
  node(around:${radiusMeters},${lat},${lon})["amenity"~"cafe|restaurant|bar|pub|fast_food|food_court"];
  node(around:${radiusMeters},${lat},${lon})["shop"~"mall|supermarket|convenience"];
  way(around:${radiusMeters},${lat},${lon})["amenity"~"cafe|restaurant|bar|pub|fast_food|food_court"];
  way(around:${radiusMeters},${lat},${lon})["shop"~"mall|supermarket|convenience"];
);
out center body;
  `.trim();

  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: query,
    });
    if (!res.ok) {
      console.error('Overpass API error:', res.status, await res.text());
      return [];
    }
    const data = (await res.json()) as { elements?: unknown[] };
    const elements = data.elements || [];
    const venues: OsmVenue[] = [];
    const seen = new Set<string>();

    for (const el of elements as Array<{ id: number | string } & Record<string, unknown>>) {
      const parsed = parseOsmElement(el);
      if (!parsed) continue;
      const key = `${parsed.lat.toFixed(5)}-${parsed.lon.toFixed(5)}-${parsed.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      venues.push({ id: typeof el.id === 'number' ? el.id : Number(el.id), ...parsed });
    }
    return venues;
  } catch (err) {
    console.error('Overpass fetch error:', err);
    return [];
  }
}

/**
 * Fetch real places of one type (bar, supermarket, park, amusement_park) in radius of lat, lon.
 * Used for search-by-location + type.
 */
export async function fetchVenuesByType(
  lat: number,
  lon: number,
  radiusMeters: number,
  typeKey: string
): Promise<OsmVenue[]> {
  const template = VENUE_TYPE_OVERPASS[typeKey];
  if (!template) {
    return fetchNearbyVenues(lat, lon, radiusMeters);
  }
  const r = radiusMeters;
  const query = `
[out:json][timeout:20];
(
  ${template.replace(/\$\{r\}/g, String(r)).replace(/\$\{lat\}/g, String(lat)).replace(/\$\{lon\}/g, String(lon))}
);
out center body;
  `.trim();

  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: query,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { elements?: unknown[] };
    const elements = data.elements || [];
    const venues: OsmVenue[] = [];
    const seen = new Set<string>();
    for (const el of elements as Array<{ id: number | string } & Record<string, unknown>>) {
      const parsed = parseOsmElement(el);
      if (!parsed) continue;
      const key = `${parsed.lat.toFixed(5)}-${parsed.lon.toFixed(5)}-${parsed.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      venues.push({ id: typeof el.id === 'number' ? el.id : Number(el.id), ...parsed });
    }
    return venues;
  } catch (err) {
    console.error('Overpass fetch by type error:', err);
    return [];
  }
}
