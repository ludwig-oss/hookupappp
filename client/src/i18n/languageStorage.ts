export const APP_LANG_KEY = 'app_language';

export function getStoredLanguage(): string {
  return localStorage.getItem(APP_LANG_KEY) || 'en';
}

export function setStoredLanguage(code: string): void {
  localStorage.setItem(APP_LANG_KEY, code);
  window.dispatchEvent(new CustomEvent('app-language-change', { detail: { language: code } }));
}
