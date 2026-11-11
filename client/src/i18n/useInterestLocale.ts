import { useEffect, useState } from 'react';
import { connectionsAPI } from '../api/connections';
import { markLocationGranted, readStoredCoords } from '../lib/locationSession';
import { languageForCountry } from './countryLanguage';
import { INTEREST_EN, loadInterestCopy, type InterestCopy } from './interestCopy';

export const LOCATION_UPDATED_EVENT = 'hookup:location-updated';

type LocaleState = { lang: string; copy: InterestCopy; key: string };

let cached: LocaleState | null = null;
let pending: Promise<LocaleState> | null = null;

function placeKey(profileCountry?: string): string {
  const coords = readStoredCoords();
  const code = (coords?.countryCode || '').trim().toUpperCase();
  const country = (coords?.country || profileCountry || '').trim().toLowerCase();
  return `${code}|${country}`;
}

async function resolveLocationLanguage(profileCountry?: string): Promise<string> {
  const coords = readStoredCoords();
  let country = coords?.country || '';
  let countryCode = coords?.countryCode || '';
  if (!country && !countryCode && coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lon)) {
    try {
      const geo = await connectionsAPI.reverseGeocode(coords.lat, coords.lon);
      country = geo.country || '';
      countryCode = geo.countryCode || '';
      if (country || countryCode) {
        markLocationGranted({
          ...coords,
          country: country || coords.country,
          countryCode: countryCode || coords.countryCode,
        });
      }
    } catch {
      /* geocoder down — fall through to the profile country */
    }
  }
  const fromHere = languageForCountry(country, countryCode);
  if (fromHere) return fromHere;
  const fromProfile = languageForCountry(profileCountry);
  if (fromProfile) return fromProfile;
  const nav = typeof navigator !== 'undefined' ? navigator.language : '';
  const short = (nav || '').toLowerCase().split('-')[0];
  if (short && /^[a-z]{2,3}$/.test(short)) return short;
  return 'en';
}

export function ensureInterestLocale(profileCountry?: string): Promise<LocaleState> {
  const key = placeKey(profileCountry);
  if (cached && cached.key === key) return Promise.resolve(cached);
  if (pending) return pending;
  pending = (async () => {
    const lang = await resolveLocationLanguage(profileCountry);
    const copy = await loadInterestCopy(lang);
    const next: LocaleState = { lang, copy, key: placeKey(profileCountry) };
    cached = next;
    return next;
  })().finally(() => {
    pending = null;
  });
  return pending;
}

export function useInterestLocale(profileCountry?: string): { lang: string; copy: InterestCopy } {
  const [state, setState] = useState<{ lang: string; copy: InterestCopy }>(
    () => (cached && cached.key === placeKey(profileCountry) ? cached : { lang: 'en', copy: INTEREST_EN })
  );

  useEffect(() => {
    let cancel = false;
    const load = () => {
      void ensureInterestLocale(profileCountry).then((next) => {
        if (!cancel) setState({ lang: next.lang, copy: next.copy });
      });
    };
    load();
    window.addEventListener(LOCATION_UPDATED_EVENT, load);
    return () => {
      cancel = true;
      window.removeEventListener(LOCATION_UPDATED_EVENT, load);
    };
  }, [profileCountry]);

  return state;
}
