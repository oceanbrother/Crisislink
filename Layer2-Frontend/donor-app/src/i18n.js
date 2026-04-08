import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en.json'
import zhCN from './locales/zh-CN.json'
import vi from './locales/vi.json'

const resources = {
  en: { translation: en },
  'zh-CN': { translation: zhCN },
  vi: { translation: vi }
}

i18n
  .use(LanguageDetector) // Detects browser language
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    
    // Allow separating keys with dots
    keySeparator: '.',

    interpolation: {
      escapeValue: false // React already protects from XSS
    },

    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    }
  })

export default i18n
