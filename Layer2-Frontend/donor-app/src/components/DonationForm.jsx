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
import OrgFeatureNav from './OrgFeatureNav'
import WorkspaceHeader from './WorkspaceHeader'
import { forgetDonorListing, getOrCreateDonorCode, rememberDonorListing } from '../utils/donorIdentity'
import { resolveImageUrl } from '../utils/imageUrl'
import { getSavedDonorPostcode, saveDonorPostcode } from '../utils/donorPostcode'
import { rememberListingSafety } from '../utils/listingSafety'
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

const ALLERGEN_PRESETS = [
  { key: 'nuts', label: 'Nuts' },
  { key: 'dairy', label: 'Dairy' },
  { key: 'gluten', label: 'Gluten' },
  { key: 'eggs', label: 'Eggs' },
  { key: 'soy', label: 'Soy' },
  { key: 'sesame', label: 'Sesame' },
  { key: 'shellfish', label: 'Shellfish' },
  { key: 'no known allergens', label: 'No known allergens' },
]

const STORAGE_OPTIONS = [
  { value: '', label: 'Select storage condition' },
  { value: 'room_temp', label: 'Room temperature' },
  { value: 'refrigerated', label: 'Refrigerated (2–8°C)' },
  { value: 'frozen', label: 'Frozen (<0°C)' },
  { value: 'keep_dry', label: 'Keep dry' },
]

function isExpiryPast(value) {
  const normalized = normalizeDateInput(value)
  if (!normalized) return false
  return new Date(normalized) < new Date(new Date().toDateString())
}

function buildInitialState({ postcode, orgMode, initialOrgCode, listing }) {
  if (listing) {
    const listingAllergenTags = Array.isArray(listing.allergenTags)
      ? listing.allergenTags
      : (Array.isArray(listing.allergen_tags) ? listing.allergen_tags : [])
    const listingStorageCondition = listing.storageCondition || listing.storage_condition || ''
    const listingPickupWindow = listing.pickupWindow || listing.pickup_window || ''
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
      allergenTags: listingAllergenTags,
      storageCondition: listingStorageCondition,
      pickupWindow: listingPickupWindow,
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
    allergenTags: [],
    storageCondition: '',
    pickupWindow: '',
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
  const [disclaimerChecked, setDisclaimerChecked] = useState(false)
  const [allergenFieldError, setAllergenFieldError] = useState('')
  const [storageFieldError, setStorageFieldError] = useState('')
  const [pickupWindowFieldError, setPickupWindowFieldError] = useState('')

  const pageTitle = useMemo(() => {
    if (editMode) return t('donation.editTitle', 'Edit listing')
    return t('donation.title')
  }, [editMode, t])

  const donorOrgCode = orgMode ? String(initialOrgCode || '').toUpperCase() : getOrCreateDonorCode()
  const roleThemeClass = orgMode ? 'org-role-page' : 'donor-role-page'
  const currentDonorPostcode = formData.postcode || postcode
  const currentOrgCode = String(initialOrgCode || formData.orgCode || '').trim().toUpperCase()

  const goToWorkspaceHome = () => {
    if (orgMode) {
      navigate('/org/listings', { state: { orgCode: currentOrgCode } })
      return
    }
    navigate('/donor/listings', { state: { postcode: currentDonorPostcode } })
  }

  useEffect(() => {
    setFormData(buildInitialState({ postcode, orgMode, initialOrgCode, listing: editingListing }))
    setError('')
    setAiWarning('')
    setSuccessListing(null)
    setPreviewLoadFailed(false)
    setDisclaimerChecked(false)
    setAllergenFieldError('')
    setStorageFieldError('')
    setPickupWindowFieldError('')
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
    if (editMode) {
      navigate('/donor/listings', { state: { postcode: formData.postcode || postcode } })
      return
    }

    const historyIndex = window.history.state?.idx ?? 0
    if (historyIndex > 0) {
      navigate(-1)
      return
    }

    goToWorkspaceHome()
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
    if (field === 'pickupWindow' && String(value || '').trim() !== '') {
      setPickupWindowFieldError('')
    }
    if (field === 'storageCondition' && String(value || '').trim() !== '') {
      setStorageFieldError('')
    }
    setFormData((prev) => ({ ...prev, [field]: nextValue }))
  }

  const quantityValue = parseQuantityValue(formData.quantity)
  const showQuantityWarning = quantityValue !== null && quantityValue > MAX_CONFIDENT_AI_QUANTITY
  const previewImageUrl = resolveImageUrl(formData.photoUrl)

  const handleRemoveListing = async (listing) => {
    if (!listing) return
    const confirmed = window.confirm(
      t(
        'donation.actions.removeConfirmMessage',
        'Are you sure you want to remove this listing?\nThis action cannot be undone.',
      ),
    )
    if (!confirmed) return
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
    setAllergenFieldError('')
    setStorageFieldError('')
    setPickupWindowFieldError('')

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
      if (String(formData.expiryDate || '').trim() === '') {
        throw new Error(t('donation.errors.expiryRequired', 'Best before date is required'))
      }
      if (String(formData.expiryDate || '').trim() !== '' && expiryDateValue === null) {
        throw new Error(t('donation.errors.bestBefore', 'Please enter the best before date as DD/MM/YYYY'))
      }
      if (expiryDateValue && new Date(expiryDateValue) < new Date(new Date().toDateString())) {
        throw new Error(t('donation.errors.expiryPast', 'Best before date cannot be in the past'))
      }
      if (formData.allergenTags.length === 0) {
        const allergenError = t('donation.errors.allergenRequired', 'Please select at least one allergen tag (or "No known allergens")')
        setAllergenFieldError(allergenError)
        throw new Error(allergenError)
      }
      if (!formData.storageCondition) {
        const storageError = t('donation.errors.storageRequired', 'Please select a storage condition')
        setStorageFieldError(storageError)
        throw new Error(storageError)
      }
      if (String(formData.pickupWindow || '').trim() === '') {
        const pickupWindowError = t('donation.errors.pickupWindowRequired', 'Please add a pickup window before posting.')
        setPickupWindowFieldError(pickupWindowError)
        throw new Error(pickupWindowError)
      }
      if (!disclaimerChecked) {
        throw new Error(t('donation.errors.disclaimerRequired', 'Please confirm the accuracy declaration before posting'))
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
        allergenTags: formData.allergenTags,
        allergen_tags: formData.allergenTags,
        storageCondition: formData.storageCondition || null,
        storage_condition: formData.storageCondition || null,
        pickupWindow: String(formData.pickupWindow || '').trim() || null,
        pickup_window: String(formData.pickupWindow || '').trim() || null,
      }

      let savedListing = null
      if (editMode && editingListing) {
        savedListing = await updateListing(editingListing.id, payload)
      } else {
        savedListing = await submitListing(payload)
      }
      const safetyListingId = savedListing?.id || editingListing?.id
      if (safetyListingId) {
        rememberListingSafety(safetyListingId, {
          allergenTags: formData.allergenTags,
          storageCondition: formData.storageCondition,
          pickupWindow: formData.pickupWindow,
        })
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
      <div className={`success-container ${roleThemeClass}`.trim()}>
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
          {!orgMode ? (
            <div className="success-next-step">
              <strong>{t('donation.success.nextStepLabel', 'Next step')}</strong>
              <p>{t('donation.success.nextStepHint', 'We’ll notify you when an organisation claims your listing. You can then coordinate pickup through messages.')}</p>
            </div>
          ) : null}

          <div style={{
            background: '#fffbeb',
            border: '1px solid rgba(221,107,32,0.25)',
            borderRadius: '0.75rem',
            padding: '0.9rem 1rem',
            marginBottom: '0.5rem',
            textAlign: 'left',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.55rem' }}>
              <span className="material-symbols-outlined" style={{ color: '#dd6b20', fontSize: '1.1rem' }}>
                shield
              </span>
              <strong style={{ fontSize: '0.8rem', color: '#92400e', letterSpacing: '0.01em' }}>
                {t('donation.safety.title')}
              </strong>
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <li style={{ fontSize: '0.75rem', color: '#78350f', lineHeight: 1.55 }}>
                {t('donation.safety.accuracy')}
              </li>
              <li style={{ fontSize: '0.75rem', color: '#78350f', lineHeight: 1.55 }}>
                {t('donation.safety.allergen')}
              </li>
              <li style={{ fontSize: '0.75rem', color: '#78350f', lineHeight: 1.55 }}>
                {t('donation.safety.platform')}
              </li>
            </ul>
          </div>

          <div className="success-action-stack">
            <button
              type="button"
              className="success-action-btn primary"
              onClick={() => {
                if (orgMode) {
                  navigate('/org/listings', {
                    state: {
                      orgCode: initialOrgCode || successListing.orgCode || '',
                      filterStatus: 'posted',
                    },
                  })
                } else {
                  navigate('/donor/listings', { state: { postcode: successListing.postcode } })
                }
              }}
            >
              {orgMode
                ? t('donation.actions.backOrgListings', 'Back to food listings')
                : t('donation.actions.backListings', 'Back to my listings')}
            </button>
            {orgMode ? (
              <>
                <button
                  type="button"
                  className="success-action-btn"
                  onClick={() =>
                    navigate('/org/alerts', {
                      state: { orgCode: initialOrgCode || successListing.orgCode || '' },
                    })
                  }
                >
                  {t('donation.actions.viewOrgAlerts', 'Review alerts')}
                </button>
                <button
                  type="button"
                  className="success-action-btn"
                  onClick={() =>
                    navigate('/org/gaps', {
                      state: { orgCode: initialOrgCode || successListing.orgCode || '' },
                    })
                  }
                >
                  {t('donation.actions.viewOrgGaps', 'Review supply gaps')}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="success-action-btn"
                onClick={() => navigate('/donor/post', { state: { postcode: successListing.postcode } })}
              >
                {t('donation.actions.postAnother', 'Post another listing')}
              </button>
            )}
            {!orgMode ? (
              <button
                type="button"
                className="success-action-btn"
                onClick={() => navigate('/donor/hotspots', { state: { postcode: successListing.postcode } })}
              >
                {t('donation.actions.viewHotspots', 'See where food is needed')}
              </button>
            ) : null}
            <button
              type="button"
              className="success-action-btn"
              onClick={() =>
                navigate(orgMode ? '/form' : '/donor/post', {
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
    <div className={`donation-form-container ${roleThemeClass}`.trim()}>
      <WorkspaceHeader
        role={orgMode ? 'org' : 'donor'}
        onBackClick={handleBack}
        onBrandClick={goToWorkspaceHome}
        utilityContent={(
          <div className="workspace-header__utility-badge">
            <span className="material-symbols-outlined">auto_awesome</span>
            {orgMode ? t('donation.orgTitle') : t('donation.aiTitle')}
          </div>
        )}
      />

      <div className="workspace-nav-row workspace-form-nav-row">
        {orgMode ? (
          <OrgFeatureNav active="" orgCode={currentOrgCode} />
        ) : (
          <DonorFeatureNav active="" postcode={currentDonorPostcode} />
        )}
      </div>

      <form onSubmit={handleSubmit} className="donation-form-shell">
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
                <li>{t('donation.reviewHintQuantity', 'Confirm the quantity and portion size.')}</li>
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
                <label className="field-label" htmlFor="sizeCue">{t('donation.sizeCue', 'Portion size')}</label>
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
                  {t('donation.sizeCueHint', 'Select the estimated number of serves rather than an exact weight.')}
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
                <label className="field-label" htmlFor="expiryDate">
                  {t('donation.expiryDateLabel', 'Use-by / best-before date')}
                  <span style={{ color: '#e53e3e', marginLeft: 2 }}>*</span>
                </label>
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
                {isExpiryPast(formData.expiryDate) ? (
                  <p className="field-warning" style={{ color: '#e53e3e' }}>
                    {t('donation.errors.expiryPast', 'Best before date cannot be in the past')}
                  </p>
                ) : (showQuantityWarning || aiWarning) ? (
                  <p className="field-warning">
                    {aiWarning || t('donation.quantityWarning', { count: quantityValue })}
                  </p>
                ) : null}
              </div>

              <div className={allergenFieldError ? 'ai-field full allergen-field has-error' : 'ai-field full allergen-field'}>
                <label className={allergenFieldError ? 'field-label field-label--error' : 'field-label'}>
                  {t('donation.allergenTags', 'Allergen information')}
                  <span style={{ color: '#e53e3e', marginLeft: 2 }}>*</span>
                </label>
                <div className="allergen-chip-group" role="group" aria-label={t('donation.allergenTags', 'Allergen information')}>
                  {ALLERGEN_PRESETS.map(({ key, label }) => {
                    const active = formData.allergenTags.includes(key)
                    const isNoKnown = key === 'no known allergens'
                    return (
                      <button
                        key={key}
                        type="button"
                        className={[
                          'allergen-chip',
                          active ? 'is-active' : '',
                          isNoKnown ? 'is-wide' : '',
                        ].join(' ').trim()}
                        onClick={() => {
                          setFormData(prev => {
                            let nextTags = []
                            if (isNoKnown) {
                              nextTags = active ? [] : [key]
                            } else {
                              const without = prev.allergenTags.filter(t => t !== 'no known allergens')
                              nextTags = active
                                ? without.filter(t => t !== key)
                                : [...without, key]
                            }
                            if (nextTags.length > 0) {
                              setAllergenFieldError('')
                            }
                            return {
                              ...prev,
                              allergenTags: nextTags,
                            }
                          })
                        }}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
                <p className={allergenFieldError ? 'field-hint field-hint--error' : 'field-hint field-hint--instruction'}>
                  {t('donation.allergenHint', 'Select all allergens present. Choose "No known allergens" if none apply.')}
                </p>
                {allergenFieldError ? (
                  <p className="field-error-inline">
                    {t(
                      'donation.allergenRequiredHint',
                      'Required: select at least one allergen tag, or choose "No known allergens".',
                    )}
                  </p>
                ) : null}
              </div>

              <div className={storageFieldError ? 'ai-field has-error' : 'ai-field'}>
                <label className={storageFieldError ? 'field-label field-label--error' : 'field-label'} htmlFor="storageCondition">
                  {t('donation.storageCondition', 'Storage condition')}
                  <span style={{ color: '#e53e3e', marginLeft: 2 }}>*</span>
                </label>
                <div className="form-select-wrapper">
                  <select
                    id="storageCondition"
                    className={storageFieldError ? 'form-select form-select--error' : 'form-select'}
                    value={formData.storageCondition}
                    onChange={(event) => handleChange('storageCondition', event.target.value)}
                  >
                    {STORAGE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} disabled={opt.value === ''}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined select-arrow">expand_more</span>
                </div>
                <p className={storageFieldError ? 'field-hint field-hint--error' : 'field-hint field-hint--instruction'}>
                  {t('donation.storageHint', 'How should this food be stored before pickup?')}
                </p>
                {storageFieldError ? (
                  <p className="field-error-inline">
                    {t(
                      'donation.storageRequiredHint',
                      'Required: choose a storage condition so organisations can handle the food safely.',
                    )}
                  </p>
                ) : null}
              </div>

              <div className={pickupWindowFieldError ? 'ai-field has-error' : 'ai-field'}>
                <label className={pickupWindowFieldError ? 'field-label field-label--error' : 'field-label'} htmlFor="pickupWindow">
                  {t('donation.pickupWindow', 'Pickup window')}
                  <span style={{ color: '#e53e3e', marginLeft: 2 }}>*</span>
                </label>
                <select
                  id="pickupWindow"
                  className={pickupWindowFieldError ? 'form-input form-input--error' : 'form-input'}
                  value={formData.pickupWindow}
                  onChange={(event) => handleChange('pickupWindow', event.target.value)}
                >
                  <option value="" disabled>{t('donation.pickupWindowPlaceholder', 'Choose a pickup window')}</option>
                  <option value="Today · Morning (8am–12pm)">Today · Morning (8am–12pm)</option>
                  <option value="Today · Afternoon (12pm–4pm)">Today · Afternoon (12pm–4pm)</option>
                  <option value="Today · Evening (4pm–7pm)">Today · Evening (4pm–7pm)</option>
                  <option value="Tomorrow · Morning (8am–12pm)">Tomorrow · Morning (8am–12pm)</option>
                  <option value="Tomorrow · Afternoon (12pm–4pm)">Tomorrow · Afternoon (12pm–4pm)</option>
                  <option value="Tomorrow · Evening (4pm–7pm)">Tomorrow · Evening (4pm–7pm)</option>
                  <option value="This weekend · Morning (8am–12pm)">This weekend · Morning (8am–12pm)</option>
                  <option value="This weekend · Afternoon (12pm–4pm)">This weekend · Afternoon (12pm–4pm)</option>
                  <option value="Flexible – arrange in chat">Flexible – arrange in chat</option>
                </select>
                <p className={pickupWindowFieldError ? 'field-hint field-hint--error' : 'field-hint field-hint--instruction'}>
                  {t('donation.pickupWindowHint', 'When can organisations collect this food?')}
                </p>
                {pickupWindowFieldError ? (
                  <p className="field-error-inline">
                    {t(
                      'donation.pickupWindowRequiredHint',
                      'Required: add a pickup date and time window so organisations know when to collect.',
                    )}
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
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              marginBottom: '0.9rem', cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={disclaimerChecked}
                onChange={(e) => setDisclaimerChecked(e.target.checked)}
                style={{ marginTop: '2px', width: 16, height: 16, flexShrink: 0, cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.78rem', color: '#4a5568', lineHeight: 1.55 }}>
                {t('donation.disclaimerCheckbox',
                  'I confirm that the food details, expiry date, allergen information, and storage condition are accurate to the best of my knowledge. I understand that OutBackShare acts as a coordination platform and does not independently verify food safety or suitability.'
                )}
              </span>
            </label>
            <button type="submit" className="btn-submit" disabled={loading || aiProcessing || !disclaimerChecked}>
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
