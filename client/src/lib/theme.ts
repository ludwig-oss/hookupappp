export type AppTheme = 'light' | 'dark' | 'system';

const THEME_KEY = 'hookup:theme';

export function readStoredTheme(): AppTheme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* ignore */
  }
  return 'system';
}

export function coerceAppTheme(v: unknown): AppTheme {
  if (v === 'light' || v === 'dark' || v === 'system') return v;
  return readStoredTheme();
}

export function applyAppTheme(theme: AppTheme = readStoredTheme()): void {
  const next = coerceAppTheme(theme);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* ignore */
  }

  const hour = new Date().getHours();
  const autoNight = hour < 7 || hour >= 19;
  const night = next === 'dark' || (next === 'system' && autoNight);
  const day = !night;

  document.documentElement.classList.toggle('theme-night', night);
  document.documentElement.classList.toggle('theme-day', day);
  document.documentElement.classList.toggle('dark-mode', night);
}
