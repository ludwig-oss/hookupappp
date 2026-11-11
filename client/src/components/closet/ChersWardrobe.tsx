import { useEffect, useMemo, useRef, useState } from 'react';
import { fashionAPI, type FashionLookCard, type RackPiece, type RedCarpetRacks } from '../../api/fashion';
import GarmentSlot from './GarmentSlot';
import { localStudioRacks } from './studioLooks';
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
  const [fitted, setFitted] = useState(false);
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
        if (!cancel) setLoaded(next.tops.length ? next : localStudioRacks());
      })
      .catch(() => {
        if (!cancel) setLoaded(localStudioRacks());
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
  const remotePerson = userImage && /^https?:\/\//i.test(userImage) ? userImage : null;
  const bodyPhoto = userImage && userImage.length > 8 ? userImage : null;

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

  const familyOf = (piece: RackPiece | null) => {
    if (!piece) return '';
    if (piece.family) return piece.family;
    const title = piece.title.toLowerCase();
    if (title.includes('plaid')) return 'plaid';
    if (title.includes('velvet') || title.includes('column')) return 'evening';
    if (title.includes('ivory') || title.includes('cream') || title.includes('silk') || title.includes('slip')) return 'ivory';
    if (title.includes('leather') || title.includes('black') || title.includes('knit')) return 'black';
    if (title.includes('silver') || title.includes('metallic')) return 'silver';
    if (title.includes('denim') || title.includes('indigo')) return 'denim';
    return title;
  };
  const matched = Boolean(top && bottom && familyOf(top) === familyOf(bottom));

  const tryOn = async () => {
    if (!top) return;
    setFitted(true);
    setBusy(true);
    setNote('');
    try {
      if (!remotePerson || top.imageUrl.startsWith('data:')) {
        setTryOnUrl(null);
        return;
      }
      const result = await fashionAPI.dress({
        userImage: remotePerson,
        garmentImage: top.imageUrl,
        bottomImage: bottom && !bottom.imageUrl.startsWith('data:') ? bottom.imageUrl : null,
        category: 'upper_body',
        title: composed?.title || top.title,
        pieces: composed?.pieces || [top.title],
      });
      if (result.tryOnUrl) {
        setTryOnUrl(result.tryOnUrl);
        if (composed) onSave?.(composed);
      }
    } catch {
      setTryOnUrl(null);
    } finally {
      setBusy(false);
    }
  };

  const spinRef = useRef<number | null>(null);

  const shuffle = () => {
    if (spinning || !tops.length || !bottoms.length) return;
    setSpinning(true);
    setFitted(false);
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
      const pairs: Array<[number, number]> = [];
      tops.forEach((piece, t) => {
        bottoms.forEach((other, b) => {
          const left = piece.family || familyOf(piece);
          const right = other.family || familyOf(other);
          if (left && left === right) pairs.push([t, b]);
        });
      });
      if (pairs.length && Math.random() < 0.7) {
        const [t, b] = pairs[Math.floor(Math.random() * pairs.length)];
        setTopIndex(t);
        setBottomIndex(b);
      } else {
        setTopIndex(Math.floor(Math.random() * tops.length));
        setBottomIndex(Math.floor(Math.random() * bottoms.length));
      }
      setSpinning(false);
    }, 70);
  };

  const reject = (id: string) => {
    setBanned((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  return (
    <section className="fancy" data-closet-tour="carousel">
      <header className="fancy-bar">
        <div className="fancy-mark">REVOLVE</div>
        <nav className="fancy-nav" aria-label="Closet">
          <span>SPOTLIGHT</span>
          <span>NEW</span>
          <span>CLOTHING</span>
          <span>SHOES</span>
          <span>BAGS</span>
          <span>ACCESSORIES</span>
          <span>DESIGNERS</span>
          <span>OCCASIONS</span>
          <span>SALE</span>
        </nav>
      </header>
      <div className="fancy-body">
        <div className="fancy-side" aria-hidden />
        <div className="fancy-stage">
          {fitted ? (
            <div className="fancy-fit">
              <div className="fancy-figure">
                {tryOnUrl ? (
                  <img className="fancy-photo" src={tryOnUrl} alt="Full body with these clothes on" />
                ) : bodyPhoto ? (
                  <img className="fancy-photo" src={bodyPhoto} alt="Your full body" />
                ) : (
                  <svg className="fancy-stand" viewBox="0 0 200 520" aria-label="Full body">
                    <path d="M78 28 Q100 4 122 28 Q128 58 100 70 Q72 58 78 28" fill="#e6c56a" />
                    <ellipse cx="100" cy="46" rx="18" ry="22" fill="#f3d2bc" />
                    <path d="M96 66 H104 V86 H96 Z" fill="#f3d2bc" />
                    <path d="M70 92 L40 168 L52 174 L78 112 Z" fill="#f3d2bc" />
                    <path d="M130 92 L160 168 L148 174 L122 112 Z" fill="#f3d2bc" />
                    <path d="M78 88 H122 L130 168 H70 Z" fill="#f7f7f7" />
                    <path d="M74 164 H126 L132 214 H68 Z" fill="#111" />
                    <path d="M84 210 H100 L96 360 H80 Z" fill="#f3d2bc" />
                    <path d="M100 210 H116 L120 360 H104 Z" fill="#f3d2bc" />
                    <path d="M80 300 H100 V392 H76 Z" fill="#f4f4f4" />
                    <path d="M100 300 H120 V392 H124 Z" fill="#f4f4f4" />
                    <path d="M74 386 H102 L100 404 H70 Z" fill="#111" />
                    <path d="M98 386 H126 L130 404 H100 Z" fill="#111" />
                  </svg>
                )}
                {!tryOnUrl && top ? <img className="fancy-wear fancy-wear-top" src={top.imageUrl} alt={garmentName(top.title)} /> : null}
                {!tryOnUrl && bottom ? (
                  <img className="fancy-wear fancy-wear-bottom" src={bottom.imageUrl} alt={garmentName(bottom.title)} />
                ) : null}
              </div>
            </div>
          ) : (
            <>
              <div className="fancy-row">
                <button type="button" className="fancy-arrow" onClick={() => setTopIndex((n) => cycle(tops.length, n, -1))} aria-label="Previous top">
                  {'<'}
                </button>
                <div className="fancy-window">
                  {top ? (
                    <GarmentSlot url={top.imageUrl} slot="top" title={garmentName(top.title)} onReject={() => reject(top.id)} />
                  ) : null}
                </div>
                <button type="button" className="fancy-arrow" onClick={() => setTopIndex((n) => cycle(tops.length, n, 1))} aria-label="Next top">
                  {'>'}
                </button>
              </div>
              {matched ? <div className="fancy-match">MATCH</div> : null}
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
            </>
          )}
        </div>
        <div className="fancy-side" aria-hidden />
        <button type="button" className="fancy-shuffle" data-closet-tour="shuffle" onClick={shuffle} disabled={spinning}>
          SHUFFLE
        </button>
        <button type="button" className="fancy-try" data-closet-tour="tryon" onClick={() => void tryOn()} disabled={busy || !top}>
          TRY ON
        </button>
      </div>
      {note ? <p className="fancy-note">{note}</p> : null}
    </section>
  );
}
