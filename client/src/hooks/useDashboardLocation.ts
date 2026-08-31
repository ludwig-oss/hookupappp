import { useEffect, useRef } from 'react';
import { connectionsAPI } from '../api/connections';
import { markLocationGranted, readStoredCoords, resolveWorkingCoords } from '../lib/locationSession';

const locationApi = {
  getMyLocation: () => connectionsAPI.getMyLocation(),
  forwardGeocode: (q: string) => connectionsAPI.forwardGeocode(q),
  updateLocation: (data: Parameters<typeof connectionsAPI.updateLocation>[0]) =>
    connectionsAPI.updateLocation(data),
};

type UserLoc = { id: string; city?: string; country?: string };

/** Keep location fresh on phone, tablet, and laptop while Dashboard is open. */
export function useDashboardLocation(user?: UserLoc) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const coordsRef = useRef(readStoredCoords());

  useEffect(() => {
    if (!user?.id) return;

    const push = (coords: { lat: number; lon: number; accuracy?: number; source?: 'gps' | 'storage' | 'server' | 'profile' }) => {
      coordsRef.current = coords;
      markLocationGranted(coords);
      connectionsAPI
        .updateLocation({
          lat: coords.lat,
          lon: coords.lon,
          accuracy: coords.accuracy,
          userId: user.id,
          connectionsVisible: true,
        })
        .catch(() => {});
    };

    resolveWorkingCoords(
      { userId: user.id, city: user.city, country: user.country },
      locationApi
    ).then((coords) => {
      if (coords) push(coords);
    });

    intervalRef.current = setInterval(() => {
      const c = coordsRef.current || readStoredCoords();
      if (c) push(c);
      else {
        resolveWorkingCoords(
          { userId: user.id, city: user.city, country: user.country },
          locationApi
        ).then((next) => {
          if (next) push(next);
        });
      }
    }, 45_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user?.id, user?.city, user?.country]);
}
