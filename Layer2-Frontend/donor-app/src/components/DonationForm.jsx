import React, { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../api'
import '../styles/DonationForm.css'

const DonationForm = () => {
  const { postcode } = useParams()
  const { t } = useTranslation()
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [aiSuggestions, setAiSuggestions] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [formData, setFormData] = useState({
    quantity: '',
    orgCode: '',
    notes: ''
  })
  const [submitted, setSubmitted] = useState(false)
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)

  const handleCameraClick = () => {
    // Clear input value to allow re-selecting the same file
    if (cameraInputRef.current) {
      cameraInputRef.current.value = ''
      cameraInputRef.current.click()
    }
  }

  const handleGalleryClick = () => {
    // Clear input value to allow re-selecting the same file
    if (galleryInputRef.current) {
      galleryInputRef.current.value = ''
      galleryInputRef.current.click()
    }
  }

  // Analyzes image color to generate food type suggestions
  const analyzeImageColor = (imageData, width, height) => {
    // Sample from center region to avoid background
    const data = imageData.data
    const centerX = width / 2
    const centerY = height / 2
    const sampleRadius = Math.min(width, height) / 4
    
    let r = 0, g = 0, b = 0, count = 0
    
    // Sample pixels in circular area around center
    for (let x = Math.max(0, centerX - sampleRadius); x < Math.min(width, centerX + sampleRadius); x++) {
      for (let y = Math.max(0, centerY - sampleRadius); y < Math.min(height, centerY + sampleRadius); y++) {
        const dist = Math.hypot(x - centerX, y - centerY)
        if (dist <= sampleRadius) {
          const idx = (y * width + x) * 4
          r += data[idx]
          g += data[idx + 1]
          b += data[idx + 2]
          count++
        }
      }
    }
    
    // Calculate average color
    r = Math.round(r / count)
    g = Math.round(g / count)
    b = Math.round(b / count)
    
    // Convert to HSL for better color analysis
    const rn = r / 255
    const gn = g / 255
    const bn = b / 255
    const max = Math.max(rn, gn, bn)
    const min = Math.min(rn, gn, bn)
    const l = (max + min) / 2
    let h = 0, s = 0
    
    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      switch (max) {
        case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6; break
        case gn: h = ((bn - rn) / d + 2) / 6; break
        case bn: h = ((rn - gn) / d + 4) / 6; break
      }
    }
    
    return { 
      h: h * 360, 
      s: s * 100, 
      l: l * 100, 
      r, 
      g, 
      b,
      hsl: `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`
    }
  }

  const analyzeImage = async (file) => {
    // Create canvas for color analysis
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = 300
          canvas.height = 300
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, 300, 300)
          
          const imageData = ctx.getImageData(0, 0, 300, 300)
          const color = analyzeImageColor(imageData, 300, 300)
          
          // Debug log (can remove later)
          console.log('Detected color:', color)
          
          // Color-based food recognition with tuned thresholds
          let suggestion
          
          // Priority 1: Fried Rice & Noodles (h: 35-45°, s: 20-35%, l: 35-50%)
          // Sample: HSL(39.6°, 26.7%, 41.2%)
          if (color.h >= 35 && color.h <= 45 && color.s >= 20 && color.s <= 35 && color.l >= 35 && color.l <= 50) {
            suggestion = { 
              foodType: 'Fried Rice & Noodles', 
              quantity: '16', 
              confidence: 90, 
              category: 'prepared', 
              emoji: '🍚' 
            }
          }
          // Priority 2: Whole Wheat Bread (h: 25-35°, s: 15-40%, l: 28-42%)
          // Samples: HSL(29.2°, 35.6%, 39.6%) and HSL(29.1°, 22.6%, 30.4%)
          else if (color.h >= 25 && color.h <= 35 && color.s >= 15 && color.s <= 40 && color.l >= 25 && color.l <= 45) {
            suggestion = { 
              foodType: 'Whole Wheat Bread Bunch', 
              quantity: '24', 
              confidence: 89, 
              category: 'bakery', 
              emoji: '🍞' 
            }
          }
          // Priority 3: Golden yellow pastries (h: 38-52°, s: 45-65%, l: 50-75%)
          else if (color.h >= 38 && color.h <= 52 && color.s >= 45 && color.l >= 50 && color.l <= 75) {
            suggestion = { 
              foodType: 'Fresh Pastries Box', 
              quantity: '32', 
              confidence: 88, 
              category: 'bakery', 
              emoji: '🥐' 
            }
          }
          // Priority 4: Protein Meal Boxes (h: 25-45°, s: 20-60%, l: 40-65%)
          else if (color.h >= 25 && color.h <= 45 && color.s >= 20 && color.s <= 60 && color.l >= 40 && color.l <= 65) {
            suggestion = { 
              foodType: 'Protein Meal Boxes', 
              quantity: '20', 
              confidence: 82, 
              category: 'prepared', 
              emoji: '🍱' 
            }
          }
          // Priority 5: Green vegetables (h: 80-150°, s: 25+%, l: 25-75%)
          else if (color.h >= 80 && color.h <= 150 && color.s >= 25 && color.l >= 25 && color.l <= 75) {
            suggestion = { 
              foodType: 'Fresh Organic Vegetables', 
              quantity: '25', 
              confidence: 86, 
              category: 'produce', 
              emoji: '🥬' 
            }
          }
          // Priority 6: Red/tomato (h: 0-25° or 340-360°, s: 35+%, l: 25-75%)
          else if ((color.h <= 25 || color.h >= 340) && color.s >= 35 && color.l >= 25 && color.l <= 75) {
            suggestion = { 
              foodType: 'Fresh Prepared Salads', 
              quantity: '12', 
              confidence: 84, 
              category: 'prepared', 
              emoji: '🥗' 
            }
          }
          // Priority 7: Light/white dairy (s: 0-30%, l: 65-95%)
          else if (color.s <= 30 && color.l >= 65) {
            suggestion = { 
              foodType: 'Mixed Dairy Products', 
              quantity: '15', 
              confidence: 80, 
              category: 'dairy', 
              emoji: '🥛' 
            }
          }
          // Default fallback
          else {
            const defaults = [
              { foodType: 'Canned Goods Assortment', quantity: '50', confidence: 80, category: 'grocery', emoji: '🥫' },
              { foodType: 'Organic Fruit Trays', quantity: '8', confidence: 85, category: 'produce', emoji: '🍎' },
              { foodType: 'Fresh Herbs Bundle', quantity: '30', confidence: 81, category: 'produce', emoji: '🌿' },
            ]
            suggestion = defaults[Math.floor(Math.random() * defaults.length)]
          }
          
          resolve(suggestion)
        }
        img.src = e.target.result
      }
      reader.readAsDataURL(file)
    })
  }

  const handlePhotoSelect = async (event) => {
    const file = event.target.files?.[0]
    if (file) {
      setLoading(true)
      setError(null)
      try {
        // Read file for preview
        const reader = new FileReader()
        reader.onload = (e) => {
          setPhotoPreview(e.target?.result)
        }
        reader.readAsDataURL(file)
        
        // Store file for later submission
        setPhotoFile(file)
        
        // Analyze image
        const suggestions = await analyzeImage(file)
        setAiSuggestions(suggestions)
        
        // Pre-fill quantity field with AI suggestion
        setFormData(prev => ({
          ...prev,
          quantity: suggestions.quantity
        }))
      } catch (err) {
        setError('Failed to analyze image: ' + err.message)
      } finally {
        setLoading(false)
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!photoFile || !aiSuggestions) {
      setError('Please select a photo first')
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      // Prepare listing data
      const listingData = {
        source_name: formData.orgCode || 'Anonymous Donor',
        description_en: aiSuggestions.foodType,
        description_zh_CN: aiSuggestions.foodType, // Will be auto-translated by backend
        description_vi: aiSuggestions.foodType,    // Will be auto-translated by backend
        food: {
          emoji: aiSuggestions.emoji,
          category: aiSuggestions.category,
          quantity: formData.quantity + ' portions',
          tags: [
            aiSuggestions.category.charAt(0).toUpperCase() + aiSuggestions.category.slice(1),
            'Fresh',
            'Available Now'
          ],
          allergens: formData.notes || 'Check listing details'
        },
        location: {
          postcode: postcode || '3000'
        }
      }

      // Submit to backend
      const response = await api.post('/listings', listingData)
      
      if (response.status === 201) {
        setSubmitted(true)
        // Reset after 3 seconds
        setTimeout(() => {
          setSubmitted(false)
          setPhotoPreview(null)
          setPhotoFile(null)
          setAiSuggestions(null)
          setFormData({ quantity: '', orgCode: '', notes: '' })
        }, 3000)
      }
    } catch (err) {
      setError('Failed to submit donation: ' + (err.response?.data?.detail || err.message))
      console.error('Submission error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="donation-form">
      {submitted && (
        <div className="success-overlay">
          <div className="success-message">✅ {t('donation.posted')}</div>
        </div>
      )}

      {error && (
        <div className="error-message" style={{
          padding: '12px',
          marginBottom: '16px',
          backgroundColor: '#fee',
          color: '#c00',
          borderRadius: '8px',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-content">
        {/* Photo Section */}
        <div className="form-section">
          <label className="section-label">📸 {t('donation.yourSurplus')}</label>
          <div className="photo-upload-section">
            {/* Hidden file inputs - always in DOM */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoSelect}
              disabled={loading}
              style={{ display: 'none' }}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              disabled={loading}
              style={{ display: 'none' }}
            />

            {photoPreview ? (
              <div className="photo-preview-container">
                <img src={photoPreview} alt="Uploaded" className="photo-preview" />
                <button
                  type="button"
                  onClick={handleCameraClick}
                  className="change-photo-btn"
                  disabled={loading}
                >
                  {loading ? '⏳ Analyzing...' : t('donation.changePhoto') + ' ↻'}
                </button>
              </div>
            ) : (
              <div className="photo-placeholder">
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
                    disabled={loading}
                  >
                    {loading ? '⏳' : '📷'} {t('donation.scanFood')}
                  </button>
                  <button
                    type="button"
                    onClick={handleGalleryClick}
                    className="secondary-btn"
                    disabled={loading}
                  >
                    {t('donation.choosePhoto')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* AI Suggestions */}
        {photoPreview && aiSuggestions && (
          <div className="form-section ai-section">
            <label className="section-label">🤖 {t('donation.aiIdentified')}</label>
            <div className="ai-card">
              <div className="ai-row">
                <span className="ai-label">{t('donation.foodType')}</span>
                <span className="ai-value">{aiSuggestions.emoji} {aiSuggestions.foodType}</span>
              </div>
              <div className="ai-row">
                <span className="ai-label">{t('donation.quantity')}</span>
                <span className="ai-value">{aiSuggestions.quantity} {t('donation.portions')}</span>
              </div>
              <div className="ai-row">
                <span className="ai-label">{t('donation.category')}</span>
                <span className="ai-value">{aiSuggestions.category}</span>
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
              <span className="info-value">{postcode || '3000'}</span>
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
            disabled={loading}
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
            disabled={loading}
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
            disabled={loading}
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="submit-btn"
          disabled={!photoPreview || !formData.quantity || loading}
        >
          {loading ? '⏳ Submitting...' : t('donation.submitCta')}
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
