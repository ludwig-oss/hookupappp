import type { DateIdea } from './dateMatchCatalog.js';

/** Real-ish hang spots by city (normalized key). Used to make Date Arena ideas feel local. */
const CITY_SPOTS: Record<string, string[]> = {
  berlin: ['Tempelhofer Feld', 'Mauerpark flea', 'Markthalle Neun', 'East Side Gallery', 'Warschauer Brücke', 'Viktoriapark'],
  munich: ['Englischer Garten', 'Viktualienmarkt', 'Olympiapark', 'Isar river steps', 'Gärtnerplatz'],
  hamburg: ['Speicherstadt', 'Landungsbrücken', 'Sternschanze', 'Alster lake path', 'Fischmarkt'],
  cologne: ['Rheinboulevard', 'Belgian Quarter', 'Rudolfplatz', 'Rheinauhafen'],
  frankfurt: ['Mainufer', 'Kleinmarkthalle', 'Sachsenhausen apple-wine lane', 'Ostend harbor'],
  vienna: ['Prater', 'Naschmarkt', 'Donauinsel', 'MuseumsQuartier courtyard'],
  paris: ['Canal Saint-Martin', 'Butte-aux-Cailles', 'Parc des Buttes-Chaumont', 'Marché d’Aligre'],
  london: ['South Bank', 'Brick Lane', 'Hampstead Heath', 'Borough Market', 'Shoreditch'],
  manchester: ['Northern Quarter', 'Castlefield', 'Spinningfields canal'],
  amsterdam: ['Vondelpark', 'Foodhallen', 'NDSM wharf', 'Jordaan canals'],
  madrid: ['Retiro Park', 'Mercado de San Miguel', 'Malasaña', 'Temple of Debod sunset'],
  barcelona: ['Park Güell slopes', 'Born market', 'Barceloneta boardwalk', 'Gràcia squares'],
  rome: ['Trastevere lanes', 'Testaccio market', 'Gianicolo viewpoint', 'Piazza Navona edge'],
  milan: ['Navigli canals', 'Isola district', 'Parco Sempione'],
  newyork: ['High Line', 'Brooklyn Bridge Park', 'Chelsea Market', 'Prospect Park', 'Astoria'],
  'new york': ['High Line', 'Brooklyn Bridge Park', 'Chelsea Market', 'Prospect Park'],
  'los angeles': ['Grand Central Market', 'Venice boardwalk', 'Griffith Observatory lawn', 'The Grove steps'],
  losangeles: ['Grand Central Market', 'Venice boardwalk', 'Griffith Observatory lawn'],
  chicago: ['Millennium Park', 'Riverwalk', 'Wicker Park', 'Navy Pier walk'],
  toronto: ['Kensington Market', 'Harbourfront', 'Trinity Bellwoods'],
  vancouver: ['Granville Island', 'Stanley Park seawall', 'Commercial Drive'],
  sydney: ['Circular Quay', 'Bondi to Bronte walk', 'Newtown'],
  melbourne: ['Queen Victoria Market', 'Fitzroy laneways', 'Southbank'],
  tokyo: ['Shimokitazawa', 'Yoyogi Park', 'Tsukiji outer market', 'Nakameguro canal'],
  seoul: ['Hongdae street', 'Hangang Park', 'Ikseon-dong lanes'],
  singapore: ['Tiong Bahru', 'Gardens by the Bay walk', 'Haji Lane'],
  dubai: ['La Mer beach', 'Al Fahidi', 'Kite Beach'],
};

/** Rough city centers for same-country distance checks when GPS home is missing. */
const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  berlin: { lat: 52.52, lon: 13.405 },
  munich: { lat: 48.137, lon: 11.576 },
  hamburg: { lat: 53.551, lon: 9.993 },
  cologne: { lat: 50.938, lon: 6.96 },
  frankfurt: { lat: 50.11, lon: 8.68 },
  vienna: { lat: 48.208, lon: 16.373 },
  paris: { lat: 48.857, lon: 2.352 },
  london: { lat: 51.507, lon: -0.128 },
  manchester: { lat: 53.48, lon: -2.24 },
  amsterdam: { lat: 52.37, lon: 4.89 },
  madrid: { lat: 40.417, lon: -3.704 },
  barcelona: { lat: 41.387, lon: 2.168 },
  rome: { lat: 41.903, lon: 12.496 },
  milan: { lat: 45.464, lon: 9.19 },
  newyork: { lat: 40.713, lon: -74.006 },
  'new york': { lat: 40.713, lon: -74.006 },
  losangeles: { lat: 34.052, lon: -118.244 },
  'los angeles': { lat: 34.052, lon: -118.244 },
  chicago: { lat: 41.878, lon: -87.63 },
  toronto: { lat: 43.653, lon: -79.383 },
  vancouver: { lat: 49.282, lon: -123.12 },
  sydney: { lat: -33.869, lon: 151.209 },
  melbourne: { lat: -37.814, lon: 144.963 },
  tokyo: { lat: 35.676, lon: 139.65 },
  seoul: { lat: 37.566, lon: 126.978 },
  singapore: { lat: 1.352, lon: 103.82 },
  dubai: { lat: 25.205, lon: 55.271 },
};

export const DATE_ARENA_FAR_KM = 100;

function normKey(s?: string | null): string {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function compactKey(s?: string | null): string {
  return normKey(s).replace(/[^a-z0-9]/g, '');
}

export function citySpots(city?: string | null): string[] {
  const n = normKey(city);
  const c = compactKey(city);
  return CITY_SPOTS[n] || CITY_SPOTS[c] || [];
}

export function cityCoords(city?: string | null): { lat: number; lon: number } | null {
  const n = normKey(city);
  const c = compactKey(city);
  return CITY_COORDS[n] || CITY_COORDS[c] || null;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function resolveUserCoords(user: {
  city?: string | null;
  homeLocation?: { lat: number; lon: number } | null;
  location?: { lat: number; lon: number } | null;
}): { lat: number; lon: number } | null {
  if (user.homeLocation && Number.isFinite(user.homeLocation.lat) && Number.isFinite(user.homeLocation.lon)) {
    return { lat: user.homeLocation.lat, lon: user.homeLocation.lon };
  }
  if (user.location && Number.isFinite(user.location.lat) && Number.isFinite(user.location.lon)) {
    return { lat: user.location.lat, lon: user.location.lon };
  }
  return cityCoords(user.city);
}

/** Crazy fun date templates — filled with real local spot names when we know the city. */
export const CRAZY_FUN_BASE: DateIdea[] = [
  { id: 'cf01', category: 'hobby', title: 'Midnight karaoke dare', detail: 'Pick a song neither of you knows. Public room, no VIP booth.' },
  { id: 'cf02', category: 'hobby', title: 'Escape-room rookies', detail: 'Book the easiest room in town — laugh when you fail.' },
  { id: 'cf03', category: 'hobby', title: 'Trampoline-park bounce-off', detail: 'Adult open-gym hour. Soft landings only.' },
  { id: 'cf04', category: 'hobby', title: 'Laser-tag underdogs', detail: 'Walk-in session. Loser buys street snacks after.' },
  { id: 'cf05', category: 'hobby', title: 'Go-kart sprint', detail: 'Indoor karting if your city has it — one heat each.' },
  { id: 'cf06', category: 'hobby', title: 'Axe-throw lane', detail: 'Supervised range. Keep score. Stay unhinged safely.' },
  { id: 'cf07', category: 'hobby', title: 'VR co-op mission', detail: 'Arcade VR — one co-op game, then debrief outside.' },
  { id: 'cf08', category: 'hobby', title: 'Roller-disco night', detail: 'Public skate session. Hold the rail, own the fall.' },
  { id: 'cf09', category: 'hobby', title: 'Indoor skydiving try', detail: 'If a tunnel exists nearby — one flight each.' },
  { id: 'cf10', category: 'hobby', title: 'Bouldering flash challenge', detail: 'Climb gym day pass. Flash the easiest V0.' },
  { id: 'cf11', category: 'hobby', title: 'Mystery bus hop', detail: 'Board a random city bus for 4 stops. Explore that block.' },
  { id: 'cf12', category: 'hobby', title: 'Photo scavenger sprint', detail: '10 wild prompts around the city center — first to finish wins fries.' },
  { id: 'cf13', category: 'hobby', title: 'Street-food roulette', detail: 'Close your eyes; the other picks two stalls near the market.' },
  { id: 'cf14', category: 'hobby', title: 'Night market dare bites', detail: 'Order the weirdest legal snack on the board.' },
  { id: 'cf15', category: 'hobby', title: 'Rooftop sunset sit', detail: 'Public rooftop / parking deck / park hill — no velvet rope.' },
  { id: 'cf16', category: 'hobby', title: 'River / canal night walk', detail: 'Walk the waterfront and invent a fake tour for statues.' },
  { id: 'cf17', category: 'hobby', title: 'Thrift-costume mini runway', detail: '€10 budget each. Style a look. Photo on a plaza.' },
  { id: 'cf18', category: 'hobby', title: 'Public piano jam', detail: 'If the station has a piano — one song, then clap for strangers.' },
  { id: 'cf19', category: 'hobby', title: 'Ice-cream walk-and-rate', detail: 'Two scoops from two shops. Brutal honesty scorecards.' },
  { id: 'cf20', category: 'hobby', title: 'Board-game café newbies', detail: 'Ask staff for the silliest game neither of you knows.' },
  { id: 'cf21', category: 'hobby', title: 'Comedy open-mic listen', detail: 'Cheap local night. Sit near the back. Debrief outside.' },
  { id: 'cf22', category: 'hobby', title: 'Arcade high-score war', detail: 'One cabinet. Best of three. Loser buys bubble tea.' },
  { id: 'cf23', category: 'hobby', title: 'Floating market / ferry hop', detail: 'Short public ferry or water taxi if your city has one.' },
  { id: 'cf24', category: 'hobby', title: 'Sunrise stretch meetup', detail: 'Meet at a park hill or pier before work noise starts.' },
  { id: 'cf25', category: 'hobby', title: 'Mural hunt + selfie map', detail: 'Find three street murals. Build a tiny map together.' },
  { id: 'cf26', category: 'hobby', title: 'Silent disco headphones', detail: 'If a rental pop-up exists — otherwise phone + one shared playlist walk.' },
  { id: 'cf27', category: 'hobby', title: 'Pottery smash-paint', detail: 'Paint-a-pot studio or mosaic workshop walk-in.' },
  { id: 'cf28', category: 'hobby', title: 'Bowling glow night', detail: 'Cosmic bowling if available — gutter balls allowed.' },
  { id: 'cf29', category: 'hobby', title: 'Observatory / planetarium hour', detail: 'Public show or free telescope night.' },
  { id: 'cf30', category: 'hobby', title: 'Farmers-market cook plan', detail: 'Buy €15 of ingredients. Plan a tiny picnic recipe on a bench.' },
];

function pickSpot(spots: string[], seed: string): string | null {
  if (!spots.length) return null;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return spots[h % spots.length];
}

export function localizeIdea(
  idea: DateIdea,
  city?: string | null,
  country?: string | null,
  altCity?: string | null
): DateIdea {
  const cityLabel = String(city || '').trim();
  const alt = String(altCity || '').trim();
  const countryLabel = String(country || '').trim();
  const spots = citySpots(cityLabel);
  const spot = pickSpot(spots, idea.id);
  const where =
    cityLabel && alt && normKey(cityLabel) !== normKey(alt)
      ? `Meet in ${cityLabel} (or agree on ${alt})`
      : cityLabel
        ? `In ${cityLabel}`
        : countryLabel
          ? `In your city in ${countryLabel}`
          : 'In your city';

  const spotLine = spot ? ` Start near ${spot}.` : cityLabel ? ` Use a real public spot in ${cityLabel} — market, park, or main square.` : '';

  return {
    ...idea,
    title: idea.title,
    detail: `${idea.detail} ${where}.${spotLine}`.replace(/\s+/g, ' ').trim(),
  };
}

export function crazyFunIdeas(city?: string | null, country?: string | null): DateIdea[] {
  return CRAZY_FUN_BASE.map((t) => localizeIdea(t, city, country));
}

export function localizeIdeaCatalog(
  ideas: DateIdea[],
  city?: string | null,
  country?: string | null,
  altCity?: string | null
): DateIdea[] {
  const merged = [...ideas];
  const seen = new Set(ideas.map((i) => i.id));
  for (const c of CRAZY_FUN_BASE) {
    if (!seen.has(c.id)) merged.push(c);
  }
  return merged.map((idea) => localizeIdea(idea, city, country, altCity));
}

export function getAnyIdeaById(id: string, from: DateIdea[]): DateIdea | undefined {
  return from.find((d) => d.id === id) || CRAZY_FUN_BASE.find((d) => d.id === id);
}

export function allDateIdeaBases(from: DateIdea[]): DateIdea[] {
  const seen = new Set(from.map((i) => i.id));
  const extras = CRAZY_FUN_BASE.filter((c) => !seen.has(c.id));
  return [...from, ...extras];
}

export function computeTravelGap(
  me: { city?: string | null; country?: string | null; homeLocation?: { lat: number; lon: number } | null; location?: { lat: number; lon: number } | null },
  other: { city?: string | null; country?: string | null; homeLocation?: { lat: number; lon: number } | null; location?: { lat: number; lon: number } | null }
): {
  sameCountry: boolean;
  sameCity: boolean;
  distanceKm: number | null;
  travelFar: boolean;
  meetingCity: string | null;
} {
  const sameCountry = Boolean(normKey(me.country) && normKey(me.country) === normKey(other.country));
  const sameCity = Boolean(normKey(me.city) && normKey(me.city) === normKey(other.city));
  const a = resolveUserCoords(me);
  const b = resolveUserCoords(other);
  let distanceKm: number | null = null;
  if (a && b) distanceKm = Math.round(haversineKm(a.lat, a.lon, b.lat, b.lon));
  const travelFar =
    sameCountry &&
    !sameCity &&
    (distanceKm == null ? true : distanceKm >= DATE_ARENA_FAR_KM);
  const meetingCity = sameCity
    ? String(me.city || other.city || '').trim() || null
    : String(other.city || me.city || '').trim() || null;
  return { sameCountry, sameCity, distanceKm, travelFar, meetingCity };
}
