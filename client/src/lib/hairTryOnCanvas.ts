/**
 * Barber-shop style hair preview: user's face + catalog silhouette or reference hair photo.
 */

export type HairFamily = 'short' | 'medium' | 'long' | 'protective' | 'slick';
export type HairDensity = 'tight' | 'soft' | 'voluminous';

export type HairPaintOptions = {
  family?: HairFamily;
  density?: HairDensity;
  /** Photo of someone else's hair — top/crown region is lifted onto the user's head. */
  refHairUrl?: string | null;
  /** Soft tint for procedural hair */
  color?: string;
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

function drawShopBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#3a342e');
  g.addColorStop(0.45, '#1c1814');
  g.addColorStop(1, '#0c0a08');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fillRect(0, 0, w, h * 0.42);
}

function drawFacePortrait(ctx: CanvasRenderingContext2D, face: HTMLImageElement, w: number, h: number) {
  // Favor head/shoulders: crop center-top of face photo into portrait frame
  const side = Math.min(face.width, face.height);
  const sx = (face.width - side) / 2;
  const sy = Math.max(0, face.height * 0.02);
  const sh = Math.min(side * 1.15, face.height - sy);
  const dw = w * 0.78;
  const dh = h * 0.88;
  const dx = (w - dw) / 2;
  const dy = h * 0.08;
  ctx.drawImage(face, sx, sy, side, sh, dx, dy, dw, dh);
}

function paintProceduralHair(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  family: HairFamily,
  density: HairDensity,
  color: string
) {
  const cx = w / 2;
  const top = h * 0.1;
  const headR = w * 0.22;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.globalAlpha = density === 'voluminous' ? 0.88 : density === 'soft' ? 0.78 : 0.9;

  if (family === 'short' || family === 'slick') {
    ctx.beginPath();
    ctx.ellipse(cx, top + headR * 0.55, headR * (family === 'slick' ? 0.95 : 1.05), headR * 0.72, 0, Math.PI, 0);
    ctx.fill();
    if (family === 'slick') {
      ctx.beginPath();
      ctx.moveTo(cx - headR * 0.2, top + headR * 0.1);
      ctx.quadraticCurveTo(cx + headR * 0.6, top - headR * 0.15, cx + headR * 0.9, top + headR * 0.5);
      ctx.lineWidth = headR * 0.35;
      ctx.stroke();
    }
  } else if (family === 'protective') {
    const rows = density === 'tight' ? 9 : 7;
    for (let i = 0; i < rows; i++) {
      const t = i / (rows - 1);
      const x0 = cx - headR * 0.85 + t * headR * 0.2;
      const x1 = cx + headR * 0.15 + t * headR * 0.7;
      ctx.beginPath();
      ctx.moveTo(x0, top + headR * 0.15);
      ctx.quadraticCurveTo(cx + (t - 0.5) * headR * 0.4, top + headR * 1.4, x1, top + headR * 2.2);
      ctx.lineWidth = Math.max(3, headR * 0.12);
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(cx, top + headR * 0.45, headR * 1.05, headR * 0.55, 0, Math.PI, 0);
    ctx.fill();
  } else if (family === 'long') {
    ctx.beginPath();
    ctx.moveTo(cx - headR * 1.15, top + headR * 0.5);
    ctx.quadraticCurveTo(cx - headR * 1.4, top + headR * 2.6, cx - headR * 0.7, top + headR * 3.2);
    ctx.lineTo(cx + headR * 0.7, top + headR * 3.2);
    ctx.quadraticCurveTo(cx + headR * 1.4, top + headR * 2.6, cx + headR * 1.15, top + headR * 0.5);
    ctx.quadraticCurveTo(cx, top - headR * 0.35, cx - headR * 1.15, top + headR * 0.5);
    ctx.fill();
  } else {
    // medium
    ctx.beginPath();
    ctx.ellipse(cx, top + headR * 0.5, headR * 1.15, headR * 0.7, 0, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - headR * 1.1, top + headR * 0.55);
    ctx.quadraticCurveTo(cx - headR * 1.25, top + headR * 1.8, cx - headR * 0.55, top + headR * 2.1);
    ctx.lineTo(cx + headR * 0.55, top + headR * 2.1);
    ctx.quadraticCurveTo(cx + headR * 1.25, top + headR * 1.8, cx + headR * 1.1, top + headR * 0.55);
    ctx.fill();
  }
  ctx.restore();
}

async function paintReferenceHair(
  ctx: CanvasRenderingContext2D,
  ref: HTMLImageElement,
  w: number,
  h: number
) {
  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext('2d');
  if (!tctx) return;

  // Use upper ~55% of reference (hair/crown), stretch over head region
  const srcH = Math.max(1, Math.floor(ref.height * 0.55));
  const destW = w * 0.86;
  const destH = h * 0.55;
  const dx = (w - destW) / 2;
  const dy = h * 0.02;
  tctx.drawImage(ref, 0, 0, ref.width, srcH, dx, dy, destW, destH);

  // Soft elliptical mask so only hair zone shows
  tctx.globalCompositeOperation = 'destination-in';
  const mask = tctx.createRadialGradient(w / 2, h * 0.22, w * 0.08, w / 2, h * 0.28, w * 0.42);
  mask.addColorStop(0, 'rgba(0,0,0,1)');
  mask.addColorStop(0.65, 'rgba(0,0,0,0.85)');
  mask.addColorStop(1, 'rgba(0,0,0,0)');
  tctx.fillStyle = mask;
  tctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.drawImage(tmp, 0, 0);
  ctx.restore();
}

/**
 * Live barbershop preview: face photo with catalog hair or uploaded reference hair.
 */
export async function paintHairTryOn(
  canvas: HTMLCanvasElement,
  faceUrl: string | null,
  opts: HairPaintOptions = {}
): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  drawShopBackdrop(ctx, w, h);

  if (faceUrl) {
    try {
      const face = await loadImage(faceUrl);
      drawFacePortrait(ctx, face, w, h);
    } catch {
      ctx.fillStyle = '#c4a484';
      ctx.beginPath();
      ctx.ellipse(w / 2, h * 0.38, w * 0.22, h * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = '#c4a484';
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.38, w * 0.22, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `${Math.floor(w * 0.045)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Upload your face first', w / 2, h * 0.72);
  }

  if (opts.refHairUrl) {
    try {
      const ref = await loadImage(opts.refHairUrl);
      await paintReferenceHair(ctx, ref, w, h);
      return;
    } catch {
      /* fall through to procedural */
    }
  }

  paintProceduralHair(
    ctx,
    w,
    h,
    opts.family || 'medium',
    opts.density || 'soft',
    opts.color || '#2a1c12'
  );
}
