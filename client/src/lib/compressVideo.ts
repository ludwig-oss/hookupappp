/** Phone camera videos (iPhone .mov/HEVC, Android 4K mp4) are often 100MB+. Re-encode to 720p so they upload. */

const SKIP_UNDER_BYTES = 16 * 1024 * 1024;
const TARGET_MAX_BYTES = 32 * 1024 * 1024;
const DEFAULT_MAX_DURATION_SEC = 180;
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|3gp|3gpp|mkv|avi|mpeg|mpg|ogv|ogg)$/i;

export function isProbablyVideoFile(file: File): boolean {
  const t = (file.type || '').toLowerCase();
  if (t.startsWith('video/')) return true;
  if (t.startsWith('image/') || t.startsWith('audio/')) return false;
  return VIDEO_EXT.test(file.name || '');
}

export function isProbablyImageFile(file: File): boolean {
  const t = (file.type || '').toLowerCase();
  if (t.startsWith('image/')) return true;
  if (t.startsWith('video/')) return false;
  return /\.(jpe?g|png|gif|webp|heic|heif|bmp|avif)$/i.test(file.name || '');
}

export const MEDIA_FILE_ACCEPT =
  'image/*,video/*,.mov,.mp4,.m4v,.webm,.3gp,.mkv,.heic,.heif';

function pickRecorderMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const types = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1.42001E',
    'video/mp4',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

function waitForEvent(el: HTMLVideoElement, event: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('Video took too long to load on this device'));
    }, timeoutMs);
    const ok = () => {
      window.clearTimeout(timer);
      cleanup();
      resolve();
    };
    const fail = () => {
      window.clearTimeout(timer);
      cleanup();
      reject(new Error('This video could not be read. Try another clip.'));
    };
    const cleanup = () => {
      el.removeEventListener(event, ok);
      el.removeEventListener('error', fail);
    };
    el.addEventListener(event, ok, { once: true });
    el.addEventListener('error', fail, { once: true });
  });
}

async function attachHiddenVideo(file: Blob): Promise<{ video: HTMLVideoElement; objectUrl: string }> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = false;
  video.playsInline = true;
  video.setAttribute('playsinline', 'true');
  video.setAttribute('webkit-playsinline', 'true');
  video.disablePictureInPicture = true;
  video.controls = false;
  video.style.cssText =
    'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;z-index:-1';
  video.src = objectUrl;
  document.body.appendChild(video);

  try {
    video.load();
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error('Video took too long to load on this device'));
      }, 20000);
      const ok = () => {
        window.clearTimeout(timer);
        cleanup();
        resolve();
      };
      const fail = () => {
        window.clearTimeout(timer);
        cleanup();
        reject(new Error('This video could not be read. Try another clip.'));
      };
      const cleanup = () => {
        video.removeEventListener('loadeddata', ok);
        video.removeEventListener('canplay', ok);
        video.removeEventListener('loadedmetadata', ok);
        video.removeEventListener('error', fail);
      };
      video.addEventListener('loadeddata', ok);
      video.addEventListener('canplay', ok);
      video.addEventListener('loadedmetadata', ok);
      video.addEventListener('error', fail);
    });
    if (!video.videoWidth) {
      video.currentTime = 0.05;
      await waitForEvent(video, 'seeked', 8000).catch(() => undefined);
    }
  } catch (err) {
    video.remove();
    URL.revokeObjectURL(objectUrl);
    throw err;
  }

  return { video, objectUrl };
}

function evenDim(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2);
}

async function transcodeVideo(
  file: File,
  maxEdge: number,
  videoBitsPerSecond: number,
  maxDurationSec: number
): Promise<Blob> {
  const mime = pickRecorderMime();

  const { video, objectUrl } = await attachHiddenVideo(file);
  const audioCtxName = typeof window !== 'undefined'
    ? window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    : undefined;
  let audioCtx: AudioContext | null = null;
  let canvas: HTMLCanvasElement | null = null;

  try {
    const srcW = video.videoWidth || 720;
    const srcH = video.videoHeight || 1280;
    const scale = Math.min(1, maxEdge / Math.max(srcW, srcH, 1));
    const w = evenDim(srcW * scale);
    const h = evenDim(srcH * scale);

    canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.style.cssText =
      'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;z-index:-1';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not process video');

    const canvasStream = canvas.captureStream(30);

    try {
      if (audioCtxName) {
        audioCtx = new audioCtxName();
        if (audioCtx.state === 'suspended') await audioCtx.resume();
        const elSrc = audioCtx.createMediaElementSource(video);
        const recDest = audioCtx.createMediaStreamDestination();
        elSrc.connect(recDest);
        recDest.stream.getAudioTracks().forEach((track) => canvasStream.addTrack(track));
      }
    } catch {
      try {
        const cap =
          (video as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream })
            .captureStream ||
          (video as HTMLVideoElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream;
        if (cap) {
          const vs = cap.call(video);
          vs.getAudioTracks().forEach((track) => canvasStream.addTrack(track));
        }
      } catch {
        /* silent video is still a valid story */
      }
    }

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(canvasStream, { mimeType: mime, videoBitsPerSecond });
    } catch {
      try {
        recorder = new MediaRecorder(canvasStream, { mimeType: mime });
      } catch {
        recorder = new MediaRecorder(canvasStream);
      }
    }
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    const recorded = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        canvasStream.getTracks().forEach((t) => t.stop());
        resolve(new Blob(chunks, { type: mime.split(';')[0] || 'video/mp4' }));
      };
      recorder.onerror = () => reject(new Error('Could not compress video'));
    });

    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : maxDurationSec;
    const endAt = Math.min(duration, maxDurationSec);

    video.currentTime = 0;
    if (video.currentTime > 0.05) {
      await waitForEvent(video, 'seeked', 6000).catch(() => undefined);
    }

    recorder.start(200);
    try {
      await video.play();
    } catch {
      video.muted = true;
      await video.play();
    }

    await new Promise<void>((resolve) => {
      let stopped = false;
      const timeoutId = window.setTimeout(() => finish(), Math.ceil(endAt * 1000) + 4000);
      function finish() {
        if (stopped) return;
        stopped = true;
        window.clearTimeout(timeoutId);
        try {
          video.pause();
        } catch {
          /* ignore */
        }
        try {
          if (recorder.state !== 'inactive') recorder.stop();
        } catch {
          /* ignore */
        }
        resolve();
      }
      video.onended = () => finish();
      const draw = () => {
        if (stopped) return;
        ctx.drawImage(video, 0, 0, w, h);
        if (video.ended || video.currentTime >= endAt) {
          finish();
          return;
        }
        requestAnimationFrame(draw);
      };
      draw();
    });

    const blob = await Promise.race([
      recorded,
      new Promise<Blob>((_, reject) => {
        window.setTimeout(() => reject(new Error('Could not finish compressing video')), 12000);
      }),
    ]);
    if (!blob.size) throw new Error('Compressed video was empty');
    return blob;
  } finally {
    try {
      video.pause();
    } catch {
      /* ignore */
    }
    video.removeAttribute('src');
    video.load();
    video.remove();
    canvas?.remove();
    URL.revokeObjectURL(objectUrl);
    if (audioCtx) {
      audioCtx.close().catch(() => undefined);
    }
  }
}

export async function compressVideoFile(
  file: File,
  opts?: { maxDurationSec?: number }
): Promise<Blob> {
  const maxDurationSec = opts?.maxDurationSec ?? DEFAULT_MAX_DURATION_SEC;
  if (file.size <= SKIP_UNDER_BYTES) return file;
  if (typeof MediaRecorder === 'undefined' || typeof document === 'undefined') {
    if (file.size <= 95 * 1024 * 1024) return file;
    throw new Error('Could not prepare this video on your phone. Try again.');
  }

  try {
    let blob = await transcodeVideo(file, 720, 1_500_000, maxDurationSec);
    if (blob.size > TARGET_MAX_BYTES) {
      blob = await transcodeVideo(file, 480, 800_000, maxDurationSec);
    }
    if (blob.size > 0 && blob.size < file.size) return blob;
    if (file.size <= 95 * 1024 * 1024) return file;
    if (blob.size > 0) return blob;
  } catch (err) {
    console.warn('Video compress failed, using original if possible', err);
    if (file.size <= 95 * 1024 * 1024) return file;
    throw new Error('Could not prepare this video on your phone. Try again.');
  }

  return file;
}
