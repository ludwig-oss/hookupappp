import { useState, useEffect, useCallback } from 'react';
import { relationshipAPI } from '../../api/relationship';
import { chatEngagementAPI, ChatChallenge } from '../../api/chatEngagement';

type Props = {
  partnerUserId: string;
  partnerName: string;
  userId: string;
  onSendMessage: (text: string) => void;
  onOpenGuides?: () => void;
};

const EMPTY_BOARD = Array(9).fill('');

function healthColor(level: string): string {
  if (level === 'great') return '#22c55e';
  if (level === 'good') return '#eab308';
  if (level === 'low') return '#f97316';
  return '#ef4444';
}

export default function RelationshipCouplePanel({
  partnerUserId,
  partnerName,
  userId,
  onSendMessage,
  onOpenGuides,
}: Props) {
  const [hub, setHub] = useState<Awaited<ReturnType<typeof relationshipAPI.getCoupleHub>> | null>(null);
  const [tab, setTab] = useState<'hub' | 'charge' | 'games' | 'watch'>('hub');
  const [xoChallenge, setXoChallenge] = useState<ChatChallenge | null>(null);
  const [board, setBoard] = useState<string[]>(EMPTY_BOARD);
  const [xoSymbol, setXoSymbol] = useState<'X' | 'O'>('X');
  const [watchUrl, setWatchUrl] = useState('');
  const [quizIdx, setQuizIdx] = useState(0);
  const [boostToast, setBoostToast] = useState<string | null>(null);

  const loadHub = useCallback(async () => {
    try {
      const data = await relationshipAPI.getCoupleHub(partnerUserId);
      setHub(data);
    } catch {
      setHub(null);
    }
  }, [partnerUserId]);

  useEffect(() => {
    loadHub();
    const t = setInterval(loadHub, 30000);
    return () => clearInterval(t);
  }, [loadHub]);

  useEffect(() => {
    chatEngagementAPI
      .getChallenges({ userId, otherUserId: partnerUserId })
      .then((r) => {
        const xo = r.challenges.find((c) => c.challengeType === 'xo' && c.status === 'active');
        if (xo) {
          setXoChallenge(xo);
          setBoard(xo.gameState?.board || EMPTY_BOARD);
          setXoSymbol(xo.gameState?.symbols?.[userId] || 'X');
        }
      })
      .catch(() => {});
  }, [userId, partnerUserId]);

  const showBoost = (msg: string) => {
    setBoostToast(msg);
    setTimeout(() => setBoostToast(null), 3500);
  };

  const applyBoost = async (activity: string, fallbackLabel?: string) => {
    if (!hub?.relationshipId) return;
    try {
      const res = await relationshipAPI.recordHealthBoost(hub.relationshipId, activity);
      showBoost(res.message || `+health from ${fallbackLabel || activity}`);
      setHub((prev) => (prev ? { ...prev, health: { ...prev.health, ...res.health } } : prev));
      await loadHub();
    } catch {
      if (fallbackLabel) showBoost(`Activity logged: ${fallbackLabel}`);
      loadHub();
    }
  };

  const startXo = async () => {
    const sym = Math.random() > 0.5 ? 'X' : 'O';
    const gameState = {
      board: EMPTY_BOARD,
      turn: userId,
      symbols: { [userId]: sym, [partnerUserId]: sym === 'X' ? 'O' : 'X' },
    };
    const { challenge } = await chatEngagementAPI.createChallenge({
      userId,
      otherUserId: partnerUserId,
      challengeType: 'xo',
      gameState,
    });
    setXoChallenge(challenge);
    setBoard(EMPTY_BOARD);
    setXoSymbol(sym);
    onSendMessage('🎮 I started Tic-Tac-Toe — your turn when ready!');
    await applyBoost('game_xo', 'Tic-Tac-Toe');
  };

  const playXo = async (idx: number) => {
    if (!xoChallenge || board[idx]) return;
    if (xoChallenge.gameState?.turn !== userId) return;
    const next = [...board];
    next[idx] = xoSymbol;
    const winner = checkWinner(next);
    const nextTurn = partnerUserId;
    const gameState = { ...xoChallenge.gameState, board: next, turn: winner ? null : nextTurn };
    const { challenge } = await chatEngagementAPI.updateChallenge({
      challengeId: xoChallenge.id,
      gameState,
      status: winner ? 'completed' : 'active',
      winner: winner === xoSymbol ? userId : winner ? partnerUserId : undefined,
    });
    setXoChallenge(challenge);
    setBoard(next);
    if (winner) {
      onSendMessage(winner === 'draw' ? '🎮 Tic-Tac-Toe draw!' : '🎮 Tic-Tac-Toe — game over!');
      if (winner !== 'draw') await applyBoost('game_xo', 'Game finished');
    }
  };

  const checkWinner = (b: string[]): string | null => {
    const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    for (const [a, c, d] of lines) {
      if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
    }
    if (b.every(Boolean)) return 'draw';
    return null;
  };

  const acceptBlindDate = async () => {
    if (!hub?.blindDate || !hub.relationshipId) return;
    await relationshipAPI.acceptBlindDate(hub.relationshipId, hub.blindDate);
    onSendMessage(`💑 Blind date idea: ${hub.blindDate} — want to do this together?`);
    await loadHub();
  };

  const sendSurpriseGift = async (idea: string, forPartner: boolean) => {
    onSendMessage(forPartner ? `🎁 Surprise for you: ${idea}` : `🎁 I am planning: ${idea}`);
    await applyBoost('surprise_gift', 'Surprise / gift');
  };

  const startWatchParty = async () => {
    if (!watchUrl.trim()) return;
    onSendMessage(`🎬 Watch together: ${watchUrl.trim()}`);
    await applyBoost('watch_together', 'Watch together');
  };

  const sendQuizAnswer = async (text: string) => {
    onSendMessage(text);
    await applyBoost('quiz', 'Couple quiz');
  };

  const runBondingActivity = async (activity: {
    id: string;
    messageTemplate: string;
    title: string;
  }) => {
    onSendMessage(activity.messageTemplate);
    await applyBoost(activity.id, activity.title);
  };

  const youtubeEmbed = (url: string) => {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : null;
  };

  if (!hub) return null;

  const extraGames = (hub.extraActivities || []).filter((a) => a.category === 'game');
  const extraBonding = (hub.extraActivities || []).filter((a) => a.category === 'bonding');

  const embed = watchUrl ? youtubeEmbed(watchUrl) : null;
  const health = hub.health as {
    score: number;
    baseScore?: number;
    boostPoints?: number;
    level: string;
    label: string;
    message: string;
    needsChargeUp: boolean;
    selfControlTip?: string | null;
    recentBoosts?: Array<{ label: string; points: number; createdAt: string }>;
  };

  return (
    <div className="relationship-couple-panel" style={{ marginBottom: 12, padding: 12, borderRadius: 12, background: 'rgba(236,72,153,0.08)', border: '1px solid rgba(236,72,153,0.25)' }}>
      {boostToast && (
        <div style={{ padding: 8, marginBottom: 8, background: 'rgba(34,197,94,0.2)', borderRadius: 8, fontSize: 12, color: '#86efac' }}>
          ⚡ {boostToast}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 4 }}>
        <strong style={{ color: '#fbcfe8' }}>💑 Couple space</strong>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {([
            ['hub', 'Health'],
            ['charge', 'Charge up'],
            ['games', 'Games'],
            ['watch', 'Watch'],
          ] as const).map(([t, label]) => (
            <button key={t} type="button" className="chat-back-btn" style={{ fontSize: 10, padding: '2px 8px', opacity: tab === t ? 1 : 0.6 }} onClick={() => setTab(t)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'hub' && (
        <>
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
              <span>Relationship health — {health.label}</span>
              <span>{health.score}%</span>
            </div>
            <div style={{ height: 12, borderRadius: 999, background: 'rgba(0,0,0,0.3)', overflow: 'hidden', position: 'relative' }}>
              {health.baseScore != null && health.boostPoints != null && health.boostPoints > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    height: '100%',
                    width: `${health.baseScore}%`,
                    background: 'rgba(255,255,255,0.15)',
                  }}
                />
              )}
              <div style={{ width: `${health.score}%`, height: '100%', background: healthColor(health.level), transition: 'width 0.6s ease' }} />
            </div>
            <p style={{ fontSize: 11, color: '#d1d5db', marginTop: 6 }}>{health.message}</p>
            {(health.boostPoints ?? 0) > 0 && (
              <p style={{ fontSize: 10, color: '#86efac', marginTop: 4 }}>
                +{health.boostPoints} from quizzes, gifts, games & watch parties this week
              </p>
            )}
            {health.recentBoosts && health.recentBoosts.length > 0 && (
              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 6 }}>
                Recent: {health.recentBoosts.slice(0, 3).map((b) => `${b.label} (+${b.points})`).join(' · ')}
              </div>
            )}
          </div>

          {health.selfControlTip && (
            <p style={{ fontSize: 11, padding: 8, background: 'rgba(0,0,0,0.25)', borderRadius: 8, marginBottom: 8 }}>
              🛡️ {health.selfControlTip}
            </p>
          )}

          {hub.blindDate && (
            <div style={{ padding: 8, background: 'rgba(0,0,0,0.2)', borderRadius: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: '#f472b6', marginBottom: 4 }}>🎭 Blind date (+14 health)</div>
              <p style={{ fontSize: 12 }}>{hub.blindDate}</p>
              <button type="button" className="chat-convo-use" style={{ marginTop: 6 }} onClick={acceptBlindDate}>
                Suggest to {partnerName}
              </button>
            </div>
          )}

          <div style={{ fontSize: 11, marginBottom: 8 }}>
            <div style={{ color: '#c4b5fd', marginBottom: 4 }}>🎁 Surprise ideas (+12 health when you send one)</div>
            <p><strong>You → partner:</strong> {hub.surprises.forPartner}</p>
            <button type="button" className="chat-convo-use" style={{ marginTop: 4, fontSize: 10 }} onClick={() => sendSurpriseGift(hub.surprises.forPartner, true)}>
              Send surprise idea
            </button>
            <p style={{ marginTop: 8 }}><strong>For you:</strong> {hub.surprises.forYou}</p>
          </div>

          {hub.suggestGuide && (
            <div style={{ padding: 8, background: 'rgba(59,130,246,0.15)', borderRadius: 8, fontSize: 11 }}>
              📚 {hub.guideMessage}
              {onOpenGuides && (
                <button type="button" className="chat-convo-use" style={{ marginLeft: 8 }} onClick={onOpenGuides}>
                  Find a guide
                </button>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'charge' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 11, color: '#d1d5db' }}>Each activity raises your health bar. Good convos charge up automatically too.</p>
          {(hub.bondingActivities || []).map((act) => (
            <button
              key={act.id}
              type="button"
              className="chat-back-btn"
              style={{ textAlign: 'left', padding: 10, fontSize: 12 }}
              onClick={() => runBondingActivity(act)}
            >
              <span style={{ marginRight: 6 }}>{act.emoji}</span>
              <strong>{act.title}</strong>
              <span style={{ display: 'block', fontSize: 10, color: '#9ca3af', marginTop: 4 }}>{act.prompt}</span>
            </button>
          ))}
          {extraBonding.length > 0 && (
            <>
              <p style={{ fontSize: 10, color: '#c4b5fd', marginTop: 4 }}>More ways to connect</p>
              {extraBonding.map((act) => (
                <button
                  key={act.id}
                  type="button"
                  className="chat-back-btn"
                  style={{ textAlign: 'left', padding: 10, fontSize: 12 }}
                  onClick={() => runBondingActivity(act)}
                >
                  <span style={{ marginRight: 6 }}>{act.emoji}</span>
                  <strong>{act.title}</strong>
                  <span style={{ display: 'block', fontSize: 10, color: '#9ca3af', marginTop: 4 }}>{act.prompt}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {tab === 'games' && (
        <div>
          <p style={{ fontSize: 11, marginBottom: 8 }}>Games add +7–12 health when you play together.</p>
          {!xoChallenge && (
            <button type="button" className="select-user-btn" style={{ width: '100%', marginBottom: 10, fontSize: 12 }} onClick={startXo}>
              ⭕ Tic-Tac-Toe (+12 health)
            </button>
          )}
          {xoChallenge && xoChallenge.status === 'active' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, maxWidth: 180, marginBottom: 10 }}>
              {board.map((cell, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => playXo(i)}
                  style={{ aspectRatio: '1', fontSize: 18, fontWeight: 700, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer' }}
                >
                  {cell}
                </button>
              ))}
            </div>
          )}
          {extraGames.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 10, color: '#c4b5fd', marginBottom: 6 }}>Quick couple games</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {extraGames.map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    className="chat-back-btn"
                    style={{ textAlign: 'left', padding: 8, fontSize: 11 }}
                    onClick={() => runBondingActivity(act)}
                  >
                    {act.emoji} <strong>{act.title}</strong>
                    <span style={{ display: 'block', fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{act.prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {hub.coupleQuiz[quizIdx] && (
            <div style={{ padding: 8, background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
              <p style={{ fontSize: 12, marginBottom: 6 }}>{hub.coupleQuiz[quizIdx].q}</p>
              <button type="button" className="chat-back-btn" style={{ marginRight: 6, fontSize: 11 }} onClick={() => sendQuizAnswer(`Quiz: ${hub.coupleQuiz[quizIdx].q} → I pick: ${hub.coupleQuiz[quizIdx].a}`)}>
                {hub.coupleQuiz[quizIdx].a}
              </button>
              <button type="button" className="chat-back-btn" style={{ fontSize: 11 }} onClick={() => sendQuizAnswer(`Quiz: ${hub.coupleQuiz[quizIdx].q} → I pick: ${hub.coupleQuiz[quizIdx].b}`)}>
                {hub.coupleQuiz[quizIdx].b}
              </button>
              <button type="button" className="chat-convo-use" style={{ marginLeft: 8, fontSize: 10 }} onClick={() => setQuizIdx((q) => (q + 1) % hub.coupleQuiz.length)}>
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'watch' && (
        <div>
          <p style={{ fontSize: 11, marginBottom: 6 }}>Watch together (+10 health) — like screen sharing.</p>
          <input
            type="url"
            value={watchUrl}
            onChange={(e) => setWatchUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            style={{ width: '100%', padding: 8, borderRadius: 8, marginBottom: 6, background: '#111827', color: '#fff', border: '1px solid #374151' }}
          />
          <button type="button" className="select-user-btn" style={{ width: '100%', fontSize: 12, marginBottom: 8 }} onClick={startWatchParty}>
            Send watch party link
          </button>
          {embed && (
            <iframe
              title="Watch together"
              src={embed}
              style={{ width: '100%', height: 180, border: 'none', borderRadius: 8 }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          )}
        </div>
      )}
    </div>
  );
}
