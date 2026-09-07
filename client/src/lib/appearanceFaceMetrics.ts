export type FaceRegionStats = {
  meanLuma: number;
  contrast: number;
  redBias: number;
  shine: number;
  occupancy: number;
  leftRightBalance: number;
  underEyeDelta: number;
  tzoneShine: number;
  cheekLuma: number;
  width: number;
  height: number;
  bytes: number;
  mime: string;
};

function mean(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function stdev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const m = mean(nums);
  return Math.sqrt(mean(nums.map((n) => (n - m) * (n - m))));
}

function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image'));
    img.src = src;
  });
}

/** Downscale for upload so the 3-angle payload stays under the 50mb JSON cap. */
export async function readAngleFile(file: File): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('file'));
    reader.readAsDataURL(file);
  });
  const img = await load(raw);
  const max = 900;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.max(2, Math.round(img.width * scale));
  const h = Math.max(2, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return raw;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.86);
}

export async function measureFace(dataUrl: string): Promise<FaceRegionStats> {
  const img = await load(dataUrl);
  const w = img.width;
  const h = img.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, w, h);
  const corner: number[] = [];
  const sampleCorner = (sx: number, sy: number, ex: number, ey: number) => {
    for (let y = sy; y < ey; y += 4) {
      for (let x = sx; x < ex; x += 4) {
        const i = (y * w + x) * 4;
        corner.push(luma(data[i], data[i + 1], data[i + 2]));
      }
    }
  };
  sampleCorner(0, 0, Math.floor(w * 0.12), Math.floor(h * 0.12));
  sampleCorner(Math.floor(w * 0.88), 0, w, Math.floor(h * 0.12));
  const bg = mean(corner) || 20;
  const all: number[] = [];
  const left: number[] = [];
  const right: number[] = [];
  const tzone: number[] = [];
  const cheek: number[] = [];
  const under: number[] = [];
  const reds: number[] = [];
  let occupancy = 0;
  let n = 0;
  const step = Math.max(2, Math.floor(Math.min(w, h) / 120));
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const yv = luma(r, g, b);
      all.push(yv);
      n += 1;
      const facey = Math.abs(yv - bg) > 18;
      if (facey) occupancy += 1;
      if (x < w / 2) left.push(yv);
      else right.push(yv);
      const nx = x / w;
      const ny = y / h;
      if (nx > 0.35 && nx < 0.65 && ny > 0.12 && ny < 0.48) tzone.push(yv);
      if (((nx > 0.12 && nx < 0.32) || (nx > 0.68 && nx < 0.88)) && ny > 0.32 && ny < 0.62) cheek.push(yv);
      if (nx > 0.32 && nx < 0.68 && ny > 0.42 && ny < 0.55) under.push(yv);
      if (ny > 0.2 && ny < 0.7 && nx > 0.2 && nx < 0.8) reds.push(r / 255 - (g + b) / 510);
    }
  }
  const meanLuma = mean(all);
  const contrast = stdev(all);
  const shine = all.filter((v) => v > 225).length / Math.max(1, all.length);
  const tzoneShine = tzone.filter((v) => v > 210).length / Math.max(1, tzone.length);
  const lm = mean(left);
  const rm = mean(right);
  const mime = dataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
  const bytes = Math.floor(((dataUrl.split(',')[1] || '').length * 3) / 4);
  return {
    meanLuma: Math.round(meanLuma),
    contrast: Math.round(contrast),
    redBias: Math.round(mean(reds) * 1000) / 1000,
    shine: Math.round(shine * 1000) / 1000,
    occupancy: Math.round((occupancy / Math.max(1, n)) * 1000) / 1000,
    leftRightBalance: Math.round(((lm - rm) / Math.max(1, meanLuma)) * 1000) / 1000,
    underEyeDelta: Math.round((mean(cheek) - mean(under)) / 255 * 1000) / 1000,
    tzoneShine: Math.round(tzoneShine * 1000) / 1000,
    cheekLuma: Math.round(mean(cheek)),
    width: w,
    height: h,
    bytes,
    mime,
  };
}
