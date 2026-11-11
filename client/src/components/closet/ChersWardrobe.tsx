import { useEffect, useMemo, useRef, useState } from 'react';
import { fashionAPI, type FashionLookCard, type RackPiece, type RedCarpetRacks } from '../../api/fashion';
import GarmentSlot from './GarmentSlot';
import './ChersWardrobe.css';

const EMPTY: RedCarpetRacks = {
  tops: [],
  bottoms: [],
  dresses: [],
  shoes: [],
  source: 'studio',
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

function garmentName(title: string) {
  return title
    .replace(/pinterest|met gala|oscars?|grammys?|cannes|red carpet/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function ChersWardrobe({
  racks,
  prompt,
  userImage,
  onSave,
}: {
  racks?: RedCarpetRacks | null;
  prompt?: string;
  userImage?: string | null;
  guideLine?: string;
  onSave?: (look: FashionLookCard) => void;
  onDraft?: (look: FashionLookCard) => void;
  onShuffle?: () => void;
}) {
  const [loaded, setLoaded] = useState<RedCarpetRacks | null>(racks && racks.tops.length ? racks : null);
  const [banned, setBanned] = useState<string[]>([]);
  const [topIndex, setTopIndex] = useState(0);
  const [bottomIndex, setBottomIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [tryOnUrl, setTryOnUrl] = useState<string | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (racks && (racks.tops.length || racks.bottoms.length)) {
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
  const tops = data.tops.filter((piece) => !banned.includes(piece.id));
  const bottoms = data.bottoms.filter((piece) => !banned.includes(piece.id));
  const top = at(tops, topIndex);
  const bottom = at(bottoms, bottomIndex);
  const person = userImage && /^https?:\/\//i.test(userImage) ? userImage : null;

  const composed = useMemo<FashionLookCard | null>(() => {
    if (!top && !bottom) return null;
    const pieces = [top?.title, bottom?.title].filter(Boolean) as string[];
    const lead = top || bottom;
    if (!lead) return null;
    return {
      id: pieces.join('|').slice(0, 80),
      title: pieces.join(' + '),
      event: 'casual',
      vibe: 'mixed',
      formality: 'mid',
      palette: [],
      pieces,
      imageUrl: lead.imageUrl,
      fallback: '#ffffff',
      warp: 'tailored',
      shopUrl: '',
      trendNotes: '',
    };
  }, [bottom, top]);

  const tryOn = async () => {
    if (!top) return;
    if (!person) {
      setNote('Upload a full-body photo first. TRY ON puts these clothes on that photo.');
      setTryOnUrl(null);
      return;
    }
    setBusy(true);
    setNote('');
    setTryOnUrl(null);
    try {
      const result = await fashionAPI.dress({
        userImage: person,
        garmentImage: top.imageUrl.startsWith('data:') ? top.imageUrl : top.imageUrl,
        bottomImage: bottom && !bottom.imageUrl.startsWith('data:') ? bottom.imageUrl : null,
        category: 'upper_body',
        title: composed?.title || top.title,
        pieces: composed?.pieces || [top.title],
      });
      if (result.tryOnUrl) {
        setTryOnUrl(result.tryOnUrl);
        setNote('');
        if (composed) onSave?.(composed);
      } else {
        setNote(result.detail || 'Add FASHN_API_KEY or REPLICATE_API_TOKEN in server/.env.');
      }
    } catch {
      setNote('Try-on did not answer. Add FASHN_API_KEY or REPLICATE_API_TOKEN.');
    } finally {
      setBusy(false);
    }
  };

  const spinRef = useRef<number | null>(null);

  const shuffle = () => {
    if (spinning || !tops.length || !bottoms.length) return;
    setSpinning(true);
    setTryOnUrl(null);
    if (spinRef.current) window.clearInterval(spinRef.current);
    let ticks = 0;
    spinRef.current = window.setInterval(() => {
      ticks += 1;
      setTopIndex((index) => cycle(tops.length, index, 1));
      setBottomIndex((index) => cycle(bottoms.length, index, 1));
      if (ticks < 12) return;
      if (spinRef.current) window.clearInterval(spinRef.current);
      spinRef.current = null;
      const vintageTops = tops.map((piece, index) => (piece.era === 'vintage' ? index : -1)).filter((index) => index >= 0);
      const modernBottoms = bottoms
        .map((piece, index) => (piece.era === 'modern' ? index : -1))
        .filter((index) => index >= 0);
      const pick = (pool: number[], length: number) =>
        pool.length ? pool[Math.floor(Math.random() * pool.length)] : Math.floor(Math.random() * length);
      setTopIndex(pick(vintageTops, tops.length));
      setBottomIndex(pick(modernBottoms, bottoms.length));
      setSpinning(false);
    }, 70);
  };

  const reject = (id: string) => {
    setBanned((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  return (
    <section className="fancy" data-closet-tour="carousel">
      <div className="fancy-side" aria-hidden />
      <div className="fancy-stage">
        <div className="fancy-row">
          <button type="button" className="fancy-arrow" onClick={() => setTopIndex((n) => cycle(tops.length, n, -1))} aria-label="Previous top">
            {'<'}
          </button>
          <div className="fancy-window">
            {top ? (
              <GarmentSlot url={top.imageUrl} slot="top" title={garmentName(top.title)} onReject={() => reject(top.id)} />
            ) : null}
            <p className="fancy-name">{top ? garmentName(top.title) : ''}</p>
          </div>
          <button type="button" className="fancy-arrow" onClick={() => setTopIndex((n) => cycle(tops.length, n, 1))} aria-label="Next top">
            {'>'}
          </button>
        </div>
        <div className="fancy-row">
          <button
            type="button"
            className="fancy-arrow"
            onClick={() => setBottomIndex((n) => cycle(bottoms.length, n, -1))}
            aria-label="Previous bottom"
          >
            {'<'}
          </button>
          <div className="fancy-window">
            {bottom ? (
              <GarmentSlot
                url={bottom.imageUrl}
                slot="bottom"
                title={garmentName(bottom.title)}
                onReject={() => reject(bottom.id)}
              />
            ) : null}
            <p className="fancy-name">{bottom ? garmentName(bottom.title) : ''}</p>
          </div>
          <button
            type="button"
            className="fancy-arrow"
            onClick={() => setBottomIndex((n) => cycle(bottoms.length, n, 1))}
            aria-label="Next bottom"
          >
            {'>'}
          </button>
        </div>
        <div className="fancy-actions">
          <button type="button" data-closet-tour="shuffle" onClick={shuffle} disabled={spinning}>
            SHUFFLE
          </button>
          <button type="button" data-closet-tour="tryon" onClick={() => void tryOn()} disabled={busy}>
            {busy ? 'TRY ON' : 'TRY ON'}
          </button>
        </div>
        {tryOnUrl && (
          <div className="fancy-result">
            <img src={tryOnUrl} alt="Clothes fitted on your photo" />
          </div>
        )}
        {note && <p className="fancy-note">{note}</p>}
      </div>
      <div className="fancy-side" aria-hidden />
    </section>
  );
}
