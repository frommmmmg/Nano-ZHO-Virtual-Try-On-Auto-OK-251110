import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import en from './en';
import zh from './zh';

type Language = 'en' | 'zh';

const translations = { en, zh };

interface LanguageContextType {
  language: Language;
  changeLanguage: (lang: Language) => void;
  // FIX: Updated `t` function signature to accept an optional `replacements` object for dynamic values in translations.
  t: (key: string, replacements?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const savedLang = localStorage.getItem('language');
      return (savedLang === 'en' || savedLang === 'zh') ? savedLang : 'en';
    } catch {
      return 'en';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('language', language);
    } catch (e) {
      console.error("Failed to save language to localStorage", e);
    }
  }, [language]);

  const changeLanguage = (lang: Language) => {
    setLanguage(lang);
  };

  // FIX: Updated `t` function to handle placeholder replacements (e.g., {count}) in translation strings.
  const t = (key: string, replacements?: Record<string, string | number>): string => {
    const keys = key.split('.');
    
    const findTranslation = (langObj: any): string | undefined => {
        let result: any = langObj;
        for (const k of keys) {
            result = result?.[k];
            if (result === undefined) {
                return undefined;
            }
        }
        return typeof result === 'string' ? result : undefined;
    };

    let translation = findTranslation(translations[language]) ?? findTranslation(translations['en']) ?? key;

    if (replacements) {
        for (const placeholder in replacements) {
            translation = translation.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), String(replacements[placeholder]));
        }
    }

    return translation;
  };

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};
