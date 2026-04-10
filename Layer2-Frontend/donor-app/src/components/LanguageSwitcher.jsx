import React from 'react'
import { useTranslation } from 'react-i18next'
import '../styles/LanguageSwitcher.css'

const LanguageSwitcher = () => {
  const { i18n, t } = useTranslation()
  const [isOpen, setIsOpen] = React.useState(false)

  const languages = [
    { code: 'en', name: t('language.en'), short: 'EN' },
    { code: 'zh-CN', name: t('language.zh_CN'), short: '中文' },
    { code: 'vi', name: t('language.vi'), short: 'VI' }
  ]

  const handleLanguageChange = (langCode) => {
    i18n.changeLanguage(langCode)
    setIsOpen(false)
    // Save to localStorage
    localStorage.setItem('preferred-language', langCode)
  }

  const currentLang =
    languages.find(lang => i18n.language === lang.code || i18n.language.startsWith(`${lang.code}-`)) ||
    languages[0]

  return (
    <div className="language-switcher">
      <button 
        className="language-button"
        onClick={() => setIsOpen(!isOpen)}
        title={t('language.label')}
      >
        <span className="language-code">{currentLang.short}</span>
      </button>

      {isOpen && (
        <div className="language-dropdown">
          {languages.map(lang => (
            <button
              key={lang.code}
              className={`language-option ${i18n.language === lang.code ? 'active' : ''}`}
              onClick={() => handleLanguageChange(lang.code)}
            >
              <span className="option-name">{lang.name}</span>
              {i18n.language === lang.code && <span className="checkmark">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default LanguageSwitcher
