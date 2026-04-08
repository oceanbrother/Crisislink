import React from 'react'
import { useTranslation } from 'react-i18next'
import '../styles/LanguageSwitcher.css'

const LanguageSwitcher = () => {
  const { i18n, t } = useTranslation()
  const [isOpen, setIsOpen] = React.useState(false)

  const languages = [
    { code: 'en', name: t('language.en'), flag: '🇬🇧' },
    { code: 'zh-CN', name: t('language.zh_CN'), flag: '🇨🇳' },
    { code: 'vi', name: t('language.vi'), flag: '🇻🇳' }
  ]

  const handleLanguageChange = (langCode) => {
    i18n.changeLanguage(langCode)
    setIsOpen(false)
    // Save to localStorage
    localStorage.setItem('preferred-language', langCode)
  }

  const currentLang = languages.find(lang => lang.code === i18n.language) || languages[0]

  return (
    <div className="language-switcher">
      <button 
        className="language-button"
        onClick={() => setIsOpen(!isOpen)}
        title={t('language.label')}
      >
        <span className="language-flag">{currentLang.flag}</span>
        <span className="language-code">{i18n.language.split('-')[0].toUpperCase()}</span>
      </button>

      {isOpen && (
        <div className="language-dropdown">
          {languages.map(lang => (
            <button
              key={lang.code}
              className={`language-option ${i18n.language === lang.code ? 'active' : ''}`}
              onClick={() => handleLanguageChange(lang.code)}
            >
              <span className="option-flag">{lang.flag}</span>
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
