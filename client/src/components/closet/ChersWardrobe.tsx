import { useEffect, useMemo, useState } from 'react';
import {
  fashionAPI,
  type FashionLookCard,
  type RackPiece,
  type RedCarpetRacks,
} from '../../api/fashion';
import GarmentSlot from './GarmentSlot';
import './ChersWardrobe.css';

const EMPTY: RedCarpetRacks = {
  tops: [],
  bottoms: [],
  dresses: [],
  shoes: [],
  source: 'catalog',
  detail: '',
};

function cycle(length: number, index: number, dir: number) {
  if (!length) return 0;
  return (index + dir + length) % length;
}

function at(list: RackPiece[], index: number) {
  if (!list.length) return null;
  return list[index % list.length];
}

const CASUAL = /sneaker|denim|jean|tee\b|hoodie|street|trainer/i;
const FORMAL = /gown|gala|oscar|heel|silk|tuxedo|blazer|satin|cannes|grammy|carpet/i;

function verdict(labels: string[]) {
  const text = labels.filter(Boolean).join(' ');
  if (CASUAL.test(text) && FORMAL.test(text)) return 'MISMATCH!' as const;
  return 'TOTALLY!' as const;
}

function Row({
  label,
  pieces,
  index,
  onPrev,
  onNext,
}: {
  label: string;
  pieces: RackPiece[];
  index: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const piece = at(pieces, index);
  return (
    <div className="chers-row">
      <p className="chers-row-label">{label}</p>
      <button type="button" className="chers-arrow" onClick={onPrev} aria-label={`Previous ${label}`}>
        ◀
      </button>
      <div className="chers-window">
        {piece ? (
          <GarmentSlot url={piece.imageUrl} slot={piece.slot} title={piece.title} />
        ) : (
          <div className="chers-empty">NO PIECES IN THIS ROW</div>
        )}
        <p className="chers-name">{piece?.title || '—'}</p>
      </div>
      <button type="button" className="chers-arrow" onClick={onNext} aria-label={`Next ${label}`}>
        ▶
      </button>
    </div>
  );
}

export default function ChersWardrobe({
  racks,
  prompt,
  userImage,
  guideLine,
  onSave,
  onDraft,
  onShuffle,
}: {
  racks?: RedCarpetRacks | null;
  prompt?: string;
  userImage?: string | null;
  guideLine?: string;
  onSave?: (look: FashionLookCard) => void;
  onDraft?: (look: FashionLookCard) => void;
  onShuffle?: () => void;
}) {
  const [loaded, setLoaded] = useState<RedCarpetRacks | null>(racks || null);
  const [dressMode, setDressMode] = useState(false);
  const [topIndex, setTopIndex] = useState(0);
  const [bottomIndex, setBottomIndex] = useState(0);
  const [shoeIndex, setShoeIndex] = useState(0);
  const [dressIndex, setDressIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [tryOnUrl, setTryOnUrl] = useState<string | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (racks && (racks.tops.length || racks.bottoms.length || racks.dresses.length || racks.shoes.length)) {
      setLoaded(racks);
      return;
    }
    let cancel = false;
    fashionAPI
      .redCarpet(prompt)
      .then((next) => {
        if (!cancel) setLoaded(next);
      })
      .catch(() => {
        if (!cancel) setLoaded(EMPTY);
      });
    return () => {
      cancel = true;
    };
  }, [racks, prompt]);

  const data = loaded || EMPTY;
  const top = at(data.tops, topIndex);
  const bottom = at(data.bottoms, bottomIndex);
  const shoe = at(data.shoes, shoeIndex);
  const dress = at(data.dresses, dressIndex);
  const labels = dressMode
    ? [top?.title || '', dress?.title || '', shoe?.title || '']
    : [top?.title || '', bottom?.title || '', shoe?.title || ''];
  const alert = verdict(labels);
  const person = userImage && /^https?:\/\//i.test(userImage) ? userImage : null;

  const composed = useMemo<FashionLookCard | null>(() => {
    const lead = dressMode ? dress : top;
    if (!lead) return null;
    const pieces = (
      dressMode ? [dress?.title, shoe?.title] : [top?.title, bottom?.title, shoe?.title]
    ).filter(Boolean) as string[];
    return {
      id: pieces.join('|').slice(0, 80) || lead.id,
      title: pieces.join(' + '),
      event: 'first-date',
      vibe: alert === 'TOTALLY!' ? 'totally' : 'mismatch',
      formality: alert === 'TOTALLY!' ? 'high' : 'low',
      palette: [],
      pieces,
      imageUrl: lead.imageUrl,
      fallback: '#1D4ED8',
      warp: dressMode ? 'drape' : 'tailored',
      shopUrl: lead.sourceUrl || `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(lead.title)}`,
      trendNotes: data.detail,
    };
  }, [alert, bottom, data.detail, dress, dressMode, shoe, top]);

  const dressMe = async () => {
    const lead = dressMode ? dress : top;
    if (!lead) return;
    if (!person) {
      setNote('Upload a full-body photo first. DRESS ME puts these clothes on that photo.');
      setTryOnUrl(null);
      return;
    }
    setBusy(true);
    setNote('');
    setTryOnUrl(null);
    try {
      const result = await fashionAPI.dress({
        userImage: person,
        garmentImage: lead.imageUrl,
        bottomImage: dressMode ? null : bottom?.imageUrl,
        category: dressMode ? 'dresses' : 'upper_body',
        title: composed?.title || lead.title,
        pieces: composed?.pieces || [lead.title],
      });
      if (result.tryOnUrl) {
        setTryOnUrl(result.tryOnUrl);
        setNote(`Dressed with ${result.engine}.`);
      } else {
        setNote(result.detail || 'Try-on needs FASHN_API_KEY or REPLICATE_API_TOKEN.');
      }
    } catch {
      setNote('The try-on service did not answer. Check FASHN_API_KEY or REPLICATE_API_TOKEN.');
    } finally {
      setBusy(false);
    }
  };

  const shuffleLocal = () => {
    if (data.tops.length) setTopIndex(Math.floor(Math.random() * data.tops.length));
    if (data.bottoms.length) setBottomIndex(Math.floor(Math.random() * data.bottoms.length));
    if (data.shoes.length) setShoeIndex(Math.floor(Math.random() * data.shoes.length));
    if (data.dresses.length) setDressIndex(Math.floor(Math.random() * data.dresses.length));
    onShuffle?.();
  };

  return (
    <section className="chers" data-closet-tour="carousel">
      <header className="chers-titlebar">
        <h2>CHER&apos;S WARDROBE / VIRTUAL CLOSET</h2>
        <div className="chers-title-actions">
          <button type="button" data-closet-tour="shuffle" onClick={shuffleLocal}>
            SHUFFLE
          </button>
          <button type="button" className={dressMode ? 'is-on' : ''} onClick={() => setDressMode((v) => !v)}>
            {dressMode ? 'SEPARATES' : 'FULL RED CARPET DRESS'}
          </button>
        </div>
      </header>
      <p className="chers-marquee">{guideLine || data.detail || 'Cycle each row. The label is the garment in that photo.'}</p>
      <div className="chers-stage">
        <Row
          label="ROW 1 · TOPS / JACKETS"
          pieces={data.tops}
          index={topIndex}
          onPrev={() => setTopIndex((n) => cycle(data.tops.length, n, -1))}
          onNext={() => setTopIndex((n) => cycle(data.tops.length, n, 1))}
        />
        {dressMode ? (
          <Row
            label="ROW 2 · FULL RED CARPET DRESS"
            pieces={data.dresses}
            index={dressIndex}
            onPrev={() => setDressIndex((n) => cycle(data.dresses.length, n, -1))}
            onNext={() => setDressIndex((n) => cycle(data.dresses.length, n, 1))}
          />
        ) : (
          <Row
            label="ROW 2 · BOTTOMS / SKIRTS / PANTS"
            pieces={data.bottoms}
            index={bottomIndex}
            onPrev={() => setBottomIndex((n) => cycle(data.bottoms.length, n, -1))}
            onNext={() => setBottomIndex((n) => cycle(data.bottoms.length, n, 1))}
          />
        )}
        <Row
          label="ROW 3 · SHOES & ACCESSORIES"
          pieces={data.shoes}
          index={shoeIndex}
          onPrev={() => setShoeIndex((n) => cycle(data.shoes.length, n, -1))}
          onNext={() => setShoeIndex((n) => cycle(data.shoes.length, n, 1))}
        />
      </div>
      <div className="chers-status">
        <button type="button" className="chers-dressme" data-closet-tour="tryon" disabled={busy} onClick={() => void dressMe()}>
          {busy ? 'DRESSING…' : 'DRESS ME'}
        </button>
        <div className={`chers-alert ${alert === 'TOTALLY!' ? 'is-good' : 'is-bad'}`} role="status">
          {alert}
        </div>
        {composed && onSave && (
          <button type="button" className="chers-mini" onClick={() => onSave(composed)}>
            SAVE
          </button>
        )}
        {composed && onDraft && (
          <button type="button" className="chers-mini" onClick={() => onDraft(composed)}>
            DRAFT
          </button>
        )}
      </div>
      {tryOnUrl && (
        <div className="chers-result">
          <p>ON YOU</p>
          <img src={tryOnUrl} alt="Virtual try-on of your photo" />
        </div>
      )}
      {note && <p className="chers-note">{note}</p>}
    </section>
  );
}
