import { useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../../api/config';
import { wardrobeCatalog, type WardrobePiece } from '../../data/wardrobeCatalog';
import { freeVirtualTryOn } from '../../lib/freeTryOn';

type Mode = 'clothes' | 'body';

function at(list: WardrobePiece[], index: number) {
  if (!list.length) return null;
  return list[((index % list.length) + list.length) % list.length];
}

function mixIndex(list: WardrobePiece[], avoid: string | undefined, salt: number) {
  const other = list.filter((item) => item.vibe !== avoid);
  const pool = other.length ? other : list;
  return list.indexOf(pool[salt % pool.length]);
}

async function asBlob(source: string | Blob): Promise<Blob> {
  if (source instanceof Blob) return source;
  try {
    const direct = await fetch(source);
    if (direct.ok) return await direct.blob();
  } catch {
    /* Store hosts that block the browser fall through to our image proxy. */
  }
  const response = await axios.get(`${API_BASE}/api/fashion/garment-image`, {
    params: { url: source },
    responseType: 'blob',
    timeout: 20000,
  });
  return response.data as Blob;
}

function SlotRow({
  item,
  tall,
  onPrev,
  onNext,
  onOpen,
}: {
  item: WardrobePiece;
  tall?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onOpen: (item: WardrobePiece) => void;
}) {
  return (
    <div className={`fashion-slot${tall ? ' is-dress' : ''}`}>
      <button type="button" className="fashion-slot-arrow" onClick={onPrev} aria-label={`Previous ${item.slot}`}>
        {'<'}
      </button>
      <button type="button" className="fashion-slot-photo" onClick={() => onOpen(item)}>
        <img src={item.imageUrl} alt={item.title} referrerPolicy="no-referrer" />
      </button>
      <button type="button" className="fashion-slot-arrow" onClick={onNext} aria-label={`Next ${item.slot}`}>
        {'>'}
      </button>
    </div>
  );
}

export default function OutfitOptionCard({
  label,
  seed,
  avatarUrl,
  personUrl,
  winner,
}: {
  label: 'A' | 'B';
  seed: number;
  avatarUrl?: string | null;
  personUrl?: string | null;
  winner?: boolean;
}) {
  const [topIndex, setTopIndex] = useState(seed % wardrobeCatalog.tops.length);
  const [bottomIndex, setBottomIndex] = useState((seed + 3) % wardrobeCatalog.bottoms.length);
  const [shoeIndex, setShoeIndex] = useState((seed + 5) % wardrobeCatalog.shoes.length);
  const [dressIndex, setDressIndex] = useState(seed % wardrobeCatalog.dresses.length);
  const [dressOn, setDressOn] = useState(false);
  const [mode, setMode] = useState<Mode>('clothes');
  const [shop, setShop] = useState<WardrobePiece | null>(null);
  const [fitting, setFitting] = useState(false);
  const [tryOnUrl, setTryOnUrl] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [localPerson, setLocalPerson] = useState<string | null>(null);

  const top = at(wardrobeCatalog.tops, topIndex);
  const bottom = at(wardrobeCatalog.bottoms, bottomIndex);
  const shoe = at(wardrobeCatalog.shoes, shoeIndex);
  const dress = at(wardrobeCatalog.dresses, dressIndex);
  const worn = useMemo(() => {
    const rows = dressOn && dress ? [dress, shoe] : [top, bottom, shoe];
    return rows.filter((item): item is WardrobePiece => Boolean(item));
  }, [bottom, dress, dressOn, shoe, top]);

  const shuffle = () => {
    const salt = Math.floor(Math.random() * 97) + 1;
    const useDress = Math.random() < 0.34;
    setDressOn(useDress);
    setTopIndex(mixIndex(wardrobeCatalog.tops, undefined, salt));
    const topVibe = wardrobeCatalog.tops[mixIndex(wardrobeCatalog.tops, undefined, salt)]?.vibe;
    setBottomIndex(mixIndex(wardrobeCatalog.bottoms, topVibe, salt + 4));
    setShoeIndex(mixIndex(wardrobeCatalog.shoes, topVibe, salt + 9));
    setDressIndex(mixIndex(wardrobeCatalog.dresses, topVibe, salt + 2));
    setMode('clothes');
    setTryOnUrl(null);
    setNote('');
  };

  const tryOn = async () => {
    const garment = dressOn && dress ? dress : top;
    const photo = localPerson || personUrl;
    if (!garment) return;
    if (!photo) {
      setMode('body');
      setNote('Upload your photo in this card, then try on.');
      return;
    }
    setMode('body');
    setFitting(true);
    setNote('');
    setTryOnUrl(null);
    try {
      const [person, cloth] = await Promise.all([asBlob(photo), asBlob(garment.imageUrl)]);
      const url = await freeVirtualTryOn(person, cloth, `${garment.brand} ${garment.title}`);
      setTryOnUrl(url);
    } catch {
      setTryOnUrl(null);
      setNote('The public try-on queue is busy. Your clothes stay right here — try again in a moment.');
    } finally {
      setFitting(false);
    }
  };

  return (
    <article className={`fashion-card${winner ? ' is-winner' : ''}`}>
      <div className="fashion-card-photo">
        <div className="fashion-card-avatar">
          {avatarUrl || localPerson || personUrl ? (
            <img src={avatarUrl || localPerson || personUrl || ''} alt="" />
          ) : (
            <span />
          )}
        </div>
        <div className="fashion-view-toggle" role="tablist" aria-label="Outfit view">
          <button type="button" className={mode === 'clothes' ? 'is-on' : ''} onClick={() => setMode('clothes')}>
            Clothes
          </button>
          <button type="button" className={mode === 'body' ? 'is-on' : ''} onClick={() => void tryOn()}>
            On Body
          </button>
        </div>
        {mode === 'body' ? (
          <div className="fashion-on-body">
            {fitting ? <p className="fashion-fitting">Fitting garment onto your photo...</p> : null}
            {tryOnUrl && !fitting ? <img className="fashion-tryon" src={tryOnUrl} alt="You wearing this outfit" /> : null}
            {note && !fitting ? <p className="fashion-fitting">{note}</p> : null}
          </div>
        ) : (
          <div className="fashion-stack">
            {dressOn && dress ? (
              <SlotRow
                item={dress}
                tall
                onPrev={() => setDressIndex((n) => n - 1)}
                onNext={() => setDressIndex((n) => n + 1)}
                onOpen={setShop}
              />
            ) : (
              <>
                {top ? (
                  <SlotRow item={top} onPrev={() => setTopIndex((n) => n - 1)} onNext={() => setTopIndex((n) => n + 1)} onOpen={setShop} />
                ) : null}
                {bottom ? (
                  <SlotRow
                    item={bottom}
                    onPrev={() => setBottomIndex((n) => n - 1)}
                    onNext={() => setBottomIndex((n) => n + 1)}
                    onOpen={setShop}
                  />
                ) : null}
              </>
            )}
            {shoe ? (
              <SlotRow item={shoe} onPrev={() => setShoeIndex((n) => n - 1)} onNext={() => setShoeIndex((n) => n + 1)} onOpen={setShop} />
            ) : null}
          </div>
        )}
      </div>
      <div className="fashion-card-copy">
        <div className="fashion-opt">Option {label}</div>
        <h3>{worn.map((item) => item.title).join(' + ')}</h3>
        <ul>
          {worn.map((item) => (
            <li key={item.id}>
              <button type="button" className="fashion-piece-name" onClick={() => setShop(item)}>
                {item.brand} {item.title}
              </button>
              <a className="fashion-shop-link" href={item.buyUrl} target="_blank" rel="noopener noreferrer">
                Shop
              </a>
            </li>
          ))}
        </ul>
        {shop ? (
          <div className="fashion-buy">
            <div className="fashion-buy-head">
              <strong>Where to buy</strong>
              <button type="button" className="ghost" onClick={() => setShop(null)}>
                Close
              </button>
            </div>
            <p>
              {shop.brand} · {shop.store}
            </p>
            <p>{shop.price}</p>
            <ul>
              {shop.similar.map((match) => (
                <li key={match.store}>
                  <span>
                    {match.store} · {match.price}
                  </span>
                  <a className="fashion-shop-link" href={match.buyUrl} target="_blank" rel="noopener noreferrer">
                    Shop
                  </a>
                </li>
              ))}
            </ul>
            <a className="fashion-store-btn" href={shop.buyUrl} target="_blank" rel="noopener noreferrer">
              Open store
            </a>
          </div>
        ) : null}
      </div>
      <div className="fashion-card-actions">
        <button type="button" onClick={shuffle}>
          Shuffle
        </button>
        <button type="button" onClick={() => setDressOn((on) => !on)}>
          {dressOn ? 'Separates' : 'Dress'}
        </button>
        <button type="button" onClick={() => void tryOn()} disabled={fitting}>
          Try On
        </button>
        <label className="fashion-photo-pick">
          Your photo
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setLocalPerson(URL.createObjectURL(file));
              setNote('');
            }}
          />
        </label>
      </div>
    </article>
  );
}
