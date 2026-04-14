import React, { useState, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { recognizeFoodFromImage, submitListing, uploadImage, expireListing } from '../services/api'
import LanguageSwitcher from './LanguageSwitcher'
import '../styles/DonationForm.css'

const CATEGORIES = ['bakedGoods', 'produce', 'dairy', 'pantry', 'preparedMeals', 'other']
const SIZE_CUES = ['small', 'medium', 'large', 'heavy', 'extraHeavy']

const normalizeCategoryValue = (value = '') => {
  const lower = String(value).toLowerCase()
  if (['bakedgoods', 'baked goods', 'bakery & grains', 'bakery'].includes(lower)) return 'bakedGoods'
  if (['produce', 'fresh produce'].includes(lower)) return 'produce'
  if (['dairy', 'dairy & eggs'].includes(lower)) return 'dairy'
  if (['pantry', 'canned goods'].includes(lower)) return 'pantry'
  if (['preparedmeals', 'prepared meals', 'prepared'].includes(lower)) return 'preparedMeals'
  if (lower === 'other') return 'other'
  return 'bakedGoods'
}

const DonationForm = () => {
  const { postcode } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const fileInputRef = useRef(null)
  const selectedFileRef = useRef(null)  // holds the actual File for upload on submit

  // Get org mode from location state
  const orgMode = location.state?.orgMode || false
  const initialOrgCode = location.state?.orgCode || ''
  const orgName = location.state?.orgName || ''
  const initialPostcode = location.state?.postcode || postcode || ''
  const draftListing = location.state?.draftListing || null
  const replaceListingId = location.state?.replaceListingId || null

  const [formData, setFormData] = useState({
    foodType: draftListing?.foodType || '',
    quantity: draftListing?.quantity != null ? String(draftListing.quantity) : '',
    category: normalizeCategoryValue(draftListing?.category || 'bakedGoods'),
    sizeCue: draftListing?.sizeCue || '',
    postcode: initialPostcode,
    orgCode: initialOrgCode,
    photoUrl: draftListing?.photoUrl || null,
    dietary_tags: draftListing?.dietary_tags || [],
    name_suggestions: [],
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [aiProcessing, setAiProcessing] = useState(false)
  const [hasPhotoSelection, setHasPhotoSelection] = useState(Boolean(draftListing?.photoUrl))
  const [editingListingId, setEditingListingId] = useState(replaceListingId)
  const [lastSubmittedDraft, setLastSubmittedDraft] = useState(null)
  const donorGeneratedCode = `DONOR-${(formData.postcode || initialPostcode || 'GUEST').toUpperCase()}`

  const handleReturnToPrimary = () => {
    if (orgMode) {
      navigate('/org/dashboard', { state: { orgCode: initialOrgCode, postcode: initialPostcode } })
      return
    }
    if (postcode) {
      navigate(`/feed/${postcode}`)
      return
    }
    if (formData.postcode) {
      navigate(`/feed/${formData.postcode}`)
      return
    }
    navigate('/')
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    selectedFileRef.current = file  // keep a reference for upload on submit
    setHasPhotoSelection(true)
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
        sizeCue: prev.sizeCue,
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
      console.log('Form validation:', {
        foodType: formData.foodType,
        quantity: formData.quantity,
        postcode: formData.postcode,
        orgCode: orgMode ? formData.orgCode : donorGeneratedCode,
      })
      
      if (!formData.foodType) throw new Error(t('donation.errors.foodType'))
      if (!formData.quantity || Number(formData.quantity) <= 0) throw new Error(t('donation.errors.quantity'))
      if (!formData.postcode) throw new Error(t('donation.errors.postcode'))
      if (orgMode && !formData.orgCode) throw new Error(t('donation.errors.orgCode'))
      const draftPayload = {
        ...formData,
        postcode: formData.postcode,
        orgCode: orgMode ? formData.orgCode : donorGeneratedCode,
      }
      setLastSubmittedDraft(draftPayload)
      
      // Upload the image first if we have one, to get a permanent URL
      let permanentPhotoUrl = null
      if (selectedFileRef.current) {
        try {
          console.log('Starting image upload...')
          const uploadResult = await uploadImage(selectedFileRef.current)
          permanentPhotoUrl = uploadResult.url
          console.log('Image upload success:', permanentPhotoUrl)
        } catch (err) {
          // Image upload failed — post without photo rather than blocking submission
          console.warn('Image upload failed, submitting without photo:', err)
        }
      }

      const submissionPayload = {
        ...formData,
        orgCode: orgMode ? formData.orgCode : donorGeneratedCode,
        photoUrl: permanentPhotoUrl,
        description: formData.description || null,
      }
      console.log('Submitting listing with data:', submissionPayload)
      const createdListing = await submitListing(submissionPayload)
      console.log('Listing submitted successfully')

      if (editingListingId) {
        try {
          await expireListing(editingListingId)
        } catch (expireError) {
          console.warn('Previous listing could not be expired after replacement:', expireError)
        }
      }
      
      setSuccess(true)
      setFormData({
        foodType: '', quantity: '', category: 'bakedGoods',
        sizeCue: '',
        postcode: initialPostcode, orgCode: initialOrgCode, photoUrl: null,
        dietary_tags: [], name_suggestions: [],
      })
      setHasPhotoSelection(false)
      setEditingListingId(createdListing?.id || null)
    } catch (err) {
      console.error('Submit error:', err)
      setError(err.message || 'Failed to submit listing. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const showAiDetails = Boolean(
    hasPhotoSelection ||
    aiProcessing ||
    formData.photoUrl ||
    formData.foodType ||
    formData.quantity ||
    formData.dietary_tags.length
  )

  const handleEditSubmittedListing = () => {
    if (!lastSubmittedDraft) return
    setFormData(prev => ({
      ...prev,
      ...lastSubmittedDraft,
      quantity: lastSubmittedDraft.quantity != null ? String(lastSubmittedDraft.quantity) : '',
      photoUrl: lastSubmittedDraft.photoUrl || prev.photoUrl,
      dietary_tags: lastSubmittedDraft.dietary_tags || [],
      name_suggestions: prev.name_suggestions || [],
    }))
    setHasPhotoSelection(Boolean(lastSubmittedDraft.photoUrl || selectedFileRef.current))
    setSuccess(false)
    setError(null)
  }

  const handleDeleteListing = async () => {
    if (!editingListingId) return
    setLoading(true)
    setError(null)
    try {
      await expireListing(editingListingId)
      setSuccess(false)
      handleReturnToPrimary()
    } catch (err) {
      console.error('Delete listing error:', err)
      setError(t('donation.errors.deleteFailed'))
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
          <div className="success-actions">
            <button
              type="button"
              className="success-btn success-btn-primary"
              onClick={() => navigate('/')}
            >
              {t('common.home')}
            </button>
            <button
              type="button"
              className="success-btn success-btn-secondary"
              onClick={handleReturnToPrimary}
            >
              {orgMode ? t('donation.success.backToDashboard') : t('donation.success.backToListings')}
            </button>
            <button
              type="button"
              className="success-btn success-btn-secondary"
              onClick={handleEditSubmittedListing}
            >
              {t('donation.success.editListing')}
            </button>
            {editingListingId && (
              <button
                type="button"
                className="success-btn success-btn-danger"
                onClick={handleDeleteListing}
              >
                {t('donation.success.deleteListing')}
              </button>
            )}
          </div>
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
          <div className="form-header-meta">
            <LanguageSwitcher />
            <div className="form-header-badge">
              <span className="material-symbols-outlined">bolt</span>
              {orgMode ? t('donation.orgTitle') : t('donation.aiTitle')}
            </div>
          </div>
        </div>
        <div className="form-header-divider" />
      </header>

      {/* Main form */}
      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.type !== 'submit') {
            e.preventDefault()
          }
        }}
      >
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
            <>
              <button
                type="button"
                className="upload-area"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="upload-icon-circle">
                  <span className="material-symbols-outlined">photo_camera</span>
                </div>
                <div className="upload-title">{t('donation.takePhoto')}</div>
                <div className="upload-subtitle">{t('donation.uploadSubtitle')}</div>
              </button>
              <input
                ref={fileInputRef}
                className="upload-input-hidden"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                tabIndex={-1}
              />
            </>
          )}

          <div className="guidance-card">
            <strong>{t('donation.guidanceTitle')}</strong>
            <ul className="guidance-list">
              <li>{t('donation.guidancePoints.fullItem')}</li>
              <li>{t('donation.guidancePoints.centered')}</li>
              <li>{t('donation.guidancePoints.lighting')}</li>
              <li>{t('donation.guidancePoints.quantityCue')}</li>
            </ul>
            <p className="guidance-note">{t('donation.reviewNotice')}</p>
          </div>

          {/* AI processing */}
          {aiProcessing && (
            <div className="ai-processing">
              <span className="material-symbols-outlined spinner-icon">settings</span>
              {t('donation.analyzing')}
            </div>
          )}

          {/* AI Result Card */}
          {showAiDetails && (
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

                <div className="ai-field">
                  <label className="field-label" htmlFor="sizeCue">{t('donation.sizeCue')}</label>
                  <div className="form-select-wrapper">
                    <select
                      id="sizeCue"
                      className="form-select"
                      value={formData.sizeCue}
                      onChange={e => setFormData(prev => ({ ...prev, sizeCue: e.target.value }))}
                    >
                      <option value="">{t('donation.sizeCuePlaceholder')}</option>
                      {SIZE_CUES.map(option => (
                        <option key={option} value={option}>
                          {t(`donation.sizeCueOptions.${option}`)}
                        </option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined select-arrow">expand_more</span>
                  </div>
                  <span className="field-hint ai-field-hint">{t('donation.quantityHint')}</span>
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
                      {CATEGORIES.map(c => (
                        <option key={c} value={c}>
                          {t(`donation.categoryOptions.${c}`)}
                        </option>
                      ))}
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

              <p className="ai-review-note">{t('donation.reviewNotice')}</p>
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

            {orgMode && (
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
            )}
          </div>
        </main>

        {/* Fixed bottom action */}
        <footer className="form-footer">
          <div className="form-footer-inner">
            {editingListingId && (
              <button
                type="button"
                className="btn-delete-listing"
                onClick={handleDeleteListing}
                disabled={loading}
              >
                {t('donation.success.deleteListing')}
              </button>
            )}
            <button
              type="submit"
              className="btn-submit"
              disabled={loading || !formData.foodType || !formData.postcode || (orgMode && !formData.orgCode)}
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
