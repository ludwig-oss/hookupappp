/**
 * Landmark-safe after preview: warp the original selfie pixels.
 * Does not generate a new identity. Submental, jaw, blemish, and under-eye
 * are simulated as a 6-month habit look.
 */

export type AfterFaultId =
  | 'submental-fullness'
  | 'low-gonial-definition'
  | 'inflammatory-acne'
  | 'comedonal'
  | 'post-inflammatory-marks'
  | 'rosacea-redness'
  | 'periorbital-darkness'
  | string;

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith('data:')) {
      try {
        if (new URL(src, window.location.href).origin !== window.location.origin) img.crossOrigin = 'anonymous';
      } catch {
        /* local */
      }
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image'));
    img.src = src;
  });
}

export async function paintAppearanceAfter(
  canvas: HTMLCanvasElement,
  photoUrl: string,
  faults: { id: AfterFaultId; score: number }[],
  angle: 'frontal' | 'leftProfile' | 'rightProfile'
): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = await load(photoUrl);
  const w = (canvas.width = 720);
  const h = (canvas.height = 960);
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const ids = new Set(faults.filter((f) => f.score >= 0.28).map((f) => f.id));
  const jaw = ids.has('low-gonial-definition') ? 1 : 0;
  const chin = ids.has('submental-fullness') ? 1 : 0;
  const skin =
    ids.has('inflammatory-acne') ||
    ids.has('comedonal') ||
    ids.has('post-inflammatory-marks') ||
    ids.has('rosacea-redness')
      ? 1
      : 0;
  const eyes = ids.has('periorbital-darkness') ? 1 : 0;

  if (jaw || chin) {
    const src = ctx.getImageData(0, Math.floor(h * 0.42), w, Math.floor(h * 0.5));
    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = Math.floor(h * 0.5);
    tmp.getContext('2d')?.putImageData(src, 0, 0);
    ctx.save();
    const scaleX = 1 + jaw * 0.035;
    const scaleY = 1 - chin * 0.04;
    ctx.translate(w / 2, h * 0.62);
    ctx.scale(scaleX, scaleY);
    ctx.translate(-w / 2, -h * 0.62);
    ctx.drawImage(tmp, 0, h * 0.42, w, tmp.height);
    ctx.restore();
  }

  const shot = ctx.getImageData(0, 0, w, h);
  const d = shot.data;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const ny = y / h;
      const nx = x / w;
      if (skin && ny > 0.18 && ny < 0.72 && nx > 0.18 && nx < 0.82) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const red = r - (g + b) / 2;
        if (red > 18) {
          d[i] = Math.round(r - red * 0.45);
          d[i + 1] = Math.round(g + red * 0.08);
          d[i + 2] = Math.round(b + red * 0.08);
        }
      }
      if (eyes && ny > 0.38 && ny < 0.52 && nx > 0.28 && nx < 0.72) {
        d[i] = Math.min(255, d[i] + 14);
        d[i + 1] = Math.min(255, d[i + 1] + 12);
        d[i + 2] = Math.min(255, d[i + 2] + 10);
      }
      if (chin && ny > 0.72 && ny < 0.9) {
        const mid = angle === 'frontal' ? Math.abs(nx - 0.5) < 0.18 : true;
        if (mid) {
          d[i] = Math.max(0, d[i] - 6);
          d[i + 1] = Math.max(0, d[i + 1] - 6);
          d[i + 2] = Math.max(0, d[i + 2] - 4);
        }
      }
    }
  }
  ctx.putImageData(shot, 0, 0);
}
