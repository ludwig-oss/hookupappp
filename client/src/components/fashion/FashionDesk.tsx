import { useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import type { AiGuideCharacter } from '../../api/aiGuides';
import {
  fashionAPI,
  type FashionLookCard,
  type FashionStyleResponse,
  type PieceSlot,
  type WardrobeItem,
} from '../../api/fashion';
import { speakGuideLine, speechLangFor } from '../../lib/aiGuideSpeech';
import { checkFaceInPhoto } from '../../lib/fashionFaceCheck';
import { prepareAndUploadFile } from '../../lib/uploadMedia';
import { restoredRecordsForEmail } from '../../lib/googleAuthSession';
import ClosetInterface from '../closet/ClosetInterface';
import ChersWardrobe from '../closet/ChersWardrobe';
import './FashionDesk.css';

function stripRoleplay(text: string) {
  return text.replace(/\*[^*]+\*/g, ' ').replace(/\s+/g, ' ').trim();
}

function speakLine(guide: AiGuideCharacter, text: string, onStart: () => void, onEnd: () => void) {
  void speakGuideLine(guide.voice, stripRoleplay(text), onStart, onEnd);
}

function getSpeechCtor(): (new () => SpeechRec) | null {
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

export default function FashionDesk({
  guide,
  stylists,
  onPickStylist,
  onClose,
  onSpeaking,
}: {
  guide: AiGuideCharacter;
  stylists?: AiGuideCharacter[];
  onPickStylist?: (g: AiGuideCharacter) => void;
  onClose: () => void;
  onSpeaking: (on: boolean) => void;
}) {
  const { user } = useContext(AuthContext);
  const first = guide.name.split(' ')[0];
  const opener =
    guide.charStyle?.actionCue && guide.charStyle.catchphrases[0]
      ? `${guide.charStyle.catchphrases[0]}. What are we dressing for? First date, dinner, club, brunch — talk or type it.`
      : guide.id === 'elena'
        ? 'What are we dressing for? First date, dinner, club, brunch — talk or type it.'
        : `What do you need to wear? Tell me the event. I will help you pick. ${first} is on the call.`;
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<FashionStyleResponse | null>(null);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [tab, setTab] = useState<'compare' | 'wardrobe' | 'drafts' | 'closet'>('closet');
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [drafts, setDrafts] = useState<WardrobeItem[]>([]);
  const [pieces, setPieces] = useState<WardrobeItem[]>([]);
  const [group, setGroup] = useState('Saved looks');
  const [faceUrl, setFaceUrl] = useState<string | null>(
    typeof user?.profilePicture === 'string' ? user.profilePicture : null
  );
  const [bodyUrl, setBodyUrl] = useState<string | null>(() => {
    try {
      const stored = localStorage.getItem('fashion-body-url') || '';
      return stored.startsWith('http') ? stored : null;
    } catch {
      return null;
    }
  });
  const profileGender = String((user as { gender?: string } | null)?.gender || '').toLowerCase();
  const closetGender = profileGender === 'female' || profileGender === 'woman' ? 'fem' : 'masc';
  const [weekPlan, setWeekPlan] = useState<'ask' | 'yes' | 'no' | 'later'>(() => {
    try {
      const raw = localStorage.getItem('fashion-week-plan');
      if (raw === 'yes' || raw === 'no' || raw === 'later') return raw;
    } catch {
      /* */
    }
    return 'ask';
  });
  const [weekNote, setWeekNote] = useState('');
  const [faceOk, setFaceOk] = useState<boolean | null>(null);
  const [faceNote, setFaceNote] = useState('Checking for a clear face…');
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadSlot, setUploadSlot] = useState<PieceSlot>('top');
  const [uploadWorn, setUploadWorn] = useState(true);
  const [uploading, setUploading] = useState(false);
  const recRef = useRef<{ stop: () => void } | null>(null);
  const lastSpokenGuide = useRef<string | null>(null);
  const faceInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRef = useRef<HTMLInputElement>(null);
  const closetInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (lastSpokenGuide.current === guide.id) return;
    lastSpokenGuide.current = guide.id;
    speakLine(guide, opener, () => onSpeaking(true), () => onSpeaking(false));
  }, [guide, opener, onSpeaking]);

  const applyWardrobeItems = (items: WardrobeItem[]) => {
    setWardrobe(items.filter((i) => i.kind !== 'piece' && i.kind !== 'draft' && !i.group.toLowerCase().includes('draft')));
    setDrafts(items.filter((i) => i.kind === 'draft' || i.group.toLowerCase().includes('draft')));
    setPieces(items.filter((i) => i.kind === 'piece'));
    const groups = [...new Set(items.map((i) => i.group).filter(Boolean))];
    if (groups[0]) setGroup(groups[0]);
  };

  const loadWardrobe = async () => {
    const email = String(user?.email || '');
    try {
      const r = await fashionAPI.wardrobe();
      if (r.items?.length) {
        setWardrobe(r.looks?.length ? r.looks : r.items.filter((i) => i.kind !== 'piece' && i.kind !== 'draft'));
        setDrafts(r.drafts || r.items.filter((i) => i.kind === 'draft' || i.group.toLowerCase().includes('draft')));
        setPieces(r.pieces || r.items.filter((i) => i.kind === 'piece'));
        if (r.groups[0]) setGroup(r.groups[0]);
        return;
      }
    } catch {
      /* fall through to the device closet */
    }
    if (!email) return;
    const saved = await restoredRecordsForEmail(email);
    if (saved?.wardrobe.length) applyWardrobeItems(saved.wardrobe);
  };

  useEffect(() => {
    void loadWardrobe();
  }, [user?.email]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const check = await checkFaceInPhoto(faceUrl);
      if (cancelled) return;
      setFaceOk(check.ok);
      setFaceNote(
        check.ok
          ? bodyUrl
            ? 'Face and body photos are ready. Press DRESS ME.'
            : 'Face photo saved. Upload a full-body photo, then press DRESS ME.'
          : check.reason || 'Upload a clear face photo, plus a full-body photo for try-on.'
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [faceUrl]);

  const runStyle = async (
    text: string,
    opts?: { shuffle?: boolean; mixWardrobe?: boolean; exclude?: string[] }
  ) => {
    const q = text.trim();
    if (q.length < 2) return;
    setBusy(true);
    setError('');
    setChosenId(null);
    try {
      const exclude = opts?.exclude || seenIds;
      const r = await fashionAPI.style(q, guide.id, {
        excludeLookIds: exclude,
        shuffle: Boolean(opts?.shuffle),
        mixWardrobe: Boolean(opts?.mixWardrobe),
      });
      setResult(r);
      setTab('compare');
      setSeenIds((prev) => [...new Set([...prev, r.optionA.id, r.optionB.id])].slice(-24));
      setBusy(false);
      speakLine(guide, r.critic.line, () => onSpeaking(true), () => onSpeaking(false));
      const person = faceUrl || r.personUrl;
      if (person) setFaceUrl(person);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Could not read that. Try “first date tomorrow night”.');
    } finally {
      setBusy(false);
    }
  };

  const startVoice = () => {
    const Ctor = getSpeechCtor();
    if (!Ctor) {
      setError('Voice notes need a browser that can transcribe (Chrome or Edge). You can still type.');
      return;
    }
    const rec = new Ctor();
    rec.lang = speechLangFor();
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (ev) => {
      const parts: string[] = [];
      for (let i = 0; i < ev.results.length; i += 1) {
        const t = ev.results[i]?.[0]?.transcript;
        if (t) parts.push(t);
      }
      const line = parts.join(' ').trim();
      if (line) setPrompt(line);
    };
    rec.onerror = () => {
      setListening(false);
      recRef.current = null;
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      setPrompt((prev) => {
        if (prev.trim().length > 1) void runStyle(prev);
        return prev;
      });
    };
    recRef.current = rec;
    setListening(true);
    setError('');
    rec.start();
  };

  const stopVoice = () => {
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
  };

  const saveLook = async (look: FashionLookCard, kind: 'look' | 'draft', winner?: boolean) => {
    try {
      await fashionAPI.save(
        look,
        kind === 'draft' ? 'Outfit drafts' : group || 'Saved looks',
        winner,
        kind
      );
      await loadWardrobe();
      speakLine(
        guide,
        kind === 'draft' ? `Saved ${look.title} as a draft. You can reopen it anytime.` : `Saved ${look.title}.`,
        () => onSpeaking(true),
        () => onSpeaking(false)
      );
    } catch {
      setError('Could not save that look.');
    }
  };

  const chooseLook = async (look: FashionLookCard, label: 'A' | 'B') => {
    setChosenId(look.id);
    await saveLook(look, 'look', true);
    speakLine(
      guide,
      `Good. Wear ${look.title}. That is option ${label}.`,
      () => onSpeaking(true),
      () => onSpeaking(false)
    );
  };

  const dislikeAndShuffle = async () => {
    if (!result) return;
    const exclude = [result.optionA.id, result.optionB.id, ...seenIds];
    speakLine(guide, 'Fair. I will pull something better.', () => onSpeaking(true), () => onSpeaking(false));
    await runStyle(prompt || result.prompt, { shuffle: true, exclude });
  };

  const shuffleMix = async () => {
    const q = prompt || result?.prompt || 'date outfit';
    speakLine(
      guide,
      pieces.length
        ? 'Mixing your closet with a fresh piece.'
        : 'Shuffling a new pair. Upload closet pieces for real mixes.',
      () => onSpeaking(true),
      () => onSpeaking(false)
    );
    await runStyle(q, {
      shuffle: true,
      mixWardrobe: pieces.length > 0 || wardrobe.length > 0,
      exclude: seenIds,
    });
  };

  const onFaceFile = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const url = await prepareAndUploadFile(file, 'fashion-face');
      const check = await checkFaceInPhoto(url);
      if (!check.ok) {
        setError(check.reason || 'That photo needs a clear face.');
        setFaceOk(false);
        setFaceNote(check.reason || 'Face not clear enough.');
        return;
      }
      setFaceUrl(url);
      setFaceOk(true);
      setFaceNote('Face photo saved. Upload a full-body photo, then press DRESS ME.');
    } catch {
      setError('Could not upload that face photo.');
    } finally {
      setUploading(false);
    }
  };

  const onBodyFile = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const url = await prepareAndUploadFile(file, 'fashion-body');
      setBodyUrl(url);
      try {
        localStorage.setItem('fashion-body-url', url);
      } catch {
        /* ignore */
      }
      setFaceNote(
        faceOk
          ? 'Body photo saved. Press DRESS ME.'
          : 'Body photo saved. A clear face photo still helps the stylist.'
      );
    } catch {
      setError('Could not upload that body photo.');
    } finally {
      setUploading(false);
    }
  };

  const onClosetFile = async (file: File | null) => {
    if (!file) return;
    const title = uploadTitle.trim() || file.name.replace(/\.[^.]+$/, '');
    setUploading(true);
    setError('');
    try {
      const url = await prepareAndUploadFile(file, 'fashion-wardrobe');
      await fashionAPI.saveUpload({
        title,
        imageUrl: url,
        kind: 'piece',
        pieceSlot: uploadSlot,
        worn: uploadWorn,
        group: 'My clothes',
        pieces: [title],
      });
      setUploadTitle('');
      await loadWardrobe();
      setTab('wardrobe');
      speakLine(
        guide,
        `Got your ${uploadSlot}. I can mix it into new outfits when you shuffle.`,
        () => onSpeaking(true),
        () => onSpeaking(false)
      );
    } catch {
      setError('Could not upload that closet photo.');
    } finally {
      setUploading(false);
    }
  };

  const reopenDraft = async (item: WardrobeItem) => {
    const asLook: FashionLookCard = {
      id: item.lookId || item.id,
      title: item.title,
      event: item.event || 'casual',
      vibe: item.vibe || 'from your drafts',
      formality: 'mid',
      palette: [],
      pieces: item.pieces?.length ? item.pieces : [item.title],
      imageUrl: item.imageUrl,
      fallback: '#1a120c',
      warp: 'drape',
      shopUrl: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(item.title)}`,
      trendNotes: 'Reopened from your outfit drafts.',
    };
    const fake: FashionStyleResponse = {
      prompt: prompt || item.event || 'outfit',
      guideLine: 'Back to your draft. Compare or pick again.',
      intent: { event: item.event || 'casual', formality: 'mid', colors: [], vibe: 'draft' },
      optionA: asLook,
      optionB: result?.optionB || asLook,
      critic: {
        winner: 'A',
        scores: {
          A: { event: 8, color: 7, body: 7, trend: 7, total: 29 },
          B: { event: 6, color: 6, body: 6, trend: 6, total: 24 },
        },
        reasons: ['This is your saved draft.', 'You can shuffle for a fresh pair anytime.'],
        skip: 'Keep one signature piece.',
        line: `Here is ${item.title} from your drafts.`,
      },
      personUrl: faceUrl,
    };
    setResult(fake);
    setTab('compare');
    setChosenId(null);
  };

  const personUrl = faceUrl || result?.personUrl || null;

  return (
    <div className="fashion-desk">
      <div className="fashion-desk-bar">
        <strong>Outfit desk · {first}</strong>
        <div className="fashion-desk-tabs">
          <button type="button" className={tab === 'closet' ? 'is-on' : ''} onClick={() => setTab('closet')}>
            Closet
          </button>
          <button type="button" className={tab === 'compare' ? 'is-on' : ''} onClick={() => setTab('compare')}>
            Compare
          </button>
          <button type="button" className={tab === 'wardrobe' ? 'is-on' : ''} onClick={() => setTab('wardrobe')}>
            Wardrobe
          </button>
          <button type="button" className={tab === 'drafts' ? 'is-on' : ''} onClick={() => setTab('drafts')}>
            Drafts
          </button>
          <button type="button" className="fashion-desk-close" onClick={onClose}>
            Back to crew
          </button>
        </div>
      </div>

      {stylists && stylists.length > 1 && onPickStylist && (
        <div className="fashion-stylist-row" aria-label="Fashion stylists">
          {stylists.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`fashion-stylist${g.id === guide.id ? ' is-on' : ''}`}
              title={`${g.name} — ${g.specialty}`}
              onClick={() => onPickStylist(g)}
            >
              <img src={g.portrait} alt="" />
              <span>{g.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      )}

      {tab === 'closet' && (
        <ClosetInterface faceUrl={faceUrl} bodyUrl={bodyUrl} gender={closetGender} />
      )}

      {tab !== 'closet' && (
      <>
      <form
        className="fashion-ask"
        onSubmit={(e) => {
          e.preventDefault();
          void runStyle(prompt);
        }}
      >
        <p>{opener}</p>
        <div className={`fashion-face-row${faceOk ? ' ok' : ''}`}>
          {faceUrl ? <img src={faceUrl} alt="" /> : <div style={{ width: 56, height: 56, borderRadius: 10, background: '#222' }} />}
          {bodyUrl ? (
            <img src={bodyUrl} alt="" className="fashion-body-thumb" />
          ) : (
            <div className="fashion-body-thumb fashion-body-placeholder" />
          )}
          <p>{faceNote}</p>
          <input
            ref={faceInputRef}
            type="file"
            accept="image/*"
            capture="user"
            hidden
            onChange={(e) => void onFaceFile(e.target.files?.[0] || null)}
          />
          <input
            ref={bodyInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => void onBodyFile(e.target.files?.[0] || null)}
          />
          <button type="button" className="ghost" disabled={uploading} onClick={() => faceInputRef.current?.click()}>
            {uploading ? '…' : 'Upload face'}
          </button>
          <button type="button" className="ghost" disabled={uploading} onClick={() => bodyInputRef.current?.click()}>
            {bodyUrl ? 'Change body photo' : 'Upload body photo'}
          </button>
        </div>
        {weekPlan === 'ask' && (
          <div className="fashion-week-ask">
            <p>Any plans this week or weekend I should dress you for?</p>
            <div className="fashion-week-actions">
              <button
                type="button"
                onClick={() => {
                  setWeekPlan('yes');
                  try {
                    localStorage.setItem('fashion-week-plan', 'yes');
                  } catch {
                    /* */
                  }
                }}
              >
                Yes — show ideas
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setWeekPlan('later');
                  try {
                    localStorage.setItem('fashion-week-plan', 'later');
                  } catch {
                    /* */
                  }
                }}
              >
                Ask later
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setWeekPlan('no');
                  try {
                    localStorage.setItem('fashion-week-plan', 'no');
                  } catch {
                    /* */
                  }
                }}
              >
                No thanks
              </button>
            </div>
          </div>
        )}
        {weekPlan === 'yes' && (
          <div className="fashion-week-ask">
            <p>What&apos;s coming up? (weekend dinner, interview, club…)</p>
            <div className="fashion-ask-row">
              <input
                value={weekNote}
                onChange={(e) => setWeekNote(e.target.value)}
                placeholder="e.g. Saturday dinner + Sunday brunch"
              />
              <button
                type="button"
                disabled={weekNote.trim().length < 2 || busy}
                onClick={() => {
                  setPrompt(weekNote.trim());
                  void runStyle(weekNote.trim());
                }}
              >
                Prep looks
              </button>
            </div>
          </div>
        )}
        <div className="fashion-ask-row">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Type it — or hold the mic and describe the night"
            disabled={busy}
          />
          <button
            type="button"
            className={`fashion-mic ${listening ? 'is-on' : ''}`}
            onClick={listening ? stopVoice : startVoice}
            title="Voice note"
          >
            {listening ? '■' : '🎤'}
          </button>
          <button type="submit" disabled={busy || prompt.trim().length < 2}>
            {busy ? 'Styling…' : 'Show looks'}
          </button>
        </div>
        {error && <p className="fashion-error">{error}</p>}
      </form>

      {tab === 'compare' && result && (
        <ChersWardrobe
          racks={result.racks}
          prompt={result.prompt}
          userImage={bodyUrl}
          guideLine={result.guideLine || result.critic.line}
          onSave={(look) => void saveLook(look, 'look', true)}
          onDraft={(look) => void saveLook(look, 'draft')}
          onShuffle={() => void dislikeAndShuffle()}
        />
      )}

      {tab === 'wardrobe' && (
        <div className="fashion-wardrobe">
          <div className="fashion-upload-box">
            <p>
              Upload clothes you own — worn on you or laid flat. Then shuffle to mix them with new pieces and get tips on
              the better combo.
            </p>
            <div className="fashion-upload-row">
              <input
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="e.g. Black knit top"
              />
              <select value={uploadSlot} onChange={(e) => setUploadSlot(e.target.value as PieceSlot)}>
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
                <option value="shoes">Shoes</option>
                <option value="outer">Outer</option>
                <option value="full">Full outfit</option>
                <option value="other">Other</option>
              </select>
              <button type="button" className={uploadWorn ? '' : 'ghost'} onClick={() => setUploadWorn(true)}>
                On me
              </button>
              <button type="button" className={!uploadWorn ? '' : 'ghost'} onClick={() => setUploadWorn(false)}>
                Laid out
              </button>
              <input
                ref={closetInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => void onClosetFile(e.target.files?.[0] || null)}
              />
              <button type="button" disabled={uploading} onClick={() => closetInputRef.current?.click()}>
                {uploading ? 'Uploading…' : 'Add photo'}
              </button>
              <button type="button" className="ghost" disabled={busy} onClick={() => void shuffleMix()}>
                Shuffle mix
              </button>
            </div>
          </div>

          <div className="fashion-wardrobe-section">
            <h4>My clothes</h4>
            <div className="fashion-wardrobe-grid">
              {!pieces.length && <p>No closet photos yet. Add a top, bottom, or shoes above.</p>}
              {pieces.map((item) => (
                <article key={item.id} className="fashion-wardrobe-card">
                  <img src={item.imageUrl} alt="" referrerPolicy="no-referrer" />
                  <div>
                    <b>{item.title}</b>
                    <span>
                      {item.pieceSlot || 'piece'} · {item.worn ? 'worn' : 'laid out'}
                    </span>
                    <p>{item.pieces.join(' · ')}</p>
                    <div className="row">
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => {
                          setPrompt((prev) => prev || item.event || 'date outfit');
                          void shuffleMix();
                        }}
                      >
                        Mix this
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={async () => {
                          await fashionAPI.remove(item.id);
                          await loadWardrobe();
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="fashion-wardrobe-section">
            <h4>Saved looks</h4>
            <div className="fashion-wardrobe-grid">
              {!wardrobe.length && <p>No saved looks yet. Choose one from Compare.</p>}
              {wardrobe.map((item) => (
                <article key={item.id} className="fashion-wardrobe-card">
                  <img src={item.imageUrl} alt="" referrerPolicy="no-referrer" />
                  <div>
                    <b>{item.title}</b>
                    <span>{item.group}</span>
                    <p>{item.pieces.join(' · ')}</p>
                    <div className="row">
                      <button type="button" className="ghost" onClick={() => void reopenDraft(item)}>
                        Compare again
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={async () => {
                          await fashionAPI.remove(item.id);
                          await loadWardrobe();
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'drafts' && (
        <div className="fashion-wardrobe">
          <div className="fashion-wardrobe-section">
            <h4>Outfit drafts</h4>
            <p style={{ color: '#e7c9a0', fontSize: 13, marginTop: 0 }}>
              Save looks you are not sure about, then reopen and choose later.
            </p>
            <div className="fashion-wardrobe-grid">
              {!drafts.length && <p>No drafts yet. Tap Save draft on a look while comparing.</p>}
              {drafts.map((item) => (
                <article key={item.id} className="fashion-wardrobe-card">
                  <img src={item.imageUrl} alt="" referrerPolicy="no-referrer" />
                  <div>
                    <b>{item.title}</b>
                    <span>Draft · {new Date(item.savedAt).toLocaleDateString()}</span>
                    <p>{item.pieces.join(' · ')}</p>
                    <div className="row">
                      <button type="button" onClick={() => void reopenDraft(item)}>
                        Rechoose
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={async () => {
                          await fashionAPI.save(
                            {
                              id: item.lookId || item.id,
                              title: item.title,
                              event: item.event || 'casual',
                              vibe: item.vibe || '',
                              formality: 'mid',
                              palette: [],
                              pieces: item.pieces,
                              imageUrl: item.imageUrl,
                              fallback: '#1a120c',
                              warp: 'drape',
                              shopUrl: '',
                              trendNotes: '',
                            },
                            'Saved looks',
                            true,
                            'look'
                          );
                          await fashionAPI.remove(item.id);
                          await loadWardrobe();
                        }}
                      >
                        Keep forever
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={async () => {
                          await fashionAPI.remove(item.id);
                          await loadWardrobe();
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
