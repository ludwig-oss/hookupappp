/**
 * Confession booth voice veil.
 * Raw microphone audio is processed on-device and never attached to the call.
 * The listener only receives a deepened, band-limited, nonlinear mask.
 */

export type VoiceVeilRole = 'seeker' | 'guide';

const WORKLET_SOURCE = `
class ConfessionPitchProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = 0.66;
    this.buf = new Float32Array(16384);
    this.write = 0;
    this.readA = 0;
    this.readB = 8192;
    this.port.onmessage = (e) => {
      if (typeof e.data?.ratio === 'number') this.ratio = e.data.ratio;
    };
  }
  process(inputs, outputs) {
    const input = inputs[0] && inputs[0][0];
    const output = outputs[0] && outputs[0][0];
    if (!output) return true;
    const n = output.length;
    const len = this.buf.length;
    for (let i = 0; i < n; i++) {
      const sample = input ? input[i] : 0;
      this.buf[this.write] = sample;
      this.write = (this.write + 1) % len;

      const i0 = Math.floor(this.readA) % len;
      const i1 = (i0 + 1) % len;
      const f = this.readA - Math.floor(this.readA);
      const a = this.buf[i0] * (1 - f) + this.buf[i1] * f;

      const j0 = Math.floor(this.readB) % len;
      const j1 = (j0 + 1) % len;
      const g = this.readB - Math.floor(this.readB);
      const b = this.buf[j0] * (1 - g) + this.buf[j1] * g;

      const wA = 0.5 + 0.5 * Math.cos((2 * Math.PI * (this.readA % 2048)) / 2048);
      output[i] = a * wA + b * (1 - wA);

      this.readA = (this.readA + this.ratio) % len;
      this.readB = (this.readB + this.ratio) % len;
    }
    return true;
  }
}
registerProcessor('confession-pitch', ConfessionPitchProcessor);
`;

function hashToUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

function makeShaperCurve(): Float32Array {
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = Math.tanh(x * 1.65) * 0.92;
  }
  return curve;
}

export interface VoiceVeilHandle {
  maskedStream: MediaStream;
  stop: () => void;
}

export async function createConfessionVoiceVeil(
  role: VoiceVeilRole,
  sessionId: string
): Promise<VoiceVeilHandle> {
  const raw = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
    video: false,
  });

  const ctx = new AudioContext();
  if (ctx.state === 'suspended') await ctx.resume();

  const source = ctx.createMediaStreamSource(raw);
  const dest = ctx.createMediaStreamDestination();

  const jitter = hashToUnit(sessionId + role);
  const baseRatio = role === 'guide' ? 0.62 : 0.68;
  const ratio = Math.max(0.55, Math.min(0.78, baseRatio - jitter * 0.06));

  let pitchNode: AudioNode;
  let workletNode: AudioWorkletNode | null = null;
  try {
    const blob = new Blob([WORKLET_SOURCE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    workletNode = new AudioWorkletNode(ctx, 'confession-pitch');
    workletNode.port.postMessage({ ratio });
    pitchNode = workletNode;
  } catch {
    pitchNode = ctx.createGain();
  }

  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 90;
  hp.Q.value = 0.7;

  const shaper = ctx.createWaveShaper();
  shaper.curve = makeShaperCurve();
  shaper.oversample = '2x';

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 420 + jitter * 80;
  bp.Q.value = 0.55;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2400;
  lp.Q.value = 0.7;

  const shelf = ctx.createBiquadFilter();
  shelf.type = 'lowshelf';
  shelf.frequency.value = 220;
  shelf.gain.value = 7;

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -24;
  comp.knee.value = 18;
  comp.ratio.value = 6;
  comp.attack.value = 0.01;
  comp.release.value = 0.18;

  const wet = ctx.createGain();
  wet.gain.value = 0.95;

  source.connect(hp);
  hp.connect(pitchNode);
  pitchNode.connect(shaper);
  shaper.connect(bp);
  bp.connect(lp);
  lp.connect(shelf);
  shelf.connect(comp);
  comp.connect(wet);
  wet.connect(dest);

  return {
    maskedStream: dest.stream,
    stop: () => {
      try {
        source.disconnect();
      } catch {
        /* ignore */
      }
      raw.getTracks().forEach((t) => t.stop());
      dest.stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
    },
  };
}
