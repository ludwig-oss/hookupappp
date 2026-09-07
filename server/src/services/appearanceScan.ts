/**
 * Multi-angle input pipeline.
 *
 * Requires exactly three images: frontal, left profile, right profile.
 * Lighting and alignment are scored from client-measured face metrics
 * (canvas sampling) plus server-side header checks (MIME, bytes, pixel size).
 *
 * We do not run OpenCV here. The client must send region stats so the
 * server can reject dark, blown-out, or off-angle shots without a native decoder.
 */

export const APPEARANCE_ANGLES = ['frontal', 'leftProfile', 'rightProfile'] as const;
export type AppearanceAngle = (typeof APPEARANCE_ANGLES)[number];

export interface FaceRegionStats {
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
}

export interface AnglePayload {
  dataUrl: string;
  metrics: FaceRegionStats;
}

export interface AngleVerdict {
  angle: AppearanceAngle;
  ok: boolean;
  errors: string[];
  metrics: FaceRegionStats | null;
}

const MIN_BYTES = 18_000;
const MAX_BYTES = 12_000_000;
const MIN_FRONT = 480;
const MIN_PROFILE = 360;

function dataUrlMeta(dataUrl: string): { mime: string; bytes: number; width: number; height: number } | null {
  const m = /^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i.exec((dataUrl || '').trim());
  if (!m) return null;
  const mime = m[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : m[1].toLowerCase();
  const b64 = m[2].replace(/\s/g, '');
  const bytes = Math.floor((b64.length * 3) / 4);
  const buf = Buffer.from(b64.slice(0, 800), 'base64');
  const dim = readImageSize(buf, mime);
  return { mime, bytes, width: dim?.width || 0, height: dim?.height || 0 };
}

function readImageSize(buf: Buffer, mime: string): { width: number; height: number } | null {
  if (mime === 'image/png' && buf.length >= 24 && buf[0] === 0x89) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (mime === 'image/jpeg') {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) break;
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker === 0xc0 || marker === 0xc2) {
        return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
      }
      i += 2 + len;
    }
  }
  if (mime === 'image/webp' && buf.length >= 30 && buf.toString('ascii', 0, 4) === 'RIFF') {
    if (buf.toString('ascii', 12, 16) === 'VP8 ') {
      return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
  }
  return null;
}

function clampMetrics(raw: FaceRegionStats | undefined, header: { mime: string; bytes: number; width: number; height: number }): FaceRegionStats {
  const m = raw || ({} as FaceRegionStats);
  return {
    meanLuma: Number(m.meanLuma) || 0,
    contrast: Number(m.contrast) || 0,
    redBias: Number(m.redBias) || 0,
    shine: Number(m.shine) || 0,
    occupancy: Number(m.occupancy) || 0,
    leftRightBalance: Number(m.leftRightBalance) || 0,
    underEyeDelta: Number(m.underEyeDelta) || 0,
    tzoneShine: Number(m.tzoneShine) || 0,
    cheekLuma: Number(m.cheekLuma) || 0,
    width: header.width || Number(m.width) || 0,
    height: header.height || Number(m.height) || 0,
    bytes: header.bytes,
    mime: header.mime,
  };
}

function scoreAngle(angle: AppearanceAngle, dataUrl: string | undefined, metricsIn: FaceRegionStats | undefined): AngleVerdict {
  const errors: string[] = [];
  if (!dataUrl || !String(dataUrl).startsWith('data:image')) {
    return { angle, ok: false, errors: [`Missing ${label(angle)} photo.`], metrics: null };
  }
  const header = dataUrlMeta(dataUrl);
  if (!header) {
    return { angle, ok: false, errors: [`${label(angle)} must be a JPEG, PNG, or WebP upload.`], metrics: null };
  }
  if (header.bytes < MIN_BYTES) errors.push(`${label(angle)} is too small or overly compressed.`);
  if (header.bytes > MAX_BYTES) errors.push(`${label(angle)} is too large. Use a photo under 12MB.`);
  const min = angle === 'frontal' ? MIN_FRONT : MIN_PROFILE;
  if (header.width && header.height && (header.width < min || header.height < min)) {
    errors.push(`${label(angle)} needs at least ${min}px on the short side.`);
  }
  const metrics = clampMetrics(metricsIn, header);
  if (!metricsIn) errors.push(`${label(angle)} could not be measured. Re-upload in the app.`);
  if (metrics.meanLuma > 0 && metrics.meanLuma < 42) errors.push(`${label(angle)} is too dark. Face a window or add a lamp in front of you.`);
  if (metrics.meanLuma > 228) errors.push(`${label(angle)} is blown out. Step back from the light.`);
  if (metrics.contrast > 0 && metrics.contrast < 12) errors.push(`${label(angle)} is flat. Move off the wall or add side light.`);
  if (metrics.occupancy > 0 && metrics.occupancy < 0.18) errors.push(`${label(angle)} is too far away. Fill more of the frame with your head.`);
  if (metrics.occupancy > 0.92) errors.push(`${label(angle)} is cropped. Show hairline to collarbones.`);
  if (angle === 'frontal' && Math.abs(metrics.leftRightBalance) > 0.22) {
    errors.push('Frontal shot is turned. Look straight at the camera, ears even.');
  }
  if (angle === 'leftProfile' && metrics.leftRightBalance < -0.08) {
    errors.push('Left profile should show the left side of the face, nose toward the left of the frame.');
  }
  if (angle === 'rightProfile' && metrics.leftRightBalance > 0.08) {
    errors.push('Right profile should show the right side of the face, nose toward the right of the frame.');
  }
  return { angle, ok: errors.length === 0, errors, metrics };
}

function label(angle: AppearanceAngle): string {
  if (angle === 'frontal') return 'Frontal';
  if (angle === 'leftProfile') return 'Left profile';
  return 'Right profile';
}

export interface ScanValidation {
  ok: boolean;
  angles: Record<AppearanceAngle, AngleVerdict>;
  errors: string[];
}

/**
 * Strict three-angle gate. Any missing angle or lighting/alignment miss fails the scan.
 */
export function validateThreeAngles(input: {
  frontal?: AnglePayload | null;
  leftProfile?: AnglePayload | null;
  rightProfile?: AnglePayload | null;
}): ScanValidation {
  const angles = {
    frontal: scoreAngle('frontal', input.frontal?.dataUrl, input.frontal?.metrics),
    leftProfile: scoreAngle('leftProfile', input.leftProfile?.dataUrl, input.leftProfile?.metrics),
    rightProfile: scoreAngle('rightProfile', input.rightProfile?.dataUrl, input.rightProfile?.metrics),
  };
  const errors = APPEARANCE_ANGLES.flatMap((a) => angles[a].errors);
  if (!input.frontal) errors.unshift('Frontal photo is required.');
  if (!input.leftProfile) errors.unshift('Left profile photo is required.');
  if (!input.rightProfile) errors.unshift('Right profile photo is required.');
  const unique = [...new Set(errors)];
  return { ok: unique.length === 0 && APPEARANCE_ANGLES.every((a) => angles[a].ok), angles, errors: unique };
}
