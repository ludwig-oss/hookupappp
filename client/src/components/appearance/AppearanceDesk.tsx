import { useContext, useEffect, useRef, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import type { AiGuideCharacter } from '../../api/aiGuides';
import {
  appearanceAPI,
  type AppearanceAngle,
  type CompleteLook,
  type HairLook,
  type ScanResponse,
  type SavedAppearanceLook,
} from '../../api/appearance';
import { measureFace, readAngleFile } from '../../lib/appearanceFaceMetrics';
import { paintAppearanceAfter } from '../../lib/appearanceAfterCanvas';
import { paintFashionTryOn } from '../../lib/fashionTryOnCanvas';
import { paintHairTryOn } from '../../lib/hairTryOnCanvas';
import { speakGuideLine } from '../../lib/aiGuideSpeech';
import { prepareAndUploadFile } from '../../lib/uploadMedia';
import './AppearanceDesk.css';

function speakLine(guide: AiGuideCharacter, text: string, onStart: () => void, onEnd: () => void) {
  void speakGuideLine(guide.voice, text, onStart, onEnd);
}

type Tab = 'scan' | 'after' | 'look' | 'hair' | 'compare' | 'wardrobe';

function AfterPane({
  src,
  afterUrl,
  faults,
  angle,
}: {
  src: string;
  afterUrl: string | null;
  faults: ScanResponse['taxonomy']['faults'];
  angle: AppearanceAngle;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (afterUrl) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    void paintAppearanceAfter(canvas, src, faults, angle);
  }, [afterUrl, src, faults, angle]);
  return (
    <div className="appear-after-pane">
      {afterUrl ? <img src={afterUrl} alt="" referrerPolicy="no-referrer" /> : <canvas ref={canvasRef} />}
    </div>
  );
}

function LookPreview({ look, personUrl }: { look: CompleteLook; personUrl: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 720;
    canvas.height = 960;
    void paintFashionTryOn(canvas, personUrl, look.outfit.imageUrl, look.outfit.warp, look.outfit.fallback);
  }, [look, personUrl]);
  return (
    <div className="appear-look-photo" style={{ background: look.outfit.fallback }}>
      <canvas ref={canvasRef} />
      <span className="appear-hair-chip">{look.hair.title}</span>
    </div>
  );
}

function HairPreview({
  faceUrl,
  hair,
  refHairUrl,
}: {
  faceUrl: string | null;
  hair: HairLook | null;
  refHairUrl: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 720;
    canvas.height = 960;
    void paintHairTryOn(canvas, faceUrl, {
      family: hair?.family,
      density: hair?.density,
      refHairUrl,
      color: '#241810',
    });
  }, [faceUrl, hair?.id, hair?.family, hair?.density, refHairUrl]);
  return (
    <div className="appear-hair-stage">
      <canvas ref={canvasRef} className="appear-hair-canvas" />
    </div>
  );
}

export default function AppearanceDesk({
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
    'Three photos: face the camera, then left, then right. Daylight. I will read skin and bone, then pick a full look. You tell me if you like it.';
  const [tab, setTab] = useState<Tab>('scan');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [occasion, setOccasion] = useState('first date dinner');
  const [previews, setPreviews] = useState<Partial<Record<AppearanceAngle, string>>>({});
  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [look, setLook] = useState<CompleteLook | null>(null);
  const [optionB, setOptionB] = useState<CompleteLook | null>(null);
  const [split, setSplit] = useState(50);
  const [chat, setChat] = useState<{ role: 'guide' | 'you'; text: string }[]>([]);
  const [draft, setDraft] = useState('');
  const [liked, setLiked] = useState<boolean | null>(null);
  const [group, setGroup] = useState('First dates');
  const [wardrobe, setWardrobe] = useState<SavedAppearanceLook[]>([]);
  const [hairCatalog, setHairCatalog] = useState<HairLook[]>([]);
  const [selectedHair, setSelectedHair] = useState<HairLook | null>(null);
  const [hairRefUrl, setHairRefUrl] = useState<string | null>(null);
  const [hairDesign, setHairDesign] = useState('');
  const [hairChat, setHairChat] = useState<{ role: 'guide' | 'you'; text: string }[]>([]);
  const asked = useRef(false);
  const compareRef = useRef<HTMLDivElement>(null);
  const hairRefInput = useRef<HTMLInputElement>(null);
  const [compareW, setCompareW] = useState(0);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    speakLine(guide, opener, () => onSpeaking(true), () => onSpeaking(false));
  }, [guide, opener, onSpeaking]);

  useEffect(() => {
    appearanceAPI.looks().then((r) => setWardrobe(r.items)).catch(() => {});
    appearanceAPI
      .hairCatalog()
      .then((r) => {
        setHairCatalog(r.items || []);
        setSelectedHair((prev) => prev || r.items?.[0] || null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (look?.hair) setSelectedHair(look.hair);
  }, [look?.hair?.id]);

  useEffect(() => {
    const el = compareRef.current;
    if (!el || tab !== 'compare') return;
    const sync = () => setCompareW(el.clientWidth);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tab, look]);

  const setAngle = async (angle: AppearanceAngle, file: File | null) => {
    if (!file) return;
    setError('');
    try {
      const dataUrl = await readAngleFile(file);
      setPreviews((p) => ({ ...p, [angle]: dataUrl }));
    } catch {
      setError('Could not read that photo.');
    }
  };

  const runScan = async () => {
    if (!previews.frontal || !previews.leftProfile || !previews.rightProfile) {
      setError('Upload frontal, left profile, and right profile.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const [frontal, leftProfile, rightProfile] = await Promise.all([
        measureFace(previews.frontal),
        measureFace(previews.leftProfile),
        measureFace(previews.rightProfile),
      ]);
      const r = await appearanceAPI.scan({
        frontal: { dataUrl: previews.frontal, metrics: frontal },
        leftProfile: { dataUrl: previews.leftProfile, metrics: leftProfile },
        rightProfile: { dataUrl: previews.rightProfile, metrics: rightProfile },
        occasion,
        guideId: guide.id,
      });
      setScan(r);
      setLook(r.style.optionA);
      setOptionB(r.style.optionB);
      setSelectedHair(r.style.optionA.hair);
      setLiked(null);
      setChat([{ role: 'guide', text: r.style.critic.line }]);
      setTab('after');
      speakLine(guide, `${r.summary} ${r.style.askLike}`, () => onSpeaking(true), () => onSpeaking(false));
    } catch (e: unknown) {
      const data = (e as { response?: { data?: { error?: string; errors?: string[] } } })?.response?.data;
      setError(data?.errors?.join(' ') || data?.error || 'Need three clear photos in daylight.');
    } finally {
      setBusy(false);
    }
  };

  const sendChat = async () => {
    if (!look || draft.trim().length < 2) return;
    const message = draft.trim();
    setDraft('');
    setChat((c) => [...c, { role: 'you', text: message }]);
    setBusy(true);
    try {
      const r = await appearanceAPI.iterate(look, message);
      setLook(r.look);
      setSelectedHair(r.look.hair);
      setLiked(null);
      setChat((c) => [...c, { role: 'guide', text: r.reply }]);
      speakLine(guide, r.reply, () => onSpeaking(true), () => onSpeaking(false));
    } catch {
      setError('Could not change that piece.');
    } finally {
      setBusy(false);
    }
  };

  const pickHair = (h: HairLook) => {
    setSelectedHair(h);
    setHairRefUrl(null);
    if (look) {
      setLook({ ...look, hair: h, id: `${look.outfit.id}__${h.id}` });
      setLiked(null);
    }
  };

  const onHairRefFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const url = await prepareAndUploadFile(file, 'hair-ref');
      setHairRefUrl(url);
      const line = `${first}: Got the reference. That hair shape is on your head in the preview — switch styles on the left anytime.`;
      setHairChat((c) => [...c, { role: 'guide', text: line }]);
      speakLine(guide, line, () => onSpeaking(true), () => onSpeaking(false));
    } catch {
      setError('Could not upload that hairstyle reference.');
    } finally {
      setBusy(false);
    }
  };

  const designHair = async () => {
    const message = hairDesign.trim();
    if (message.length < 2) return;
    setHairDesign('');
    setHairChat((c) => [...c, { role: 'you', text: message }]);
    setBusy(true);
    try {
      const r = await appearanceAPI.designHair(message, selectedHair, guide.id);
      setSelectedHair(r.hair);
      setHairCatalog((list) => {
        if (list.some((x) => x.id === r.hair.id)) return list;
        return [r.hair, ...list];
      });
      if (look) {
        setLook({ ...look, hair: r.hair, id: `${look.outfit.id}__${r.hair.id}` });
        setLiked(null);
      }
      setHairChat((c) => [...c, { role: 'guide', text: r.reply }]);
      speakLine(guide, r.reply, () => onSpeaking(true), () => onSpeaking(false));
    } catch {
      setError('Could not design that cut.');
    } finally {
      setBusy(false);
    }
  };

  const answerLike = async (yes: boolean) => {
    if (!look) return;
    setLiked(yes);
    if (!yes) {
      setChat((c) => [...c, { role: 'guide', text: 'Tell me what to change. Hair, jacket, color — I will re-render that piece.' }]);
      setTab('look');
      return;
    }
    try {
      const r = await appearanceAPI.approve(look, true, group, look.outfit.imageUrl);
      if (r.item) setWardrobe((w) => [r.item!, ...w]);
      setChat((c) => [...c, { role: 'guide', text: `Saved to ${group}.` }]);
      speakLine(guide, `Saved. ${group}.`, () => onSpeaking(true), () => onSpeaking(false));
    } catch {
      setError('Could not save until you like the look.');
    }
  };

  const personUrl = previews.frontal || (typeof user?.profilePicture === 'string' ? user.profilePicture : null);
  const hairList = hairCatalog.length ? hairCatalog : selectedHair ? [selectedHair] : [];

  return (
    <div className="appear-desk">
      <div className="appear-bar">
        <strong>Face & look · {first}</strong>
        <div className="appear-tabs">
          {(['scan', 'after', 'look', 'hair', 'compare', 'wardrobe'] as Tab[]).map((t) => (
            <button key={t} type="button" className={tab === t ? 'is-on' : ''} onClick={() => setTab(t)}>
              {t === 'after' ? 'After' : t === 'look' ? 'Look' : t === 'hair' ? 'Hair' : t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
          <button type="button" className="appear-close" onClick={onClose}>
            Back to crew
          </button>
        </div>
      </div>

      {error && <p className="appear-error">{error}</p>}

      {tab === 'scan' && (
        <div className="appear-scan">
          <p>{opener}</p>
          <input value={occasion} onChange={(e) => setOccasion(e.target.value)} placeholder="Occasion — first date, dinner, club…" />
          <div className="appear-slots">
            {([
              ['frontal', 'Frontal'],
              ['leftProfile', 'Left profile'],
              ['rightProfile', 'Right profile'],
            ] as [AppearanceAngle, string][]).map(([key, label]) => (
              <label key={key} className="appear-slot">
                <span>{label}</span>
                {previews[key] ? <img src={previews[key]} alt="" /> : <em>Upload</em>}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => void setAngle(key, e.target.files?.[0] || null)}
                />
              </label>
            ))}
          </div>
          <button type="button" disabled={busy} onClick={() => void runScan()}>
            {busy ? 'Reading face…' : 'Analyze 3 angles'}
          </button>
        </div>
      )}

      {tab === 'after' && scan && (
        <div className="appear-after">
          <p>{scan.summary}</p>
          <p className="appear-note">{scan.afterResults.detail}</p>
          <div className="appear-after-grid">
            {(['frontal', 'leftProfile', 'rightProfile'] as AppearanceAngle[]).map((angle) => (
              <figure key={angle}>
                <AfterPane
                  src={scan.afterResults.angles[angle].beforeUrl}
                  afterUrl={scan.afterResults.angles[angle].afterUrl}
                  faults={scan.taxonomy.faults}
                  angle={angle}
                />
                <figcaption>
                  {angle === 'frontal' ? 'Frontal' : angle === 'leftProfile' ? 'Left' : 'Right'} · 6-month preview
                </figcaption>
              </figure>
            ))}
          </div>
          <div className="appear-tax">
            <p>
              Skin: <b>{scan.taxonomy.skinType}</b> ({Math.round(scan.taxonomy.skinConfidence * 100)}%)
            </p>
            <ul>
              {scan.taxonomy.blemishes.filter((b) => b.present).map((b) => (
                <li key={b.id}>
                  {b.id.replace(/-/g, ' ')} · {Math.round(b.score * 100)}%
                </li>
              ))}
            </ul>
            <ul>
              {scan.taxonomy.faults.slice(0, 6).map((f) => (
                <li key={f.id}>
                  {f.label} · {Math.round(f.score * 100)}%
                </li>
              ))}
            </ul>
          </div>
          <details className="appear-plan">
            <summary>50-step action plan ({scan.actionPlanCount})</summary>
            <ol>
              {scan.actionPlan.map((h) => (
                <li key={h.id}>
                  <b>{h.title}</b> <i>{h.pillar}</i>
                  <p>{h.action}</p>
                </li>
              ))}
            </ol>
          </details>
          <p className="appear-note">{scan.disclaimer}</p>
          <button type="button" onClick={() => setTab('look')}>
            See the look I picked
          </button>
        </div>
      )}

      {tab === 'look' && !look && (
        <p className="appear-note">Scan three angles first. I pick the look after I see your face.</p>
      )}

      {tab === 'look' && look && (
        <div className="appear-look-wrap">
          <div>
            <p className="appear-auto">Auto-chosen for {look.occasion.replace('-', ' ')}</p>
            <LookPreview look={look} personUrl={personUrl} />
            <h3>
              {look.outfit.title} · {look.hair.title}
            </h3>
            <p>
              {look.outfit.vibe} · {look.hair.vibe}
            </p>
            <ul>
              {look.outfit.pieces.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <p className="appear-ask">{scan?.style.askLike || 'Do you like this look?'}</p>
            <div className="appear-like-row">
              <button type="button" className={liked === true ? 'is-on' : ''} onClick={() => void answerLike(true)}>
                Yes, save it
              </button>
              <button type="button" className={liked === false ? 'is-on' : ''} onClick={() => void answerLike(false)}>
                No, change it
              </button>
              <button type="button" className="ghost" onClick={() => setTab('hair')}>
                Open barbershop
              </button>
              <input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="Folder" />
            </div>
          </div>
          <aside className="appear-chat">
            <p>Tell me what to change.</p>
            <div className="appear-chat-log">
              {chat.map((m, i) => (
                <p key={i} className={m.role === 'you' ? 'is-you' : ''}>
                  {m.text}
                </p>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendChat();
              }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder='e.g. make the braids tighter into a geometric crown'
              />
              <button type="submit" disabled={busy}>
                Send
              </button>
            </form>
          </aside>
        </div>
      )}

      {tab === 'hair' && (
        <div className="appear-barber">
          <aside className="appear-barber-menu">
            <header>
              <strong>{first.toUpperCase()} · BARBERS</strong>
              <span>
                HAIRSTYLES {selectedHair ? hairList.findIndex((h) => h.id === selectedHair.id) + 1 : 0} /{' '}
                {Math.max(hairList.length, 1)}
              </span>
            </header>
            <ul className="appear-barber-list">
              {hairList.map((h) => (
                <li key={h.id}>
                  <button type="button" className={selectedHair?.id === h.id ? 'is-on' : ''} onClick={() => pickHair(h)}>
                    <span>{h.title}</span>
                    <em>{h.family}</em>
                  </button>
                </li>
              ))}
            </ul>
            <div className="appear-barber-tools">
              <input
                ref={hairRefInput}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => void onHairRefFile(e.target.files?.[0] || null)}
              />
              <button type="button" className="ghost" disabled={busy} onClick={() => hairRefInput.current?.click()}>
                {hairRefUrl ? 'Change hair photo' : 'Upload hair reference'}
              </button>
              {hairRefUrl && (
                <button type="button" className="ghost" onClick={() => setHairRefUrl(null)}>
                  Clear reference
                </button>
              )}
            </div>
            <form
              className="appear-barber-design"
              onSubmit={(e) => {
                e.preventDefault();
                void designHair();
              }}
            >
              <p>{first} can design a cut with you — describe it.</p>
              <input
                value={hairDesign}
                onChange={(e) => setHairDesign(e.target.value)}
                placeholder="e.g. soft curtain bangs, matte texture"
                disabled={busy}
              />
              <button type="submit" disabled={busy || hairDesign.trim().length < 2}>
                Design with {first}
              </button>
            </form>
            <div className="appear-chat-log appear-barber-chat">
              {hairChat.map((m, i) => (
                <p key={i} className={m.role === 'you' ? 'is-you' : ''}>
                  {m.text}
                </p>
              ))}
            </div>
          </aside>
          <div className="appear-barber-preview">
            <HairPreview faceUrl={personUrl} hair={selectedHair} refHairUrl={hairRefUrl} />
            <p className="appear-barber-caption">
              {hairRefUrl
                ? 'Reference hair on your face — switch styles on the left to compare.'
                : selectedHair
                  ? `${selectedHair.title} · ${selectedHair.notes}`
                  : 'Pick a style or upload a hair reference photo.'}
            </p>
            {!personUrl && (
              <p className="appear-note">Upload your frontal scan (or set a profile photo) so hair sits on your head.</p>
            )}
            <div className="appear-like-row">
              <button type="button" onClick={() => setTab('look')} disabled={!look}>
                Apply to look
              </button>
              <button type="button" className="ghost" onClick={() => setTab('compare')} disabled={!look || !optionB}>
                Compare outfits
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'compare' && look && optionB && (
        <div className="appear-compare-wrap">
          <div className="appear-compare" ref={compareRef}>
            <div className="appear-compare-base">
              <LookPreview look={optionB} personUrl={personUrl} />
            </div>
            <div className="appear-compare-clip" style={{ width: `${split}%` }}>
              <div className="appear-compare-clip-inner" style={{ width: compareW ? `${compareW}px` : '200%' }}>
                <LookPreview look={look} personUrl={personUrl} />
              </div>
            </div>
            <span className="appear-corner appear-corner-a">A · {look.outfit.title}</span>
            <span className="appear-corner appear-corner-b">B · {optionB.outfit.title}</span>
            <input
              className="appear-split"
              type="range"
              min={8}
              max={92}
              value={split}
              onChange={(e) => setSplit(Number(e.target.value))}
              aria-label="Compare A and B"
            />
          </div>
          {scan && (
            <aside className="appear-critic">
              <p className="appear-winner">Winner: Option {scan.style.critic.winner} · hair harmony scored</p>
              <p>{scan.style.critic.line}</p>
              <ul>
                {scan.style.critic.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <button type="button" className="ghost" onClick={() => setTab('hair')}>
                Open barbershop
              </button>
            </aside>
          )}
        </div>
      )}

      {tab === 'wardrobe' && (
        <div className="appear-wardrobe">
          {!wardrobe.length && <p>Like a look first. Nothing saves until you say yes.</p>}
          {wardrobe.map((item) => (
            <article key={item.id}>
              <img src={item.imageUrl} alt="" referrerPolicy="no-referrer" />
              <div>
                <b>{item.title}</b>
                <span>{item.group}</span>
                <p>{item.pieces.join(' · ')}</p>
                <button
                  type="button"
                  onClick={async () => {
                    await appearanceAPI.remove(item.id);
                    setWardrobe((w) => w.filter((x) => x.id !== item.id));
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
