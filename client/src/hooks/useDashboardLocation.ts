import { useEffect, useRef } from 'react';
import { connectionsAPI } from '../api/connections';
import { markLocationGranted, readStoredCoords, resolveWorkingCoords, startGpsWatch, type StoredCoords } from '../lib/locationSession';

const locationApi = {
  getMyLocation: () => connectionsAPI.getMyLocation(),
  forwardGeocode: (q: string) => connectionsAPI.forwardGeocode(q),
  updateLocation: (data: Parameters<typeof connectionsAPI.updateLocation>[0]) =>
    connectionsAPI.updateLocation(data),
  locateByIp: () => connectionsAPI.locateByIp(),
};

type UserLoc = { id: string; city?: string; country?: string };

function appIsInForeground(): boolean {
  if (typeof document === 'undefined') return true;
  return document.visibilityState !== 'hidden';
}

/** Keep location on while the app is open; turn it off when they leave, switch tabs, or switch apps. */
export function useDashboardLocation(user?: UserLoc) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const coordsRef = useRef(readStoredCoords());
  const stopWatchRef = useRef<(() => void) | null>(null);
  const visibleRef = useRef(true);

  useEffect(() => {
    if (!user?.id) return;

    const push = (coords: StoredCoords, visible: boolean) => {
      coordsRef.current = coords;
      markLocationGranted(coords);
      connectionsAPI
        .updateLocation({
          lat: coords.lat,
          lon: coords.lon,
          accuracy: coords.accuracy,
          userId: user.id,
          connectionsVisible: visible,
        })
        .catch(() => {});
    };

    const stopWatch = () => {
      if (stopWatchRef.current) {
        stopWatchRef.current();
        stopWatchRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const hideNearby = () => {
      visibleRef.current = false;
      stopWatch();
      connectionsAPI.setVisibility(false).catch(() => {});
      const c = coordsRef.current || readStoredCoords();
      if (c) push(c, false);
    };

    const showNearby = () => {
      visibleRef.current = true;
      stopWatch();
      connectionsAPI.setVisibility(true).catch(() => {});

      resolveWorkingCoords(
        { userId: user.id, allowIp: true },
        locationApi
      ).then((coords) => {
        if (coords && visibleRef.current) push(coords, true);
      });

      stopWatchRef.current = startGpsWatch((coords) => {
        if (visibleRef.current) push(coords, true);
      });

      intervalRef.current = setInterval(() => {
        if (!visibleRef.current) return;
        const c = coordsRef.current || readStoredCoords();
        if (c) push(c, true);
        else {
          resolveWorkingCoords(
            { userId: user.id, allowIp: true },
            locationApi
          ).then((next) => {
            if (next && visibleRef.current) push(next, true);
          });
        }
      }, 45_000);
    };

    const onVisibility = () => {
      if (appIsInForeground()) showNearby();
      else hideNearby();
    };

    if (appIsInForeground()) showNearby();
    else hideNearby();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', hideNearby);
    window.addEventListener('freeze', hideNearby as EventListener);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', hideNearby);
      window.removeEventListener('freeze', hideNearby as EventListener);
      hideNearby();
    };
  }, [user?.id, user?.city, user?.country]);
}
