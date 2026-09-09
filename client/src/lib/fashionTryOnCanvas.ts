/**
 * Full-body wardrobe preview (GTA-style): body base + face on head + outfit on torso.
 */

export type FashionWarp = 'tailored' | 'drape' | 'layer';

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

function torsoWidth(t: number, warp: FashionWarp): number {
  const waist = warp === 'tailored' ? 0.34 : warp === 'drape' ? 0.3 : 0.36;
  const shoulder = warp === 'layer' ? 0.46 : 0.4;
  const hip = warp === 'drape' ? 0.44 : warp === 'layer' ? 0.42 : 0.36;
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
  // soft shelf lines like a wardrobe
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

function drawBodyStandIn(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // legs
  ctx.fillStyle = '#3d3228';
  ctx.fillRect(w * 0.38, h * 0.62, w * 0.1, h * 0.32);
  ctx.fillRect(w * 0.52, h * 0.62, w * 0.1, h * 0.32);
  // torso
  ctx.fillStyle = '#4a3c30';
  ctx.beginPath();
  ctx.moveTo(w * 0.32, h * 0.28);
  ctx.lineTo(w * 0.68, h * 0.28);
  ctx.lineTo(w * 0.62, h * 0.64);
  ctx.lineTo(w * 0.38, h * 0.64);
  ctx.closePath();
  ctx.fill();
  // neck
  ctx.fillStyle = '#c4a484';
  ctx.fillRect(w * 0.46, h * 0.22, w * 0.08, h * 0.07);
  // head oval placeholder
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.145, w * 0.11, h * 0.085, 0, 0, Math.PI * 2);
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

function drawFaceOnHead(ctx: CanvasRenderingContext2D, face: HTMLImageElement, w: number, h: number) {
  const cx = w / 2;
  const cy = h * 0.145;
  const rx = w * 0.13;
  const ry = h * 0.1;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  // cover face photo into head oval (favor top/center of face photo)
  const side = Math.min(face.width, face.height * 0.9);
  const sx = (face.width - side) / 2;
  const sy = face.height * 0.08;
  ctx.drawImage(face, sx, sy, side, side, cx - rx, cy - ry, rx * 2, ry * 2);
  ctx.restore();
  // soft rim
  ctx.strokeStyle = 'rgba(255,220,180,0.35)';
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
  warp: FashionWarp
) {
  const top = h * (warp === 'drape' ? 0.26 : 0.24);
  const bot = h * (warp === 'drape' ? 0.9 : warp === 'layer' ? 0.82 : 0.78);
  const torsoH = bot - top;
  const strips = 32;
  ctx.save();
  for (let i = 0; i < strips; i += 1) {
    const t = i / strips;
    const t2 = (i + 1) / strips;
    const destY = top + t * torsoH;
    const destH = Math.max(1, (t2 - t) * torsoH);
    const destW = w * torsoWidth((t + t2) / 2, warp);
    const sway = Math.sin(t * Math.PI) * w * (warp === 'drape' ? 0.012 : 0.006);
    const destX = w / 2 - destW / 2 + sway;
    const srcY = garment.height * t;
    const srcH = Math.max(1, garment.height / strips);
    ctx.globalAlpha = warp === 'layer' ? 0.85 : 0.92;
    ctx.drawImage(garment, 0, srcY, garment.width, srcH, destX, destY, destW, destH);
  }
  ctx.restore();
}

/**
 * Paint a wardrobe-style full-body preview:
 * closet backdrop → body (upload or stand-in) → face on head → outfit on torso.
 */
export async function paintFashionTryOn(
  canvas: HTMLCanvasElement,
  faceUrl: string | null,
  garmentUrl: string,
  warp: FashionWarp,
  fallback = '#3a2e22',
  bodyUrl: string | null = null
): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  drawClosetBackdrop(ctx, w, h);

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
  if (!drewBody) drawBodyStandIn(ctx, w, h);

  if (faceUrl) {
    try {
      const face = await loadImage(faceUrl);
      drawFaceOnHead(ctx, face, w, h);
    } catch {
      /* keep stand-in head */
    }
  }

  try {
    const garment = await loadImage(garmentUrl);
    drapeGarment(ctx, garment, w, h, warp);
  } catch {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = fallback;
    const top = h * 0.26;
    const bot = h * 0.8;
    const midW = w * (warp === 'drape' ? 0.38 : 0.34);
    ctx.beginPath();
    ctx.moveTo(w * 0.32, top);
    ctx.lineTo(w * 0.68, top);
    ctx.lineTo(w / 2 + midW / 2, bot);
    ctx.lineTo(w / 2 - midW / 2, bot);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
