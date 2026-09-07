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

/** Strip-warp the garment onto the torso so it pinches at the waist and flares with drape. */
export async function paintFashionTryOn(
  canvas: HTMLCanvasElement,
  personUrl: string | null,
  garmentUrl: string,
  warp: FashionWarp,
  fallback = '#3a2e22'
): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#1a120c';
  ctx.fillRect(0, 0, w, h);

  if (personUrl) {
    try {
      const person = await loadImage(personUrl);
      ctx.drawImage(person, 0, 0, w, h);
    } catch {
      drawStandIn(ctx, w, h);
    }
  } else {
    drawStandIn(ctx, w, h);
  }

  try {
    const garment = await loadImage(garmentUrl);
    const top = h * (warp === 'drape' ? 0.2 : 0.18);
    const bot = h * (warp === 'drape' ? 0.94 : warp === 'layer' ? 0.86 : 0.78);
    const torsoH = bot - top;
    const strips = 28;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
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
      ctx.globalAlpha = warp === 'layer' ? 0.82 : 0.9;
      ctx.drawImage(garment, 0, srcY, garment.width, srcH, destX, destY, destW, destH);
    }
    ctx.restore();
  } catch {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = fallback;
    const top = h * 0.2;
    const bot = h * 0.82;
    const midW = w * (warp === 'drape' ? 0.38 : 0.34);
    ctx.beginPath();
    ctx.moveTo(w / 2 - w * 0.2, top);
    ctx.lineTo(w / 2 + w * 0.2, top);
    ctx.lineTo(w / 2 + midW / 2, bot);
    ctx.lineTo(w / 2 - midW / 2, bot);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawStandIn(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#2a2118';
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.16, w * 0.11, h * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a2e22';
  ctx.beginPath();
  ctx.moveTo(w * 0.32, h * 0.24);
  ctx.lineTo(w * 0.68, h * 0.24);
  ctx.lineTo(w * 0.62, h * 0.78);
  ctx.lineTo(w * 0.38, h * 0.78);
  ctx.closePath();
  ctx.fill();
}
