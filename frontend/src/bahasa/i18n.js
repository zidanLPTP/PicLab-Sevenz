import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import id from './id.json';

const BAHASA_TERSIMPAN =
  typeof window !== 'undefined'
    ? localStorage.getItem('piclab_bahasa') || 'id'
    : 'id';

i18n.use(initReactI18next).init({
  resources: {
    id: { translation: id },
    en: { translation: en },
  },
  lng: BAHASA_TERSIMPAN,
  fallbackLng: 'id',
  interpolation: {
    escapeValue: false, // React sudah menangani XSS secara aman
  },
});

i18n.on('languageChanged', (bahasaBaru) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('piclab_bahasa', bahasaBaru);
  }
});

export default i18n;
