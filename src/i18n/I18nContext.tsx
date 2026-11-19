import React, { createContext, useContext, useEffect, useState } from 'react';
import { LanguageCode } from '../types';
import { TRANSLATIONS, TranslationStrings } from './translations';

const LANG_STORAGE_KEY = 'zone_language_v1';

interface I18nContextValue {
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  t: TranslationStrings;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'pt-BR',
  setLang: () => {},
  t: TRANSLATIONS['pt-BR'],
});

function detectInitialLang(): LanguageCode {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY) as LanguageCode | null;
    if (saved === 'pt-BR' || saved === 'en' || saved === 'ru') return saved;
  } catch {
    // ignore storage errors
  }
  if (typeof navigator !== 'undefined') {
    const nav = navigator.language.toLowerCase();
    if (nav.startsWith('ru')) return 'ru';
    if (nav.startsWith('pt')) return 'pt-BR';
    if (nav.startsWith('en')) return 'en';
  }
  return 'pt-BR';
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<LanguageCode>(detectInitialLang);

  const setLang = (next: LanguageCode) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
  };

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t: TRANSLATIONS[lang] }}>
      {children}
    </I18nContext.Provider>
  );
};

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
