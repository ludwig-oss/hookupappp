import { useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import type { AiGuideCharacter } from '../../api/aiGuides';
import { fashionAPI, type FashionLookCard, type FashionStyleResponse, type WardrobeItem } from '../../api/fashion';
import { paintFashionTryOn } from '../../lib/fashionTryOnCanvas';
import { speakGuideLine, speechLangFor } from '../../lib/aiGuideSpeech';
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
}: {
  look: FashionLookCard;
  personUrl: string | null;
  fitting: boolean;
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

  const badge = modelUrl ? 'On you' : fitting ? 'Fitting…' : 'Fitted preview';

  return (
    <div className={`fashion-pane warp-${look.warp}`}>
      <div className="fashion-pane-photo" style={{ background: look.fallback }}>
        {modelUrl ? (
          <img className="fashion-tryon" src={modelUrl} alt="" />
        ) : (
          <canvas ref={canvasRef} className="fashion-tryon-canvas" />
        )}
        <span className="fashion-fit-badge">{badge}</span>
      </div>
    </div>
  );
}

function LookCopy({ look, label }: { look: FashionLookCard; label: string }) {
  return (
    <div className="fashion-pane-copy">
      <span className="fashion-opt">Option {label}</span>
      <h3>{look.title}</h3>
      <p>{look.vibe}</p>
      <ul>
        {look.pieces.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </div>
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
  const [split, setSplit] = useState(50);
  const [tab, setTab] = useState<'compare' | 'wardrobe'>('compare');
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [group, setGroup] = useState('First dates');
  const [fitting, setFitting] = useState(false);
  const recRef = useRef<{ stop: () => void } | null>(null);
  const asked = useRef(false);
  const compareRef = useRef<HTMLDivElement>(null);
  const [compareW, setCompareW] = useState(0);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    speakLine(guide, opener, () => onSpeaking(true), () => onSpeaking(false));
  }, [guide, opener, onSpeaking]);

  const loadWardrobe = async () => {
    try {
      const r = await fashionAPI.wardrobe();
      setWardrobe(r.items);
      if (r.groups[0]) setGroup(r.groups[0]);
    } catch {
      /* empty wardrobe is fine */
    }
  };

  useEffect(() => {
    void loadWardrobe();
  }, []);

  useEffect(() => {
    const el = compareRef.current;
    if (!el || !result) return;
    const sync = () => setCompareW(el.clientWidth);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [result, tab]);

  const runStyle = async (text: string) => {
    const q = text.trim();
    if (q.length < 2) return;
    setBusy(true);
    setError('');
    try {
      const r = await fashionAPI.style(q, guide.id);
      setResult(r);
      setTab('compare');
      setSplit(50);
      setBusy(false);
      speakLine(guide, r.critic.line, () => onSpeaking(true), () => onSpeaking(false));
      setFitting(true);
      const person = r.personUrl;
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

  const saveLook = async (look: FashionLookCard, winner: boolean) => {
    try {
      await fashionAPI.save(look, group || 'Saved looks', winner);
      await loadWardrobe();
    } catch {
      setError('Could not save that look.');
    }
  };

  const personUrl = result?.personUrl || (typeof user?.profilePicture === 'string' ? user.profilePicture : null);

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
            <div className="fashion-compare" ref={compareRef}>
              <div className="fashion-compare-base">
                <LookPane look={result.optionB} personUrl={personUrl} fitting={fitting} />
              </div>
              <div className="fashion-compare-clip" style={{ width: `${split}%` }}>
                <div className="fashion-compare-clip-inner" style={{ width: compareW ? `${compareW}px` : '200%' }}>
                  <LookPane look={result.optionA} personUrl={personUrl} fitting={fitting} />
                </div>
              </div>
              <span className="fashion-corner fashion-corner-a">A · {result.optionA.title}</span>
              <span className="fashion-corner fashion-corner-b">B · {result.optionB.title}</span>
              <input
                className="fashion-split"
                type="range"
                min={8}
                max={92}
                value={split}
                onChange={(e) => setSplit(Number(e.target.value))}
                aria-label="Compare A and B"
              />
            </div>
            <div className="fashion-looks-meta">
              <LookCopy look={result.optionA} label="A" />
              <LookCopy look={result.optionB} label="B" />
            </div>
          </div>
          <aside className="fashion-critic">
            <p className="fashion-winner">
              Winner: Option {result.critic.winner} · {result.critic.winner === 'A' ? result.optionA.title : result.optionB.title}
            </p>
            {fitting && <p className="fashion-fitting">Draping both looks on your photo…</p>}
            {!fitting && !result.optionA.tryOnUrl && !result.optionB.tryOnUrl && (
              <p className="fashion-fitting-note">
                {result.tryOnReady
                  ? 'Model fit did not return — canvas preview is on your photo.'
                  : 'Live IDM-VTON needs a try-on key. Canvas preview drapes the look on your photo until then.'}
              </p>
            )}
            <p>{result.critic.line}</p>
            <ul>
              {result.critic.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="fashion-skip">{result.critic.skip}</p>
            <div className="fashion-save-row">
              <input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="Folder name" />
              <button type="button" onClick={() => void saveLook(result.optionA, result.critic.winner === 'A')}>
                Save A
              </button>
              <button type="button" onClick={() => void saveLook(result.optionB, result.critic.winner === 'B')}>
                Save B
              </button>
              <a href={result.critic.winner === 'A' ? result.optionA.shopUrl : result.optionB.shopUrl} target="_blank" rel="noreferrer">
                Shop winner
              </a>
            </div>
          </aside>
        </div>
      )}

      {tab === 'wardrobe' && (
        <div className="fashion-wardrobe">
          {!wardrobe.length && <p>No saved looks yet. Compare two, then save into a folder.</p>}
          {wardrobe.map((item) => (
            <article key={item.id} className="fashion-wardrobe-card">
              <img src={item.imageUrl} alt="" referrerPolicy="no-referrer" />
              <div>
                <b>{item.title}</b>
                <span>{item.group}</span>
                <p>{item.pieces.join(' · ')}</p>
                <button
                  type="button"
                  onClick={async () => {
                    await fashionAPI.remove(item.id);
                    await loadWardrobe();
                  }}
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
