/**
 * Full-body wardrobe preview: realistic stand-in figure + face on head + garment drape.
 * When garment images fail, draws structured clothing (not a flat rectangle).
 */

export type FashionWarp = 'tailored' | 'drape' | 'layer';

export type BodyAvatarOpts = {
  gender: 'masc' | 'fem' | 'any';
  skinTone: string;
  build: number; // 0 thin … 1 full
  height: number; // 0 short … 1 tall
};

function isCrossOrigin(src: string): boolean {
  try {
    return new URL(src, window.location.href).origin !== window.location.origin;
  } catch {
    return false;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith('data:') && isCrossOrigin(src)) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image'));
    img.src = src;
  });
}

function torsoWidth(t: number, warp: FashionWarp, build: number): number {
  const waist = (warp === 'tailored' ? 0.3 : warp === 'drape' ? 0.28 : 0.34) + build * 0.06;
  const shoulder = (warp === 'layer' ? 0.44 : 0.4) + build * 0.05;
  const hip = (warp === 'drape' ? 0.42 : warp === 'layer' ? 0.4 : 0.34) + build * 0.08;
  if (t < 0.45) {
    const u = t / 0.45;
    return shoulder + (waist - shoulder) * u * u;
  }
  const u = (t - 0.45) / 0.55;
  return waist + (hip - waist) * (1 - (1 - u) * (1 - u));
}

function drawClosetBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#2a221c');
  g.addColorStop(0.5, '#1a1410');
  g.addColorStop(1, '#0e0a08');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,200,120,0.08)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const y = h * (0.12 + i * 0.14);
    ctx.beginPath();
    ctx.moveTo(w * 0.04, y);
    ctx.lineTo(w * 0.28, y);
    ctx.moveTo(w * 0.72, y);
    ctx.lineTo(w * 0.96, y);
    ctx.stroke();
  }
}

function headY(h: number, height: number) {
  return h * (0.12 + (1 - height) * 0.02);
}

/** Soft mannequin with skin tone — not rectangles. */
export function drawAdjustableBody(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: BodyAvatarOpts
) {
  const skin = opts.skinTone || '#c4a484';
  const build = Math.min(1, Math.max(0, opts.build ?? 0.45));
  const height = Math.min(1, Math.max(0, opts.height ?? 0.55));
  const fem = opts.gender === 'fem';
  const cx = w / 2;
  const hy = headY(h, height);
  const shoulderY = hy + h * 0.1;
  const waistY = h * (0.48 + (1 - height) * 0.02);
  const hipY = h * (0.58 + (1 - height) * 0.01);
  const crotchY = h * 0.64;
  const footY = h * 0.96;
  const shW = w * (0.16 + build * 0.05) * (fem ? 0.92 : 1.05);
  const waistW = w * (0.1 + build * 0.04) * (fem ? 0.88 : 1);
  const hipW = w * (0.12 + build * 0.05) * (fem ? 1.12 : 1);

  // legs
  ctx.fillStyle = skin;
  const legW = w * (0.07 + build * 0.02);
  ctx.beginPath();
  ctx.moveTo(cx - hipW * 0.55, crotchY);
  ctx.quadraticCurveTo(cx - hipW * 0.35, (crotchY + footY) / 2, cx - legW * 0.9, footY);
  ctx.lineTo(cx - legW * 0.1, footY);
  ctx.quadraticCurveTo(cx - w * 0.02, (crotchY + footY) / 2, cx - w * 0.01, crotchY);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + hipW * 0.55, crotchY);
  ctx.quadraticCurveTo(cx + hipW * 0.35, (crotchY + footY) / 2, cx + legW * 0.9, footY);
  ctx.lineTo(cx + legW * 0.1, footY);
  ctx.quadraticCurveTo(cx + w * 0.02, (crotchY + footY) / 2, cx + w * 0.01, crotchY);
  ctx.closePath();
  ctx.fill();

  // torso
  ctx.beginPath();
  ctx.moveTo(cx - shW, shoulderY);
  ctx.quadraticCurveTo(cx - shW * 1.05, (shoulderY + waistY) / 2, cx - waistW, waistY);
  ctx.quadraticCurveTo(cx - hipW, (waistY + hipY) / 2, cx - hipW, hipY);
  ctx.lineTo(cx + hipW, hipY);
  ctx.quadraticCurveTo(cx + hipW, (waistY + hipY) / 2, cx + waistW, waistY);
  ctx.quadraticCurveTo(cx + shW * 1.05, (shoulderY + waistY) / 2, cx + shW, shoulderY);
  ctx.closePath();
  ctx.fill();

  // arms
  const armTop = shoulderY + h * 0.02;
  const handY = h * 0.55;
  ctx.beginPath();
  ctx.moveTo(cx - shW, armTop);
  ctx.quadraticCurveTo(cx - shW - w * 0.08, (armTop + handY) / 2, cx - shW - w * 0.02, handY);
  ctx.lineTo(cx - shW + w * 0.04, handY);
  ctx.quadraticCurveTo(cx - shW + w * 0.02, (armTop + handY) / 2, cx - shW + w * 0.04, armTop);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + shW, armTop);
  ctx.quadraticCurveTo(cx + shW + w * 0.08, (armTop + handY) / 2, cx + shW + w * 0.02, handY);
  ctx.lineTo(cx + shW - w * 0.04, handY);
  ctx.quadraticCurveTo(cx + shW - w * 0.02, (armTop + handY) / 2, cx + shW - w * 0.04, armTop);
  ctx.closePath();
  ctx.fill();

  // neck + head
  ctx.fillRect(cx - w * 0.035, hy + h * 0.055, w * 0.07, h * 0.055);
  ctx.beginPath();
  ctx.ellipse(cx, hy, w * (0.11 + build * 0.01), h * 0.085, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBodyPhoto(ctx: CanvasRenderingContext2D, body: HTMLImageElement, w: number, h: number) {
  const scale = Math.max(w / body.width, (h * 0.92) / body.height);
  const dw = body.width * scale;
  const dh = body.height * scale;
  const dx = (w - dw) / 2;
  const dy = h * 0.04;
  ctx.drawImage(body, dx, dy, dw, dh);
}

function drawFaceOnHead(
  ctx: CanvasRenderingContext2D,
  face: HTMLImageElement,
  w: number,
  h: number,
  height = 0.55
) {
  const cx = w / 2;
  const cy = headY(h, height);
  const rx = w * 0.12;
  const ry = h * 0.09;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  const side = Math.min(face.width, face.height * 0.92);
  const sx = (face.width - side) / 2;
  const sy = Math.max(0, face.height * 0.06);
  ctx.drawImage(face, sx, sy, side, side * 0.95, cx - rx, cy - ry * 1.05, rx * 2, ry * 2.1);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,220,180,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drapeGarment(
  ctx: CanvasRenderingContext2D,
  garment: HTMLImageElement,
  w: number,
  h: number,
  warp: FashionWarp,
  build: number
) {
  const top = h * (warp === 'drape' ? 0.24 : 0.22);
  const bot = h * (warp === 'drape' ? 0.88 : warp === 'layer' ? 0.8 : 0.76);
  const torsoH = bot - top;
  const strips = 48;
  ctx.save();
  for (let i = 0; i < strips; i += 1) {
    const t = i / strips;
    const t2 = (i + 1) / strips;
    const destY = top + t * torsoH;
    const destH = Math.max(1, (t2 - t) * torsoH);
    const destW = w * torsoWidth((t + t2) / 2, warp, build);
    const sway = Math.sin(t * Math.PI) * w * (warp === 'drape' ? 0.01 : 0.005);
    const destX = w / 2 - destW / 2 + sway;
    const srcY = garment.height * t;
    const srcH = Math.max(1, garment.height / strips);
    ctx.globalAlpha = warp === 'layer' ? 0.88 : 0.94;
    ctx.drawImage(garment, 0, srcY, garment.width, srcH, destX, destY, destW, destH);
  }
  ctx.restore();
}

function drawFallbackOutfit(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  warp: FashionWarp,
  color: string,
  gender: BodyAvatarOpts['gender']
) {
  const cx = w / 2;
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.92;
  const top = h * 0.24;
  const bot = h * (warp === 'drape' && gender === 'fem' ? 0.72 : 0.58);
  const sh = w * 0.38;
  const waist = w * (gender === 'fem' ? 0.28 : 0.32);
  ctx.beginPath();
  ctx.moveTo(cx - sh / 2, top);
  ctx.lineTo(cx + sh / 2, top);
  ctx.lineTo(cx + waist / 2, bot);
  ctx.lineTo(cx - waist / 2, bot);
  ctx.closePath();
  ctx.fill();
  // sleeves
  ctx.beginPath();
  ctx.moveTo(cx - sh / 2, top);
  ctx.lineTo(cx - sh / 2 - w * 0.08, h * 0.48);
  ctx.lineTo(cx - sh / 2 + w * 0.06, h * 0.5);
  ctx.lineTo(cx - sh / 2 + w * 0.04, top + h * 0.06);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + sh / 2, top);
  ctx.lineTo(cx + sh / 2 + w * 0.08, h * 0.48);
  ctx.lineTo(cx + sh / 2 - w * 0.06, h * 0.5);
  ctx.lineTo(cx + sh / 2 - w * 0.04, top + h * 0.06);
  ctx.closePath();
  ctx.fill();
  // bottoms
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = shade(color, -25);
  const pantTop = bot - h * 0.02;
  if (warp === 'drape' && gender === 'fem') {
    ctx.beginPath();
    ctx.moveTo(cx - waist / 2, pantTop);
    ctx.quadraticCurveTo(cx, h * 0.9, cx + waist / 2, pantTop);
    ctx.lineTo(cx + w * 0.2, h * 0.92);
    ctx.lineTo(cx - w * 0.2, h * 0.92);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(cx - w * 0.14, pantTop, w * 0.12, h * 0.34);
    ctx.fillRect(cx + w * 0.02, pantTop, w * 0.12, h * 0.34);
  }
  ctx.restore();
}

function shade(hex: string, amt: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const n = (x: string) => Math.min(255, Math.max(0, parseInt(x, 16) + amt));
  return `#${[n(m[1]), n(m[2]), n(m[3])].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Build a reusable body avatar data URL the user can tweak. */
export function renderBodyAvatarDataUrl(opts: BodyAvatarOpts, w = 360, h = 640): string {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = 'transparent';
  ctx.clearRect(0, 0, w, h);
  drawAdjustableBody(ctx, w, h, opts);
  return canvas.toDataURL('image/png');
}

/**
 * Paint a wardrobe-style full-body preview:
 * closet backdrop → body (upload / avatar / soft stand-in) → face on head → outfit.
 */
export async function paintFashionTryOn(
  canvas: HTMLCanvasElement,
  faceUrl: string | null,
  garmentUrl: string,
  warp: FashionWarp,
  fallback = '#3a2e22',
  bodyUrl: string | null = null,
  avatar?: BodyAvatarOpts | null
): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  drawClosetBackdrop(ctx, w, h);

  const bodyOpts: BodyAvatarOpts = avatar || {
    gender: 'any',
    skinTone: '#c4a484',
    build: 0.45,
    height: 0.55,
  };

  let drewBody = false;
  if (bodyUrl) {
    try {
      const body = await loadImage(bodyUrl);
      drawBodyPhoto(ctx, body, w, h);
      drewBody = true;
    } catch {
      /* fall through */
    }
  }
  if (!drewBody) drawAdjustableBody(ctx, w, h, bodyOpts);

  if (faceUrl) {
    try {
      const face = await loadImage(faceUrl);
      drawFaceOnHead(ctx, face, w, h, bodyOpts.height);
    } catch {
      /* keep head */
    }
  }

  try {
    const garment = await loadImage(garmentUrl);
    drapeGarment(ctx, garment, w, h, warp, bodyOpts.build);
  } catch {
    drawFallbackOutfit(ctx, w, h, warp, fallback, bodyOpts.gender);
  }
}
