import { useEffect, useMemo, useState } from 'react';
import {
  CLOSET_CATEGORIES,
  itemsFor,
  type ClosetCategory,
  type ClosetGender,
  type ClosetItem,
  type EquippedCloset,
} from '../../data/closetCatalog';
import { fashionAPI, type FashionLookCard } from '../../api/fashion';
import './ClosetInterface.css';

/** High-fidelity full-body stand-ins until the user’s body photo / VTON result lands. */
const MODEL_FULL_BODY: Record<'masc' | 'fem', string> = {
  masc: 'https://images.unsplash.com/photo-1488161628813-04466f872be2?auto=format&fit=crop&w=900&q=85',
  fem: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=85',
};

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

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

  const initialModelUrl = useMemo(() => {
    if (bodyUrl) return bodyUrl;
    return MODEL_FULL_BODY[gender === 'fem' ? 'fem' : 'masc'];
  }, [bodyUrl, gender]);

  const [tryOnImage, setTryOnImage] = useState(initialModelUrl);

  useEffect(() => {
    setEquipped({});
    setCategory('tops');
    setTryOnLabel(null);
    setTryOnImage(bodyUrl || MODEL_FULL_BODY[genderProp === 'fem' ? 'fem' : 'masc']);
  }, []);

  useEffect(() => {
    if (genderProp === 'fem' || genderProp === 'masc') setGender(genderProp);
  }, [genderProp]);

  useEffect(() => {
    // Gender / body plate change resets to a clean full-body model (not a vector mannequin).
    if (!tryOnLoading) {
      setTryOnImage(bodyUrl || MODEL_FULL_BODY[gender === 'fem' ? 'fem' : 'masc']);
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
    const personPlate = bodyUrl || initialModelUrl;
    try {
      // Prefer live Fashn / IDM-VTON when the server has keys; otherwise premium preview swap.
      const look = asTryOnLook(item);
      try {
        const r = await fashionAPI.tryOn(look, personPlate);
        if (r.tryOnUrl) {
          setTryOnImage(r.tryOnUrl);
          setTryOnLabel(`${item.title} · ${r.engine || 'try-on'}`);
          return;
        }
      } catch {
        /* fall through to local preview */
      }

      await delay(850);
      const preview =
        item.tryOnPreviewUrl ||
        item.thumbUrl ||
        // Keep a realistic full-body frame — garment activation still refreshes the plate for pipeline UX
        `${personPlate}${personPlate.includes('?') ? '&' : '?'}tryOn=${encodeURIComponent(item.id)}`;
      setTryOnImage(preview);
      setTryOnLabel(`${item.title} · preview`);
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
        setTryOnImage(bodyUrl || MODEL_FULL_BODY[gender === 'fem' ? 'fem' : 'masc']);
        setTryOnLabel(null);
        setTryOnLoading(false);
      } else {
        void runVirtualTryOn(item);
      }
      return next;
    });
  };

  return (
    <div className="closet-root">
      <div className="closet-stage">
        <div className="closet-tryon-frame" aria-busy={tryOnLoading}>
          <img
            key={tryOnImage}
            className={`closet-tryon-image${tryOnLoading ? ' is-dim' : ''}`}
            src={tryOnImage}
            alt="Virtual try-on preview"
            referrerPolicy="no-referrer"
          />
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
                  <img src={item.thumbUrl || item.tryOnPreviewUrl} alt="" referrerPolicy="no-referrer" />
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
  );
}
