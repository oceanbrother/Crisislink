import React from 'react'
import { useTranslation } from 'react-i18next'
import '../styles/LanguageSwitcher.css'

const LanguageSwitcher = () => {
  const { i18n } = useTranslation()

  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang)
    localStorage.setItem('preferredLanguage', lang)
  }

  return (
    <div className="language-switcher" role="group" aria-label="Language switcher">
      <button
        className={`lang-btn ${i18n.language === 'en' ? 'active' : ''}`}
        type="button"
        aria-pressed={i18n.language === 'en'}
        onClick={() => handleLanguageChange('en')}
      >
        English
      </button>
      <button
        className={`lang-btn ${i18n.language === 'zh' ? 'active' : ''}`}
        type="button"
        aria-pressed={i18n.language === 'zh'}
        onClick={() => handleLanguageChange('zh')}
      >
        中文
      </button>
    </div>
  )
}

export default LanguageSwitcher
