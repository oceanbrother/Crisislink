import React, { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import '../styles/DonationForm.css'

const DonationForm = () => {
  const { postcode } = useParams()
  const { t } = useTranslation()
  const [photoPreview, setPhotoPreview] = useState(null)
  const [aiSuggestions, setAiSuggestions] = useState({
    foodType: 'Artisan Sourdough Loaves',
    quantity: '18',
    confidence: 85
  })
  const [formData, setFormData] = useState({
    quantity: '',
    orgCode: '',
    notes: ''
  })
  const [submitted, setSubmitted] = useState(false)
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)

  const handleCameraClick = () => {
    cameraInputRef.current?.click()
  }

  const handleGalleryClick = () => {
    galleryInputRef.current?.click()
  }

  const handlePhotoSelect = (event) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result)
        // Simulate AI analysis
        setAiSuggestions({
          foodType: 'Artisan Sourdough Loaves',
          quantity: '18',
          confidence: 85
        })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    // Simulate submission
    setSubmitted(true)
    console.log('Form submitted:', {
      photo: photoPreview,
      postcode,
      ...formData
    })
    
    // Reset after 2 seconds
    setTimeout(() => {
      setSubmitted(false)
      setPhotoPreview(null)
      setFormData({ quantity: '', orgCode: '', notes: '' })
    }, 2000)
  }

  return (
    <div className="donation-form">
      {submitted && (
        <div className="success-overlay">
          <div className="success-message">✅ {t('donation.posted')}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-content">
        {/* Photo Section */}
        <div className="form-section">
          <label className="section-label">📸 {t('donation.yourSurplus')}</label>
          <div className="photo-upload-section">
            {photoPreview ? (
              <div className="photo-preview-container">
                <img src={photoPreview} alt="Uploaded" className="photo-preview" />
                <button
                  type="button"
                  onClick={handleCameraClick}
                  className="change-photo-btn"
                >
                  {t('donation.changePhoto')} ↻
                </button>
              </div>
            ) : (
              <div className="photo-placeholder">
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoSelect}
                  style={{ display: 'none' }}
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  style={{ display: 'none' }}
                />
                
                <div className="camera-icon-circle">
                  📷
                </div>

                <p className="upload-title">{t('donation.snapTitle')}</p>
                <p className="upload-subtitle">{t('donation.snapSubtitle')}</p>

                <div className="button-group">
                  <button
                    type="button"
                    onClick={handleCameraClick}
                    className="primary-btn"
                  >
                    📷 {t('donation.scanFood')}
                  </button>
                  <button
                    type="button"
                    onClick={handleGalleryClick}
                    className="secondary-btn"
                  >
                    {t('donation.choosePhoto')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* AI Suggestions */}
        {photoPreview && (
          <div className="form-section ai-section">
            <label className="section-label">🤖 {t('donation.aiIdentified')}</label>
            <div className="ai-card">
              <div className="ai-row">
                <span className="ai-label">{t('donation.foodType')}</span>
                <span className="ai-value">{aiSuggestions.foodType}</span>
              </div>
              <div className="ai-row">
                <span className="ai-label">{t('donation.quantity')}</span>
                <span className="ai-value">{aiSuggestions.quantity} {t('donation.portions')}</span>
              </div>
              <div className="ai-confidence">
                {t('donation.confidence')} <strong>{aiSuggestions.confidence}%</strong>
              </div>
            </div>
          </div>
        )}

        {/* Location Section */}
        <div className="form-section">
          <label className="section-label">📍 {t('donation.location')}</label>
          <div className="location-info-display">
            <div className="info-row">
              <span className="info-label">{t('donation.postcode')}</span>
              <span className="info-value">{postcode || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Quantity Section */}
        <div className="form-section">
          <label htmlFor="quantity" className="section-label">
            📦 {t('donation.howMuch')}
          </label>
          <input
            id="quantity"
            type="text"
            placeholder={t('donation.quantityPlaceholder')}
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
            className="form-input"
            required
          />
        </div>

        {/* Organization Code Section */}
        <div className="form-section">
          <label htmlFor="orgCode" className="section-label">
            🏢 {t('donation.orgCodeOptional')}
          </label>
          <input
            id="orgCode"
            type="text"
            placeholder={t('donation.orgCodePlaceholder')}
            value={formData.orgCode}
            onChange={(e) => setFormData({ ...formData, orgCode: e.target.value })}
            className="form-input"
          />
        </div>

        {/* Notes Section */}
        <div className="form-section">
          <label htmlFor="notes" className="section-label">
            💬 {t('donation.notesOptional')}
          </label>
          <textarea
            id="notes"
            placeholder={t('donation.notesPlaceholder')}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="form-textarea"
            rows="3"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="submit-btn"
          disabled={!photoPreview || !formData.quantity}
        >
          {t('donation.submitCta')}
        </button>

        {/* Footer Message */}
        <p className="form-footer">
          ✅ {t('donation.footerInfo')}
        </p>
      </form>
    </div>
  )
}

export default DonationForm
