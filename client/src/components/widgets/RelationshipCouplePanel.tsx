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
  const [tab, setTab] = useState<'hub' | 'games' | 'watch'>('hub');
  const [xoChallenge, setXoChallenge] = useState<ChatChallenge | null>(null);
  const [board, setBoard] = useState<string[]>(EMPTY_BOARD);
  const [xoSymbol, setXoSymbol] = useState<'X' | 'O'>('X');
  const [watchUrl, setWatchUrl] = useState('');
  const [quizIdx, setQuizIdx] = useState(0);

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
    const t = setInterval(loadHub, 60000);
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
    onSendMessage(`🎮 I started Tic-Tac-Toe — your turn when ready!`);
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
    if (winner) onSendMessage(winner === 'draw' ? '🎮 Tic-Tac-Toe draw!' : '🎮 Tic-Tac-Toe — game over!');
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
    loadHub();
  };

  const startWatchParty = () => {
    if (!watchUrl.trim()) return;
    onSendMessage(`🎬 Watch together: ${watchUrl.trim()}`);
  };

  const youtubeEmbed = (url: string) => {
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : null;
  };

  if (!hub) return null;

  const embed = watchUrl ? youtubeEmbed(watchUrl) : null;

  return (
    <div className="relationship-couple-panel" style={{ marginBottom: 12, padding: 12, borderRadius: 12, background: 'rgba(236,72,153,0.08)', border: '1px solid rgba(236,72,153,0.25)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong style={{ color: '#fbcfe8' }}>💑 Couple space</strong>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['hub', 'games', 'watch'] as const).map((t) => (
            <button key={t} type="button" className="chat-back-btn" style={{ fontSize: 10, padding: '2px 8px', opacity: tab === t ? 1 : 0.6 }} onClick={() => setTab(t)}>
              {t === 'hub' ? 'Health' : t === 'games' ? 'Games' : 'Watch'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'hub' && (
        <>
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
              <span>Relationship health — {hub.health.label}</span>
              <span>{hub.health.score}%</span>
            </div>
            <div style={{ height: 10, borderRadius: 999, background: 'rgba(0,0,0,0.3)', overflow: 'hidden' }}>
              <div style={{ width: `${hub.health.score}%`, height: '100%', background: healthColor(hub.health.level), transition: 'width 0.4s' }} />
            </div>
            <p style={{ fontSize: 11, color: '#d1d5db', marginTop: 6 }}>{hub.health.message}</p>
            {hub.health.needsChargeUp && (
              <p style={{ fontSize: 11, color: '#fbbf24', marginTop: 4 }}>⚡ Charge up now — talk, plan a date, or play a game below.</p>
            )}
          </div>

          {hub.health.selfControlTip && (
            <p style={{ fontSize: 11, padding: 8, background: 'rgba(0,0,0,0.25)', borderRadius: 8, marginBottom: 8 }}>
              🛡️ {hub.health.selfControlTip}
            </p>
          )}

          {hub.blindDate && (
            <div style={{ padding: 8, background: 'rgba(0,0,0,0.2)', borderRadius: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: '#f472b6', marginBottom: 4 }}>🎭 Blind date (something new)</div>
              <p style={{ fontSize: 12 }}>{hub.blindDate}</p>
              <button type="button" className="chat-convo-use" style={{ marginTop: 6 }} onClick={acceptBlindDate}>
                Suggest to {partnerName}
              </button>
            </div>
          )}

          <div style={{ fontSize: 11, marginBottom: 8 }}>
            <div style={{ color: '#c4b5fd', marginBottom: 4 }}>🎁 Surprise ideas</div>
            <p><strong>You → partner:</strong> {hub.surprises.forPartner}</p>
            <p style={{ marginTop: 4 }}><strong>Partner → you:</strong> {hub.surprises.forYou}</p>
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

      {tab === 'games' && (
        <div>
          <p style={{ fontSize: 11, marginBottom: 8 }}>Play in chat — tap to connect when vibes are low.</p>
          {!xoChallenge && (
            <button type="button" className="select-user-btn" style={{ width: '100%', marginBottom: 10, fontSize: 12 }} onClick={startXo}>
              ⭕ Tic-Tac-Toe (X O)
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
          {hub.coupleQuiz[quizIdx] && (
            <div style={{ padding: 8, background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
              <p style={{ fontSize: 12, marginBottom: 6 }}>{hub.coupleQuiz[quizIdx].q}</p>
              <button type="button" className="chat-back-btn" style={{ marginRight: 6, fontSize: 11 }} onClick={() => onSendMessage(`Quiz: ${hub.coupleQuiz[quizIdx].q} → I pick: ${hub.coupleQuiz[quizIdx].a}`)}>
                {hub.coupleQuiz[quizIdx].a}
              </button>
              <button type="button" className="chat-back-btn" style={{ fontSize: 11 }} onClick={() => onSendMessage(`Quiz: ${hub.coupleQuiz[quizIdx].q} → I pick: ${hub.coupleQuiz[quizIdx].b}`)}>
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
          <p style={{ fontSize: 11, marginBottom: 6 }}>Paste a YouTube link — watch together like screen share.</p>
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
