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
import { paintFashionTryOn } from '../../lib/fashionTryOnCanvas';
import { speakGuideLine, speechLangFor } from '../../lib/aiGuideSpeech';
import { checkFaceInPhoto } from '../../lib/fashionFaceCheck';
import { prepareAndUploadFile } from '../../lib/uploadMedia';
import './FashionDesk.css';

function speakLine(guide: AiGuideCharacter, text: string, onStart: () => void, onEnd: () => void) {
  void speakGuideLine(guide.voice, text, onStart, onEnd);
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

function LookPane({
  look,
  personUrl,
  fitting,
  label,
  isWinner,
  onChoose,
  onDraft,
}: {
  look: FashionLookCard;
  personUrl: string | null;
  fitting: boolean;
  label: 'A' | 'B';
  isWinner: boolean;
  onChoose: () => void;
  onDraft: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelUrl = look.tryOnUrl;

  useEffect(() => {
    if (modelUrl) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 720;
    canvas.height = 960;
    void paintFashionTryOn(canvas, personUrl, look.imageUrl, look.warp, look.fallback);
  }, [modelUrl, personUrl, look.imageUrl, look.warp, look.fallback]);

  const badge = modelUrl ? 'On you' : fitting ? 'Fitting…' : 'Full preview';

  return (
    <article className={`fashion-card${isWinner ? ' is-winner' : ''}`}>
      <div className="fashion-card-photo" style={{ background: look.fallback }}>
        {modelUrl ? (
          <img className="fashion-tryon" src={modelUrl} alt="" />
        ) : (
          <canvas ref={canvasRef} className="fashion-tryon-canvas" />
        )}
        <span className="fashion-fit-badge">{badge}</span>
      </div>
      <div className="fashion-card-copy">
        <span className="fashion-opt">
          Option {label}
          {isWinner ? ' · guide pick' : ''}
        </span>
        <h3>{look.title}</h3>
        <p>{look.vibe}</p>
        <ul>
          {look.pieces.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
      <div className="fashion-card-actions">
        <button type="button" onClick={onChoose}>
          Choose {label}
        </button>
        <button type="button" className="ghost" onClick={onDraft}>
          Save draft
        </button>
      </div>
    </article>
  );
}

export default function FashionDesk({
  guide,
  onClose,
  onSpeaking,
}: {
  guide: AiGuideCharacter;
  onClose: () => void;
  onSpeaking: (on: boolean) => void;
}) {
  const { user } = useContext(AuthContext);
  const first = guide.name.split(' ')[0];
  const opener =
    guide.id === 'elena'
      ? 'What are we dressing for? First date, dinner, club, brunch — talk or type it.'
      : `What do you need to wear? Tell me the event. I will help you pick. ${first} is on the call.`;
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<FashionStyleResponse | null>(null);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [tab, setTab] = useState<'compare' | 'wardrobe' | 'drafts'>('compare');
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [drafts, setDrafts] = useState<WardrobeItem[]>([]);
  const [pieces, setPieces] = useState<WardrobeItem[]>([]);
  const [group, setGroup] = useState('Saved looks');
  const [fitting, setFitting] = useState(false);
  const [faceUrl, setFaceUrl] = useState<string | null>(
    typeof user?.profilePicture === 'string' ? user.profilePicture : null
  );
  const [faceOk, setFaceOk] = useState<boolean | null>(null);
  const [faceNote, setFaceNote] = useState('Checking for a clear face…');
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadSlot, setUploadSlot] = useState<PieceSlot>('top');
  const [uploadWorn, setUploadWorn] = useState(true);
  const [uploading, setUploading] = useState(false);
  const recRef = useRef<{ stop: () => void } | null>(null);
  const asked = useRef(false);
  const faceInputRef = useRef<HTMLInputElement>(null);
  const closetInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    speakLine(guide, opener, () => onSpeaking(true), () => onSpeaking(false));
  }, [guide, opener, onSpeaking]);

  const loadWardrobe = async () => {
    try {
      const r = await fashionAPI.wardrobe();
      setWardrobe(r.looks?.length ? r.looks : r.items.filter((i) => i.kind !== 'piece' && i.kind !== 'draft'));
      setDrafts(r.drafts || r.items.filter((i) => i.kind === 'draft' || i.group.toLowerCase().includes('draft')));
      setPieces(r.pieces || r.items.filter((i) => i.kind === 'piece'));
      if (r.groups[0]) setGroup(r.groups[0]);
    } catch {
      /* empty wardrobe is fine */
    }
  };

  useEffect(() => {
    void loadWardrobe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const check = await checkFaceInPhoto(faceUrl);
      if (cancelled) return;
      setFaceOk(check.ok);
      setFaceNote(
        check.ok
          ? 'Face photo ready — try-on will use this.'
          : check.reason || 'Upload a clear face photo for try-on.'
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [faceUrl]);

  const applyFits = async (r: FashionStyleResponse, person: string | null) => {
    setFitting(true);
    try {
      if (!person || !(await checkFaceInPhoto(person)).ok) {
        setError('Need a clear face photo before I drape outfits on you.');
        return;
      }
      const [fitA, fitB] = await Promise.all([
        fashionAPI.tryOn(r.optionA, person).catch(() => null),
        fashionAPI.tryOn(r.optionB, person).catch(() => null),
      ]);
      setResult((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          optionA: fitA?.tryOnUrl
            ? { ...prev.optionA, tryOnUrl: fitA.tryOnUrl, tryOnEngine: fitA.engine }
            : prev.optionA,
          optionB: fitB?.tryOnUrl
            ? { ...prev.optionB, tryOnUrl: fitB.tryOnUrl, tryOnEngine: fitB.engine }
            : prev.optionB,
        };
      });
    } finally {
      setFitting(false);
    }
  };

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
      await applyFits(r, person);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Could not read that. Try “first date tomorrow night”.');
    } finally {
      setBusy(false);
      setFitting(false);
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
      setFaceNote('Face photo ready — try-on will use this.');
      if (result) await applyFits(result, url);
    } catch {
      setError('Could not upload that face photo.');
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
    await applyFits(fake, faceUrl);
  };

  const personUrl = faceUrl || result?.personUrl || null;

  return (
    <div className="fashion-desk">
      <div className="fashion-desk-bar">
        <strong>Outfit desk · {first}</strong>
        <div className="fashion-desk-tabs">
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
          <p>{faceNote}</p>
          <input
            ref={faceInputRef}
            type="file"
            accept="image/*"
            capture="user"
            hidden
            onChange={(e) => void onFaceFile(e.target.files?.[0] || null)}
          />
          <button type="button" className="ghost" disabled={uploading} onClick={() => faceInputRef.current?.click()}>
            {uploading ? '…' : 'Upload face photo'}
          </button>
        </div>
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
        <div className="fashion-compare-wrap">
          <div>
            <div className="fashion-pair">
              <LookPane
                look={result.optionA}
                personUrl={personUrl}
                fitting={fitting}
                label="A"
                isWinner={result.critic.winner === 'A' || chosenId === result.optionA.id}
                onChoose={() => void chooseLook(result.optionA, 'A')}
                onDraft={() => void saveLook(result.optionA, 'draft')}
              />
              <LookPane
                look={result.optionB}
                personUrl={personUrl}
                fitting={fitting}
                label="B"
                isWinner={result.critic.winner === 'B' || chosenId === result.optionB.id}
                onChoose={() => void chooseLook(result.optionB, 'B')}
                onDraft={() => void saveLook(result.optionB, 'draft')}
              />
            </div>
          </div>
          <aside className="fashion-critic">
            <p className="fashion-winner">
              Winner: Option {result.critic.winner} ·{' '}
              {result.critic.winner === 'A' ? result.optionA.title : result.optionB.title}
            </p>
            {fitting && <p className="fashion-fitting">Draping both looks on your face photo…</p>}
            {!fitting && !result.optionA.tryOnUrl && !result.optionB.tryOnUrl && (
              <p className="fashion-fitting-note">
                {faceOk === false
                  ? 'Upload a clear face photo to see the fit on you.'
                  : result.tryOnReady
                    ? 'Model fit did not return — canvas preview is on your photo.'
                    : 'Canvas preview drapes the look on your photo. Full AI try-on needs a try-on key.'}
              </p>
            )}
            <p>{result.critic.line}</p>
            <ul>
              {result.critic.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="fashion-skip">{result.critic.skip}</p>
            <div className="fashion-actions">
              <button type="button" className="danger" disabled={busy} onClick={() => void dislikeAndShuffle()}>
                Don&apos;t like — show better
              </button>
              <button type="button" className="ghost" disabled={busy} onClick={() => void shuffleMix()}>
                Shuffle / mix closet
              </button>
              <button
                type="button"
                className="ghost"
                disabled={busy}
                onClick={() => void runStyle(prompt || result.prompt, { shuffle: true, exclude: seenIds })}
              >
                New pair
              </button>
            </div>
            <div className="fashion-save-row">
              <input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="Folder name" />
              <button type="button" onClick={() => void saveLook(result.optionA, 'look', result.critic.winner === 'A')}>
                Save A
              </button>
              <button type="button" onClick={() => void saveLook(result.optionB, 'look', result.critic.winner === 'B')}>
                Save B
              </button>
              <button type="button" className="ghost" onClick={() => void saveLook(result.optionA, 'draft')}>
                Draft A
              </button>
              <button type="button" className="ghost" onClick={() => void saveLook(result.optionB, 'draft')}>
                Draft B
              </button>
              <a
                href={result.critic.winner === 'A' ? result.optionA.shopUrl : result.optionB.shopUrl}
                target="_blank"
                rel="noreferrer"
              >
                Shop winner
              </a>
            </div>
          </aside>
        </div>
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
    </div>
  );
}
