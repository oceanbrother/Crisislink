import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Import translation files
import en from './locales/en.json'
import zh from './locales/zh.json'

const resources = {
  en: { translation: en },
  zh: { translation: zh }
}

i18n
  // Detect user language
  .use(LanguageDetector)
  // Pass i18n instance to react-i18next
  .use(initReactI18next)
  // Initialize i18next
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'translation',
    interpolation: {
      escapeValue: false // React already escapes values
    }
  })

export default i18n
