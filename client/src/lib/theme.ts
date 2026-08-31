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

export function applyAppTheme(theme: AppTheme = readStoredTheme()): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }

  const hour = new Date().getHours();
  const autoNight = hour < 7 || hour >= 19;
  const night = theme === 'dark' || (theme === 'system' && autoNight);
  const day = !night;

  document.documentElement.classList.toggle('theme-night', night);
  document.documentElement.classList.toggle('theme-day', day);
  document.documentElement.classList.toggle('dark-mode', night);
}
