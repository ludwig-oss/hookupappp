import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { activityAPI } from '../../api/activity';
import { openChatWithUser } from '../../lib/openChat';
import { markWheelUserActed } from '../../lib/wheelEncounter';
import type { WheelGame } from '../../data/wheelGames';
import './WheelOutcomeFlow.css';

type UserInfo = {
  id: string;
  name: string;
  username: string;
  profilePicture: string | null;
  blurred?: boolean;
  displayName?: string;
};

type ChatLine = { who: 'them' | 'you' | 'system'; text: string; imageUrl?: string };

const MATCH_24H =
  'Reply within 24 hours after each message or the match ends.';

const THEIR_LINES = [
  'Okay so what’s your idea of a perfect Saturday?',
  'Be honest — coffee date or night walk?',
  'What’s one thing people always get wrong about you?',
  'If we matched for real, what would you text first?',
  'Pineapple on pizza: yes or war crime?',
];

const PREDICTIVE_POOL = [
  'honestly', 'coffee', 'sounds', 'perfect', 'maybe', 'walk',
  'tonight', 'vibes', 'with', 'you', 'okay', 'let', 'us',
  'try', 'something', 'fun', 'i', 'think', 'we', 'should',
];

const GIF_PACKS: Record<string, string[]> = {
  laugh: ['😂😂😂', '🤣💀', 'HAHA gif', 'crying laughing cat'],
  flirty: ['😏✨', 'heart eyes gif', 'wink kiss', 'butterflies'],
  confused: ['🤔❓', 'confused blink', 'wait what', 'loading brain'],
  hype: ['🔥🔥🔥', 'lets gooo', 'airhorn gif', 'standing ovation'],
};

function lastWord(s: string): string {
  const m = s.trim().toLowerCase().match(/[a-z']+(?=[^a-z']*$)/i);
  return m?.[0] || '';
}

function roughRhyme(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const ta = a.slice(-3);
  const tb = b.slice(-3);
  if (ta.length >= 2 && tb.endsWith(ta.slice(-2))) return true;
  return a.slice(-2) === b.slice(-2);
}

function onlyEmojis(s: string): boolean {
  const stripped = s.replace(/\s/g, '');
  if (!stripped) return false;
  // Allow emoji + a few symbols; reject latin letters/digits
  return !/[A-Za-z0-9]/.test(stripped);
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

async function winToCommunications(
  toUserId: string,
  onOpenChat?: (userId: string) => void
): Promise<{ mutual: boolean; message: string }> {
  if (toUserId.startsWith('wheel_fill_')) {
    return {
      mutual: true,
      message: `Challenge cleared — you’re in Communications (demo match). ${MATCH_24H}`,
    };
  }
  const res = await activityAPI.sendInterest(toUserId);
  markWheelUserActed(toUserId);
  const chatId = (res as { chatUserId?: string }).chatUserId;
  const mutual = Boolean((res as { openChat?: boolean; mutual?: boolean }).openChat);
  if (chatId) {
    openChatWithUser(chatId);
    onOpenChat?.(chatId);
  }
  return {
    mutual,
    message: mutual
      ? `${(res as { message?: string }).message || "It's a match!"} You're in Communications — ${MATCH_24H}`
      : `Interest sent! When they say yes you’ll both land in Communications. ${MATCH_24H}`,
  };
}

type ChallengeDef = {
  rules: string;
  rounds: number;
  theirOpener: string;
  validate: (input: string, ctx: ChallengeCtx) => string | null;
  transform?: (input: string, ctx: ChallengeCtx) => string;
  inputMode: 'text' | 'predictive' | 'gif' | 'image' | 'letter_spin';
  placeholder?: string;
};

type ChallengeCtx = {
  bannedLetter: string;
  lastTheir: string;
  round: number;
};

function defFor(id: string): ChallengeDef {
  const base = THEIR_LINES[Math.floor(Math.random() * THEIR_LINES.length)];
  switch (id) {
    case 'predictive_text':
      return {
        rules: 'Build 3 messages using the predictive word buttons. Tap any suggested word, then Send.',
        rounds: 3,
        theirOpener: base,
        inputMode: 'predictive',
        validate: (input) => (wordCount(input) < 2 ? 'Need at least 2 predictive words in the sentence.' : null),
      };
    case 'one_word':
      return {
        rules: 'Exactly ONE word per message. Survive 4 replies.',
        rounds: 4,
        theirOpener: base,
        inputMode: 'text',
        placeholder: 'one word…',
        validate: (input) => (wordCount(input) === 1 ? null : 'Exactly one word.'),
      };
    case 'gif_roulette':
      return {
        rules: 'No typing. Answer using only the FIRST GIF that pops up for your reaction search.',
        rounds: 3,
        theirOpener: base,
        inputMode: 'gif',
        validate: (input) => (input ? null : 'Pick a GIF.'),
      };
    case 'rhyme_crime':
      return {
        rules: 'Every reply must rhyme with their last message. Break the chain = lose.',
        rounds: 3,
        theirOpener: 'I’m free Friday night if the vibe is right.',
        inputMode: 'text',
        placeholder: 'rhyme with their last word…',
        validate: (input, ctx) =>
          roughRhyme(lastWord(input), lastWord(ctx.lastTheir))
            ? null
            : `Must rhyme with “${lastWord(ctx.lastTheir)}”.`,
      };
    case 'job_interviewer':
      return {
        rules: 'You are HR. Every message must sound like a corporate hiring interview.',
        rounds: 3,
        theirOpener: 'Uh… so like, what are we doing here?',
        inputMode: 'text',
        placeholder: 'Thank you for your application…',
        validate: (input) =>
          /thank you|application|weakness|experience|role|partnership|candidate|interview|hire|position/i.test(input)
            ? null
            : 'Make it corporate (application / weakness / partnership / hire…).',
      };
    case 'cryptic_riddle':
      return {
        rules: 'No straight answers. Every response must be a vague riddle or deep question.',
        rounds: 3,
        theirOpener: base,
        inputMode: 'text',
        placeholder: 'What is the sound of…?',
        validate: (input) => (/\?/.test(input) || /riddle|shadow|echo|mirror|silence/i.test(input)
          ? null
          : 'Needs a riddle or a question (?).'),
      };
    case 'reality_villain':
      return {
        rules: 'Act like a dating-show villain. Narrate strategy + whisper to camera.',
        rounds: 3,
        theirOpener: 'So… are you here for the right reasons?',
        inputMode: 'text',
        placeholder: '(to camera: …) my strategy is…',
        validate: (input) =>
          /to camera|strategy|rose|villa|connection|blind|bachelor|whisper/i.test(input)
            ? null
            : 'Include strategy / (to camera) / rose / villa energy.',
      };
    case 'emoji_only':
      return {
        rules: 'Banned from words. Reply with emojis only.',
        rounds: 4,
        theirOpener: base,
        inputMode: 'text',
        placeholder: '😎🔥💬',
        validate: (input) => (onlyEmojis(input) ? null : 'Emojis only — no letters or numbers.'),
      };
    case 'hardcore_detective':
      return {
        rules: 'Treat everything like a crime investigation. Dig for clues.',
        rounds: 3,
        theirOpener: 'I love pizza and long walks, nothing suspicious.',
        inputMode: 'text',
        placeholder: 'Interesting… your profile says…',
        validate: (input) =>
          /interesting|clue|alibi|hiding|profile|claim|suspect|case|evidence/i.test(input)
            ? null
            : 'Sound like a detective (Interesting… / clue / hiding…).',
      };
    case 'letter_ban':
      return {
        rules: 'A letter gets banned. You cannot use it for 5 messages.',
        rounds: 5,
        theirOpener: base,
        inputMode: 'letter_spin',
        placeholder: 'type without the banned letter…',
        validate: (input, ctx) => {
          if (!ctx.bannedLetter) return 'Spin a letter first.';
          const re = new RegExp(ctx.bannedLetter, 'i');
          return re.test(input) ? `Banned letter “${ctx.bannedLetter.toUpperCase()}” found.` : null;
        },
      };
    case 'no_context_image':
      return {
        rules: 'Take or pick a real photo. Send it with zero explanation. Refuse to explain.',
        rounds: 2,
        theirOpener: 'Okay send me something fun?',
        inputMode: 'image',
        validate: (input) => (input ? null : 'Send a real photo.'),
      };
    case 'blind_compliment':
      return {
        rules: 'Compliment something incredibly specific & bizarre about their pics.',
        rounds: 2,
        theirOpener: 'Do you like my photos or…?',
        inputMode: 'text',
        placeholder: 'The lighting on your left elbow in pic 3…',
        validate: (input) =>
          /elbow|lighting|pic|photo|pixel|shadow|ear|collar|background|thumb|knee|sock/i.test(input)
            ? null
            : 'Get weirdly specific (elbow / lighting / pic 3 / background…).',
      };
    case 'caps_lock_chaos':
      return {
        rules: 'EVERY MESSAGE MUST BE ALL CAPS.',
        rounds: 3,
        theirOpener: base,
        inputMode: 'text',
        placeholder: 'YELL YOUR VIBES',
        validate: (input) => {
          const letters = input.replace(/[^A-Za-z]/g, '');
          if (!letters) return 'Need some letters.';
          return letters === letters.toUpperCase() ? null : 'ALL CAPS only.';
        },
      };
    case 'question_only':
      return {
        rules: 'You may only reply with another question.',
        rounds: 3,
        theirOpener: base,
        inputMode: 'text',
        placeholder: 'But what if…?',
        validate: (input) => (/\?\s*$/.test(input.trim()) ? null : 'Must end with a question mark.'),
      };
    case 'opposite_day':
      return {
        rules: 'Say the opposite of what you mean. Survive 3 rounds.',
        rounds: 3,
        theirOpener: 'Wanna hang this weekend?',
        inputMode: 'text',
        placeholder: 'Absolutely not, weekends are illegal…',
        validate: (input) => (wordCount(input) >= 3 ? null : 'At least 3 words of opposite energy.'),
      };
    case 'seven_word_max':
      return {
        rules: 'Hard cap: 7 words maximum per message.',
        rounds: 4,
        theirOpener: base,
        inputMode: 'text',
        placeholder: 'seven words max here…',
        validate: (input) => {
          const n = wordCount(input);
          if (n < 1) return 'Say something.';
          return n <= 7 ? null : `${n} words — max is 7.`;
        },
      };
    case 'soft_roast':
      return {
        rules: 'Soft roast them, then save it with a compliment in the same message.',
        rounds: 2,
        theirOpener: 'Rate my vibe honestly.',
        inputMode: 'text',
        placeholder: 'Your bio is chaotic… but somehow charming.',
        validate: (input) =>
          /but|however|still|also|yet/i.test(input) && wordCount(input) >= 5
            ? null
            : 'Need a roast + save (use but/however/still…).',
      };
    case 'future_ex':
      return {
        rules: 'Joke-predict a “future breakup reason”, then pitch why you’d still match.',
        rounds: 2,
        theirOpener: 'Where do you see us in five years?',
        inputMode: 'text',
        placeholder: 'We’ll break up over playlists… but I’d still match because…',
        validate: (input) =>
          /break|dump|leave|split|because|still|match/i.test(input)
            ? null
            : 'Include a breakup forecast AND why you’d still match.',
      };
    default:
      return {
        rules: 'Complete the challenge rounds without breaking the rule.',
        rounds: 3,
        theirOpener: base,
        inputMode: 'text',
        validate: (input) => (input.trim() ? null : 'Type a reply.'),
      };
  }
}

export default function ChatChallengeFlow({
  game,
  users,
  onClose,
  onOpenChat,
}: {
  game: WheelGame;
  users: UserInfo[];
  onClose: () => void;
  onOpenChat: (id: string) => void;
}) {
  const match = users[0] || null;
  const def = useMemo(() => defFor(game.id), [game.id]);
  const [phase, setPhase] = useState<'intro' | 'play' | 'won' | 'lost' | 'sending' | 'done'>('intro');
  const [round, setRound] = useState(0);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState('');
  const [bannedLetter, setBannedLetter] = useState('');
  const [predLeft, setPredLeft] = useState(() => PREDICTIVE_POOL[0]);
  const [predMid, setPredMid] = useState(() => PREDICTIVE_POOL[1]);
  const [predRight, setPredRight] = useState(() => PREDICTIVE_POOL[2]);
  const [gifKey, setGifKey] = useState<keyof typeof GIF_PACKS>('laugh');
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  if (!match) {
    return createPortal(
      <div className="wheel-outcome-overlay" onClick={onClose}>
        <div className="wheel-outcome-modal" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="wheel-outcome-close" onClick={onClose}>×</button>
          <p className="wheel-outcome-msg">No one nearby to challenge. Spin again.</p>
          <button type="button" className="wheel-outcome-btn" onClick={onClose}>OK</button>
        </div>
      </div>,
      document.body
    );
  }

  const ctx: ChallengeCtx = {
    bannedLetter,
    lastTheir: [...chat].reverse().find((c) => c.who === 'them')?.text || def.theirOpener,
    round,
  };

  const startPlay = () => {
    setChat([{ who: 'them', text: def.theirOpener }]);
    setRound(0);
    setDraft('');
    setError(null);
    setPhase('play');
    if (game.id === 'letter_ban' && !bannedLetter) {
      /* wait for spin */
    }
  };

  const spinLetter = () => {
    const letters = 'AEIOUSTRN';
    const L = letters[Math.floor(Math.random() * letters.length)];
    setBannedLetter(L);
    setChat((c) => [...c, { who: 'system', text: `Banned letter: ${L}` }]);
  };

  const rollPredictive = () => {
    const shuffle = [...PREDICTIVE_POOL].sort(() => Math.random() - 0.5);
    setPredLeft(shuffle[0]);
    setPredMid(shuffle[1]);
    setPredRight(shuffle[2]);
  };

  const tapPredictive = (word: string) => {
    setDraft((d) => (d ? `${d} ${word}` : word));
    rollPredictive();
  };

  const submitPhoto = (file: File | null | undefined) => {
    if (!file || !file.type.startsWith('image/')) {
      setError('Pick or take a real photo.');
      return;
    }
    const imageUrl = URL.createObjectURL(file);
    const caption = '📷 (no context. not explaining.)';
    const fail = def.validate(caption, ctx);
    if (fail) {
      URL.revokeObjectURL(imageUrl);
      setError(fail);
      setPhase('lost');
      return;
    }
    const nextRound = round + 1;
    const theirFollow = THEIR_LINES[(nextRound + 1) % THEIR_LINES.length];
    setChat((c) => {
      const lines: ChatLine[] = [...c, { who: 'you', text: caption, imageUrl }];
      if (nextRound < def.rounds) lines.push({ who: 'them', text: theirFollow });
      return lines;
    });
    setError(null);
    setRound(nextRound);
    if (nextRound >= def.rounds) setPhase('won');
  };

  const submitReply = (raw: string) => {
    const input = raw.trim();
    if (game.id === 'letter_ban' && !bannedLetter) {
      setError('Spin the letter ban first.');
      return;
    }
    const fail = def.validate(input, ctx);
    if (fail) {
      setError(fail);
      setPhase('lost');
      setChat((c) => [...c, { who: 'you', text: input || '(empty)' }, { who: 'system', text: `Rule broken: ${fail}` }]);
      return;
    }
    const shown = def.transform ? def.transform(input, ctx) : input;
    const nextRound = round + 1;
    const theirFollow =
      THEIR_LINES[(nextRound + 1) % THEIR_LINES.length];
    setChat((c) => {
      const lines: ChatLine[] = [...c, { who: 'you', text: shown }];
      if (nextRound < def.rounds) lines.push({ who: 'them', text: theirFollow });
      return lines;
    });
    setDraft('');
    setError(null);
    setRound(nextRound);
    if (nextRound >= def.rounds) {
      setPhase('won');
    }
  };

  const claimWin = () => {
    setPhase('sending');
    winToCommunications(match.id, onOpenChat)
      .then((r) => {
        setResultMsg(r.message);
        setPhase('done');
      })
      .catch(() => {
        setResultMsg(`Challenge cleared — connection request queued. ${MATCH_24H}`);
        setPhase('done');
      });
  };

  const displayName = (match as UserInfo & { displayName?: string }).displayName || match.name;

  return createPortal(
    <div className="wheel-outcome-overlay" onClick={onClose}>
      <div className="wheel-outcome-modal chat-challenge" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="wheel-outcome-close" onClick={onClose} aria-label="Close">×</button>
        <h3 className="wheel-outcome-title">{game.name}</h3>

        {phase === 'intro' && (
          <>
            <p className="wheel-outcome-msg">{game.blurb}</p>
            <p className="wheel-outcome-msg" style={{ opacity: 0.9 }}>{def.rules}</p>
            <p className="wheel-outcome-msg">
              Clear all {def.rounds} rounds → they get added to <strong>Communications</strong>.
            </p>
            <div className="wheel-outcome-reveal" style={{ marginBottom: 12 }}>
              {match.profilePicture ? (
                <img src={match.profilePicture} alt="" className="wheel-outcome-avatar" style={{ filter: 'blur(10px)' }} />
              ) : (
                <div className="wheel-outcome-avatar placeholder wheel-name-blurred">?</div>
              )}
              <p className="wheel-name-blurred">{displayName}</p>
            </div>
            <button type="button" className="wheel-outcome-btn" onClick={startPlay}>Start challenge</button>
          </>
        )}

        {(phase === 'play' || phase === 'won' || phase === 'lost') && (
          <>
            <p className="wheel-outcome-msg" style={{ fontSize: '0.85rem' }}>
              Round {Math.min(round + 1, def.rounds)}/{def.rounds}
              {bannedLetter ? ` · Banned: ${bannedLetter}` : ''}
            </p>
            <div className="challenge-chat">
              {chat.map((line, i) => (
                <div key={i} className={`challenge-bubble ${line.who}`}>
                  {line.who === 'them' ? 'Them: ' : line.who === 'you' ? 'You: ' : ''}
                  {line.text}
                  {line.imageUrl ? (
                    <img src={line.imageUrl} alt="" className="challenge-photo" />
                  ) : null}
                </div>
              ))}
            </div>

            {phase === 'play' && (
              <div className="challenge-controls">
                {def.inputMode === 'letter_spin' && !bannedLetter && (
                  <button type="button" className="wheel-outcome-btn" onClick={spinLetter}>
                    Spin banned letter
                  </button>
                )}

                {def.inputMode === 'predictive' && (
                  <>
                    <div className="predictive-row">
                      <button type="button" className="pred-btn" onClick={() => tapPredictive(predLeft)}>
                        {predLeft}
                      </button>
                      <button type="button" className="pred-btn mid" onClick={() => tapPredictive(predMid)}>
                        {predMid}
                      </button>
                      <button type="button" className="pred-btn" onClick={() => tapPredictive(predRight)}>
                        {predRight}
                      </button>
                    </div>
                    <p className="wheel-outcome-msg" style={{ fontSize: '0.8rem' }}>
                      Tap any word to build your line, then Send.
                    </p>
                    <p className="challenge-draft">{draft || '…'}</p>
                    <div className="wheel-outcome-actions">
                      <button type="button" className="wheel-outcome-btn" disabled={!draft} onClick={() => submitReply(draft)}>
                        Send message
                      </button>
                      <button type="button" className="wheel-outcome-btn secondary" onClick={() => setDraft('')}>
                        Clear
                      </button>
                    </div>
                  </>
                )}

                {def.inputMode === 'gif' && (
                  <>
                    <div className="wheel-outcome-actions" style={{ flexWrap: 'wrap' }}>
                      {(Object.keys(GIF_PACKS) as (keyof typeof GIF_PACKS)[]).map((k) => (
                        <button key={k} type="button" className="wheel-outcome-btn secondary" onClick={() => setGifKey(k)}>
                          Search: {k}
                        </button>
                      ))}
                    </div>
                    <p className="wheel-outcome-msg">First GIF that popped:</p>
                    <button
                      type="button"
                      className="wheel-outcome-btn"
                      onClick={() => submitReply(GIF_PACKS[gifKey][0])}
                    >
                      Send “{GIF_PACKS[gifKey][0]}”
                    </button>
                  </>
                )}

                {def.inputMode === 'image' && (
                  <div className="wheel-outcome-actions" style={{ flexDirection: 'column', gap: 10 }}>
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      hidden
                      onChange={(e) => {
                        submitPhoto(e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                    <input
                      ref={galleryInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => {
                        submitPhoto(e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                    <button type="button" className="wheel-outcome-btn" onClick={() => cameraInputRef.current?.click()}>
                      Take photo
                    </button>
                    <button type="button" className="wheel-outcome-btn secondary" onClick={() => galleryInputRef.current?.click()}>
                      Choose from gallery
                    </button>
                    <p className="wheel-outcome-msg" style={{ fontSize: '0.8rem' }}>
                      Real camera or gallery. Send it. Do not explain it.
                    </p>
                  </div>
                )}

                {(def.inputMode === 'text' || def.inputMode === 'letter_spin') && (def.inputMode !== 'letter_spin' || bannedLetter) && (
                  <>
                    <textarea
                      className="challenge-input"
                      rows={3}
                      value={draft}
                      placeholder={def.placeholder}
                      onChange={(e) => setDraft(e.target.value)}
                    />
                    <button type="button" className="wheel-outcome-btn" onClick={() => submitReply(draft)}>
                      Send
                    </button>
                  </>
                )}
                {error && <p className="wheel-outcome-msg" style={{ color: '#fca5a5' }}>{error}</p>}
              </div>
            )}

            {phase === 'won' && (
              <>
                <p className="wheel-outcome-msg">You cleared the challenge.</p>
                <div className="wheel-outcome-actions">
                  <button type="button" className="wheel-outcome-btn" onClick={claimWin}>
                    Add to Communications
                  </button>
                  <button type="button" className="wheel-outcome-btn secondary" onClick={onClose}>Pass</button>
                </div>
              </>
            )}

            {phase === 'lost' && (
              <>
                <p className="wheel-outcome-msg" style={{ color: '#fca5a5' }}>Challenge failed. Spin again for another game.</p>
                <button type="button" className="wheel-outcome-btn" onClick={onClose}>OK</button>
              </>
            )}
          </>
        )}

        {phase === 'sending' && <p className="wheel-outcome-loading">Adding to Communications…</p>}

        {phase === 'done' && (
          <>
            <p className="wheel-outcome-msg">{resultMsg}</p>
            <button type="button" className="wheel-outcome-btn" onClick={onClose}>Done</button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
