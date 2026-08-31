/** Phone notification + vibration. Safe on browsers that block either. */
export function vibratePhone(pattern: number[] = [200, 80, 200, 80, 200]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    /* ignore */
  }
}

export function notifyDevice(title: string, body: string): void {
  vibratePhone();
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body, silent: false });
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
