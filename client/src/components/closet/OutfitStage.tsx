import { useEffect, useMemo, useRef, useState } from 'react';
import { fashionAPI, type FashionLookCard, type RackPiece, type RedCarpetRacks } from '../../api/fashion';
import GarmentSlot from './GarmentSlot';
import { localStudioRacks } from './studioLooks';
import './OutfitStage.css';

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

function familyOf(piece: RackPiece | null) {
  if (!piece) return '';
  if (piece.family) return piece.family;
  const title = piece.title.toLowerCase();
  if (title.includes('plaid')) return 'plaid';
  if (title.includes('velvet') || title.includes('column')) return 'evening';
  if (title.includes('ivory') || title.includes('cream') || title.includes('silk') || title.includes('slip')) return 'ivory';
  if (title.includes('leather') || title.includes('black') || title.includes('knit') || title.includes('boot')) return 'black';
  if (title.includes('silver') || title.includes('metallic')) return 'silver';
  if (title.includes('denim') || title.includes('indigo')) return 'denim';
  if (title.includes('white') || title.includes('sneaker')) return 'white';
  return title;
}

function ShopTag({ piece }: { piece: RackPiece | null }) {
  if (!piece?.buyUrl) return null;
  const label = [piece.price, piece.store].filter(Boolean).join(' · ') || 'Shop';
  return (
    <a className="wardrobe-shop" href={piece.buyUrl} target="_blank" rel="noreferrer">
      {label}
    </a>
  );
}

export default function OutfitStage({
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
  const [shoeIndex, setShoeIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [tryOnUrl, setTryOnUrl] = useState<string | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (racks && (racks.tops.length || racks.bottoms.length || racks.shoes.length)) {
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
  const shoes = data.shoes.filter((piece) => !banned.includes(piece.id));
  const top = at(tops, topIndex);
  const bottom = at(bottoms, bottomIndex);
  const shoe = at(shoes, shoeIndex);
  const remotePerson = userImage && /^https?:\/\//i.test(userImage) ? userImage : null;
  const matched = Boolean(top && bottom && familyOf(top) === familyOf(bottom));

  const composed = useMemo<FashionLookCard | null>(() => {
    if (!top && !bottom && !shoe) return null;
    const pieces = [top?.title, bottom?.title, shoe?.title].filter(Boolean) as string[];
    const lead = top || bottom || shoe;
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
      shopUrl: lead.buyUrl || '',
      trendNotes: '',
    };
  }, [bottom, shoe, top]);

  const tryOn = async () => {
    if (!top) return;
    if (!remotePerson) {
      setTryOnUrl(null);
      setNote('Upload a full-body photo. Try on dresses that photo and keeps your face, hair, and proportions.');
      return;
    }
    if (top.imageUrl.startsWith('data:')) {
      setTryOnUrl(null);
      setNote('Product photos need SERPAPI_API_KEY. The photo try-on needs FASHN_API_KEY or REPLICATE_API_TOKEN.');
      return;
    }
    setBusy(true);
    setNote('');
    setTryOnUrl(null);
    try {
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
      setShoeIndex((index) => cycle(shoes.length, index, 1));
      if (ticks < 12) return;
      if (spinRef.current) window.clearInterval(spinRef.current);
      spinRef.current = null;
      const pairs: Array<[number, number, number]> = [];
      tops.forEach((piece, t) => {
        bottoms.forEach((other, b) => {
          if (familyOf(piece) !== familyOf(other)) return;
          const shoeHits = shoes
            .map((item, s) => (familyOf(item) === familyOf(piece) ? s : -1))
            .filter((s) => s >= 0);
          const s = shoeHits.length ? shoeHits[Math.floor(Math.random() * shoeHits.length)] : 0;
          pairs.push([t, b, s]);
        });
      });
      if (pairs.length && Math.random() < 0.7) {
        const [t, b, s] = pairs[Math.floor(Math.random() * pairs.length)];
        setTopIndex(t);
        setBottomIndex(b);
        setShoeIndex(s);
      } else {
        setTopIndex(Math.floor(Math.random() * tops.length));
        setBottomIndex(Math.floor(Math.random() * bottoms.length));
        if (shoes.length) setShoeIndex(Math.floor(Math.random() * shoes.length));
      }
      setSpinning(false);
    }, 70);
  };

  const reject = (id: string) => {
    setBanned((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const row = (
    label: string,
    piece: RackPiece | null,
    slot: 'top' | 'bottom' | 'shoes',
    onPrev: () => void,
    onNext: () => void
  ) => (
    <div className="wardrobe-row">
      <button type="button" className="wardrobe-arrow" onClick={onPrev} aria-label={`Previous ${label}`}>
        {'<'}
      </button>
      <div className="wardrobe-window">
        {piece ? (
          <GarmentSlot url={piece.imageUrl} slot={slot === 'shoes' ? 'shoes' : slot} title={garmentName(piece.title)} onReject={() => reject(piece.id)} />
        ) : null}
        <ShopTag piece={piece} />
      </div>
      <button type="button" className="wardrobe-arrow" onClick={onNext} aria-label={`Next ${label}`}>
        {'>'}
      </button>
    </div>
  );

  const shopPieces = [top, bottom, shoe].filter((piece): piece is RackPiece => Boolean(piece?.buyUrl));

  return (
    <section className="wardrobe" data-closet-tour="carousel">
      <header className="wardrobe-bar">
        <div className="wardrobe-mark">HOOK UP</div>
        <p className="wardrobe-kicker">Wardrobe</p>
      </header>
      <div className="wardrobe-body">
        <div className="wardrobe-side" aria-hidden />
        <div className="wardrobe-stage">
          {tryOnUrl ? (
            <img className="wardrobe-photo" src={tryOnUrl} alt="Your photo with these clothes on" />
          ) : (
            <>
              {row('top', top, 'top', () => setTopIndex((n) => cycle(tops.length, n, -1)), () => setTopIndex((n) => cycle(tops.length, n, 1)))}
              {matched ? <div className="wardrobe-match">MATCH</div> : null}
              {row('bottom', bottom, 'bottom', () => setBottomIndex((n) => cycle(bottoms.length, n, -1)), () => setBottomIndex((n) => cycle(bottoms.length, n, 1)))}
              {row('shoes', shoe, 'shoes', () => setShoeIndex((n) => cycle(shoes.length, n, -1)), () => setShoeIndex((n) => cycle(shoes.length, n, 1)))}
            </>
          )}
        </div>
        <div className="wardrobe-side" aria-hidden />
        <button type="button" className="wardrobe-shuffle" data-closet-tour="shuffle" onClick={shuffle} disabled={spinning}>
          SHUFFLE
        </button>
        <button type="button" className="wardrobe-try" data-closet-tour="tryon" onClick={() => void tryOn()} disabled={busy || !top}>
          {busy ? '…' : 'TRY ON'}
        </button>
      </div>
      <div className="wardrobe-shop-bar">
        <button type="button" className="wardrobe-shop-toggle" onClick={() => setShopOpen((open) => !open)}>
          Shop pieces
        </button>
        {shopOpen ? (
          <ul className="wardrobe-drawer">
            {shopPieces.map((piece) => (
              <li key={piece.id}>
                <a href={piece.buyUrl} target="_blank" rel="noreferrer">
                  <strong>{garmentName(piece.title)}</strong>
                  <span>{[piece.price, piece.store].filter(Boolean).join(' · ') || 'Open shop'}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {note ? <p className="wardrobe-note">{note}</p> : null}
    </section>
  );
}
