import { useEffect } from 'react';
import { API_BASE } from '../api/config';
import { getAuthToken } from '../lib/authStorage';
import { notifyDevice } from '../lib/deviceNotify';
import type { DisinterestReport } from '../api/disinterest';

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
      notifyDevice('Guide application received', 'You will get an answer within 48 hours.', 'safety');
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
          : 'Your application was not approved. You can strengthen your proofs and apply again.',
        'safety'
      );
      dispatchGuideUpdate();
    });

    es.addEventListener('chat_disinterest', (event) => {
      let otherUserId = '';
      let score = 0;
      let report: DisinterestReport | null = null;
      try {
        const data = JSON.parse((event as MessageEvent).data || '{}') as {
          otherUserId?: string;
          score?: number;
          report?: DisinterestReport;
        };
        otherUserId = data.otherUserId || '';
        score = Number(data.score) || 0;
        report = data.report || null;
      } catch {
        /* ignore */
      }
      notifyDevice(
        'Hey, watch out',
        'This is not a red flag — just a heads-up. Take time, gather evidence, then decide.',
        'safety'
      );
      window.dispatchEvent(
        new CustomEvent('chat:disinterest-warning', { detail: { otherUserId, score, report } })
      );
    });

    es.addEventListener('texting_help_sos', (event) => {
      let payload = { sessionId: '', fromUserId: '', fromName: 'Someone', otherUserId: '', createdAt: new Date().toISOString(), firstAnswered: false };
      try {
        payload = { ...payload, ...JSON.parse((event as MessageEvent).data || '{}') };
      } catch {
        /* ignore */
      }
      notifyDevice('Texting SOS — extra cash', `${payload.fromName} needs live help texting someone.`, 'safety');
      window.dispatchEvent(new CustomEvent('texting-help:sos', { detail: payload }));
    });

    es.addEventListener('texting_help_answered', (event) => {
      let payload = { sessionId: '', guideUserId: '', guideName: 'A guide' };
      try {
        payload = { ...payload, ...JSON.parse((event as MessageEvent).data || '{}') };
      } catch {
        /* ignore */
      }
      notifyDevice(`${payload.guideName} answered your SOS`, 'They are highlighted on the wheel. Pick who you want.', 'safety');
      window.dispatchEvent(new CustomEvent('texting-help:answered', { detail: payload }));
    });

    es.addEventListener('texting_help_chosen', (event) => {
      let liveRoomUrl = '';
      try {
        liveRoomUrl = JSON.parse((event as MessageEvent).data || '{}').liveRoomUrl || '';
      } catch {
        /* ignore */
      }
      notifyDevice('You were chosen for texting help', 'Join the live room and coach them. Extra cash is on the way.', 'safety');
      if (liveRoomUrl) window.open(liveRoomUrl, '_blank', 'width=900,height=700');
    });

    es.addEventListener('guide_application_pending_review', (event) => {
      let name = 'Someone';
      try {
        const data = JSON.parse((event as MessageEvent).data || '{}') as { applicantName?: string };
        name = data.applicantName || name;
      } catch {
        /* ignore */
      }
      notifyDevice('New guide applicant', `${name} applied. Open Compatibility → Expert dashboard to review their profile and proofs.`, 'safety');
      dispatchGuideUpdate();
    });

    es.addEventListener('date_pitch', () => {
      notifyDevice('Pitch update', 'Open Date Arena or the pitch popup to respond.', 'interest');
      window.dispatchEvent(new Event('date-pitch:update'));
    });
    es.addEventListener('date_match', () => {
      notifyDevice('Date Arena', 'You have a match waiting. Open Date Arena.', 'matches');
    });
    es.addEventListener('date_lawyer', () => {
      notifyDevice('Guide lawyer room', 'A 3-person pitch room needs you in Date Arena.', 'safety');
    });

    return () => es.close();
  }, [userId]);
}
