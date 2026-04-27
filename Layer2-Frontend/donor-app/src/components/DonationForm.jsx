import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  deleteListing,
  recognizeFoodFromImage,
  submitListing,
  updateListing,
  uploadImage,
} from '../services/api'
import {
  buildDietaryTags,
  CATEGORY_OPTIONS,
  DIETARY_OPTIONS,
  inferDietaryChoiceFromFoodName,
  getPrimaryDietaryChoice,
  normalizeCategory,
  resolveListingCategory,
  SIZE_CUE_OPTIONS,
} from '../constants/listings'
import DonorFeatureNav from './DonorFeatureNav'
import { forgetDonorListing, getOrCreateDonorCode, rememberDonorListing } from '../utils/donorIdentity'
import { resolveImageUrl } from '../utils/imageUrl'
import { getSavedDonorPostcode, saveDonorPostcode } from '../utils/donorPostcode'
import '../styles/DonationForm.css'

const DEFAULT_CATEGORY = 'Baked goods'
const MAX_CONFIDENT_AI_QUANTITY = 30

function getSuggestedQuantity(resultQuantity, fallbackQuantity) {
  const parsed = parseQuantityValue(resultQuantity)
  if (parsed === null || parsed <= 0) {
    return {
      value: fallbackQuantity || '1',
      warning: '',
    }
  }

  if (parsed > MAX_CONFIDENT_AI_QUANTITY) {
    return {
      value: fallbackQuantity || '1',
      warning: 'high',
    }
  }

  return {
    value: String(parsed),
    warning: '',
  }
}

function formatDateForDisplay(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    return raw
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split('-')
    return `${day}/${month}/${year}`
  }
  return raw
}

function parseQuantityValue(value) {
  const parsed = Number.parseFloat(String(value ?? '').replace(',', '.').trim())
  if (Number.isFinite(parsed) === false) return null
  return parsed
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Unable to read image file'))
    reader.readAsDataURL(file)
  })
}

function normalizeDateInput(value) {
  const raw = String(value || '').trim()
  if (!raw) return null

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split('/')
    return `${year}-${month}-${day}`
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  return null
}

function formatDateForPicker(value) {
  const normalized = normalizeDateInput(value)
  return normalized || ''
}

function formatDateForTextInput(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split('-')
    return `${day}/${month}/${year}`
  }

  return raw
}

function buildInitialState({ postcode, orgMode, initialOrgCode, listing }) {
  if (listing) {
    return {
      foodType: listing.foodType || '',
      quantity: listing.quantity ? String(listing.quantity) : '',
      category: resolveListingCategory(listing.category || DEFAULT_CATEGORY, listing.foodType || DEFAULT_CATEGORY),
      postcode: listing.postcode || postcode || '',
      orgCode: (listing.orgCode || initialOrgCode || '').toUpperCase(),
      photoUrl: listing.photoUrl || null,
      sizeCue: listing.sizeCue || '',
      expiryDate: formatDateForDisplay(listing.expiryDate),
      dietaryChoice:
        getPrimaryDietaryChoice(listing.dietary_tags || []) !== 'none'
          ? getPrimaryDietaryChoice(listing.dietary_tags || [])
          : inferDietaryChoiceFromFoodName(listing.foodType),
      description: listing.description || '',
      nameSuggestions: [],
    }
  }

  return {
    foodType: '',
    quantity: '1',
    category: DEFAULT_CATEGORY,
    postcode: postcode || '',
    orgCode: orgMode ? String(initialOrgCode || '').toUpperCase() : getOrCreateDonorCode(),
    photoUrl: null,
    sizeCue: '',
    expiryDate: '',
    dietaryChoice: 'none',
    description: '',
    nameSuggestions: [],
  }
}

const DonationForm = () => {
  const { postcode: routePostcode } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const fileInputRef = useRef(null)
  const dateInputRef = useRef(null)
  const selectedFileRef = useRef(null)

  const orgMode = location.state?.orgMode || false
  const initialOrgCode = location.state?.orgCode || ''
  const orgName = location.state?.orgName || ''
  const focusPostcode = String(location.state?.focusPostcode || '').trim()
  const editingListing = location.state?.listing || null
  const editMode = Boolean(location.state?.editMode && editingListing)
  const postcode = String(
    routePostcode ||
      location.state?.postcode ||
      focusPostcode ||
      editingListing?.postcode ||
      getSavedDonorPostcode() ||
      '',
  ).trim()

  const [formData, setFormData] = useState(() =>
    buildInitialState({ postcode, orgMode, initialOrgCode, listing: editingListing }),
  )
  const [loading, setLoading] = useState(false)
  const [aiProcessing, setAiProcessing] = useState(false)
  const [error, setError] = useState('')
  const [aiWarning, setAiWarning] = useState('')
  const [successListing, setSuccessListing] = useState(null)
  const [previewLoadFailed, setPreviewLoadFailed] = useState(false)

  const pageTitle = useMemo(() => {
    if (editMode) return t('donation.editTitle', 'Edit listing')
    return t('donation.title')
  }, [editMode, t])

  const donorOrgCode = orgMode ? String(initialOrgCode || '').toUpperCase() : getOrCreateDonorCode()

  useEffect(() => {
    setFormData(buildInitialState({ postcode, orgMode, initialOrgCode, listing: editingListing }))
    setError('')
    setAiWarning('')
    setSuccessListing(null)
    setPreviewLoadFailed(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    selectedFileRef.current = null
  }, [postcode, orgMode, initialOrgCode, editMode, editingListing?.id])

  useEffect(() => {
    if (!orgMode && formData.postcode && /^\d{4}$/.test(String(formData.postcode).trim())) {
      saveDonorPostcode(formData.postcode)
    }
  }, [formData.postcode, orgMode])

  const handleQuantityAdjust = (delta) => {
    setFormData((prev) => {
      const current = parseQuantityValue(prev.quantity) ?? 0
      const next = Math.max(0, Math.round((current + delta) * 100) / 100)
      return {
        ...prev,
        quantity: next === 0 ? '' : String(next),
      }
    })
  }

  const handleBack = () => {
    if (successListing) {
      return
    }
    if (orgMode) {
      navigate('/org/listings', { state: { orgCode: initialOrgCode } })
      return
    }
    navigate('/donor', { state: { postcode: formData.postcode || postcode } })
  }

  const handleFileChange = async (event) => {
    const file = event.target.files && event.target.files[0]
    if (!file) return

    selectedFileRef.current = file
    setPreviewLoadFailed(false)
    setAiProcessing(true)
    setError('')
    setAiWarning('')

    try {
      const fd = new FormData()
      fd.append('image', file)
      const result = await recognizeFoodFromImage(fd)
      const nextFoodType = result.name || ''
      const suggestedQuantity = getSuggestedQuantity(result.quantity, formData.quantity || '1')
      const suggestedCategory = resolveListingCategory(result.category || DEFAULT_CATEGORY, nextFoodType)
      const suggestedDietary =
        getPrimaryDietaryChoice(result.dietary_tags || []) !== 'none'
          ? getPrimaryDietaryChoice(result.dietary_tags || [])
          : inferDietaryChoiceFromFoodName(nextFoodType)

      if (suggestedQuantity.warning === 'high') {
        setAiWarning(t('donation.quantityWarning', { count: Number(result.quantity) }))
      }

      setFormData((prev) => ({
        ...prev,
        foodType: nextFoodType || prev.foodType,
        quantity: suggestedQuantity.value,
        category: suggestedCategory,
        dietaryChoice: suggestedDietary,
        photoUrl: URL.createObjectURL(file),
        nameSuggestions: result.name_suggestions || [],
      }))
    } catch (err) {
      console.error('AI recognition error:', err)
      setError(t('donation.errors.aiTimeout'))
      setFormData((prev) => ({
        ...prev,
        photoUrl: URL.createObjectURL(file),
      }))
    } finally {
      setAiProcessing(false)
    }
  }

  const handleChange = (field, value) => {
    let nextValue = value
    if (field === 'quantity') {
      nextValue = String(value).replace(/[^0-9.]/g, '')
      if (aiWarning) {
        setAiWarning('')
      }
    }
    if (field === 'expiryDate') {
      nextValue = String(value)
    }
    setFormData((prev) => ({ ...prev, [field]: nextValue }))
  }

  const quantityValue = parseQuantityValue(formData.quantity)
  const showQuantityWarning = quantityValue !== null && quantityValue > MAX_CONFIDENT_AI_QUANTITY
  const previewImageUrl = resolveImageUrl(formData.photoUrl)

  const handleRemoveListing = async (listing) => {
    if (!listing) return
    try {
      setLoading(true)
      await deleteListing(listing.id, listing.orgCode)
      if (!orgMode) {
        forgetDonorListing(listing.id)
      }
      if (orgMode) {
        navigate('/org/listings', { state: { orgCode: initialOrgCode } })
      } else {
        navigate('/donor/listings', { state: { postcode: listing.postcode } })
      }
    } catch (err) {
      console.error('Remove listing error:', err)
      setError(t('donation.errors.removeFailed', 'Unable to remove this listing right now.'))
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const quantityValue = parseQuantityValue(formData.quantity)
      const expiryDateValue = normalizeDateInput(formData.expiryDate)

      if (String(formData.foodType).trim() === '') {
        throw new Error(t('donation.errors.foodType'))
      }
      if (quantityValue === null || quantityValue <= 0) {
        throw new Error(t('donation.errors.quantity'))
      }
      if (String(formData.postcode).trim() === '') {
        throw new Error(t('donation.errors.postcode'))
      }
      if (String(formData.expiryDate || '').trim() !== '' && expiryDateValue === null) {
        throw new Error(t('donation.errors.bestBefore', 'Please enter the best before date as DD/MM/YYYY'))
      }

      let permanentPhotoUrl = editingListing?.photoUrl || null
      if (selectedFileRef.current) {
        try {
          const uploadResult = await uploadImage(selectedFileRef.current)
          permanentPhotoUrl = resolveImageUrl(uploadResult?.url)
        } catch (uploadErr) {
          console.warn('Image upload failed, saving data-url fallback instead:', uploadErr)
          try {
            permanentPhotoUrl = await fileToDataUrl(selectedFileRef.current)
          } catch (fallbackErr) {
            console.warn('Image fallback conversion failed, continuing with existing image:', fallbackErr)
          }
        }
      }

      const payload = {
        foodType: formData.foodType.trim(),
        category: normalizeCategory(formData.category),
        quantity: quantityValue,
        unit: 'portions',
        postcode: String(formData.postcode).trim(),
        orgCode: editMode && editingListing?.orgCode ? editingListing.orgCode : donorOrgCode,
        dietary_tags: buildDietaryTags(formData.dietaryChoice),
        description: String(formData.description || '').trim(),
        photoUrl: permanentPhotoUrl,
        sizeCue: String(formData.sizeCue || '').trim(),
        expiryDate: expiryDateValue,
      }

      let savedListing = null
      if (editMode && editingListing) {
        savedListing = await updateListing(editingListing.id, payload)
      } else {
        savedListing = await submitListing(payload)
      }
      if (!orgMode && savedListing?.id) {
        rememberDonorListing(savedListing.id)
      }
      setSuccessListing(savedListing)
    } catch (err) {
      console.error('Submit listing error:', err)
      setError(err.message || t('donation.errors.submitFailed', 'Unable to save this listing right now.'))
    } finally {
      setLoading(false)
    }
  }

  if (successListing) {
    return (
      <div className="success-container">
        <div className="success-card success-card-wide">
          <div className="success-icon">
            <span className="material-symbols-outlined">check_circle</span>
          </div>
          <h2>{editMode ? t('donation.success.updatedTitle', 'Listing updated') : t('donation.success.title')}</h2>
          <p>
            {orgMode
              ? t('donation.success.orgMessage')
              : t('donation.success.donorMessage')}
          </p>
          <div className="success-action-stack">
            <button
              type="button"
              className="success-action-btn primary"
              onClick={() => {
                if (orgMode) {
                  navigate('/org/listings', { state: { orgCode: initialOrgCode } })
                } else {
                  navigate('/donor/listings', { state: { postcode: successListing.postcode } })
                }
              }}
            >
              {orgMode
                ? t('donation.actions.backDashboard', 'Back to dashboard')
                : t('donation.actions.backListings', 'Back to my listings')}
            </button>
            <button
              type="button"
              className="success-action-btn"
              onClick={() =>
                navigate('/donor/post', {
                  state: {
                    postcode: successListing.postcode,
                    editMode: true,
                    listing: successListing,
                    orgMode,
                    orgCode: successListing.orgCode,
                    orgName,
                  },
                })
              }
            >
              {t('donation.actions.editListing', 'Edit this listing')}
            </button>
            <button
              type="button"
              className="success-action-btn"
              onClick={() => navigate(orgMode ? '/' : '/donor', { state: { postcode: successListing.postcode } })}
            >
              {orgMode ? t('donation.actions.backHome', 'Back to home') : 'Back to donor workspace'}
            </button>
            <button
              type="button"
              className="success-action-btn text-danger"
              onClick={() => handleRemoveListing(successListing)}
            >
              {t('donation.actions.removeListing', 'Remove this listing')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="donation-form-container">
      <header className="form-header">
        <div className="form-header-inner">
          <div className="form-header-left">
            <button className="btn-back" type="button" onClick={handleBack}>
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <span className="form-brand">{t('appName')}</span>
          </div>
          <div className="form-header-badge">
            <span className="material-symbols-outlined">auto_awesome</span>
            {orgMode ? t('donation.orgTitle') : t('donation.aiTitle')}
          </div>
        </div>
        <div className="form-header-divider" />
      </header>

      {orgMode ? null : (
        <div className="donor-form-nav-row">
          <DonorFeatureNav active="post" postcode={formData.postcode || postcode} />
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <main className="form-content">
          <header className="form-hero">
            <h1>{pageTitle}</h1>
            <p>
              {orgMode
                ? orgName
                  ? t('dashboard.sharing', { orgName })
                  : t('donation.subtitle')
                : t('donation.subtitle')}
            </p>
          </header>

          {previewImageUrl && !previewLoadFailed ? (
            <div className="photo-preview">
              <img src={previewImageUrl} alt="Food" onError={() => setPreviewLoadFailed(true)} />
              <button
                type="button"
                className="btn-change-photo"
                onClick={() => {
                  selectedFileRef.current = null
                  setPreviewLoadFailed(false)
                  handleChange('photoUrl', null)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
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

          {aiProcessing ? <div className="ai-processing">{t('donation.analyzing')}</div> : null}
          {error ? <div className="error-message">{error}</div> : null}

          <section className="ai-result-card">
            <div className="ai-result-label">
              <div className="ai-label-icon">
                <span className="material-symbols-outlined">auto_awesome</span>
              </div>
              <span className="ai-label-text">{t('donation.aiDetails')}</span>
            </div>

            <div className="ai-review-note">
              <p>{t('donation.reviewTitle', 'Suggested details — please review before posting.')}</p>
              <ul>
                <li>{t('donation.reviewHintFood', 'Check the food name and category.')}</li>
                <li>{t('donation.reviewHintQuantity', 'Confirm the quantity and size or weight.')}</li>
                <li>{t('donation.reviewHintDietary', 'Update the dietary tag if the AI guessed incorrectly.')}</li>
              </ul>
            </div>

            <div className="ai-fields-grid">
              <div className="ai-field full">
                <label className="field-label" htmlFor="foodType">{t('donation.foodName')}</label>
                <input
                  id="foodType"
                  className="form-input"
                  type="text"
                  value={formData.foodType}
                  onChange={(event) => handleChange('foodType', event.target.value)}
                  placeholder={t('donation.foodName')}
                />
                {formData.nameSuggestions.length > 0 ? (
                  <p className="field-hint strong">{formData.nameSuggestions.join(' / ')}</p>
                ) : null}
              </div>

              <div className="ai-field">
                <label className="field-label" htmlFor="quantity">{t('donation.quantity')}</label>
                <div className="quantity-control">
                  <button
                    type="button"
                    className="quantity-step-btn"
                    onClick={() => handleQuantityAdjust(-1)}
                    aria-label="Decrease quantity"
                  >
                    -
                  </button>
                  <input
                    id="quantity"
                    className="form-input quantity-input"
                    type="text"
                    inputMode="decimal"
                    value={formData.quantity}
                    onChange={(event) => handleChange('quantity', event.target.value)}
                    placeholder="1"
                  />
                  <button
                    type="button"
                    className="quantity-step-btn"
                    onClick={() => handleQuantityAdjust(1)}
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="ai-field">
                <label className="field-label" htmlFor="category">{t('donation.category')}</label>
                <div className="form-select-wrapper">
                  <select
                    id="category"
                    className="form-select"
                    value={formData.category}
                    onChange={(event) => handleChange('category', event.target.value)}
                  >
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t('dashboard.tabs.' + option.key, option.value)}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined select-arrow">expand_more</span>
                </div>
              </div>

              <div className="ai-field">
                <label className="field-label" htmlFor="sizeCue">{t('donation.sizeCue', 'Size or weight')}</label>
                <div className="form-select-wrapper">
                  <select
                    id="sizeCue"
                    className="form-select"
                    value={formData.sizeCue}
                    onChange={(event) => handleChange('sizeCue', event.target.value)}
                  >
                    {SIZE_CUE_OPTIONS.map((option) => (
                      <option key={option.key} value={option.value}>
                        {t('donation.sizeOptions.' + option.key, option.value || 'Select one')}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined select-arrow">expand_more</span>
                </div>
                <p className="field-hint strong">
                  {t('donation.sizeCueHint', 'Choose the closest size or weight so community groups know what to expect at pickup.')}
                </p>
              </div>

              <div className="ai-field">
                <label className="field-label" htmlFor="dietaryChoice">{t('donation.dietary', 'Dietary tag')}</label>
                <div className="form-select-wrapper">
                  <select
                    id="dietaryChoice"
                    className="form-select"
                    value={formData.dietaryChoice}
                    onChange={(event) => handleChange('dietaryChoice', event.target.value)}
                  >
                    {DIETARY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t('listing.dietary.' + option.key, option.value)}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined select-arrow">expand_more</span>
                </div>
              </div>

              <div className="ai-field">
                <label className="field-label" htmlFor="expiryDate">{t('donation.bestBefore', 'Best before')}</label>
                <div className="date-input-wrapper">
                  <input
                    id="expiryDate"
                    className="form-input"
                    type="text"
                    inputMode="numeric"
                    placeholder={t('donation.bestBeforePlaceholder', 'DD/MM/YYYY')}
                    value={formatDateForTextInput(formData.expiryDate)}
                    onChange={(event) => handleChange('expiryDate', event.target.value)}
                  />
                  <button
                    type="button"
                    className="date-picker-trigger"
                    aria-label={t('donation.openDatePicker', 'Open calendar')}
                    onClick={() => {
                      if (dateInputRef.current?.showPicker) {
                        dateInputRef.current.showPicker()
                      } else {
                        dateInputRef.current?.click()
                      }
                    }}
                  >
                    <span className="material-symbols-outlined">calendar_month</span>
                  </button>
                  <input
                    ref={dateInputRef}
                    className="date-picker-native"
                    type="date"
                    tabIndex="-1"
                    aria-hidden="true"
                    value={formatDateForPicker(formData.expiryDate)}
                    onChange={(event) => handleChange('expiryDate', formatDateForDisplay(event.target.value))}
                  />
                </div>
                {showQuantityWarning || aiWarning ? (
                  <p className="field-warning">
                    {aiWarning || t('donation.quantityWarning', { count: quantityValue })}
                  </p>
                ) : null}
              </div>

              <div className="ai-field">
                {orgMode && focusPostcode ? (
                  <p className="response-context-hint">
                    {t('donation.respondingToPostcode', {
                      postcode: focusPostcode,
                      defaultValue: 'Responding to supply gap in {{postcode}}',
                    })}
                  </p>
                ) : null}
                <label className="field-label" htmlFor="postcodeField">{t('donation.postcode')}</label>
                <input
                  id="postcodeField"
                  className="form-input"
                  type="text"
                  inputMode="numeric"
                  maxLength="4"
                  value={formData.postcode}
                  onChange={(event) => handleChange('postcode', event.target.value)}
                />
              </div>

              <div className="ai-field full">
                <label className="field-label" htmlFor="description">{t('donation.extraNotes', 'Extra notes')}</label>
                <textarea
                  id="description"
                  className="form-textarea"
                  rows="4"
                  value={formData.description}
                  onChange={(event) => handleChange('description', event.target.value)}
                  placeholder={t('donation.extraNotesPlaceholder', 'Example: Pickup from front desk after 4pm. Keep refrigerated. Please bring a container.')}
                />
              </div>
            </div>
          </section>
        </main>

        <footer className="form-footer">
          <div className="form-footer-inner">
            <button type="submit" className="btn-submit" disabled={loading || aiProcessing}>
              {loading
                ? t('common.loading')
                : editMode
                  ? t('donation.saveButton', 'Save listing changes')
                  : t('donation.postButton')}
              {loading ? null : <span className="material-symbols-outlined">arrow_forward</span>}
            </button>
            <p className="form-security-note">{t('common.secure')}</p>
          </div>
        </footer>
      </form>
    </div>
  )
}

export default DonationForm
