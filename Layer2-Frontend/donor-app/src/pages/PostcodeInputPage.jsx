import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { saveDonorPostcode } from '../utils/donorPostcode'
import '../styles/PostcodeInputPage.css'

const PostcodeInputPage = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [postcode, setPostcode] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    document.getElementById('postcode-input')?.focus()
  }, [])

  const handleInputChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4)
    setPostcode(value)
    if (error) setError('')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (/^\d{4}$/.test(postcode)) {
      saveDonorPostcode(postcode)
      navigate('/donor/listings', { state: { postcode } })
    } else {
      setError(t('postcode.invalid'))
    }
  }

  return (
    <div className="postcode-page donor-role-page">
      <button className="back-link" onClick={() => navigate('/roles')}>
        <span className="material-symbols-outlined">arrow_back</span>
      </button>

      <main className="postcode-main">
        <div className="postcode-card">
          <div className="postcode-icon-circle">
            <span className="material-symbols-outlined">volunteer_activism</span>
          </div>

          <div className="postcode-brand">{t('appName')}</div>

          <h1 className="postcode-title">{t('postcode.title')}</h1>
          <p className="postcode-desc">{t('postcode.subtitle')}</p>

          <form onSubmit={handleSubmit} className="form-group">
            <input
              id="postcode-input"
              className="postcode-input"
              type="text"
              value={postcode}
              onChange={handleInputChange}
              placeholder={t('postcode.placeholder')}
              maxLength="4"
              inputMode="numeric"
              autoComplete="postal-code"
            />

            {error ? <div className="error-message">{error}</div> : null}

            <button type="submit" className="submit-btn">
              {t('postcode.button')}
            </button>

            <p className="privacy-note">{t('common.secure')}</p>
          </form>
        </div>
      </main>
    </div>
  )
}

export default PostcodeInputPage
