import { useState, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { recognizeFoodFromImage, submitListing, uploadImage } from '../services/api'
import { getStoredDonorCode } from '../utils/codeGeneration'
import '../styles/DonationForm.css'

const CATEGORIES = ['Bakery & Grains', 'Fresh Produce', 'Dairy & Eggs', 'Canned Goods', 'Prepared Meals', 'Other']

const DonationForm = () => {
  const { postcode } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const fileInputRef = useRef(null)
  const selectedFileRef = useRef(null)  // holds the actual File for upload on submit

  // Get org mode from location state
  const orgMode = location.state?.orgMode || false
  // Prefer org code from router state (org dashboard flow); fall back to the
  // donor code stored during registration so donors never need to type it.
  const initialOrgCode = location.state?.orgCode || getStoredDonorCode() || ''
  const orgName = location.state?.orgName || ''
  const initialPostcode = location.state?.postcode || postcode || ''

  const [formData, setFormData] = useState({
    foodType: '',
    quantity: '',
    category: 'Bakery & Grains',
    postcode: initialPostcode,
    orgCode: initialOrgCode,
    photoUrl: null,
    dietary_tags: [],
    name_suggestions: [],
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [aiProcessing, setAiProcessing] = useState(false)

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    selectedFileRef.current = file  // keep a reference for upload on submit
    setAiProcessing(true)
    setError(null)

    try {
      const fd = new FormData()
      fd.append('image', file)
      const result = await recognizeFoodFromImage(fd)
      setFormData(prev => ({
        ...prev,
        foodType: result.name || 'Unknown Food',
        quantity: result.quantity != null ? String(result.quantity) : '',
        dietary_tags: result.dietary_tags || [],
        name_suggestions: result.name_suggestions || [],
        photoUrl: URL.createObjectURL(file)
      }))
    } catch (err) {
      console.error('AI recognition error:', err)
      setError(t('donation.errors.aiTimeout'))
      setFormData(prev => ({
        ...prev,
        photoUrl: URL.createObjectURL(file),
        foodType: prev.foodType || ''
      }))
    } finally {
      setAiProcessing(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (!formData.foodType) throw new Error(t('donation.errors.foodType'))
      if (!formData.quantity || Number(formData.quantity) <= 0) throw new Error(t('donation.errors.quantity'))
      if (!formData.postcode) throw new Error(t('donation.errors.postcode'))
      if (!formData.orgCode) throw new Error(t('donation.errors.orgCode'))

      // Upload the image first if we have one, to get a permanent URL
      let permanentPhotoUrl = null
      if (selectedFileRef.current) {
        try {
          const uploadResult = await uploadImage(selectedFileRef.current)
          permanentPhotoUrl = uploadResult.url
        } catch (err) {
          // Image upload failed — post without photo rather than blocking submission
          console.error('Image upload failed, submitting without photo:', err)
        }
      }

      await submitListing({ ...formData, photoUrl: permanentPhotoUrl })
      
      setSuccess(true)
      setFormData({
        foodType: '', quantity: '', category: 'Bakery & Grains',
        postcode: initialPostcode, orgCode: initialOrgCode, photoUrl: null,
        dietary_tags: [], name_suggestions: [],
      })
      
      // Navigate back after 2 seconds
      setTimeout(() => {
        if (orgMode) {
          // Return to org dashboard
          navigate('/org/dashboard', { state: { orgCode: initialOrgCode } })
        } else if (postcode) {
          navigate(`/feed/${postcode}`)
        } else if (formData.postcode) {
          navigate(`/feed/${formData.postcode}`)
        } else {
          setSuccess(false)
        }
      }, 2000)
    } catch (err) {
      console.error('Submit error:', err)
      setError(err.message || 'Failed to submit listing. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="success-container">
        <div className="success-card">
          <div className="success-icon">
            <span className="material-symbols-outlined">check_circle</span>
          </div>
          <h2>{t('donation.success.title')}</h2>
          {orgMode ? (
            <>
              <p>{t('donation.success.orgMessage')}</p>
              <p className="success-tag">{t('donation.success.orgTag')}</p>
            </>
          ) : (
            <>
              <p>{t('donation.success.donorMessage')}</p>
              <p className="success-tag">{t('donation.success.donorTag')}</p>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="donation-form-container">
      {/* Fixed Header */}
      <header className="form-header">
        <div className="form-header-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="btn-back" onClick={() => {
              if (orgMode) {
                navigate('/org/dashboard', { state: { orgCode: initialOrgCode } })
              } else if (postcode) {
                navigate(`/feed/${postcode}`)
              } else {
                window.history.back()
              }
            }}>
              <span className="material-symbols-outlined">close</span>
            </button>
            <span className="form-brand">{t('appName')}</span>
          </div>
          <div className="form-header-badge">
            <span className="material-symbols-outlined">bolt</span>
            {orgMode ? t('donation.orgTitle') : t('donation.aiTitle')}
          </div>
        </div>
        <div className="form-header-divider" />
      </header>

      {/* Main form */}
      <form onSubmit={handleSubmit}>
        <main className="form-content">
          {/* Hero */}
          <header className="form-hero">
            {orgMode ? (
              <>
                <h1>{t('donation.title')}</h1>
                <p>{orgName ? t('dashboard.sharing', { orgName: orgName }) : t('donation.subtitle')}</p>
              </>
            ) : (
              <>
                <h1>{t('donation.title')}</h1>
                <p>{t('donation.subtitle')}</p>
              </>
            )}
          </header>

          {/* Upload / Preview */}
          {formData.photoUrl ? (
            <div className="photo-preview">
              <img src={formData.photoUrl} alt="Food" />
              <button
                type="button"
                className="btn-change-photo"
                onClick={() => { setFormData(prev => ({ ...prev, photoUrl: null })); fileInputRef.current.value = '' }}
              >
                <span className="material-symbols-outlined">photo_camera</span>
                {t('donation.changePhoto')}
              </button>
            </div>
          ) : (
            <label className="upload-area">
              <div className="upload-icon-circle">
                <span className="material-symbols-outlined">photo_camera</span>
              </div>
              <div className="upload-title">{t('donation.takePhoto')}</div>
              <div className="upload-subtitle">{t('donation.uploadSubtitle')}</div>
              <input
                ref={fileInputRef}
                className="upload-input"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
              />
            </label>
          )}

          {/* AI processing */}
          {aiProcessing && (
            <div className="ai-processing">
              <span className="material-symbols-outlined spinner-icon">settings</span>
              {t('donation.analyzing')}
            </div>
          )}

          {/* AI Result Card */}
          {formData.foodType && (
            <div className="ai-result-card">
              <div className="ai-result-bg-icon">
                <span className="material-symbols-outlined">auto_awesome</span>
              </div>
              <div className="ai-result-label">
                <div className="ai-label-icon">
                  <span className="material-symbols-outlined">auto_awesome</span>
                </div>
                <span className="ai-label-text">{t('donation.aiDetails')}</span>
              </div>

              <div className="ai-fields-grid">
                {/* Food name */}
                <div className="ai-field full">
                  <label className="field-label" htmlFor="foodType">{t('donation.foodName')}</label>
                  <input
                    id="foodType"
                    className="form-input"
                    type="text"
                    placeholder={t('donation.foodName')}
                    value={formData.foodType}
                    onChange={e => setFormData(prev => ({ ...prev, foodType: e.target.value }))}
                  />
                </div>

                {/* Quantity */}
                <div className="ai-field">
                  <label className="field-label" htmlFor="quantity">{t('donation.quantity')}</label>
                  <input
                    id="quantity"
                    className="form-input"
                    type="number"
                    placeholder="0"
                    value={formData.quantity}
                    onChange={e => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                  />
                </div>

                {/* Category */}
                <div className="ai-field">
                  <label className="field-label" htmlFor="category">{t('donation.category')}</label>
                  <div className="form-select-wrapper">
                    <select
                      id="category"
                      className="form-select"
                      value={formData.category}
                      onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    >
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <span className="material-symbols-outlined select-arrow">expand_more</span>
                  </div>
                </div>
              </div>

              {/* Dietary tags */}
              {formData.dietary_tags.length > 0 && (
                <div className="tags-row">
                  {formData.dietary_tags.map(tag => (
                    <span key={tag} className={`tag-chip tag-${tag.replace(/\s+/g, '-')}`}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && <div className="error-message">{error}</div>}

          {/* Manual fields */}
          <div className="manual-fields">
            {!orgMode && (
              <div>
                <label className="field-label muted" htmlFor="postcodeField">{t('donation.postcode')}</label>
                <input
                  id="postcodeField"
                  className="form-input muted-bg"
                  style={{ maxWidth: '12rem' }}
                  type="text"
                  placeholder={t('postcode.example')}
                  value={formData.postcode}
                  onChange={e => setFormData(prev => ({ ...prev, postcode: e.target.value }))}
                />
                <span className="field-hint">Only shared with verified recipients once accepted.</span>
              </div>
            )}

            <div>
              <label className="field-label muted" htmlFor="orgCode">
                {orgMode ? t('donation.orgCode') : t('donation.orgCode')}
              </label>
              <input
                id="orgCode"
                className="form-input muted-bg"
                style={{ maxWidth: '12rem' }}
                type="text"
                placeholder={orgMode ? 'Your org code' : 'e.g. FB001'}
                maxLength="20"
                value={formData.orgCode}
                onChange={e => setFormData(prev => ({ ...prev, orgCode: e.target.value.toUpperCase() }))}
                readOnly={orgMode}
              />
              <span className="field-hint">
                {orgMode ? 'Your organization code for this surplus posting.' : 'Ask the food bank staff for their code.'}
              </span>
            </div>
          </div>
        </main>

        {/* Fixed bottom action */}
        <footer className="form-footer">
          <div className="form-footer-inner">
            <button
              type="submit"
              className="btn-submit"
              disabled={loading || !formData.foodType || !formData.postcode || !formData.orgCode}
            >
              {loading ? (orgMode ? 'Publishing...' : 'Posting...') : t('donation.postButton')}
              {!loading && <span className="material-symbols-outlined">arrow_forward</span>}
            </button>
            <p className="form-security-note">{t('common.secure')}</p>
          </div>
        </footer>
      </form>
    </div>
  )
}

export default DonationForm
