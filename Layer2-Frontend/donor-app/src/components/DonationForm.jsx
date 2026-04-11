import React, { useState, useRef } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { recognizeFoodFromImage, submitListing } from '../services/api'
import '../styles/DonationForm.css'

const DonationForm = () => {
  const { postcode: routePostcode } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const cameraRef = useRef(null)
  const galleryRef = useRef(null)

  const effectivePostcode = routePostcode || location.state?.postcode || ''
  const defaultOrgCode = location.state?.orgCode || ''
  const orgMode = Boolean(location.state?.orgMode)
  const orgName = location.state?.orgName || 'Organisation'
  const userName = location.state?.userName || 'Sarah'

  const [formData, setFormData] = useState({
    foodType: '',
    quantity: '',
    unit: 'portions',
    description: '',
    postcode: effectivePostcode,
    orgCode: defaultOrgCode,
    photoUrl: null,
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [aiProcessing, setAiProcessing] = useState(false)
  const [lastSubmission, setLastSubmission] = useState(null)

  const updateField = (name, value) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleCameraCapture = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setAiProcessing(true)
    setError(null)

    try {
      const formDataWithFile = new FormData()
      formDataWithFile.append('image', file)

      const result = await recognizeFoodFromImage(formDataWithFile)

      setFormData((prev) => ({
        ...prev,
        foodType: result.foodType || 'Unknown Food',
        quantity: result.quantity || '1',
        description: result.description || prev.description,
        photoUrl: URL.createObjectURL(file),
      }))
    } catch (err) {
      setFormData((prev) => ({
        ...prev,
        photoUrl: URL.createObjectURL(file),
        foodType: prev.foodType || 'Mixed Food Items',
        quantity: prev.quantity || '1',
      }))
      setError('AI suggestion is only a placeholder right now. Please review the details before posting.')
    } finally {
      setAiProcessing(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    updateField(name, value)
  }

  const openDashboard = () => {
    const dashboardOrgCode = lastSubmission?.orgCode || defaultOrgCode || formData.orgCode || 'FB001'
    navigate('/org/dashboard', {
      state: {
        orgCode: dashboardOrgCode,
        orgName: orgMode ? orgName : 'Connected Food Bank',
        userName,
        postcode: effectivePostcode,
      },
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (!formData.foodType || !formData.quantity || !formData.postcode || !formData.orgCode) {
        throw new Error('Please fill in all required fields')
      }

      await submitListing({
        foodType: formData.foodType,
        quantity: Number(formData.quantity),
        unit: formData.unit,
        postcode: formData.postcode,
        orgCode: formData.orgCode,
        description: formData.description,
        photoUrl: formData.photoUrl,
      })

      setLastSubmission({
        orgCode: formData.orgCode,
        postcode: formData.postcode,
      })
      setSuccess(true)
      setFormData({
        foodType: '',
        quantity: '',
        unit: 'portions',
        description: '',
        postcode: effectivePostcode,
        orgCode: defaultOrgCode,
        photoUrl: null,
      })
    } catch (err) {
      setError(err.message || 'Failed to submit listing. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="success-container">
        <div className="success-card">
          <div className="success-icon">✓</div>
          <h2>Listed!</h2>
          <p>
            {orgMode
              ? 'Your organisation surplus is now visible to other community food banks.'
              : 'Your food is now visible to local food banks.'}
          </p>
          <p className="success-subtext">Thank you for sharing.</p>
          <p className="success-hint">You can now check whether your listing appears on the coordinator board.</p>

          <div className="success-actions">
            <button className="success-primary-btn" onClick={openDashboard}>
              View Coordinator Dashboard
            </button>
            <button className="success-secondary-btn" onClick={() => navigate('/')}>
              Back to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="donation-form-container">
      <div className="form-header">
        <button className="btn-back" onClick={() => window.history.back()}>
          ←
        </button>
        <h1>{orgMode ? 'Post excess food' : 'Post surplus'}</h1>
        <div></div>
      </div>

      <form onSubmit={handleSubmit} className="form-content">
        <div className="scan-title-section">
          <h2>{orgMode ? 'Share excess food with the network' : 'Scan your food'}</h2>
          <p>
            {orgMode
              ? 'You can upload a photo or type the details manually before posting.'
              : 'AI suggestions can be edited before posting.'}
          </p>
        </div>

        <div className="photo-section">
          {formData.photoUrl ? (
            <div className="photo-preview">
              <img src={formData.photoUrl} alt="Food" />
              <button
                type="button"
                className="btn-change-photo"
                onClick={() => updateField('photoUrl', null)}
              >
                📷 Change photo
              </button>
            </div>
          ) : (
            <>
              <button type="button" className="btn-take-photo" onClick={() => cameraRef.current?.click()}>
                <div className="camera-icon">📷</div>
                <div className="camera-text">
                  <div className="camera-title">Take a photo</div>
                  <div className="camera-subtitle">Tap here - uses your camera</div>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleCameraCapture}
                  ref={cameraRef}
                  style={{ display: 'none' }}
                />
              </button>

              <button type="button" className="btn-upload-gallery" onClick={() => galleryRef.current?.click()}>
                ⬆️ Upload from gallery
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCameraCapture}
                  ref={galleryRef}
                  style={{ display: 'none' }}
                />
              </button>
            </>
          )}

          {aiProcessing && (
            <div className="ai-processing">
              <div className="spinner">⚙️</div>
              <span>Analyzing food...</span>
            </div>
          )}
        </div>

        {(formData.foodType || formData.quantity) && (
          <div className="info-display">
            <div className="info-item">
              <span className="info-label">Food</span>
              <span className="info-value">{formData.foodType || 'Add manually below'}</span>
            </div>
            <div className="info-divider"></div>
            <div className="info-item">
              <span className="info-label">Qty</span>
              <span className="info-value">{formData.quantity || '-'}</span>
            </div>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        <div className="manual-entry-section">
          <div className="section-label">Review or edit details</div>

          <div className="manual-grid">
            <div className="manual-field manual-field-wide">
              <label htmlFor="foodType">Food type</label>
              <input
                id="foodType"
                name="foodType"
                className="input-field"
                value={formData.foodType}
                onChange={handleInputChange}
                placeholder="e.g. Bread and pastries"
                required
              />
            </div>

            <div className="manual-field">
              <label htmlFor="quantity">Quantity</label>
              <input
                id="quantity"
                name="quantity"
                type="number"
                min="1"
                step="1"
                className="input-field"
                value={formData.quantity}
                onChange={handleInputChange}
                placeholder="5"
                required
              />
            </div>

            <div className="manual-field">
              <label htmlFor="unit">Unit</label>
              <select
                id="unit"
                name="unit"
                className="input-field"
                value={formData.unit}
                onChange={handleInputChange}
              >
                <option value="portions">portions</option>
                <option value="boxes">boxes</option>
                <option value="kg">kg</option>
                <option value="items">items</option>
              </select>
            </div>
          </div>

          <div className="manual-field">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              className="input-field input-textarea"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Pickup notes, dietary details, expiry timing, or anything the next organisation should know."
              rows="3"
            />
          </div>
        </div>

        <div className="location-section">
          <div className="location-info">
            <div className="postcode-display">
              <span className="location-icon">📍</span>
              <span className="postcode-value">{formData.postcode || 'No postcode selected'}</span>
            </div>
          </div>

          <div className="orgcode-input-group">
            <label htmlFor="orgCode">{orgMode ? 'Organisation code' : 'Food Bank Code'}</label>
            <input
              type="text"
              id="orgCode"
              name="orgCode"
              className="input-field input-orgcode"
              value={formData.orgCode}
              onChange={(e) => updateField('orgCode', e.target.value.toUpperCase())}
              placeholder={orgMode ? 'e.g., HCFB-2841' : 'e.g., FB001'}
              maxLength="20"
              required
            />
            <small>
              {orgMode
                ? 'Use your organisation code so other community groups can recognise the source.'
                : 'Ask the food bank staff for their code'}
            </small>
          </div>
        </div>

        <button
          type="submit"
          className="btn-submit"
          disabled={loading || !formData.foodType || !formData.quantity || !formData.postcode || !formData.orgCode}
        >
          {loading ? '📤 Posting...' : orgMode ? '✓ Share With Network' : '✓ Post Now'}
        </button>

        <p className="form-hint">
          {orgMode
            ? 'This creates a new available listing that other organisations can see and claim.'
            : 'No account needed. Your location is only shared with the receiving food bank.'}
        </p>
      </form>
    </div>
  )
}

export default DonationForm
