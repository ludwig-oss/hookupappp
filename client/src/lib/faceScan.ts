/**
 * Camera face scan: both eyes open + 128-d descriptor for sign-up / sign-in.
 * Models + library loaded from CDN (no extra npm install).
 */

import { MEDIA_API_BASE } from '../api/config';

const MODEL_BASE = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
const FACE_API_ESM = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.esm.js';
const EYE_OPEN_MIN = 0.21;
const OPEN_FRAMES_REQUIRED = 4;

export type FaceScanResult = {
  descriptor: number[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FaceApiModule = any;

let faceapiModule: FaceApiModule | null = null;
let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;

async function loadFaceApi(): Promise<FaceApiModule> {
  if (faceapiModule) return faceapiModule;
  faceapiModule = await import(/* @vite-ignore */ FACE_API_ESM);
  return faceapiModule;
}

export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    const faceapi = await loadFaceApi();
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_BASE),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_BASE),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_BASE),
    ]);
    modelsLoaded = true;
  })();
  return loadingPromise;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Eye aspect ratio — higher means eyes more open. */
function eyeAspectRatio(points: { x: number; y: number }[], indices: number[]): number {
  const p = indices.map((i) => points[i]);
  const vertical1 = dist(p[1], p[5]);
  const vertical2 = dist(p[2], p[4]);
  const horizontal = dist(p[0], p[3]);
  if (horizontal === 0) return 0;
  return (vertical1 + vertical2) / (2 * horizontal);
}

function bothEyesOpen(landmarks: { positions: { x: number; y: number }[] }): boolean {
  const pts = landmarks.positions;
  const left = eyeAspectRatio(pts, [36, 37, 38, 39, 40, 41]);
  const right = eyeAspectRatio(pts, [42, 43, 44, 45, 46, 47]);
  return left >= EYE_OPEN_MIN && right >= EYE_OPEN_MIN;
}

export type ScanProgress = {
  status: 'loading' | 'no_face' | 'eyes_closed' | 'ready' | 'capturing' | 'done' | 'error';
  hint: string;
};

export async function captureFaceWithOpenEyes(
  video: HTMLVideoElement,
  onProgress: (p: ScanProgress) => void,
  signal?: AbortSignal
): Promise<FaceScanResult> {
  await loadFaceModels();
  const faceapi = await loadFaceApi();

  onProgress({ status: 'loading', hint: 'Loading face check…' });

  let openFrames = 0;
  const maxAttempts = 120;

  for (let i = 0; i < maxAttempts; i++) {
    if (signal?.aborted) throw new Error('Scan cancelled');

    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      openFrames = 0;
      onProgress({ status: 'no_face', hint: 'Center your face in the circle' });
      await sleep(120);
      continue;
    }

    if (!bothEyesOpen(detection.landmarks)) {
      openFrames = 0;
      onProgress({ status: 'eyes_closed', hint: 'Open both eyes to continue' });
      await sleep(120);
      continue;
    }

    openFrames++;
    onProgress({
      status: openFrames >= OPEN_FRAMES_REQUIRED ? 'ready' : 'eyes_closed',
      hint: openFrames >= OPEN_FRAMES_REQUIRED ? 'Hold still…' : 'Open both eyes to continue',
    });

    if (openFrames >= OPEN_FRAMES_REQUIRED) {
      onProgress({ status: 'capturing', hint: 'Verifying your face…' });
      const descriptor = Array.from(detection.descriptor as Float32Array);
      onProgress({ status: 'done', hint: 'Face verified' });
      return { descriptor };
    }

    await sleep(100);
  }

  onProgress({ status: 'error', hint: 'Could not verify your face. Try better lighting.' });
  throw new Error('Face scan timed out. Open both eyes and face the camera.');
}

export async function startCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  });
  video.srcObject = stream;
  video.playsInline = true;
  video.muted = true;
  await video.play();
  return stream;
}

export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}

export function faceScanSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Same threshold as server face login — same person. */
export const FACE_MATCH_THRESHOLD = 0.55;

export function faceDistance(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function facesMatch(a: number[], b: number[], threshold = FACE_MATCH_THRESHOLD): boolean {
  return faceDistance(a, b) <= threshold;
}

function resolveImageSrc(src: string): string {
  if (src.startsWith('data:') || src.startsWith('blob:') || /^https?:\/\//i.test(src)) return src;
  if (typeof window === 'undefined') return src;
  if (src.startsWith('/')) return `${MEDIA_API_BASE || (typeof window !== 'undefined' ? window.location.origin : '')}${src}`;
  return src;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load your profile photo. Upload a clear face photo and try again.'));
    img.src = resolveImageSrc(src);
  });
}

/** Extract a 128-d descriptor from the visible profile picture. */
export async function extractFaceDescriptorFromImage(src: string): Promise<number[] | null> {
  await loadFaceModels();
  const faceapi = await loadFaceApi();
  const img = await loadImageElement(src);
  const detection = await faceapi
    .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!detection) return null;
  return Array.from(detection.descriptor as Float32Array);
}

export function captureVideoJpeg(video: HTMLVideoElement, quality = 0.85): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const base64 = dataUrl.split(',')[1];
  return base64 || null;
}
