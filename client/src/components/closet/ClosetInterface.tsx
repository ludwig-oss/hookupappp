import { useEffect, useState } from 'react';
import {
  CLOSET_CATEGORIES,
  itemsFor,
  type ClosetCategory,
  type ClosetGender,
  type ClosetItem,
  type EquippedCloset,
} from '../../data/closetCatalog';
import { fashionAPI, type FashionLookCard } from '../../api/fashion';
import CluelessClosetApp from './CluelessClosetApp';
import GarmentSlot from './GarmentSlot';
import './ClosetInterface.css';

function asTryOnLook(item: ClosetItem): FashionLookCard {
  const garment =
    item.tryOnPreviewUrl ||
    item.thumbUrl ||
    `https://images.unsplash.com/photo-1523381210434-271e8bb1ff70?auto=format&fit=crop&w=600&q=80&sig=${encodeURIComponent(item.id)}`;
  return {
    id: item.id,
    title: item.title,
    event: 'everyday',
    vibe: 'closet',
    formality: 'casual',
    palette: [item.color],
    pieces: [item.title],
    imageUrl: garment,
    fallback: item.color,
    warp: 'tailored',
    shopUrl: '',
    trendNotes: item.notes || '',
  };
}

export default function ClosetInterface({
  faceUrl: _faceUrl,
  bodyUrl,
  skinTone: _skinTone,
  gender: genderProp,
  outfitHint,
  onEquipChange,
}: {
  faceUrl?: string | null;
  /** Preferred full-body photo for the VTON person plate. */
  bodyUrl?: string | null;
  skinTone?: string;
  gender?: ClosetGender;
  outfitHint?: { top?: string; bottom?: string; outer?: string; shoeColor?: string };
  onEquipChange?: (eq: EquippedCloset) => void;
}) {
  const [gender, setGender] = useState<ClosetGender>(genderProp === 'fem' ? 'fem' : 'masc');
  const [category, setCategory] = useState<ClosetCategory>('tops');
  const [equipped, setEquipped] = useState<EquippedCloset>({});
  const [brand, setBrand] = useState<'Jordan' | 'Nike' | 'Adidas' | 'All'>('All');
  const [tryOnLoading, setTryOnLoading] = useState(false);
  const [tryOnLabel, setTryOnLabel] = useState<string | null>(null);
  const [occasion, setOccasion] = useState<'everyday' | 'special_event' | 'work' | 'night_out'>('everyday');
  const [cluelessLine, setCluelessLine] = useState<string | null>(null);

  const [tryOnImage, setTryOnImage] = useState('');

  useEffect(() => {
    setEquipped({});
    setCategory('tops');
    setTryOnLabel(null);
    setTryOnImage('');
  }, []);

  useEffect(() => {
    if (genderProp === 'fem' || genderProp === 'masc') setGender(genderProp);
  }, [genderProp]);

  useEffect(() => {
    if (!tryOnLoading) {
      setTryOnImage('');
      setTryOnLabel(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gender, bodyUrl]);

  useEffect(() => {
    onEquipChange?.(equipped);
  }, [equipped, onEquipChange]);

  useEffect(() => {
    if (!outfitHint) return;
    setEquipped((prev) => {
      if (prev.tops || prev.bottoms) return prev;
      const next = { ...prev };
      if (outfitHint.top) {
        next.tops = {
          id: 'hint-top',
          category: 'tops',
          title: 'Look top',
          gender: 'any',
          color: outfitHint.top,
        };
      }
      if (outfitHint.bottom) {
        next.bottoms = {
          id: 'hint-bot',
          category: 'bottoms',
          title: 'Look bottom',
          gender: 'any',
          color: outfitHint.bottom,
        };
      }
      if (outfitHint.outer) {
        next.outer = {
          id: 'hint-out',
          category: 'outer',
          title: 'Look outer',
          gender: 'any',
          color: outfitHint.outer,
        };
      }
      if (outfitHint.shoeColor) {
        next.shoes = {
          id: 'hint-shoe',
          category: 'shoes',
          title: 'Look shoe',
          gender: 'any',
          color: outfitHint.shoeColor,
          accent: '#222',
        };
      }
      return next;
    });
  }, [outfitHint]);

  const shelf = itemsFor(category, gender);
  const brandFilter = category === 'shoes' ? (['Jordan', 'Nike', 'Adidas', 'All'] as const) : null;
  const visible =
    category === 'shoes' && brand !== 'All' ? shelf.filter((i) => i.brand === brand) : shelf;

  const runVirtualTryOn = async (item: ClosetItem) => {
    setTryOnLoading(true);
    setTryOnLabel(item.title);
    const personPlate = bodyUrl && /^https?:\/\//i.test(bodyUrl) ? bodyUrl : null;
    try {
      if (!personPlate) {
        setTryOnImage('');
        setTryOnLabel('Upload a full-body photo, then try this piece on.');
        return;
      }
      const look = asTryOnLook(item);
      const r = await fashionAPI.tryOn(look, personPlate);
      if (r.tryOnUrl) {
        setTryOnImage(r.tryOnUrl);
        setTryOnLabel(`${item.title} · ${r.engine || 'try-on'}`);
        return;
      }
      setTryOnImage('');
      setTryOnLabel(r.detail || 'Add FASHN_API_KEY or REPLICATE_API_TOKEN.');
    } catch {
      setTryOnImage('');
      setTryOnLabel('Try-on did not answer.');
    } finally {
      setTryOnLoading(false);
    }
  };

  const runCluelessMatch = async () => {
    setTryOnLoading(true);
    setCluelessLine(null);
    try {
      const match = await fashionAPI.clutchMatch({ occasion });
      setCluelessLine(match.guideLine);
      const first = match.outfit.top || match.outfit.bottom || match.outfit.outerwear;
      if (first?.imageUrl && bodyUrl) {
        setTryOnLabel(match.context.isShoppingAssisted ? 'Clueless · shop assist' : 'Clueless · closet match');
      }
    } catch {
      setCluelessLine('Could not compose that look yet. Save closet pieces first, then try again.');
    } finally {
      setTryOnLoading(false);
    }
  };

  const equip = (item: ClosetItem) => {
    setEquipped((prev) => {
      const cur = prev[item.category];
      const clearing = cur?.id === item.id;
      const next: EquippedCloset = clearing
        ? { ...prev, [item.category]: null }
        : { ...prev, [item.category]: item };

      if (clearing) {
        setTryOnImage('');
        setTryOnLabel(null);
        setTryOnLoading(false);
      } else {
        void runVirtualTryOn(item);
      }
      return next;
    });
  };

  return (
    <div className="closet-stack">
    <CluelessClosetApp gender={gender} onTryOn={(top) => void runVirtualTryOn(top)} />
    <div className="closet-root">
      <div className="closet-stage">
        <div className="closet-tryon-frame" aria-busy={tryOnLoading}>
          {tryOnImage ? (
            <img
              key={tryOnImage}
              className={`closet-tryon-image${tryOnLoading ? ' is-dim' : ''}`}
              src={tryOnImage}
              alt="Virtual try-on of your photo"
              referrerPolicy="no-referrer"
            />
          ) : (
            <p className="closet-hint">Your dressed photo shows here after a real try-on. Closet rows above stay garment-only.</p>
          )}
          {tryOnLoading && (
            <div className="closet-tryon-skeleton" aria-hidden>
              <div className="closet-tryon-skeleton-glow" />
              <div className="closet-tryon-skeleton-figure" />
              <p>Rendering try-on…</p>
            </div>
          )}
          <div className="closet-tryon-badge">
            {tryOnLoading ? 'AI try-on' : tryOnLabel || 'CAM · FULL BODY'}
          </div>
        </div>
        <p className="closet-hint">Tap a piece to run virtual try-on on the full-body model</p>
        <div className="closet-gender" aria-label="Occasion">
          {(['everyday', 'work', 'night_out', 'special_event'] as const).map((id) => (
            <button key={id} type="button" className={occasion === id ? 'is-on' : ''} onClick={() => setOccasion(id)}>
              {id === 'special_event' ? 'Special' : id === 'night_out' ? 'Night out' : id === 'work' ? 'Work' : 'Everyday'}
            </button>
          ))}
        </div>
        <button type="button" className="closet-gender" style={{ marginTop: 8 }} onClick={() => void runCluelessMatch()} disabled={tryOnLoading}>
          Clueless match
        </button>
        {cluelessLine && <p className="closet-hint">{cluelessLine}</p>}
        <div className="closet-gender">
          <button type="button" className={gender === 'masc' ? 'is-on' : ''} onClick={() => setGender('masc')}>
            Man
          </button>
          <button type="button" className={gender === 'fem' ? 'is-on' : ''} onClick={() => setGender('fem')}>
            Woman
          </button>
        </div>
      </div>

      <div className="closet-panel">
        <div className="closet-cats">
          {CLOSET_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={category === c.id ? 'is-on' : ''}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>

        {brandFilter && (
          <div className="closet-brands">
            {brandFilter.map((b) => (
              <button key={b} type="button" className={brand === b ? 'is-on' : ''} onClick={() => setBrand(b)}>
                {b}
              </button>
            ))}
          </div>
        )}

        {(category === 'glasses' || category === 'masks') && (
          <p className="closet-layer-note">Glasses + mask can both stay equipped for the try-on plate.</p>
        )}

        <div className="closet-shelf">
          {visible.map((item) => {
            const on = equipped[item.category]?.id === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`closet-card${on ? ' is-on' : ''}`}
                onClick={() => equip(item)}
                disabled={tryOnLoading}
              >
                {item.thumbUrl || item.tryOnPreviewUrl ? (
                  <GarmentSlot
                    url={item.thumbUrl || item.tryOnPreviewUrl || ''}
                    slot={item.category === 'bottoms' ? 'bottom' : item.category === 'shoes' ? 'shoes' : 'top'}
                    title={item.title}
                  />
                ) : (
                  <span className="closet-swatch" style={{ background: item.color, borderColor: item.accent }} />
                )}
                <span className="closet-card-meta">
                  {item.brand && <b>{item.brand}</b>}
                  <em>{item.title}</em>
                  {item.notes && <i>{item.notes}</i>}
                </span>
              </button>
            );
          })}
          {!visible.length && <p className="closet-empty">Nothing in this filter yet.</p>}
        </div>
      </div>
    </div>
    </div>
  );
}
