import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getTranslation } from '../i18n/translations';
import { getStoredLanguage } from '../i18n/languageStorage';

type LanguageContextType = {
  language: string;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  t: (key: string) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState(getStoredLanguage);

  useEffect(() => {
    const handler = () => setLanguage(getStoredLanguage());
    window.addEventListener('app-language-change', handler);
    return () => window.removeEventListener('app-language-change', handler);
  }, []);

  const t = useCallback((key: string) => getTranslation(language, key), [language]);

  return (
    <LanguageContext.Provider value={{ language, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}
