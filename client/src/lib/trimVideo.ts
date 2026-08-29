const MAX_CLIP_SEC = 8;

export function clampClipRange(duration: number, start: number, end: number): { start: number; end: number } {
  const maxEnd = Math.min(duration, MAX_CLIP_SEC);
  let s = Math.max(0, Math.min(start, duration - 0.3));
  let e = Math.max(s + 0.5, Math.min(end, maxEnd));
  if (e - s > MAX_CLIP_SEC) e = s + MAX_CLIP_SEC;
  return { start: s, end: e };
}

/** Trim a video blob to a short looping clip (GIF-style profile video). */
export async function trimVideoToDataUrl(
  source: Blob,
  startSec: number,
  endSec: number
): Promise<string> {
  const url = URL.createObjectURL(source);
  try {
    const video = document.createElement('video');
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Could not load video'));
    });

    const duration = video.duration || MAX_CLIP_SEC;
    const { start, end } = clampClipRange(duration, startSec, endSec);
    const clipLen = end - start;

    const w = Math.min(480, video.videoWidth || 480);
    const h = Math.round(((video.videoHeight || 480) / (video.videoWidth || 480)) * w);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process video');

    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
      ? 'video/webm;codecs=vp8'
      : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : '';

    if (!mime) throw new Error('Video recording not supported on this device');

    const stream = canvas.captureStream(24);
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 800_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const done = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mime.split(';')[0] }));
      recorder.onerror = () => reject(new Error('Recording failed'));
    });

    recorder.start(200);
    video.currentTime = start;
    await new Promise<void>((r) => {
      video.onseeked = () => r();
    });

    const startTime = performance.now();
    const draw = () => {
      if (video.currentTime >= end || video.ended) {
        recorder.stop();
        return;
      }
      ctx.drawImage(video, 0, 0, w, h);
      if ((performance.now() - startTime) / 1000 >= clipLen) {
        recorder.stop();
        return;
      }
      requestAnimationFrame(draw);
    };

    await video.play();
    draw();
    const blob = await done;
    video.pause();

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Could not encode video'));
      reader.readAsDataURL(blob);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function isVideoDataUrl(url: string): boolean {
  return url.startsWith('data:video') || /\.(mp4|webm|mov)(\?|#|$)/i.test(url);
}

export { MAX_CLIP_SEC };
