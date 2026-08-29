/**
 * Camera face scan: both eyes open + 128-d descriptor for sign-up / sign-in.
 * Models + library loaded from CDN (no extra npm install).
 */

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
