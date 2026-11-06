import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslation from './locales/en/translation.json';
import hiTranslation from './locales/hi/translation.json';

const savedLang = typeof window !== 'undefined' ? localStorage.getItem('feetrack_lang') : null;
const defaultLang = savedLang === 'hi' ? 'hi' : 'en';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslation },
      hi: { translation: hiTranslation }
    },
    lng: defaultLang,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export const changeLanguage = (lng) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('feetrack_lang', lng);
  }
  return i18n.changeLanguage(lng);
};

export default i18n;
