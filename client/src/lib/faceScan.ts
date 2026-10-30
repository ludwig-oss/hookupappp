/**
 * Camera face scan: a visible head is enough (chest and above).
 * Models + library loaded from CDN (no extra npm install).
 */

import { MEDIA_API_BASE } from '../api/config';

const MODEL_BASE = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
const FACE_API_ESM = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.esm.js';
const HEAD_FRAMES_REQUIRED = 2;

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

  let seenFrames = 0;
  const maxAttempts = 120;

  for (let i = 0; i < maxAttempts; i++) {
    if (signal?.aborted) throw new Error('Scan cancelled');

    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.28 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      seenFrames = 0;
      onProgress({ status: 'no_face', hint: 'Keep your head in frame. Chest and above is enough.' });
      await sleep(120);
      continue;
    }

    seenFrames++;
    onProgress({
      status: 'ready',
      hint: seenFrames >= HEAD_FRAMES_REQUIRED ? 'Hold still…' : 'Head in frame — chest and above is enough',
    });

    if (seenFrames >= HEAD_FRAMES_REQUIRED) {
      onProgress({ status: 'capturing', hint: 'Checking your head against your photo…' });
      const descriptor = Array.from(detection.descriptor as Float32Array);
      onProgress({ status: 'done', hint: 'Head matched' });
      return { descriptor };
    }

    await sleep(100);
  }

  onProgress({ status: 'error', hint: 'Could not see your head. Frame from the chest up and try again.' });
  throw new Error('Could not see your head. A chest-up photo is enough — keep your head in frame.');
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
    img.onerror = () => reject(new Error('Could not load your profile photo. Use a chest-up photo with your head visible.'));
    img.src = resolveImageSrc(src);
  });
}

/** Extract a 128-d descriptor from the visible profile picture. */
export async function extractFaceDescriptorFromImage(src: string): Promise<number[] | null> {
  await loadFaceModels();
  const faceapi = await loadFaceApi();
  const img = await loadImageElement(src);
  const detection = await faceapi
    .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.28 }))
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
