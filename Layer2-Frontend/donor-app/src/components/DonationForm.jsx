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
import { forgetDonorListing, getOrCreateDonorCode, rememberDonorListing } from '../utils/donorIdentity'
import logoUrl from '../assets/outbackshare-logo.png'
import textureImg from '../assets/post-food-texture.jpg'
import produceBgImg from '../assets/postcode-produce.jpg'
import { resolveImageUrl } from '../utils/imageUrl'
import { getSavedDonorPostcode, saveDonorPostcode } from '../utils/donorPostcode'
import { rememberListingSafety } from '../utils/listingSafety'
import '../styles/DonationForm.css'

const DEFAULT_CATEGORY = 'Baked goods'
const MAX_CONFIDENT_AI_QUANTITY = 30

// Pick a safe quantity from AI result, fall back to previous value if the number seems too high
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

// Convert an ISO or DD/MM/YYYY date string to DD/MM/YYYY for display
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

// Parse a quantity string to a float, return null if not a valid number
function parseQuantityValue(value) {
  const parsed = Number.parseFloat(String(value ?? '').replace(',', '.').trim())
  if (Number.isFinite(parsed) === false) return null
  return parsed
}

// Read a local file and return its data URL string
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Unable to read image file'))
    reader.readAsDataURL(file)
  })
}

// Accept DD/MM/YYYY or YYYY-MM-DD and always return YYYY-MM-DD (or null)
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

// Return YYYY-MM-DD string suitable for a native date input element
function formatDateForPicker(value) {
  const normalized = normalizeDateInput(value)
  return normalized || ''
}

// Return DD/MM/YYYY string for the visible text input
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

// Return true if the expiry date is before today
function isExpiryPast(value) {
  const normalized = normalizeDateInput(value)
  if (!normalized) return false
  return new Date(normalized) < new Date(new Date().toDateString())
}

// Build the initial form state from route params or an existing listing being edited
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

  // Navigate back to the correct workspace home depending on role
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

  // Increase or decrease quantity by one step, keeping value >= 0
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

  // Navigate back, skipping action when on the success screen
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

  // Upload the selected photo to AI recognition and pre-fill form fields from the result
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

  // Update a single form field, with special handling for quantity and date fields
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

  // Ask for confirmation then delete the listing and redirect to the listings page
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

  // Validate all fields, upload the photo if needed, then create or update the listing
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
    // Navigate back to the correct listings page after a successful post
    const backAction = () => {
      if (orgMode) {
        navigate('/org/listings', { state: { orgCode: initialOrgCode || successListing.orgCode || '', filterStatus: 'posted' } })
      } else {
        navigate('/donor/listings', { state: { postcode: successListing.postcode } })
      }
    }

    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif', position: 'relative', overflow: 'hidden' }}>

        {/* Background image with blur and dark overlay */}
        <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
          <img src={produceBgImg} alt="" aria-hidden="true"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: 'blur(18px) brightness(0.45)', transform: 'scale(1.06)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(10,30,18,0.72) 0%, rgba(15,45,28,0.85) 100%)' }} />
        </div>

        {/* Bloom accent */}
        <div style={{ position: 'fixed', top: '10%', left: '20%', width: 500, height: 500, borderRadius: '50%', background: 'rgba(45,106,79,0.25)', filter: 'blur(100px)', pointerEvents: 'none', zIndex: 1 }} />
        <div style={{ position: 'fixed', bottom: '5%', right: '15%', width: 380, height: 380, borderRadius: '50%', background: 'rgba(45,106,79,0.18)', filter: 'blur(90px)', pointerEvents: 'none', zIndex: 1 }} />

        {/* Header with centered logo */}
        <header style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(15,45,28,0.70)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(149,212,179,0.18)', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button type="button" onClick={backAction} style={{ position: 'absolute', left: 32, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 500, fontFamily: 'inherit', padding: 0 }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
            {orgMode ? 'Listings' : 'My Listings'}
          </button>
          <img src={logoUrl} alt="OutBackShare" style={{ height: 36, width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        </header>

        {/* Page content */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px 60px', position: 'relative', zIndex: 2 }}>
          <div style={{ width: '100%', maxWidth: 520 }}>

            {/* Success card */}
            <div style={{ background: 'rgba(20,55,38,0.80)', border: '1px solid rgba(149,212,179,0.25)', borderRadius: 28, padding: '40px 40px 32px', backdropFilter: 'blur(24px)', boxShadow: '0 32px 80px rgba(0,0,0,0.4)' }}>

              {/* Check icon */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(149,212,179,0.18)', border: '2px solid rgba(149,212,179,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 38, color: '#95d4b3' }}>check_circle</span>
                </div>
              </div>

              {/* Success title and message */}
              <h2 style={{ fontSize: 32, fontWeight: 800, color: '#fff', textAlign: 'center', margin: '0 0 10px', letterSpacing: '-0.02em' }}>
                {editMode ? t('donation.success.updatedTitle', 'Listing updated') : t('donation.success.title', 'Posted!')}
              </h2>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', textAlign: 'center', margin: '0 0 24px', lineHeight: 1.6 }}>
                {orgMode ? t('donation.success.orgMessage', 'Your listing is now visible to donors in your area.') : t('donation.success.donorMessage', 'Your listing is now visible to local organisations.')}
              </p>

              {/* Next step hint for donors */}
              {!orgMode && (
                <div style={{ background: 'rgba(149,212,179,0.10)', border: '1px solid rgba(149,212,179,0.2)', borderRadius: 14, padding: '14px 16px', marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#95d4b3', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                    {t('donation.success.nextStepLabel', 'Next step')}
                  </div>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', margin: 0, lineHeight: 1.65 }}>
                    {t('donation.success.nextStepHint', "We'll notify you when an organisation claims your listing. You can then coordinate pickup through messages.")}
                  </p>
                </div>
              )}

              {/* Food safety reminder */}
              <div style={{ background: 'rgba(252,145,116,0.08)', border: '1px solid rgba(252,145,116,0.2)', borderRadius: 14, padding: '14px 16px', marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span className="material-symbols-outlined" style={{ color: '#fc9174', fontSize: 18 }}>shield</span>
                  <strong style={{ fontSize: 12, color: '#fc9174', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    {t('donation.safety.title', 'Food safety reminder')}
                  </strong>
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[t('donation.safety.accuracy'), t('donation.safety.allergen'), t('donation.safety.platform')].map((text, i) => (
                    <li key={i} style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>{text}</li>
                  ))}
                </ul>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Primary CTA */}
                <button type="button" onClick={backAction}
                  style={{ width: '100%', padding: '14px 20px', borderRadius: 14, border: 'none', background: '#95d4b3', color: '#002114', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit', transition: 'opacity 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{orgMode ? 'list_alt' : 'list_alt'}</span>
                  {orgMode ? t('donation.actions.backOrgListings', 'Back to food listings') : t('donation.actions.backListings', 'Back to my listings')}
                </button>

                {/* Secondary actions */}
                {orgMode ? (
                  <button type="button"
                    onClick={() => navigate('/org/intelligence', { state: { orgCode: initialOrgCode || successListing.orgCode || '' } })}
                    style={{ width: '100%', padding: '13px 20px', borderRadius: 14, border: '1px solid rgba(149,212,179,0.3)', background: 'rgba(149,212,179,0.08)', color: '#95d4b3', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(149,212,179,0.15)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(149,212,179,0.08)'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 17 }}>travel_explore</span>
                    {t('donation.actions.viewAreaIntelligence', 'Area Intelligence')}
                  </button>
                ) : (
                  <>
                    <button type="button"
                      onClick={() => navigate('/donor/post', { state: { postcode: successListing.postcode } })}
                      style={{ width: '100%', padding: '13px 20px', borderRadius: 14, border: '1px solid rgba(149,212,179,0.3)', background: 'rgba(149,212,179,0.08)', color: '#95d4b3', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(149,212,179,0.15)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(149,212,179,0.08)'}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 17 }}>add_circle</span>
                      {t('donation.actions.postAnother', 'Post another listing')}
                    </button>
                    <button type="button"
                      onClick={() => navigate('/org/intelligence', { state: { fromDonor: true, returnPath: '/donor/listings' } })}
                      style={{ width: '100%', padding: '13px 20px', borderRadius: 14, border: '1px solid rgba(149,212,179,0.3)', background: 'rgba(149,212,179,0.08)', color: '#95d4b3', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(149,212,179,0.15)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(149,212,179,0.08)'}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 17 }}>travel_explore</span>
                      {t('donation.actions.viewHotspots', 'See where food is needed')}
                    </button>
                  </>
                )}

                {/* Edit and remove actions */}
                <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                  <button type="button"
                    onClick={() => navigate(orgMode ? '/form' : '/donor/post', { state: { postcode: successListing.postcode, editMode: true, listing: successListing, orgMode, orgCode: successListing.orgCode, orgName } })}
                    style={{ flex: 1, padding: '11px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.10)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>edit</span>
                    {t('donation.actions.editListing', 'Edit')}
                  </button>
                  <button type="button"
                    onClick={() => handleRemoveListing(successListing)}
                    style={{ flex: 1, padding: '11px 16px', borderRadius: 12, border: '1px solid rgba(255,180,171,0.2)', background: 'rgba(255,180,171,0.06)', color: '#ffb4ab', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,180,171,0.12)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,180,171,0.06)'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span>
                    {t('donation.actions.removeListing', 'Remove')}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    )
  }

  // Nav tabs for the workspace header
  const FORM_TABS = orgMode ? [
    { label: 'Listings',      path: '/org/listings', state: { orgCode: currentOrgCode }, active: false },
    { label: 'Post Food',     path: null,            state: null,                        active: true  },
    { label: 'Area Intelligence', path: '/org/intelligence', state: { orgCode: currentOrgCode }, active: false },
  ] : [
    { label: 'My Listings', path: '/donor/listings', state: { postcode: currentDonorPostcode }, active: false },
    { label: 'Post Food',   path: null,              state: null,                               active: true  },
    { label: 'Area Intelligence', path: '/org/intelligence', state: { fromDonor: true, returnPath: '/donor/listings' }, active: false },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#1b4332', fontFamily: 'Inter, system-ui, sans-serif', position: 'relative', overflowX: 'hidden' }}>
      {/* Organic bloom effects */}
      <div style={{ position: 'fixed', width: 700, height: 700, background: 'radial-gradient(circle, rgba(45,106,79,0.25) 0%, transparent 70%)', filter: 'blur(80px)', top: -250, left: -250, zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', width: 700, height: 700, background: 'radial-gradient(circle, rgba(45,106,79,0.25) 0%, transparent 70%)', filter: 'blur(80px)', bottom: -250, right: -250, zIndex: 0, pointerEvents: 'none' }} />
      {/* Texture overlay */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: `url(${textureImg})`, backgroundSize: 'cover', opacity: 0.05, zIndex: 0, pointerEvents: 'none' }} />

      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(27,67,50,0.84)', backdropFilter: 'blur(18px)', borderBottom: '1px solid rgba(149,212,179,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px', height: 68 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button type="button" onClick={handleBack}
            style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.10)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#95d4b3', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.10)'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>arrow_back</span>
          </button>
          <button type="button" onClick={goToWorkspaceHome} style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <img src={logoUrl} alt="OutBackShare" style={{ height: 30, width: 'auto', objectFit: 'contain', alignSelf: 'flex-start', filter: 'brightness(0) invert(1)' }} />
          </button>
        </div>
        <nav style={{ display: 'flex', gap: 4 }}>
          {FORM_TABS.map(tab => (
            <button key={tab.label} type="button"
              onClick={tab.path ? () => navigate(tab.path, { state: tab.state }) : undefined}
              style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: tab.active ? 'rgba(149,212,179,0.20)' : 'transparent', color: tab.active ? '#95d4b3' : 'rgba(149,212,179,0.55)', fontWeight: tab.active ? 700 : 500, fontSize: 14, cursor: tab.path ? 'pointer' : 'default', fontFamily: 'inherit', transition: 'background 0.15s' }}
              onMouseEnter={e => { if (tab.path) e.currentTarget.style.background = 'rgba(149,212,179,0.12)' }}
              onMouseLeave={e => { e.currentTarget.style.background = tab.active ? 'rgba(149,212,179,0.20)' : 'transparent' }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(149,212,179,0.22)', borderRadius: 999, padding: '5px 14px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#95d4b3' }}>auto_awesome</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#95d4b3' }}>{orgMode ? t('donation.orgTitle') : t('donation.aiTitle')}</span>
        </div>
      </header>

      {/* Two-column layout */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'flex-start', gap: 32, maxWidth: 1380, margin: '0 auto', padding: '40px 48px 80px', position: 'relative', zIndex: 1 }}>

        {/* Left panel: photo upload and AI suggestions (sticky) */}
        <div style={{ width: 360, flexShrink: 0, position: 'sticky', top: 88, display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Photo upload or preview */}
          {previewImageUrl && !previewLoadFailed ? (
            <div style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', border: '2px solid rgba(149,212,179,0.3)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
              <img src={previewImageUrl} alt="Food" onError={() => setPreviewLoadFailed(true)} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} />
              <button type="button"
                onClick={() => { selectedFileRef.current = null; setPreviewLoadFailed(false); handleChange('photoUrl', null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                style={{ position: 'absolute', bottom: 14, right: 14, background: 'rgba(27,67,50,0.85)', backdropFilter: 'blur(8px)', border: '1px solid rgba(149,212,179,0.3)', borderRadius: 999, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: '#95d4b3', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>photo_camera</span>
                {t('donation.changePhoto')}
              </button>
            </div>
          ) : (
            <label
              style={{ border: '2px dashed rgba(149,212,179,0.38)', borderRadius: 20, padding: '44px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', cursor: 'pointer', background: 'rgba(45,106,79,0.15)', transition: 'background 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(45,106,79,0.28)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(45,106,79,0.15)'}
            >
              <div style={{ width: 60, height: 60, background: 'rgba(149,212,179,0.18)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 30, color: '#95d4b3' }}>photo_camera</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#95d4b3', marginBottom: 8 }}>{t('donation.takePhoto')}</div>
              <div style={{ fontSize: 13, color: 'rgba(149,212,179,0.65)', lineHeight: 1.6 }}>{t('donation.uploadSubtitle')}</div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
            </label>
          )}

          {/* AI processing indicator */}
          {aiProcessing && (
            <div style={{ background: 'rgba(45,106,79,0.3)', border: '1px solid rgba(149,212,179,0.25)', borderRadius: 14, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 10, color: '#95d4b3', fontSize: 14, fontWeight: 500 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>auto_awesome</span>
              {t('donation.analyzing')}
            </div>
          )}

          {/* AI suggestion notice */}
          <div style={{ background: 'rgba(45,106,79,0.22)', border: '1px solid rgba(149,212,179,0.20)', borderRadius: 20, padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 34, height: 34, background: 'rgba(149,212,179,0.18)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#95d4b3' }}>auto_awesome</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#95d4b3' }}>{t('donation.aiDetails')}</span>
            </div>
            <div style={{ background: 'rgba(177,240,206,0.10)', border: '1px solid rgba(149,212,179,0.18)', borderRadius: 12, padding: '14px 16px' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#b1f0ce', margin: '0 0 8px', lineHeight: 1.5 }}>{t('donation.reviewTitle', 'Suggested details — please review before posting.')}</p>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <li style={{ fontSize: 12, color: 'rgba(177,240,206,0.80)', lineHeight: 1.6 }}>{t('donation.reviewHintFood', 'Check the food name and category.')}</li>
                <li style={{ fontSize: 12, color: 'rgba(177,240,206,0.80)', lineHeight: 1.6 }}>{t('donation.reviewHintQuantity', 'Confirm the quantity and portion size.')}</li>
                <li style={{ fontSize: 12, color: 'rgba(177,240,206,0.80)', lineHeight: 1.6 }}>{t('donation.reviewHintDietary', 'Update the dietary tag if the AI guessed incorrectly.')}</li>
              </ul>
            </div>
          </div>

          {/* Impact stats panel */}
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(149,212,179,0.14)', borderRadius: 20, padding: '20px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(149,212,179,0.55)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>Your average impact per post</div>
            {[
              { icon: 'eco',      label: 'CO2 avoided',        value: '0.9 kg' },
              { icon: 'group',    label: 'Families reached',   value: '2–4' },
              { icon: 'schedule', label: 'Avg. claim time',    value: '< 20 min' },
            ].map(({ icon, label, value }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(149,212,179,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#95d4b3' }}>{icon}</span>
                  <span style={{ fontSize: 13, color: 'rgba(149,212,179,0.72)' }}>{label}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#b1f0ce' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel: main form card */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ background: 'rgba(249,249,246,0.98)', borderRadius: 24, boxShadow: '0 24px 80px rgba(0,0,0,0.35)', border: '1px solid rgba(149,212,179,0.22)', overflow: 'hidden' }}>

            {/* Card heading */}
            <div style={{ padding: '36px 44px 28px', borderBottom: '1px solid #e8e8e5', background: 'linear-gradient(135deg, rgba(177,240,206,0.08) 0%, transparent 60%)' }}>
              <h1 style={{ fontSize: 'clamp(24px, 2.6vw, 36px)', fontWeight: 700, color: '#0f5238', margin: '0 0 10px', letterSpacing: '-0.02em' }}>{pageTitle}</h1>
              <p style={{ fontSize: 15, color: '#707973', margin: 0, lineHeight: 1.65 }}>
                {orgMode ? (orgName ? t('dashboard.sharing', { orgName }) : t('donation.subtitle')) : t('donation.subtitle')}
              </p>
            </div>

            {/* Error banner */}
            {error && (
              <div style={{ margin: '24px 44px 0', padding: '13px 18px', borderRadius: 12, background: '#ffdad6', color: '#93000a', fontSize: 14, lineHeight: 1.5 }}>
                {error}
              </div>
            )}

            {/* Form fields */}
            <div style={{ padding: '32px 44px' }}>
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

              {/* Quantity field with step buttons */}
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

              {/* Category selector */}
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

              {/* Portion size selector */}
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

              {/* Dietary tag selector */}
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

              {/* Expiry date field with calendar picker */}
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

              {/* Allergen chip selector */}
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

              {/* Storage condition selector */}
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

              {/* Pickup window selector */}
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

              {/* Postcode field */}
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

              {/* Extra notes textarea */}
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
            </div>

            {/* Card footer with disclaimer checkbox and submit button */}
            <div style={{ padding: '28px 44px 40px', borderTop: '1px solid #e8e8e5', background: 'linear-gradient(to top, rgba(177,240,206,0.05) 0%, transparent 80%)' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={disclaimerChecked}
                  onChange={(e) => setDisclaimerChecked(e.target.checked)}
                  style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0, cursor: 'pointer', accentColor: '#0f5238' }}
                />
                <span style={{ fontSize: 13, color: '#707973', lineHeight: 1.6 }}>
                  {t('donation.disclaimerCheckbox',
                    'I confirm that the food details, expiry date, allergen information, and storage condition are accurate to the best of my knowledge. I understand that OutBackShare acts as a coordination platform and does not independently verify food safety or suitability.'
                  )}
                </span>
              </label>
              <button type="submit"
                disabled={loading || aiProcessing || !disclaimerChecked}
                style={{ width: '100%', height: 60, background: disclaimerChecked && !loading && !aiProcessing ? '#9a442d' : '#bfc9c1', color: '#fff', border: 'none', borderRadius: 16, fontWeight: 700, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: disclaimerChecked && !loading && !aiProcessing ? 'pointer' : 'not-allowed', transition: 'background 0.2s, transform 0.15s', fontFamily: 'inherit', boxShadow: disclaimerChecked && !loading && !aiProcessing ? '0 6px 24px rgba(154,68,45,0.32)' : 'none' }}
                onMouseEnter={e => { if (disclaimerChecked && !loading && !aiProcessing) e.currentTarget.style.opacity = '0.92' }}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>volunteer_activism</span>
                {loading ? t('common.loading') : editMode ? t('donation.saveButton', 'Save listing changes') : t('donation.postButton')}
              </button>
              <p style={{ textAlign: 'center', fontSize: 12, color: '#bfc9c1', marginTop: 12 }}>{t('common.secure')}</p>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

export default DonationForm
