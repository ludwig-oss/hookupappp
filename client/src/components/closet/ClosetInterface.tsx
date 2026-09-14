import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CLOSET_CATEGORIES,
  itemsFor,
  type ClosetCategory,
  type ClosetGender,
  type ClosetItem,
  type EquippedCloset,
} from '../../data/closetCatalog';
import './ClosetInterface.css';

const SENSITIVITY = 0.45;

type CameraFocus = 'center' | 'head' | 'feet';

function drawBaseAvatar(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  yaw: number,
  gender: ClosetGender,
  skin: string
) {
  const cx = w / 2;
  const lean = Math.sin(yaw) * w * 0.04;
  const depth = Math.cos(yaw);
  const scaleX = 0.72 + Math.abs(depth) * 0.28;
  const fem = gender === 'fem';

  ctx.save();
  ctx.translate(cx + lean, 0);
  ctx.scale(scaleX, 1);

  // soft floor shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, h * 0.94, w * 0.16, h * 0.018, 0, 0, Math.PI * 2);
  ctx.fill();

  // legs (underwear / base)
  const underwear = fem ? '#2a1520' : '#1a2430';
  ctx.fillStyle = skin;
  const legW = w * (fem ? 0.065 : 0.075);
  ctx.beginPath();
  ctx.moveTo(-w * 0.07, h * 0.58);
  ctx.quadraticCurveTo(-w * 0.1, h * 0.75, -legW, h * 0.92);
  ctx.lineTo(-legW * 0.15, h * 0.92);
  ctx.quadraticCurveTo(-w * 0.02, h * 0.72, -w * 0.01, h * 0.58);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.07, h * 0.58);
  ctx.quadraticCurveTo(w * 0.1, h * 0.75, legW, h * 0.92);
  ctx.lineTo(legW * 0.15, h * 0.92);
  ctx.quadraticCurveTo(w * 0.02, h * 0.72, w * 0.01, h * 0.58);
  ctx.closePath();
  ctx.fill();

  // underwear
  ctx.fillStyle = underwear;
  ctx.beginPath();
  ctx.moveTo(-w * (fem ? 0.09 : 0.08), h * 0.52);
  ctx.lineTo(w * (fem ? 0.09 : 0.08), h * 0.52);
  ctx.lineTo(w * 0.07, h * 0.6);
  ctx.lineTo(-w * 0.07, h * 0.6);
  ctx.closePath();
  ctx.fill();
  if (fem) {
    ctx.fillRect(-w * 0.07, h * 0.42, w * 0.14, h * 0.05);
  }

  // torso
  ctx.fillStyle = skin;
  const sh = w * (fem ? 0.15 : 0.18);
  const waist = w * (fem ? 0.09 : 0.11);
  ctx.beginPath();
  ctx.moveTo(-sh, h * 0.26);
  ctx.quadraticCurveTo(-sh * 1.05, h * 0.38, -waist, h * 0.48);
  ctx.lineTo(waist, h * 0.48);
  ctx.quadraticCurveTo(sh * 1.05, h * 0.38, sh, h * 0.26);
  ctx.closePath();
  ctx.fill();

  // arms
  ctx.beginPath();
  ctx.moveTo(-sh, h * 0.27);
  ctx.quadraticCurveTo(-sh - w * 0.08, h * 0.42, -sh - w * 0.02, h * 0.55);
  ctx.lineTo(-sh + w * 0.04, h * 0.55);
  ctx.quadraticCurveTo(-sh + w * 0.02, h * 0.4, -sh + w * 0.05, h * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(sh, h * 0.27);
  ctx.quadraticCurveTo(sh + w * 0.08, h * 0.42, sh + w * 0.02, h * 0.55);
  ctx.lineTo(sh - w * 0.04, h * 0.55);
  ctx.quadraticCurveTo(sh - w * 0.02, h * 0.4, sh - w * 0.05, h * 0.28);
  ctx.closePath();
  ctx.fill();

  // neck + head
  ctx.fillRect(-w * 0.03, h * 0.18, w * 0.06, h * 0.08);
  ctx.beginPath();
  ctx.ellipse(0, h * 0.13, w * 0.1, h * 0.085, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawFace(
  ctx: CanvasRenderingContext2D,
  face: HTMLImageElement,
  w: number,
  h: number,
  yaw: number
) {
  const lean = Math.sin(yaw) * w * 0.04;
  const depth = Math.cos(yaw);
  const scaleX = 0.72 + Math.abs(depth) * 0.28;
  const cx = w / 2 + lean;
  const cy = h * 0.13;
  const rx = w * 0.1 * scaleX;
  const ry = h * 0.085;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  const side = Math.min(face.width, face.height * 0.9);
  ctx.drawImage(
    face,
    (face.width - side) / 2,
    face.height * 0.05,
    side,
    side * 0.95,
    cx - rx,
    cy - ry * 1.05,
    rx * 2,
    ry * 2.15
  );
  ctx.restore();
}

function drawGarmentTop(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  yaw: number,
  item: ClosetItem,
  gender: ClosetGender
) {
  const lean = Math.sin(yaw) * w * 0.04;
  const scaleX = 0.72 + Math.abs(Math.cos(yaw)) * 0.28;
  const fem = gender === 'fem';
  ctx.save();
  ctx.translate(w / 2 + lean, 0);
  ctx.scale(scaleX, 1);
  ctx.fillStyle = item.color;
  const sh = w * (fem ? 0.155 : 0.185);
  const waist = w * (fem ? 0.095 : 0.115);
  ctx.beginPath();
  ctx.moveTo(-sh, h * 0.255);
  ctx.quadraticCurveTo(-sh * 1.02, h * 0.38, -waist, h * 0.5);
  ctx.lineTo(waist, h * 0.5);
  ctx.quadraticCurveTo(sh * 1.02, h * 0.38, sh, h * 0.255);
  ctx.closePath();
  ctx.fill();
  // sleeves
  ctx.beginPath();
  ctx.moveTo(-sh, h * 0.26);
  ctx.lineTo(-sh - w * 0.07, h * 0.48);
  ctx.lineTo(-sh + w * 0.05, h * 0.5);
  ctx.lineTo(-sh + w * 0.04, h * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(sh, h * 0.26);
  ctx.lineTo(sh + w * 0.07, h * 0.48);
  ctx.lineTo(sh - w * 0.05, h * 0.5);
  ctx.lineTo(sh - w * 0.04, h * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGarmentBottom(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  yaw: number,
  item: ClosetItem,
  gender: ClosetGender
) {
  const lean = Math.sin(yaw) * w * 0.04;
  const scaleX = 0.72 + Math.abs(Math.cos(yaw)) * 0.28;
  ctx.save();
  ctx.translate(w / 2 + lean, 0);
  ctx.scale(scaleX, 1);
  ctx.fillStyle = item.color;
  if (gender === 'fem' && /midi|skirt|column/i.test(item.title)) {
    ctx.beginPath();
    ctx.moveTo(-w * 0.09, h * 0.5);
    ctx.lineTo(w * 0.09, h * 0.5);
    ctx.quadraticCurveTo(w * 0.14, h * 0.7, w * 0.12, h * 0.88);
    ctx.lineTo(-w * 0.12, h * 0.88);
    ctx.quadraticCurveTo(-w * 0.14, h * 0.7, -w * 0.09, h * 0.5);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(-w * 0.085, h * 0.5, w * 0.075, h * 0.4);
    ctx.fillRect(w * 0.01, h * 0.5, w * 0.075, h * 0.4);
    ctx.fillRect(-w * 0.09, h * 0.48, w * 0.18, h * 0.06);
  }
  ctx.restore();
}

function drawOuter(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  yaw: number,
  item: ClosetItem,
  gender: ClosetGender
) {
  const lean = Math.sin(yaw) * w * 0.04;
  const scaleX = 0.72 + Math.abs(Math.cos(yaw)) * 0.28;
  const fem = gender === 'fem';
  ctx.save();
  ctx.translate(w / 2 + lean, 0);
  ctx.scale(scaleX, 1);
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = item.color;
  const sh = w * (fem ? 0.17 : 0.2);
  ctx.beginPath();
  ctx.moveTo(-sh, h * 0.24);
  ctx.lineTo(sh, h * 0.24);
  ctx.lineTo(sh * 0.85, h * 0.58);
  ctx.lineTo(-sh * 0.85, h * 0.58);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = item.accent || item.color;
  ctx.globalAlpha = 0.5;
  ctx.fillRect(-w * 0.01, h * 0.26, w * 0.02, h * 0.28);
  ctx.restore();
}

function drawHat(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  yaw: number,
  item: ClosetItem
) {
  const lean = Math.sin(yaw) * w * 0.04;
  const scaleX = 0.72 + Math.abs(Math.cos(yaw)) * 0.28;
  const cx = w / 2 + lean;
  const cy = h * 0.08;
  ctx.save();
  ctx.fillStyle = item.color;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.12 * scaleX, h * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx - w * 0.08 * scaleX, cy - h * 0.06, w * 0.16 * scaleX, h * 0.07);
  if (/cap|dad|baseball/i.test(item.title)) {
    ctx.beginPath();
    ctx.ellipse(cx + w * 0.1 * Math.sign(Math.cos(yaw) || 1) * scaleX, cy + h * 0.01, w * 0.08, h * 0.02, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawGlasses(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  yaw: number,
  item: ClosetItem
) {
  const lean = Math.sin(yaw) * w * 0.04;
  const scaleX = 0.72 + Math.abs(Math.cos(yaw)) * 0.28;
  const cx = w / 2 + lean;
  const cy = h * 0.125;
  const gap = w * 0.025 * scaleX;
  const lensW = w * 0.055 * scaleX;
  const lensH = h * 0.028;
  ctx.save();
  ctx.strokeStyle = item.color;
  ctx.fillStyle = item.accent || 'rgba(80,100,120,0.3)';
  ctx.lineWidth = 2.5;
  // left lens
  ctx.beginPath();
  ctx.roundRect(cx - gap - lensW, cy - lensH, lensW, lensH * 2, 4);
  ctx.fill();
  ctx.stroke();
  // right lens
  ctx.beginPath();
  ctx.roundRect(cx + gap, cy - lensH, lensW, lensH * 2, 4);
  ctx.fill();
  ctx.stroke();
  // bridge
  ctx.beginPath();
  ctx.moveTo(cx - gap, cy);
  ctx.lineTo(cx + gap, cy);
  ctx.stroke();
  ctx.restore();
}

function drawMask(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  yaw: number,
  item: ClosetItem
) {
  const lean = Math.sin(yaw) * w * 0.04;
  const scaleX = 0.72 + Math.abs(Math.cos(yaw)) * 0.28;
  const cx = w / 2 + lean;
  ctx.save();
  ctx.fillStyle = item.color;
  ctx.beginPath();
  ctx.ellipse(cx, h * 0.155, w * 0.085 * scaleX, h * 0.045, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = item.accent || '#333';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.08 * scaleX, h * 0.15);
  ctx.lineTo(cx - w * 0.12 * scaleX, h * 0.12);
  ctx.moveTo(cx + w * 0.08 * scaleX, h * 0.15);
  ctx.lineTo(cx + w * 0.12 * scaleX, h * 0.12);
  ctx.stroke();
  ctx.restore();
}

function drawShoe(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  yaw: number,
  item: ClosetItem,
  side: 'L' | 'R'
) {
  const lean = Math.sin(yaw) * w * 0.04;
  const scaleX = 0.72 + Math.abs(Math.cos(yaw)) * 0.28;
  const dir = side === 'L' ? -1 : 1;
  const cx = w / 2 + lean + dir * w * 0.055 * scaleX;
  const cy = h * 0.91;
  const shoeW = w * 0.09 * scaleX;
  const shoeH = h * 0.035;
  ctx.save();
  // sole
  ctx.fillStyle = item.accent || '#222';
  ctx.beginPath();
  ctx.ellipse(cx, cy + shoeH * 0.55, shoeW * 0.95, shoeH * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  // upper
  ctx.fillStyle = item.color;
  ctx.beginPath();
  ctx.ellipse(cx, cy, shoeW, shoeH, 0, 0, Math.PI * 2);
  ctx.fill();
  // brand hit (swoosh / stripe suggestion)
  ctx.strokeStyle = item.accent || '#111';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (/jordan|nike/i.test(item.brand || '')) {
    ctx.moveTo(cx - shoeW * 0.3, cy);
    ctx.quadraticCurveTo(cx, cy - shoeH * 0.4, cx + shoeW * 0.35, cy + shoeH * 0.1);
  } else if (/adidas/i.test(item.brand || '')) {
    for (let i = -1; i <= 1; i++) {
      ctx.moveTo(cx + i * shoeW * 0.12 - shoeW * 0.15, cy - shoeH * 0.3);
      ctx.lineTo(cx + i * shoeW * 0.12 + shoeW * 0.15, cy + shoeH * 0.3);
    }
  }
  ctx.stroke();
  // toe box highlight
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath();
  ctx.ellipse(cx + dir * shoeW * 0.25, cy - shoeH * 0.1, shoeW * 0.25, shoeH * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('img'));
    img.src = src;
  });
}

export default function ClosetInterface({
  gender: genderProp,
  faceUrl,
  skinTone = '#c4a484',
  outfitHint,
  onEquipChange,
}: {
  gender?: ClosetGender;
  faceUrl?: string | null;
  skinTone?: string;
  /** Optional: seed tops/bottoms from a look's pieces colors */
  outfitHint?: { top?: string; bottom?: string; outer?: string; shoeColor?: string };
  onEquipChange?: (eq: EquippedCloset) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gender, setGender] = useState<ClosetGender>(genderProp || 'masc');
  const [yaw, setYaw] = useState(0);
  const [category, setCategory] = useState<ClosetCategory>('tops');
  const [equipped, setEquipped] = useState<EquippedCloset>({});
  const [dragging, setDragging] = useState(false);
  const dragX = useRef(0);
  const faceRef = useRef<HTMLImageElement | null>(null);
  const camera: CameraFocus =
    CLOSET_CATEGORIES.find((c) => c.id === category)?.camera || 'center';

  // Closet open: underwear base (drawn on avatar), camera centered via "tops" / full body
  useEffect(() => {
    setEquipped({});
    setYaw(0);
    setCategory('tops');
  }, []);

  useEffect(() => {
    if (genderProp) setGender(genderProp);
  }, [genderProp]);

  useEffect(() => {
    let cancelled = false;
    if (!faceUrl) {
      faceRef.current = null;
      return;
    }
    void loadImg(faceUrl)
      .then((img) => {
        if (!cancelled) faceRef.current = img;
      })
      .catch(() => {
        if (!cancelled) faceRef.current = null;
      });
    return () => {
      cancelled = true;
    };
  }, [faceUrl]);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;

    // camera zoom / pan
    let zoom = 1;
    let panY = 0;
    if (camera === 'head') {
      zoom = 2.15;
      panY = h * 0.28;
    } else if (camera === 'feet') {
      zoom = 2.05;
      panY = -h * 0.32;
    }

    ctx.clearRect(0, 0, w, h);
    // closet backdrop
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#1a1410');
    g.addColorStop(0.5, '#0e0a08');
    g.addColorStop(1, '#050403');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2, h / 2 + panY);
    ctx.scale(zoom, zoom);
    ctx.translate(-w / 2, -h / 2);

    drawBaseAvatar(ctx, w, h, yaw, gender, skinTone);
    if (equipped.bottoms) drawGarmentBottom(ctx, w, h, yaw, equipped.bottoms, gender);
    if (equipped.tops) drawGarmentTop(ctx, w, h, yaw, equipped.tops, gender);
    if (equipped.outer) drawOuter(ctx, w, h, yaw, equipped.outer, gender);
    if (faceRef.current) drawFace(ctx, faceRef.current, w, h, yaw);
    // layering: glasses + mask both allowed
    if (equipped.masks) drawMask(ctx, w, h, yaw, equipped.masks);
    if (equipped.glasses) drawGlasses(ctx, w, h, yaw, equipped.glasses);
    if (equipped.hats) drawHat(ctx, w, h, yaw, equipped.hats);
    if (equipped.shoes) {
      drawShoe(ctx, w, h, yaw, equipped.shoes, 'L');
      drawShoe(ctx, w, h, yaw, equipped.shoes, 'R');
    }

    ctx.restore();

    // camera label
    ctx.fillStyle = 'rgba(245,158,11,0.85)';
    ctx.font = '600 13px Orbitron, sans-serif';
    ctx.fillText(
      camera === 'head' ? 'CAM · HEAD' : camera === 'feet' ? 'CAM · FEET' : 'CAM · FULL',
      16,
      28
    );
  }, [yaw, gender, skinTone, equipped, camera]);

  useEffect(() => {
    paint();
  }, [paint]);

  useEffect(() => {
    onEquipChange?.(equipped);
  }, [equipped, onEquipChange]);

  // seed soft defaults from outfit hint colors once
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
  const brandFilter =
    category === 'shoes'
      ? (['Jordan', 'Nike', 'Adidas', 'All'] as const)
      : null;
  const [brand, setBrand] = useState<'Jordan' | 'Nike' | 'Adidas' | 'All'>('All');
  const visible =
    category === 'shoes' && brand !== 'All'
      ? shelf.filter((i) => i.brand === brand)
      : shelf;

  const equip = (item: ClosetItem) => {
    setEquipped((prev) => {
      const cur = prev[item.category];
      if (cur?.id === item.id) return { ...prev, [item.category]: null };
      return { ...prev, [item.category]: item };
    });
  };

  return (
    <div className="closet-root">
      <div className="closet-stage">
        <canvas
          ref={canvasRef}
          width={480}
          height={720}
          className={`closet-canvas${dragging ? ' is-drag' : ''}`}
          onPointerDown={(e) => {
            setDragging(true);
            dragX.current = e.clientX;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!dragging) return;
            const dx = e.clientX - dragX.current;
            dragX.current = e.clientX;
            setYaw((y) => y + (dx * SENSITIVITY * Math.PI) / 180);
          }}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
        />
        <p className="closet-hint">Drag left/right to spin · pick a category to zoom</p>
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
          <p className="closet-layer-note">Glasses + mask layer together — both stay on.</p>
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
              >
                {item.thumbUrl ? (
                  <img src={item.thumbUrl} alt="" referrerPolicy="no-referrer" />
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
