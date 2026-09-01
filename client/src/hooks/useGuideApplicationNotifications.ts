import { useEffect } from 'react';
import { API_BASE } from '../api/config';
import { getAuthToken } from '../lib/authStorage';
import { notifyDevice } from '../lib/deviceNotify';

function dispatchGuideUpdate(): void {
  window.dispatchEvent(new Event('guide:application-updated'));
}

/** Live alerts for guide apply (48h wait) and qualified-admin review decisions. */
export function useGuideApplicationNotifications(userId: string | undefined): void {
  useEffect(() => {
    if (!userId) return;
    const token = getAuthToken();
    if (!token) return;

    const url = `${API_BASE}/api/notifications/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    es.addEventListener('guide_application_received', () => {
      notifyDevice('Guide application received', 'You will get an answer within 48 hours.');
      dispatchGuideUpdate();
    });

    es.addEventListener('guide_application_decision', (event) => {
      let approved = false;
      try {
        const data = JSON.parse((event as MessageEvent).data || '{}') as { approved?: boolean };
        approved = Boolean(data.approved);
      } catch {
        approved = false;
      }
      notifyDevice(
        approved ? 'You are a qualified guide' : 'Guide application update',
        approved
          ? 'You can start guiding others now from Compatibility.'
          : 'Your application was not approved. You can strengthen your proofs and apply again.'
      );
      dispatchGuideUpdate();
    });

    es.addEventListener('guide_application_pending_review', (event) => {
      let name = 'Someone';
      try {
        const data = JSON.parse((event as MessageEvent).data || '{}') as { applicantName?: string };
        name = data.applicantName || name;
      } catch {
        /* ignore */
      }
      notifyDevice('New guide applicant', `${name} applied. Open Compatibility → Expert dashboard to review their profile and proofs.`);
      dispatchGuideUpdate();
    });

    return () => es.close();
  }, [userId]);
}
