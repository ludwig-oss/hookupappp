import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { coachVoteAPI, CoachVoteCampaign } from '../api/improvement';
import { getSkippedPopupIds, markCoachVotePopupShown, shouldShowCoachVotePopup } from '../lib/coachVoteSession';
import './CoachVoteSwipePopup.css';

const POPUP_SECONDS = 15;

type PopupData = {
  campaign: CoachVoteCampaign & { applicantCountry?: string | null; applicantCity?: string | null };
  swipeLabel: string;
  helpText: string;
  regionalMatch?: boolean;
};

export default function CoachVoteSwipePopup() {
  const { user } = useContext(AuthContext);
  const [data, setData] = useState<PopupData | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(POPUP_SECONDS);
  const [dragX, setDragX] = useState(0);
  const [voting, setVoting] = useState(false);
  const startX = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const dismiss = useCallback(() => {
    if (data?.campaign?.id) markCoachVotePopupShown(data.campaign.id);
    setData(null);
    setDragX(0);
    setSecondsLeft(POPUP_SECONDS);
  }, [data?.campaign?.id]);

  const submitSwipe = useCallback(
    async (vote: 'baddie' | 'not') => {
      if (!data?.campaign?.id || voting) return;
      setVoting(true);
      try {
        await coachVoteAPI.vote(data.campaign.id, vote);
        markCoachVotePopupShown(data.campaign.id);
        setData(null);
      } catch {
        dismiss();
      } finally {
        setVoting(false);
      }
    },
    [data?.campaign?.id, voting, dismiss]
  );

  const loadPopup = useCallback(async () => {
    if (!user?.id) return;
    try {
      const skip = getSkippedPopupIds();
      const res = await coachVoteAPI.getPopup({
        skip: skip.join(','),
        country: user.country,
        city: user.city,
      });
      if (!res.campaign || !shouldShowCoachVotePopup(res.campaign.id)) return;
      setData({
        campaign: res.campaign,
        swipeLabel: res.swipeLabel || 'Swipe right = yes, left = no',
        helpText: res.helpText || 'Help pick quality guides in your area.',
        regionalMatch: res.regionalMatch,
      });
      setSecondsLeft(POPUP_SECONDS);
    } catch {
      /* silent */
    }
  }, [user?.id, user?.country, user?.city]);

  useEffect(() => {
    loadPopup();
    const interval = setInterval(loadPopup, 90000);
    return () => clearInterval(interval);
  }, [loadPopup]);

  useEffect(() => {
    if (!data) return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          dismiss();
          return POPUP_SECONDS;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [data, dismiss]);

  if (!data) return null;

  const regionLabel = [data.campaign.applicantCity, data.campaign.applicantCountry].filter(Boolean).join(', ');

  return (
    <div className="coach-vote-overlay" role="dialog" aria-modal="true">
      <div className="coach-vote-card" style={{ transform: `translateX(${dragX}px) rotate(${dragX * 0.05}deg)` }}>
        <p className="coach-vote-badge">Help pick guides · {secondsLeft}s</p>
        <p className="coach-vote-help">{data.helpText}</p>
        {data.regionalMatch && regionLabel ? (
          <p className="coach-vote-region">Near you: {regionLabel}</p>
        ) : null}
        <div className="coach-vote-profile">
          {data.campaign.profilePicture ? (
            <img src={data.campaign.profilePicture} alt="" className="coach-vote-avatar" />
          ) : (
            <div className="coach-vote-avatar coach-vote-avatar-ph">{data.campaign.profileName[0]}</div>
          )}
          <div>
            <strong>{data.campaign.profileName}</strong>
            {data.campaign.profileAge ? <div className="coach-vote-meta">Age {data.campaign.profileAge}</div> : null}
          </div>
        </div>
        <p className="coach-vote-question">{data.swipeLabel}</p>
        <div className="coach-vote-hints">
          <span className="coach-vote-left">← Not yet</span>
          <span className="coach-vote-right">Baddie →</span>
        </div>
        <div
          className="coach-vote-swipe-area"
          onPointerDown={(e) => {
            startX.current = e.clientX;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => setDragX(e.clientX - startX.current)}
          onPointerUp={() => {
            if (dragX > 80) submitSwipe('baddie');
            else if (dragX < -80) submitSwipe('not');
            setDragX(0);
          }}
        >
          <button type="button" disabled={voting} className="coach-vote-btn no" onClick={() => submitSwipe('not')}>
            ✕
          </button>
          <button type="button" disabled={voting} className="coach-vote-btn yes" onClick={() => submitSwipe('baddie')}>
            ♥
          </button>
        </div>
        <button type="button" className="coach-vote-skip" onClick={dismiss}>
          Skip
        </button>
      </div>
    </div>
  );
}
