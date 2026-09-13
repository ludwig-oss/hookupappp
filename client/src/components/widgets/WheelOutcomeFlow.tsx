import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { activityAPI } from '../../api/activity';
import { openChatWithUser } from '../../lib/openChat';
import { filterWheelUsers, markWheelUserActed } from '../../lib/wheelEncounter';
import { formatAxiosError } from '../../lib/apiError';
import { getWheelGameById } from '../../data/wheelGames';
import './WheelOutcomeFlow.css';

const MATCH_24H_RULE =
  'Reply within 24 hours after each message or the match ends.';

async function sendInterestOpenChat(toUserId: string, onOpenChat?: (userId: string) => void) {
  const res = await activityAPI.sendInterest(toUserId);
  markWheelUserActed(toUserId);
  const chatId = (res as { chatUserId?: string }).chatUserId;
  const mutual = Boolean((res as { openChat?: boolean; mutual?: boolean }).openChat);
  if (chatId) {
    openChatWithUser(chatId);
    onOpenChat?.(chatId);
  }
  return { mutual, message: res.message || (mutual ? "It's a match!" : 'Interest sent') };
}

function interestResultMessage(mutual: boolean, message: string, targetName?: string): string {
  if (mutual) {
    return `${message} You're in Communications — ${MATCH_24H_RULE}`;
  }
  return targetName
    ? `Interest sent to ${targetName}! When they say yes in Activity, you'll both land in Communications. ${MATCH_24H_RULE}`
    : `${message} When they say yes too, you'll both land in Communications. ${MATCH_24H_RULE}`;
}

const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';
async function reverseGeocode(lat: number, lon: number): Promise<{ country: string; city: string }> {
  const url = `${NOMINATIM_REVERSE}?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
  const res = await fetch(url, { headers: { 'User-Agent': 'ASWP-Wheel/1.0' } });
  if (!res.ok) throw new Error('Location lookup failed');
  const data = await res.json();
  const addr = data.address || {};
  return {
    city: addr.city || addr.town || addr.village || addr.municipality || addr.county || '',
    country: addr.country || '',
  };
}

type UserInfo = { id: string; name: string; username: string; profilePicture: string | null; country?: string; city?: string; blurred?: boolean; displayName?: string; goldStar?: boolean };

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

interface WheelOutcomeFlowProps {
  gameId: string;
  country: string;
  city: string;
  onClose: () => void;
  onOpenChat: (userId: string) => void;
  onLocationDetected?: (country: string, city: string) => void;
}

export default function WheelOutcomeFlow({ gameId, country, city, onClose, onOpenChat, onLocationDetected }: WheelOutcomeFlowProps) {
  const [regionUsers, setRegionUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detectedCountry, setDetectedCountry] = useState('');
  const [detectedCity, setDetectedCity] = useState('');
  const [detectingLocation, setDetectingLocation] = useState(false);

  const effectiveCountry = (country?.trim() || detectedCountry).trim();
  const effectiveCity = (city?.trim() || detectedCity).trim();

  useEffect(() => {
    setLoading(true);
    setError(null);
    activityAPI
      .getRegionUsers(effectiveCountry || '', effectiveCity || undefined)
      .then((r) => {
        const list = shuffle(filterWheelUsers(r.users || []));
        setRegionUsers(list);
        if (!list.length) {
          setError(
            effectiveCountry
              ? `No one available in ${effectiveCity || effectiveCountry} for this game yet. Set Profile city, or try again — simulator mocks should appear when the sim is running.`
              : 'Set your country in Profile (or use location) so we can find people for this game.'
          );
        }
      })
      .catch((e) =>
        setError(
          formatAxiosError(e, 'Could not load users. Check you are signed in, then try again.')
        )
      )
      .finally(() => setLoading(false));
  }, [effectiveCountry, effectiveCity]);

  const handleUseMyLocation = () => {
    if (!navigator?.geolocation) {
      setError('Location is not supported by your browser.');
      return;
    }
    setError(null);
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { country: c, city: ct } = await reverseGeocode(position.coords.latitude, position.coords.longitude);
          setDetectedCountry(c);
          setDetectedCity(ct);
          onLocationDetected?.(c, ct);
        } catch {
          setError('Could not get location. Try setting country in Profile.');
        } finally {
          setDetectingLocation(false);
        }
      },
      () => {
        setError('Location access denied. Enable location or set country in Profile.');
        setDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  if (loading) {
    return createPortal(
      <div className="wheel-outcome-overlay" onClick={onClose}>
        <div className="wheel-outcome-modal" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="wheel-outcome-close" onClick={onClose} aria-label="Close">×</button>
          <p className="wheel-outcome-loading">Loading...</p>
        </div>
      </div>,
      document.body
    );
  }

  if (error && regionUsers.length === 0) {
    const isNoCountry = error.includes('Set your country in Profile');
    return createPortal(
      <div className="wheel-outcome-overlay" onClick={onClose}>
        <div className="wheel-outcome-modal" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="wheel-outcome-close" onClick={onClose} aria-label="Close">×</button>
          <p className="wheel-outcome-msg">{error}</p>
          <div className="wheel-outcome-actions">
            {isNoCountry && (
              <button type="button" className="wheel-outcome-btn" onClick={handleUseMyLocation} disabled={detectingLocation}>
                {detectingLocation ? 'Detecting…' : '📍 Use my location'}
              </button>
            )}
            <button type="button" className="wheel-outcome-btn secondary" onClick={onClose}>OK</button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  if (regionUsers.length === 0) {
    return createPortal(
      <div className="wheel-outcome-overlay" onClick={onClose}>
        <div className="wheel-outcome-modal" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="wheel-outcome-close" onClick={onClose} aria-label="Close">×</button>
          <p className="wheel-outcome-msg">No other users to play with yet. Invite friends or try again later!</p>
          <button type="button" className="wheel-outcome-btn secondary" onClick={onClose}>OK</button>
        </div>
      </div>,
      document.body
    );
  }

  const game = getWheelGameById(gameId);
  const mechanic = game?.mechanic || 'blind_date';
  const gameTitle = game?.name || 'Mini-game';

  if (mechanic === 'blind_date') return <BlindDateFlow users={regionUsers} title={gameTitle} onClose={onClose} onOpenChat={onOpenChat} />;
  if (mechanic === 'picture_pick') return <PicturePickFlow users={regionUsers} title={gameTitle} onClose={onClose} onOpenChat={onOpenChat} />;
  if (mechanic === 'compatibility_rush') return <CompatibilityRushFlow users={regionUsers} title={gameTitle} onClose={onClose} onOpenChat={onOpenChat} />;
  if (mechanic === 'lucky_like') return <LuckyLikeFlow users={regionUsers} title={gameTitle} onClose={onClose} onOpenChat={onOpenChat} />;
  if (mechanic === 'speed_pick') return <SpeedPickFlow users={regionUsers} title={gameTitle} onClose={onClose} onOpenChat={onOpenChat} />;
  if (mechanic === 'mystery_message') return <MysteryMessageFlow users={regionUsers} title={gameTitle} onClose={onClose} onOpenChat={onOpenChat} />;

  return null;
}

const BLIND_DATE_PROMPTS = [
  "Icebreaker: I'm really into hiking and terrible puns 😄 — what about you?",
  "Question for you: Coffee or tea? (I'm judging silently)",
  "Icebreaker: I once traveled 3 hours for a good taco. No regrets. Your turn — share a food adventure.",
  "Icebreaker: My superpower is falling asleep in 2 minutes flat. What's yours?",
  "Question for you: What's the last thing that made you laugh really hard?",
];

function BlindDateFlow({
  users,
  title = 'Blind Date',
  onClose,
  onOpenChat,
}: {
  users: UserInfo[];
  title?: string;
  onClose: () => void;
  onOpenChat: (id: string) => void;
}) {
  const [step, setStep] = useState<'intro' | 'matched' | 'timer' | 'vote' | 'reveal' | 'add' | 'done'>('intro');
  const [match] = useState<UserInfo | null>(() => users[0] || null);
  const CALL_SEC = 45;
  const [timerSec, setTimerSec] = useState(CALL_SEC);
  const [promptIndex, setPromptIndex] = useState(0);
  const [otherSaidYes, setOtherSaidYes] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [micLive, setMicLive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (step === 'intro') {
      const t = setTimeout(() => setStep('matched'), 1500);
      return () => clearTimeout(t);
    }
    if (step === 'matched') {
      const t = setTimeout(() => setStep('timer'), 1800);
      return () => clearTimeout(t);
    }
  }, [step]);

  useEffect(() => {
    if (step !== 'timer') return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setMicLive(true);
        setMicError(null);
      } catch {
        setMicError('Mic permission needed for the voice round — enable it, or continue with prompts only.');
        setMicLive(false);
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setMicLive(false);
    };
  }, [step]);

  useEffect(() => {
    if (step !== 'timer') return;
    const interval = setInterval(() => {
      setTimerSec((s) => {
        if (s <= 1) {
          clearInterval(interval);
          streamRef.current?.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          setMicLive(false);
          setStep('vote');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  useEffect(() => {
    if (step !== 'timer') return;
    const rot = setInterval(() => setPromptIndex((i) => (i + 1) % BLIND_DATE_PROMPTS.length), 8000);
    return () => clearInterval(rot);
  }, [step]);

  const handleVote = (vote: 'yes' | 'no') => {
    setTimeout(() => {
      setOtherSaidYes(vote === 'yes' && Math.random() > 0.3);
      setStep('reveal');
    }, 800);
  };

  const handleRevealNo = () => setStep('done');

  const handleAddToComm = () => {
    if (!match) return;
    sendInterestOpenChat(match.id, onOpenChat)
      .then(() => setStep('done'))
      .catch(() => setStep('done'));
  };

  if (!match) {
    return createPortal(
      <div className="wheel-outcome-overlay" onClick={onClose}>
        <div className="wheel-outcome-modal" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="wheel-outcome-close" onClick={onClose}>×</button>
          <p className="wheel-outcome-msg">No one in your area right now. Try again later!</p>
          <button type="button" className="wheel-outcome-btn" onClick={onClose}>OK</button>
        </div>
      </div>,
      document.body
    );
  }

  const blurredLabel = 'Someone nearby';

  const content = (
    <div className="wheel-outcome-overlay" onClick={onClose}>
      <div className="wheel-outcome-modal blind-date" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="wheel-outcome-close" onClick={onClose}>×</button>
        {step === 'intro' && <p className="wheel-outcome-msg">Finding your match...</p>}
        {step === 'matched' && (
          <>
            <h3 className="wheel-outcome-title">{title}</h3>
            <div className="wheel-outcome-reveal">
              <div className="wheel-outcome-avatar placeholder wheel-name-blurred">?</div>
              <p className="wheel-name-blurred">{blurredLabel}</p>
            </div>
            <p className="wheel-outcome-msg">
              Names stay blurred. You get a timed voice round — talk only until the clock hits zero, then vote if you think they’re a match.
            </p>
          </>
        )}
        {step === 'timer' && (
          <>
            <h3 className="wheel-outcome-title">🎙 Voice round · {title}</h3>
            <p className="wheel-outcome-timer">{Math.floor(timerSec / 60)}:{(timerSec % 60).toString().padStart(2, '0')}</p>
            <div className="wheel-outcome-reveal">
              <div className="wheel-outcome-avatar placeholder wheel-name-blurred">?</div>
              <p className="wheel-name-blurred">{blurredLabel}</p>
              <p style={{ fontSize: 12, color: micLive ? '#86efac' : '#fca5a5' }}>
                {micLive ? 'Mic live — talk now' : micError || 'Connecting mic…'}
              </p>
            </div>
            <div className="wheel-outcome-chat-bubble">
              {BLIND_DATE_PROMPTS[promptIndex]}
            </div>
            <p className="wheel-outcome-msg">
              Voice only for this countdown. When time’s up the call ends and we ask: Do you think they’re a match?
            </p>
          </>
        )}
        {step === 'vote' && (
          <>
            <h3 className="wheel-outcome-title">Time’s up — call ended</h3>
            <p className="wheel-outcome-msg">Do you think they’re a match?</p>
            <div className="wheel-outcome-actions">
              <button type="button" className="wheel-outcome-btn" onClick={() => handleVote('yes')}>Yes</button>
              <button type="button" className="wheel-outcome-btn secondary" onClick={() => handleVote('no')}>No</button>
            </div>
          </>
        )}
        {step === 'reveal' && (
          <>
            <h3 className="wheel-outcome-title">{otherSaidYes ? 'They said Yes too!' : "They didn't say Yes."}</h3>
            {otherSaidYes && (
              <>
                <div className="wheel-outcome-reveal">
                  {match.profilePicture ? (
                    <img src={match.profilePicture} alt="" className="wheel-outcome-avatar" />
                  ) : (
                    <div className="wheel-outcome-avatar placeholder">{match.name.charAt(0)}</div>
                  )}
                  <p><strong>{match.name}</strong> @{match.username}</p>
                </div>
                <p className="wheel-outcome-msg">Still want to chat?</p>
                <div className="wheel-outcome-actions">
                  <button type="button" className="wheel-outcome-btn" onClick={() => setStep('add')}>Yes, add to Communication</button>
                  <button type="button" className="wheel-outcome-btn secondary" onClick={handleRevealNo}>No</button>
                </div>
              </>
            )}
            {!otherSaidYes && (
              <button type="button" className="wheel-outcome-btn" onClick={onClose}>Close</button>
            )}
          </>
        )}
        {step === 'add' && (
          <>
            <p className="wheel-outcome-msg">Send a connection request?</p>
            <div className="wheel-outcome-actions">
              <button type="button" className="wheel-outcome-btn" onClick={handleAddToComm}>Send request</button>
              <button type="button" className="wheel-outcome-btn secondary" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
        {step === 'done' && (
          <>
            <p className="wheel-outcome-msg">Request sent! When they accept you can chat in Communication.</p>
            <button type="button" className="wheel-outcome-btn" onClick={onClose}>OK</button>
          </>
        )}
      </div>
    </div>
  );
  return createPortal(content, document.body);
}

const PICTURE_PICK_HINTS = ['🌙 Night owl', '✈️ Loves travel', '🎵 Music lover', '🐕 Dog person', '🍕 Foodie', '📚 Book nerd', '☕ Coffee addict', '🎬 Movie buff', '🌿 Outdoorsy', '🎨 Creative soul'];

function PicturePickFlow({ users, title = 'Picture Pick', onClose, onOpenChat }: { users: UserInfo[]; title?: string; onClose: () => void; onOpenChat: (id: string) => void }) {
  const pickFive = users.slice(0, 5);
  const [hints] = useState(() => {
    const pool = [...PICTURE_PICK_HINTS];
    shuffle(pool);
    return pool.slice(0, 5);
  });
  const hintMap = Object.fromEntries(pickFive.map((u, i) => [u.id, hints[i] ?? '?']));
  const [picked, setPicked] = useState<UserInfo | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [showMissed, setShowMissed] = useState(false);

  if (pickFive.length < 5) {
    return createPortal(
      <div className="wheel-outcome-overlay" onClick={onClose}>
        <div className="wheel-outcome-modal" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="wheel-outcome-close" onClick={onClose}>×</button>
          <p className="wheel-outcome-msg">Not enough users in your area. Try again later!</p>
          <button type="button" className="wheel-outcome-btn" onClick={onClose}>OK</button>
        </div>
      </div>,
      document.body
    );
  }

  const handlePick = (u: UserInfo) => {
    if (picked) return;
    setPicked(u);
    setRevealed(true);
  };

  const handleSendRequest = () => {
    if (!picked) return;
    sendInterestOpenChat(picked.id, onOpenChat)
      .then(() => {
        setRequestSent(true);
        setShowMissed(true);
      })
      .catch(() => setRequestSent(true));
  };

  const content = (
    <div className="wheel-outcome-overlay" onClick={onClose}>
      <div className="wheel-outcome-modal picture-pick" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="wheel-outcome-close" onClick={onClose}>×</button>
        <h3 className="wheel-outcome-title">{title}</h3>
        <p className="wheel-outcome-msg">Each card hides someone from your area. Pick the vibe that calls to you — we’ll reveal who’s behind it.</p>
        {!revealed ? (
          <div className="wheel-outcome-cards">
            {pickFive.map((u) => (
              <button key={u.id} type="button" className="wheel-outcome-card facedown" onClick={() => handlePick(u)}>
                <span className="wheel-outcome-hint-back">{hintMap[u.id] ?? '?'}</span>
              </button>
            ))}
          </div>
        ) : picked && (
          <div className="wheel-outcome-reveal-block">
            <div className="wheel-outcome-reveal">
              {picked.profilePicture ? (
                <img src={picked.profilePicture} alt={(picked as any).displayName || picked.name} className="wheel-outcome-avatar large" />
              ) : (
                <div className={`wheel-outcome-avatar large placeholder ${(picked as any).blurred ? 'celeb-blur' : ''}`}>{(picked as any).blurred ? '?' : picked.name.charAt(0)}</div>
              )}
              <p><strong>{(picked as any).goldStar && '⭐ '}{(picked as any).displayName || picked.name}</strong> {(picked as any).username ? `@${picked.username}` : ''}</p>
            </div>
            {!requestSent ? (
              <div className="wheel-outcome-actions">
                <button type="button" className="wheel-outcome-btn" onClick={handleSendRequest}>Send request</button>
                <button type="button" className="wheel-outcome-btn secondary" onClick={onClose}>Cancel</button>
              </div>
            ) : (
              <>
                <p className="wheel-outcome-msg">Request sent! When they accept you can chat in Communication.</p>
                {!showMissed ? (
                  <button type="button" className="wheel-outcome-btn" onClick={() => setShowMissed(true)}>See who you missed</button>
                ) : (
                  <div className="wheel-outcome-missed">
                    <p className="wheel-outcome-subtitle">The ones you missed</p>
                    <div className="wheel-outcome-missed-grid">
                      {pickFive.filter((u) => u.id !== picked.id).map((u) => (
                        <div key={u.id} className={`wheel-outcome-missed-card ${(u as any).blurred ? 'celeb-blurred' : ''}`}>
                          {u.profilePicture ? (
                            <img src={u.profilePicture} alt={(u as any).displayName || u.name} />
                          ) : (
                            <div className={`avatar-placeholder ${(u as any).blurred ? 'celeb-blur' : ''}`}>{(u as any).blurred ? '?' : u.name.charAt(0)}</div>
                          )}
                          <span>{(u as any).goldStar && '⭐ '}{(u as any).displayName || u.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <button type="button" className="wheel-outcome-btn" onClick={onClose}>Done</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
  return createPortal(content, document.body);
}

function CompatibilityRushFlow({ users, title = 'Compatibility Rush', onClose, onOpenChat }: { users: UserInfo[]; title?: string; onClose: () => void; onOpenChat: (id: string) => void }) {
  const [target] = useState<UserInfo | null>(() => users[0] || null);
  const [step, setStep] = useState<'calculating' | 'reveal'>('calculating');
  const [compatPercent, setCompatPercent] = useState(0);
  const [countdown, setCountdown] = useState(10);
  const [sent, setSent] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [finalPercent] = useState(() => 72 + Math.floor(Math.random() * 18));

  useEffect(() => {
    if (step !== 'calculating') return;
    const start = Date.now();
    const duration = 2200;
    const t = setInterval(() => {
      const elapsed = Date.now() - start;
      if (elapsed >= duration) {
        setCompatPercent(finalPercent);
        clearInterval(t);
        setStep('reveal');
        return;
      }
      setCompatPercent(Math.min(finalPercent, Math.floor((elapsed / duration) * finalPercent)));
    }, 80);
    return () => clearInterval(t);
  }, [step, finalPercent]);

  useEffect(() => {
    if (step !== 'reveal' || sent) return;
    const t = setInterval(() => setCountdown((c) => (c <= 0 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [step, sent]);

  if (!target) {
    return createPortal(
      <div className="wheel-outcome-overlay" onClick={onClose}>
        <div className="wheel-outcome-modal" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="wheel-outcome-close" onClick={onClose}>×</button>
          <p className="wheel-outcome-msg">No one in your area. Try again later!</p>
          <button type="button" className="wheel-outcome-btn" onClick={onClose}>OK</button>
        </div>
      </div>,
      document.body
    );
  }

  const handleYes = () => {
    if (!target) return;
    sendInterestOpenChat(target.id, onOpenChat)
      .then(({ mutual, message }) => {
        setResultMessage(interestResultMessage(mutual, message, target.name));
        setSent(true);
      })
      .catch((err: unknown) => {
        setResultMessage(formatAxiosError(err, 'Could not send interest — try again'));
        setSent(true);
      });
  };

  const handlePass = () => {
    if (target) markWheelUserActed(target.id);
    onClose();
  };

  const content = (
    <div className="wheel-outcome-overlay" onClick={onClose}>
      <div className="wheel-outcome-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="wheel-outcome-close" onClick={onClose}>×</button>
        <h3 className="wheel-outcome-title">{title}</h3>
        {step === 'calculating' && (
          <>
            <p className="wheel-outcome-msg">Calculating chemistry…</p>
            <div className="wheel-outcome-compat-bar">
              <div className="wheel-outcome-compat-fill" style={{ width: `${compatPercent}%` }} />
            </div>
            <p className="wheel-outcome-timer">{compatPercent}%</p>
          </>
        )}
        {step === 'reveal' && (
          <>
            <p className="wheel-outcome-msg">One person from your area — <strong>{finalPercent}% match!</strong> Decide before time runs out.</p>
            {!sent && countdown > 0 && <p className="wheel-outcome-countdown">⏱ {countdown}</p>}
            <div className="wheel-outcome-reveal">
              {target.profilePicture ? (
                <img src={target.profilePicture} alt={target.name} className="wheel-outcome-avatar" />
              ) : (
                <div className="wheel-outcome-avatar placeholder">{target.name.charAt(0)}</div>
              )}
              <p><strong>{target.name}</strong> @{target.username}</p>
            </div>
            {!sent ? (
              <div className="wheel-outcome-actions">
                <button type="button" className="wheel-outcome-btn" onClick={handleYes}>Yes, send request</button>
                <button type="button" className="wheel-outcome-btn secondary" onClick={handlePass}>Pass</button>
              </div>
            ) : (
              <>
                <p className="wheel-outcome-msg">{resultMessage || `Request sent! ${MATCH_24H_RULE}`}</p>
                <button type="button" className="wheel-outcome-btn" onClick={onClose}>OK</button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
  return createPortal(content, document.body);
}

const LUCKY_PEEK_HINTS = ['They have a dog 🐕', 'Total coffee addict ☕', 'Early bird, not night owl 🌅', 'Loves spontaneous road trips 🚗', 'Music is their love language 🎵', 'Thinks the best dates are low-key 🍕', 'Always has a book recommendation 📚'];

function LuckyLikeFlow({ users, title = 'Lucky Like', onClose, onOpenChat }: { users: UserInfo[]; title?: string; onClose: () => void; onOpenChat: (id: string) => void }) {
  const [target] = useState<UserInfo | null>(() => users[0] || null);
  const [peeked, setPeeked] = useState(false);
  const [peekHint] = useState(() => LUCKY_PEEK_HINTS[Math.floor(Math.random() * LUCKY_PEEK_HINTS.length)]);
  const [sent, setSent] = useState(false);
  const [passed, setPassed] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  const [loading, setLoading] = useState(false);

  if (!target) {
    return createPortal(
      <div className="wheel-outcome-overlay" onClick={onClose}>
        <div className="wheel-outcome-modal" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="wheel-outcome-close" onClick={onClose}>×</button>
          <p className="wheel-outcome-msg">No one in your area. Try again later!</p>
          <button type="button" className="wheel-outcome-btn" onClick={onClose}>OK</button>
        </div>
      </div>,
      document.body
    );
  }

  const handleLike = () => {
    if (!target || loading) return;
    setLoading(true);
    sendInterestOpenChat(target.id, onOpenChat)
      .then(({ mutual, message }) => {
        setResultMessage(interestResultMessage(mutual, message, target.name));
        setSent(true);
      })
      .catch((err: unknown) => {
        setResultMessage(formatAxiosError(err, 'Could not send interest — try again'));
        setSent(true);
      })
      .finally(() => setLoading(false));
  };

  const handlePass = () => {
    if (target) markWheelUserActed(target.id);
    setPassed(true);
  };

  const content = (
    <div className="wheel-outcome-overlay" onClick={onClose}>
      <div className="wheel-outcome-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="wheel-outcome-close" onClick={onClose}>×</button>
        <h3 className="wheel-outcome-title">{title}</h3>
        <p className="wheel-outcome-msg">One random profile — blurred. You get <strong>one peek</strong> at a hint, then Like or Pass.</p>
        <div className="wheel-outcome-reveal blurred">
          {target.profilePicture ? (
            <img src={target.profilePicture} alt="" className="wheel-outcome-avatar" style={{ filter: 'blur(12px)' }} />
          ) : (
            <div className="wheel-outcome-avatar placeholder">?</div>
          )}
          <p>???</p>
        </div>
        {!peeked ? (
          <button type="button" className="wheel-outcome-btn" onClick={() => setPeeked(true)}>🔍 Peek (one hint)</button>
        ) : (
          <>
            <div className="wheel-outcome-peek-hint">💡 {peekHint}</div>
            {!sent && !passed ? (
              <div className="wheel-outcome-actions">
                <button type="button" className="wheel-outcome-btn" disabled={loading} onClick={handleLike}>
                  {loading ? 'Sending…' : 'Like'}
                </button>
                <button type="button" className="wheel-outcome-btn secondary" disabled={loading} onClick={handlePass}>Pass</button>
              </div>
            ) : sent ? (
              <>
                <p className="wheel-outcome-msg">{resultMessage}</p>
                <button type="button" className="wheel-outcome-btn" onClick={onClose}>OK</button>
              </>
            ) : (
              <>
                <p className="wheel-outcome-msg">Passed. Spin again for another chance!</p>
                <button type="button" className="wheel-outcome-btn" onClick={onClose}>OK</button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
  return createPortal(content, document.body);
}

function SpeedPickFlow({ users, title = 'Speed Pick', onClose, onOpenChat }: { users: UserInfo[]; title?: string; onClose: () => void; onOpenChat: (id: string) => void }) {
  const three = users.slice(0, 3);
  const [countdown, setCountdown] = useState(5);
  const [picked, setPicked] = useState<UserInfo | null>(null);
  const [timeUp, setTimeUp] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (picked) return;
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(t);
          setTimeUp(true);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [picked]);

  useEffect(() => {
    if (!timeUp || picked) return;
    const random = three[Math.floor(Math.random() * 3)];
    setPicked(random);
  }, [timeUp, picked, three]);

  if (three.length < 3) {
    return createPortal(
      <div className="wheel-outcome-overlay" onClick={onClose}>
        <div className="wheel-outcome-modal" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="wheel-outcome-close" onClick={onClose}>×</button>
          <p className="wheel-outcome-msg">Not enough users. Try again later!</p>
          <button type="button" className="wheel-outcome-btn" onClick={onClose}>OK</button>
        </div>
      </div>,
      document.body
    );
  }

  const handlePick = (u: UserInfo) => {
    if (!picked) setPicked(u);
  };

  const handleSend = () => {
    if (!picked) return;
    sendInterestOpenChat(picked.id, onOpenChat).then(() => setSent(true)).catch(() => setSent(true));
  };

  const content = (
    <div className="wheel-outcome-overlay" onClick={onClose}>
      <div className="wheel-outcome-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="wheel-outcome-close" onClick={onClose}>×</button>
        <h3 className="wheel-outcome-title">{title}</h3>
        <p className="wheel-outcome-msg">They disappear in <strong>5 seconds</strong>! Pick one before time runs out — or we’ll pick for you.</p>
        {countdown > 0 && <p className="wheel-outcome-speed-timer">{countdown}</p>}
        {timeUp && !picked && <p className="wheel-outcome-msg">Picking for you…</p>}
        <div className={`wheel-outcome-cards horizontal ${countdown > 0 ? 'speed-disappear' : ''}`}>
          {three.map((u) => (
            <button
              key={u.id}
              type="button"
              className={`wheel-outcome-card ${picked?.id === u.id ? 'picked' : ''}`}
              onClick={() => handlePick(u)}
              disabled={!!picked}
            >
              {u.profilePicture ? (
                <img src={u.profilePicture} alt={u.name} />
              ) : (
                <div className="avatar-placeholder">{u.name.charAt(0)}</div>
              )}
              <span>{u.name}</span>
            </button>
          ))}
        </div>
        {picked && !sent && (
          <>
            <p className="wheel-outcome-msg">{timeUp ? `Time's up! We picked for you — it's ${picked.name}!` : `You picked ${picked.name}!`}</p>
            <div className="wheel-outcome-actions">
              <button type="button" className="wheel-outcome-btn" onClick={handleSend}>Send request to {picked.name}</button>
            </div>
          </>
        )}
        {sent && (
          <>
            <p className="wheel-outcome-msg">Request sent! When they accept you can chat in Communication.</p>
            <button type="button" className="wheel-outcome-btn" onClick={onClose}>OK</button>
          </>
        )}
      </div>
    </div>
  );
  return createPortal(content, document.body);
}

const MYSTERY_ONELINERS = [
  'The wheel chose you! 🎡',
  'Fate says we should chat. 💫',
  'Mystery admirer here — say hi? 👋',
  'Your turn to make the first move! ✨',
  'The universe picked you. No pressure. 😄',
  'Sending good vibes your way 🌟',
];

function MysteryMessageFlow({
  users,
  title = 'Mystery Message',
  onClose,
  onOpenChat,
}: {
  users: UserInfo[];
  title?: string;
  onClose: () => void;
  onOpenChat: (id: string) => void;
}) {
  const [target] = useState<UserInfo | null>(() => users[0] || null);
  const [customMessage, setCustomMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  if (!target) {
    return createPortal(
      <div className="wheel-outcome-overlay" onClick={onClose}>
        <div className="wheel-outcome-modal" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="wheel-outcome-close" onClick={onClose}>×</button>
          <p className="wheel-outcome-msg">No one in your area. Try again later!</p>
          <button type="button" className="wheel-outcome-btn" onClick={onClose}>OK</button>
        </div>
      </div>,
      document.body
    );
  }

  const handleSend = async () => {
    const text = customMessage.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await sendInterestOpenChat(target.id, onOpenChat);
      try {
        localStorage.setItem(`mystery:msg:${target.id}`, text);
      } catch {
        /* ignore */
      }
      setSent(true);
    } catch {
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  const content = (
    <div className="wheel-outcome-overlay" onClick={onClose}>
      <div className="wheel-outcome-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="wheel-outcome-close" onClick={onClose}>×</button>
        <h3 className="wheel-outcome-title">{title}</h3>
        <p className="wheel-outcome-msg">
          A random person in your area will get your request. Type the question or message you want answered — they’ll see it when you connect.
        </p>
        {!sent ? (
          <>
            <div className="wheel-outcome-reveal">
              <div className="wheel-outcome-avatar placeholder">?</div>
              <p>Someone in your area</p>
            </div>
            <label className="wheel-outcome-msg" style={{ display: 'block', textAlign: 'left', marginBottom: 6 }}>
              Your question / message
            </label>
            <textarea
              className="wheel-outcome-textarea"
              rows={4}
              maxLength={400}
              placeholder="e.g. What’s your ideal low-key first date — and why?"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
            />
            <p style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>{customMessage.length}/400</p>
            <p className="wheel-outcome-msg" style={{ marginTop: 10, marginBottom: 6 }}>Or tap a starter:</p>
            <div className="wheel-outcome-oneliner-list">
              {MYSTERY_ONELINERS.map((line) => (
                <button
                  key={line}
                  type="button"
                  className={`wheel-outcome-oneliner-btn ${customMessage === line ? 'selected' : ''}`}
                  onClick={() => setCustomMessage(line)}
                >
                  {line}
                </button>
              ))}
            </div>
            <div className="wheel-outcome-actions">
              <button type="button" className="wheel-outcome-btn" onClick={() => void handleSend()} disabled={!customMessage.trim() || sending}>
                {sending ? 'Sending…' : 'Send request'}
              </button>
              <button type="button" className="wheel-outcome-btn secondary" onClick={onClose}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <p className="wheel-outcome-msg">Request sent! When they accept you’ll see them in Communication.</p>
            <button type="button" className="wheel-outcome-btn" onClick={onClose}>OK</button>
          </>
        )}
      </div>
    </div>
  );
  return createPortal(content, document.body);
}
