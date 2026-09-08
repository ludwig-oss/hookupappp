import {
  shouldNotifyInApp,
  shouldPlaySoundInApp,
  shouldVibrateInApp,
  type NotifyKind,
} from './notifyPrefsCache';

/** Slight phone buzz — short so it does not feel aggressive. */
const LIGHT_VIBRATE = [90, 50, 90];
const INTEREST_VIBRATE = [100, 40, 100, 40, 120];

/** Phone notification + vibration. Safe on browsers that block either. */
export function vibratePhone(pattern: number[] = LIGHT_VIBRATE): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    /* ignore */
  }
}

/** Soft in-app beep when OS notification sound is muted (common while tab is open). */
function playNotifyBeep(): void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.start(t);
    osc.stop(t + 0.25);
    osc.onended = () => {
      void ctx.close().catch(() => {});
    };
  } catch {
    /* ignore */
  }
}

export function notifyDevice(title: string, body: string, kind: NotifyKind = 'generic'): void {
  if (!shouldNotifyInApp(kind)) return;
  if (shouldVibrateInApp(kind)) {
    vibratePhone(kind === 'interest' ? INTEREST_VIBRATE : LIGHT_VIBRATE);
  }
  const playSound = shouldPlaySoundInApp();
  if (playSound) playNotifyBeep();
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        silent: !playSound,
        tag: `hookup-${kind}-${Date.now()}`,
        renotify: true,
      });
    }
  } catch {
    /* ignore */
  }
}

export function askNotifyPermission(): void {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  } catch {
    /* ignore */
  }
}
