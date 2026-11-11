import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../../api/config';
import { fashionAPI, type RackPiece } from '../../api/fashion';
import { catalogFor, pieceMatchesAudience, type WardrobeAudience, type WardrobePiece } from '../../data/wardrobeCatalog';
import { freeVirtualTryOn } from '../../lib/freeTryOn';

type PieceSlot = 'tops' | 'bottoms' | 'shoes';
type Mode = 'clothes' | 'body';

const FAMILIES = [
  'graphic tee', 'oversize tee', 'varsity', 'track jacket', 'hoodie', 'blazer', 'bomber', 'cardigan',
  'turtleneck', 'flannel', 'denim jacket', 'linen', 'overshirt', 'chore coat', 'oxford', 'polo',
  'sweater', 'vest', 'tee', 'shirt', 'jacket', 'jean', 'chino', 'trouser', 'corduroy', 'cargo',
  'carpenter', 'loafer', 'sneaker', 'chelsea', 'derby', 'desert', 'runner', 'skate', 'boot',
];

function familyOf(title: string): string {
  const text = title.toLowerCase();
  return FAMILIES.find((kind) => text.includes(kind)) || '';
}

function hasColor(title: string, color: string): boolean {
  const text = title.toLowerCase();
  if (text.includes(color)) return true;
  return color === 'grey' && text.includes('gray');
}
type StyleAim = 'flashy' | 'blend' | 'unique' | 'mix';

const STYLE_ORDER: StyleAim[] = ['flashy', 'blend', 'unique', 'mix'];
const STYLE_COPY: Record<StyleAim, string> = {
  flashy: 'Flashy — one piece is there to get attention',
  blend: 'Blended — the colors sit together',
  unique: 'Unique — a contrast that still holds',
  mix: 'Creative — spikes, paint, rips, and patches on the top, the trousers, and the shoes',
};

const HUES: { id: string; label: string; hex: string }[] = [
  { id: '', label: 'All colors', hex: '#2a2a2a' },
  { id: 'black', label: 'Black', hex: '#111111' },
  { id: 'white', label: 'White', hex: '#f4f4f4' },
  { id: 'navy', label: 'Navy', hex: '#1b2a4a' },
  { id: 'grey', label: 'Grey', hex: '#8a8f98' },
  { id: 'brown', label: 'Brown', hex: '#6b4423' },
  { id: 'beige', label: 'Beige', hex: '#d8c3a5' },
  { id: 'olive', label: 'Olive', hex: '#556b2f' },
  { id: 'burgundy', label: 'Burgundy', hex: '#6e1e2a' },
  { id: 'red', label: 'Red', hex: '#c0392b' },
  { id: 'blue', label: 'Blue', hex: '#2471a3' },
  { id: 'green', label: 'Green', hex: '#1e8449' },
  { id: 'pink', label: 'Pink', hex: '#e8a0bf' },
  { id: 'yellow', label: 'Yellow', hex: '#f1c40f' },
  { id: 'purple', label: 'Purple', hex: '#6c3483' },
  { id: 'orange', label: 'Orange', hex: '#e67e22' },
  { id: 'cream', label: 'Cream', hex: '#f7f1e3' },
];

function toneOf(title: string): string {
  const text = title.toLowerCase();
  if (/\bblack\b/.test(text)) return 'black';
  if (/white|ivory|cream/.test(text)) return 'light';
  if (/navy|indigo|\bblue\b|denim/.test(text)) return 'blue';
  if (/brown|tan|camel|beige|khaki|olive|sand/.test(text)) return 'earth';
  if (/red|yellow|green|pink|purple|orange|gold/.test(text)) return 'color';
  return 'neutral';
}

const MADE = /\b(spikes?|studs?|studded|painted|paint splatter|splatter|graffiti|ripped|ragged|distressed|patched|bleached|frayed|chains?|safety pin|shredded|destroyed|acid wash|deconstructed|grommets?|slashed|handmade|hand painted|custom painted|beat up)\b/;

function madePiece(item: WardrobePiece | null | undefined): boolean {
  return Boolean(item && MADE.test(item.title.toLowerCase()));
}

function loudPiece(item: WardrobePiece): boolean {
  return madePiece(item) || toneOf(item.title) === 'color';
}

function pickMade(list: WardrobePiece[], salt: number, extra: (item: WardrobePiece) => boolean): number {
  if (!list.length) return 0;
  const sideCatalog = new Set(['ma-loafer', 'sm-keller', 'toms-sneaker', 'tc-denim']);
  const rows = list.map((item, index) => ({ item, index })).filter(({ item }) => !sideCatalog.has(item.id));
  if (!rows.length) return -1;
  const made = rows.filter(({ item }) => madePiece(item));
  const pool = made.length ? made : rows;
  const liked = pool.filter(({ item }) => extra(item));
  const use = liked.length ? liked : pool;
  return use[Math.abs(salt) % use.length].index;
}

function indexWhere(list: WardrobePiece[], salt: number, prefer: (item: WardrobePiece) => boolean): number {
  if (!list.length) return 0;
  const liked: number[] = [];
  list.forEach((item, index) => {
    if (prefer(item)) liked.push(index);
  });
  const pool = liked.length ? liked : list.map((_, index) => index);
  return pool[Math.abs(salt) % pool.length];
}

function styleIndices(
  lists: { tops: WardrobePiece[]; bottoms: WardrobePiece[]; dresses: WardrobePiece[]; shoes: WardrobePiece[] },
  aim: StyleAim,
  salt: number,
  allowDress: boolean
) {
  const top = pickMade(lists.tops, salt, (item) => {
    if (aim === 'flashy') return loudPiece(item);
    if (aim === 'blend') return toneOf(item.title) !== 'color';
    return item.vibe === '90s-vintage' || item.vibe === 'street-luxe' || madePiece(item);
  });
  const hero = lists.tops[top];
  const heroTone = hero ? toneOf(hero.title) : 'neutral';
  const agrees = (item: WardrobePiece) => {
    const tone = toneOf(item.title);
    return tone === heroTone || tone === 'neutral' || heroTone === 'neutral';
  };
  const bottom = pickMade(lists.bottoms, salt + 3, (item) => (aim === 'blend' ? agrees(item) : item.vibe !== hero?.vibe || madePiece(item)));
  const shoe = pickMade(lists.shoes, salt + 7, (item) => (aim === 'blend' ? agrees(item) : madePiece(item) || item.vibe !== hero?.vibe));
  const dressIndex = indexWhere(lists.dresses, salt + 2, (item) => (aim === 'flashy' ? loudPiece(item) : true));
  const useDress = allowDress && lists.dresses.length > 0 && (aim === 'flashy' || aim === 'unique') && salt % 3 === 0;
  return { top, bottom, shoe, dressIndex, dress: useDress };
}

function at(list: WardrobePiece[], index: number) {
  if (!list.length || index < 0) return null;
  return list[((index % list.length) + list.length) % list.length];
}

function fromShop(row: RackPiece): WardrobePiece | null {
  if (!row.imageUrl.startsWith('https://')) return null;
  const slot = row.slot === 'top' ? 'tops' : row.slot === 'bottom' ? 'bottoms' : row.slot === 'dress' ? 'dresses' : 'shoes';
  if (slot === 'bottoms' && /\b(sneakers?|loafers?|boots|shoes|footwear|hanger|waistband|interior|side view|profile|back view)\b/i.test(row.title) && !/bootcut/i.test(row.title)) return null;
  if (slot === 'shoes' && /\b(jeans?|pants|trousers|person|model|wearing|side view|profile|legs|outfit)\b/i.test(row.title)) return null;
  const buy = row.buyUrl || row.sourceUrl;
  const price = row.price || 'See store';
  const query = encodeURIComponent(row.title);
  return {
    id: row.id,
    slot,
    title: row.title,
    brand: row.store || 'Shop',
    price,
    store: row.store || 'Online',
    buyUrl: buy.startsWith('https://') ? buy : `https://www.google.com/search?tbm=shop&q=${query}`,
    imageUrl: row.imageUrl,
    vibe:
      row.era === 'vintage' || /vintage|retro|90s|plaid|corduroy/.test(row.title.toLowerCase())
        ? '90s-vintage'
        : /leather|sneaker|hoodie|bomber|denim|cargo|graphic|baggy|skate|varsity|street/.test(row.title.toLowerCase())
          ? 'street-luxe'
          : 'modern-runway',
    similar: [
      { store: 'Nordstrom', price, buyUrl: `https://www.nordstrom.com/sr?keyword=${query}` },
      { store: 'SSENSE', price, buyUrl: `https://www.ssense.com/en-us/search?q=${query}` },
    ],
  };
}

function mergeSlot(online: WardrobePiece[], saved: WardrobePiece[]) {
  const seen = new Set<string>();
  const titles = new Set<string>();
  const out: WardrobePiece[] = [];
  for (const item of [...saved, ...online]) {
    const titleKey = `${item.slot}:${item.title.toLowerCase().replace(/[^a-z0-9]+/g, '')}`;
    if (seen.has(item.imageUrl) || titles.has(titleKey)) continue;
    seen.add(item.imageUrl);
    titles.add(titleKey);
    out.push(item);
  }
  return out;
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
  picked,
  onPrev,
  onNext,
  onPick,
}: {
  item: WardrobePiece;
  tall?: boolean;
  picked?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onPick: () => void;
}) {
  const frame = item.slot === 'tops' ? 'is-top' : item.slot === 'bottoms' ? 'is-bottom' : item.slot === 'shoes' ? 'is-shoes' : 'is-dress';
  return (
    <div className={`fashion-slot ${frame}${tall ? ' is-dress' : ''}${picked ? ' is-picked' : ''}`}>
      <button type="button" className="fashion-slot-arrow" onClick={onPrev} aria-label={`Previous ${item.slot}`}>
        {'<'}
      </button>
      <button type="button" className="fashion-slot-photo" onClick={onPick}>
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
  audience = null,
}: {
  label: 'A' | 'B';
  seed: number;
  avatarUrl?: string | null;
  personUrl?: string | null;
  winner?: boolean;
  audience?: WardrobeAudience | null;
}) {
  const saved = useMemo(() => catalogFor(audience), [audience]);
  const [lists, setLists] = useState(saved);
  const [fresh, setFresh] = useState(audience === 'women' ? "Pulling today's women's clothes..." : "Pulling today's men's clothes...");
  const [styleAim, setStyleAim] = useState<StyleAim>('mix');
  const pageRef = useRef(0);
  const moreRef = useRef(false);
  const pendingRef = useRef<{ color: string; slot: PieceSlot; family: string } | null>(null);
  const [hue, setHue] = useState('');
  const [focus, setFocus] = useState<PieceSlot>('tops');
  const [topIndex, setTopIndex] = useState(seed % Math.max(saved.tops.length, 1));
  const [bottomIndex, setBottomIndex] = useState((seed + 3) % Math.max(saved.bottoms.length, 1));
  const [shoeIndex, setShoeIndex] = useState((seed + 5) % Math.max(saved.shoes.length, 1));
  const [dressIndex, setDressIndex] = useState(seed % Math.max(saved.dresses.length, 1));
  const [dressOn, setDressOn] = useState(false);
  const [mode, setMode] = useState<Mode>('clothes');
  const [shop, setShop] = useState<WardrobePiece | null>(null);
  const [fitting, setFitting] = useState(false);
  const [tryOnUrl, setTryOnUrl] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [localPerson, setLocalPerson] = useState<string | null>(null);
  const listsRef = useRef(lists);
  const topIndexRef = useRef(topIndex);
  const bottomIndexRef = useRef(bottomIndex);
  const shoeIndexRef = useRef(shoeIndex);
  listsRef.current = lists;
  topIndexRef.current = topIndex;
  bottomIndexRef.current = bottomIndex;
  shoeIndexRef.current = shoeIndex;

  const who = audience === 'women' ? "women's" : "men's";
  const allowDress = audience !== 'men';

  const readRacks = useCallback(
    (racks: { tops?: RackPiece[]; bottoms?: RackPiece[]; dresses?: RackPiece[]; shoes?: RackPiece[] }) => {
      const take = (rows: RackPiece[] | undefined) =>
        (rows || [])
          .map(fromShop)
          .filter((item): item is WardrobePiece => Boolean(item))
          .filter((item) => pieceMatchesAudience(`${item.title} ${item.buyUrl}`, audience));
      return {
        tops: take(racks.tops),
        bottoms: take(racks.bottoms),
        dresses: allowDress ? take(racks.dresses) : [],
        shoes: take(racks.shoes),
      };
    },
    [allowDress, audience]
  );

  const applyStyle = (next: typeof saved, aim: StyleAim, salt: number) => {
    const pick = styleIndices(next, aim, salt, allowDress);
    setStyleAim(aim);
    setDressOn(pick.dress);
    setTopIndex(pick.top);
    setBottomIndex(pick.bottom);
    setShoeIndex(pick.shoe);
    setDressIndex(pick.dressIndex);
  };

  const loadMore = useCallback(async () => {
    if (moreRef.current) return;
    moreRef.current = true;
    const nextPage = pageRef.current + 1;
    const day = new Date().toISOString().slice(0, 10);
    try {
      const pending = pendingRef.current;
      const hueBit = pending ? ` hue:${pending.color}` : '';
      const slotBit = pending ? ` slot:${pending.slot === 'tops' ? 'top' : pending.slot === 'bottoms' ? 'bottom' : 'shoes'}` : '';
      const racks = await fashionAPI.redCarpet(`daily ${day} ${audience === 'women' ? 'women' : 'men'} page ${nextPage}${hueBit}${slotBit}`);
      const found = readRacks(racks);
      pageRef.current = nextPage;
      const added = found.tops.length + found.bottoms.length + found.dresses.length + found.shoes.length;
      if (!added) return;
      const prev = listsRef.current;
      const next = {
        tops: mergeSlot(found.tops, prev.tops),
        bottoms: mergeSlot(found.bottoms, prev.bottoms),
        dresses: mergeSlot(found.dresses, prev.dresses),
        shoes: mergeSlot(found.shoes, prev.shoes),
      };
      const wearMade = (list: WardrobePiece[], current: number, salt: number) => {
        if (madePiece(at(list, current))) return;
        const hit = pickMade(list, salt, madePiece);
        if (madePiece(at(list, hit))) {
          if (list === next.tops) setTopIndex(hit);
          else if (list === next.bottoms) setBottomIndex(hit);
          else setShoeIndex(hit);
        }
      };
      wearMade(next.tops, topIndexRef.current, seed);
      wearMade(next.bottoms, bottomIndexRef.current, seed + 3);
      wearMade(next.shoes, shoeIndexRef.current, seed + 7);
      const waiting = pendingRef.current;
      if (waiting) {
        const list = next[waiting.slot];
        const hit = list.findIndex((item) => {
          const title = item.title.toLowerCase();
          return hasColor(title, waiting.color) && (!waiting.family || title.includes(waiting.family));
        });
        if (hit >= 0) {
          pendingRef.current = null;
          if (waiting.slot === 'tops') setTopIndex(hit);
          else if (waiting.slot === 'bottoms') setBottomIndex(hit);
          else setShoeIndex(hit);
          setNote('');
        } else {
          const shoeHit = next.shoes.findIndex((item) => hasColor(item.title, waiting.color));
          if (shoeHit >= 0) {
            pendingRef.current = null;
            setShoeIndex(shoeHit);
            setFocus('shoes');
            setNote(`No ${waiting.color} of that piece. This ${waiting.color} shoe sits better with the outfit.`);
          }
        }
      }
      setLists(next);
      setFresh(`${added} new ${who} pieces. The rack stays open — over a million front photos, and a photo does not repeat.`);
    } catch {
      /* The pieces already on the card stay. */
    } finally {
      moreRef.current = false;
    }
  }, [audience, readRacks, seed, who]);

  useEffect(() => {
    let cancel = false;
    pageRef.current = 0;
    setLists(saved);
    setDressOn(false);
    setFresh(`Pulling today's ${who} clothes...`);
    const day = new Date().toISOString().slice(0, 10);
    const opening: StyleAim = 'mix';
    fashionAPI
      .redCarpet(`daily ${day} ${audience === 'women' ? 'women' : 'men'} page 0`)
      .then((racks) => {
        if (cancel) return;
        const found = readRacks(racks);
        const next = {
          tops: mergeSlot(found.tops, saved.tops),
          bottoms: mergeSlot(found.bottoms, saved.bottoms),
          dresses: mergeSlot(found.dresses, saved.dresses),
          shoes: mergeSlot(found.shoes, saved.shoes),
        };
        setLists(next);
        setFresh(`${who[0].toUpperCase()}${who.slice(1)} pieces with spikes, paint, rips, and patches. Tap a piece, then a color.`);
        applyStyle(next, opening, seed + 11);
        void (async () => {
          for (let i = 0; i < 10 && !cancel; i += 1) await loadMore();
        })();
      })
      .catch(() => {
        if (!cancel) setFresh(`Shops were slow, so the saved ${who} closet is still here.`);
      });
    return () => {
      cancel = true;
    };
  }, [audience, readRacks, saved, seed, who]);

  const step = (setIndex: (value: number | ((current: number) => number)) => void, length: number, dir: number) => {
    setIndex((current) => {
      const next = current + dir;
      if (dir > 0 && length > 0 && Math.abs(next) % length === length - 1) void loadMore();
      return next;
    });
  };

  const tops = lists.tops;
  const bottoms = lists.bottoms;
  const shoes = lists.shoes;
  const dresses = lists.dresses;
  const top = at(tops, topIndex);
  const bottom = at(bottoms, bottomIndex);
  const shoe = at(shoes, shoeIndex);
  const dress = at(dresses, dressIndex);

  useEffect(() => {
    if (label === 'A') sessionStorage.removeItem('fashion-shown');
  }, [label]);

  useEffect(() => {
    const key = 'fashion-shown';
    const taken = JSON.parse(sessionStorage.getItem(key) || '{}') as Record<string, string>;
    const freeIndex = (list: WardrobePiece[], index: number) => {
      if (list.length < 2) return index;
      const skip = new Set(['ma-loafer', 'sm-keller', 'toms-sneaker', 'tc-denim']);
      const madeExists = list.some((row) => madePiece(row));
      for (let n = 0; n < list.length; n += 1) {
        const item = at(list, index + n);
        const owner = item ? taken[item.imageUrl] : '';
        if (!item || owner && owner !== label) continue;
        if (skip.has(item.id)) continue;
        if (madeExists && !madePiece(item)) continue;
        return index + n;
      }
      return -1;
    };
    const nextTop = freeIndex(tops, topIndex);
    const nextBottom = freeIndex(bottoms, bottomIndex);
    const nextShoe = freeIndex(shoes, shoeIndex);
    const claim = (list: WardrobePiece[], index: number) => {
      const item = at(list, index);
      if (item) taken[item.imageUrl] = label;
    };
    claim(tops, nextTop);
    claim(bottoms, nextBottom);
    claim(shoes, nextShoe);
    sessionStorage.setItem(key, JSON.stringify(taken));
    if (nextTop !== topIndex) setTopIndex(nextTop);
    if (nextBottom !== bottomIndex) setBottomIndex(nextBottom);
    if (nextShoe !== shoeIndex) setShoeIndex(nextShoe);
  }, [bottoms, bottomIndex, label, shoes, shoeIndex, tops, topIndex]);

  const worn = useMemo(() => {
    const rows = dressOn && dress ? [dress, shoe] : [top, bottom, shoe];
    return rows.filter((item): item is WardrobePiece => Boolean(item));
  }, [bottom, dress, dressOn, shoe, top]);

  const paint = (color: string) => {
    setHue(color);
    if (!color) {
      pendingRef.current = null;
      setNote('');
      return;
    }
    const slot: PieceSlot = focus;
    const list = slot === 'tops' ? lists.tops : slot === 'bottoms' ? lists.bottoms : lists.shoes;
    const index = slot === 'tops' ? topIndex : slot === 'bottoms' ? bottomIndex : shoeIndex;
    const current = at(list, index);
    const family = familyOf(current?.title || '');
    const same = list.findIndex((item) => {
      const title = item.title.toLowerCase();
      return hasColor(title, color) && (!family || title.includes(family));
    });
    if (same >= 0) {
      if (slot === 'tops') setTopIndex(same);
      else if (slot === 'bottoms') setBottomIndex(same);
      else setShoeIndex(same);
      pendingRef.current = null;
      setNote('');
      return;
    }
    const shoeHit = lists.shoes.findIndex((item) => hasColor(item.title, color));
    if (shoeHit >= 0 && slot !== 'shoes') {
      setShoeIndex(shoeHit);
      setFocus('shoes');
      setNote(`No ${color} of that piece. This ${color} shoe sits better with the outfit.`);
      return;
    }
    if (shoeHit >= 0 && slot === 'shoes') {
      setShoeIndex(shoeHit);
      setNote(`That exact pair has no ${color}. This ${color} pair works with the rest of the outfit.`);
      return;
    }
    pendingRef.current = { color, slot, family };
    setNote(`Looking for ${color} that still works with this outfit...`);
    void loadMore();
  };

  const shuffle = () => {
    const salt = Math.floor(Math.random() * 997) + 1;
    const aim = STYLE_ORDER[(STYLE_ORDER.indexOf(styleAim) + 1) % STYLE_ORDER.length];
    applyStyle(lists, aim, salt);
    setMode('clothes');
    setTryOnUrl(null);
    setNote('');
    void loadMore();
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
                onPrev={() => step(setDressIndex, dresses.length, -1)}
                onNext={() => step(setDressIndex, dresses.length, 1)}
                onPick={() => setShop(dress)}
              />
            ) : (
              <>
                {top ? (
                  <SlotRow
                    item={top}
                    picked={focus === 'tops'}
                    onPrev={() => {
                      setFocus('tops');
                      step(setTopIndex, tops.length, -1);
                    }}
                    onNext={() => {
                      setFocus('tops');
                      step(setTopIndex, tops.length, 1);
                    }}
                    onPick={() => setFocus('tops')}
                  />
                ) : null}
                {bottom ? (
                  <SlotRow
                    item={bottom}
                    picked={focus === 'bottoms'}
                    onPrev={() => {
                      setFocus('bottoms');
                      step(setBottomIndex, bottoms.length, -1);
                    }}
                    onNext={() => {
                      setFocus('bottoms');
                      step(setBottomIndex, bottoms.length, 1);
                    }}
                    onPick={() => setFocus('bottoms')}
                  />
                ) : null}
              </>
            )}
            {shoe ? (
              <SlotRow
                item={shoe}
                picked={focus === 'shoes'}
                onPrev={() => {
                  setFocus('shoes');
                  step(setShoeIndex, shoes.length, -1);
                }}
                onNext={() => {
                  setFocus('shoes');
                  step(setShoeIndex, shoes.length, 1);
                }}
                onPick={() => setFocus('shoes')}
              />
            ) : null}
          </div>
        )}
      </div>
      <div className="fashion-card-copy">
        <div className="fashion-opt">Option {label}</div>
        <p className="fashion-fresh">{fresh}</p>
        <p className="fashion-fresh">{STYLE_COPY[styleAim]}</p>
        <div className="fashion-hues" role="listbox" aria-label="Clothing color">
          {HUES.map((swatch) => (
            <button
              key={swatch.id || 'all'}
              type="button"
              className={hue === swatch.id ? 'is-on' : ''}
              style={{ background: swatch.hex }}
              aria-label={swatch.label}
              title={swatch.label}
              onClick={() => paint(swatch.id)}
            />
          ))}
        </div>
        {note ? <p className="fashion-fresh">{note}</p> : null}
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
        {lists.dresses.length ? (
          <button type="button" onClick={() => setDressOn((on) => !on)}>
            {dressOn ? 'Separates' : 'Dress'}
          </button>
        ) : null}
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
