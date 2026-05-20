import React from 'react'
import { useTranslation } from 'react-i18next'
import '../styles/LanguageSwitcher.css'

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'zh', label: '中文' },
]

const LanguageSwitcher = ({ dark = false }) => {
  const { i18n } = useTranslation()

  // Save chosen language to local storage and apply it
  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang)
    localStorage.setItem('preferredLanguage', lang)
  }

  return (
    <div className={`language-switcher${dark ? ' language-switcher--dark' : ''}`} role="group" aria-label="Language switcher">
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          className={`lang-btn${i18n.language === code ? ' active' : ''}`}
          type="button"
          aria-pressed={i18n.language === code}
          onClick={() => handleLanguageChange(code)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export default LanguageSwitcher
