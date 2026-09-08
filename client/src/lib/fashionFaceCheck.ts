import { measureFace } from './appearanceFaceMetrics';

export type FacePhotoCheck = {
  ok: boolean;
  reason?: string;
  occupancy: number;
  contrast: number;
};

/** Heuristic: profile / try-on photo must clearly show a face (not a landscape or blank). */
export async function checkFaceInPhoto(src: string | null | undefined): Promise<FacePhotoCheck> {
  if (!src || !String(src).trim()) {
    return { ok: false, reason: 'Add a clear face photo first.', occupancy: 0, contrast: 0 };
  }
  try {
    const m = await measureFace(src);
    if (m.occupancy < 0.08) {
      return {
        ok: false,
        reason: 'I need a photo with your face clearly in frame — not a landscape or empty shot.',
        occupancy: m.occupancy,
        contrast: m.contrast,
      };
    }
    if (m.contrast < 10) {
      return {
        ok: false,
        reason: 'That photo is too flat or dark. Use daylight and face the camera.',
        occupancy: m.occupancy,
        contrast: m.contrast,
      };
    }
    if (Math.abs(m.leftRightBalance) > 0.55) {
      return {
        ok: false,
        reason: 'Face the camera more straight-on so I can fit the outfit on you.',
        occupancy: m.occupancy,
        contrast: m.contrast,
      };
    }
    return { ok: true, occupancy: m.occupancy, contrast: m.contrast };
  } catch {
    return {
      ok: false,
      reason: 'Could not read that photo. Upload a clear face shot.',
      occupancy: 0,
      contrast: 0,
    };
  }
}
