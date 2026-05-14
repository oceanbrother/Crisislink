import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  generateDonorCode,
  generateOrgCode,
  isSafeCode,
  getStoredDonorCode,
  getStoredOrgCode,
  storeDonorCode,
  storeOrgCode,
} from '../utils/codeGeneration'
import { registerUser } from '../services/api'
import '../styles/RegisterPage.css'

// Strip anything that is not a safe text character to prevent injection.
// Allows letters, digits, spaces, commas, hyphens, slashes, dots, apostrophes.
const sanitiseText = (v) => v.replace(/[<>"'`;]/g, '').slice(0, 500)

// Strips non-alphanumeric/hyphen characters from manually entered codes.
const sanitiseCodeInput = (v) =>
  v.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20)

const DISTANCE_OPTIONS = [5, 10, 20, 30, 50, 100]

const RegisterPage = () => {
  const { role } = useParams()   // 'donor' | 'org'
  const navigate  = useNavigate()
  const isDonor   = role === 'donor'

  // ── Step state ─────────────────────────────────────────────────────────────
  // 'form'  → fill in details
  // 'code'  → show generated / existing code + confirm
  const [step, setStep] = useState('form')

  // ── Form fields ────────────────────────────────────────────────────────────
  const [orgName,          setOrgName]          = useState('')
  const [businessAddress,  setBusinessAddress]  = useState('')
  const [preferredLocation, setPreferredLocation] = useState('')   // donor
  const [maxDistance,      setMaxDistance]      = useState('')     // org (km)
  const [formError,        setFormError]        = useState('')

  // ── Code step state ────────────────────────────────────────────────────────
  // 'generate' = auto-generated new code | 'existing' = user-typed (org only)
  const [codeMode,       setCodeMode]       = useState('generate')
  const [generatedCode,  setGeneratedCode]  = useState('')
  const [existingInput,  setExistingInput]  = useState('')
  const [copied,         setCopied]         = useState(false)
  const [submitLoading,  setSubmitLoading]  = useState(false)
  const [submitError,    setSubmitError]    = useState('')

  useEffect(() => {
    if (role !== 'donor' && role !== 'org') {
      navigate('/', { replace: true })
      return
    }
    // If a code already exists in localStorage pre-fill the code step
    const stored = isDonor ? getStoredDonorCode() : getStoredOrgCode()
    setGeneratedCode(stored ?? (isDonor ? generateDonorCode() : generateOrgCode()))
  }, [role, isDonor, navigate])

  // ── Form step handlers ─────────────────────────────────────────────────────

  const handleFormContinue = () => {
    setFormError('')
    if (!orgName.trim()) {
      setFormError('Organisation name is required.')
      return
    }
    if (isDonor && !preferredLocation.trim()) {
      setFormError('Preferred drop-off location is required.')
      return
    }
    if (!isDonor && !maxDistance) {
      setFormError('Please select a maximum pickup distance.')
      return
    }
    setStep('code')
  }

  // ── Code step handlers ─────────────────────────────────────────────────────

  const handleRegenerate = useCallback(() => {
    setGeneratedCode(isDonor ? generateDonorCode() : generateOrgCode())
    setCopied(false)
    setSubmitError('')
  }, [isDonor])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generatedCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API blocked in non-HTTPS dev env — silent fallback
    }
  }, [generatedCode])

  const handleExistingInput = (e) => {
    setExistingInput(sanitiseCodeInput(e.target.value))
    setSubmitError('')
  }

  const handleConfirm = async () => {
    if (submitLoading) return

    const code = codeMode === 'existing' ? existingInput : generatedCode

    if (!code) {
      setSubmitError('Please generate or enter a code to continue.')
      return
    }
    if (!isSafeCode(code)) {
      setSubmitError('Code may only contain uppercase letters, digits, and hyphens.')
      return
    }

    // Existing-code path: skip /register — org record will be created lazily
    // the first time this code interacts with a listing.
    if (codeMode === 'existing') {
      storeOrgCode(code)
      navigate('/org/dashboard', { state: { orgCode: code } })
      return
    }

    setSubmitLoading(true)
    setSubmitError('')

    try {
      const orgType = isDonor ? 'donor' : 'community_org'
      await registerUser({
        orgType,
        orgCode:             code,
        orgName:             orgName.trim(),
        businessAddress:     businessAddress.trim() || null,
        preferredLocation:   isDonor  ? preferredLocation.trim() || null : null,
        maxPickupDistanceKm: !isDonor ? Number(maxDistance) || null      : null,
      })

      if (isDonor) {
        storeDonorCode(code)
        navigate('/postcode')
      } else {
        storeOrgCode(code)
        navigate('/org/dashboard', { state: { orgCode: code } })
      }
    } catch (err) {
      const status = err?.response?.status
      if (status === 422) {
        setSubmitError('This code format is not valid. Please generate a new code.')
      } else if (status === 429) {
        setSubmitError('Too many attempts. Please wait a moment and try again.')
      } else {
        setSubmitError('Registration failed. Please try again.')
      }
    } finally {
      setSubmitLoading(false)
    }
  }

  if (role !== 'donor' && role !== 'org') return null

  const icon  = isDonor ? 'bakery_dining' : 'corporate_fare'
  const color = isDonor ? 'donor' : 'org'

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="register-page">
      <button
        className="back-link"
        onClick={() => step === 'code' ? setStep('form') : navigate('/')}
        aria-label={step === 'code' ? 'Back to form' : 'Back to home'}
      >
        <span className="material-symbols-outlined">arrow_back</span>
      </button>

      <main className="register-main">
        <div className="register-card">

          {/* Icon + brand */}
          <div className={`register-icon-circle ${color}`}>
            <span className="material-symbols-outlined">{icon}</span>
          </div>
          <div className="register-brand">OutBackShare</div>

          {/* ── STEP 1: Form ───────────────────────────────────────── */}
          {step === 'form' && (
            <>
              <h1 className="register-title">
                {isDonor ? 'Donor Registration' : 'Organisation Registration'}
              </h1>
              <p className="register-desc">
                {isDonor
                  ? 'Tell us a bit about your business before we generate your donor code.'
                  : 'Tell us about your organisation before we generate your access code.'}
              </p>

              <div className="register-form">

                {/* Organisation name */}
                <div className="field-group">
                  <label className="field-label" htmlFor="orgName">
                    Organisation Name <span className="required">*</span>
                  </label>
                  <input
                    id="orgName"
                    className="field-input"
                    type="text"
                    value={orgName}
                    onChange={e => setOrgName(sanitiseText(e.target.value))}
                    placeholder={isDonor ? 'e.g. Sunshine Bakery' : 'e.g. Harbour Community Food Bank'}
                    maxLength={255}
                    autoComplete="organization"
                  />
                </div>

                {/* Business address */}
                <div className="field-group">
                  <label className="field-label" htmlFor="businessAddress">
                    Business Address
                  </label>
                  <input
                    id="businessAddress"
                    className="field-input"
                    type="text"
                    value={businessAddress}
                    onChange={e => setBusinessAddress(sanitiseText(e.target.value))}
                    placeholder="e.g. 42 Main Street, Melbourne VIC 3000"
                    maxLength={500}
                    autoComplete="street-address"
                  />
                </div>

                {/* Donor: preferred drop-off location */}
                {isDonor && (
                  <div className="field-group">
                    <label className="field-label" htmlFor="preferredLocation">
                      Preferred Drop-off Location <span className="required">*</span>
                    </label>
                    <input
                      id="preferredLocation"
                      className="field-input"
                      type="text"
                      value={preferredLocation}
                      onChange={e => setPreferredLocation(sanitiseText(e.target.value))}
                      placeholder="e.g. Fitzroy Community Centre, 123 Smith St"
                      maxLength={500}
                    />
                    <span className="field-hint">
                      Where recipients can collect food from your business.
                    </span>
                  </div>
                )}

                {/* Org: max pickup distance */}
                {!isDonor && (
                  <div className="field-group">
                    <label className="field-label" htmlFor="maxDistance">
                      Maximum Pickup Distance <span className="required">*</span>
                    </label>
                    <div className="select-wrapper">
                      <select
                        id="maxDistance"
                        className="field-select"
                        value={maxDistance}
                        onChange={e => setMaxDistance(e.target.value)}
                      >
                        <option value="" disabled>Select distance…</option>
                        {DISTANCE_OPTIONS.map(d => (
                          <option key={d} value={d}>{d} km</option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined select-arrow">expand_more</span>
                    </div>
                    <span className="field-hint">
                      Furthest distance your organisation can travel to collect food.
                    </span>
                  </div>
                )}

                {formError && (
                  <div className="error-message" role="alert" aria-live="assertive">
                    {formError}
                  </div>
                )}

                <button
                  type="button"
                  className="submit-btn"
                  onClick={handleFormContinue}
                >
                  Continue →
                </button>

                <p className="privacy-note">
                  Your information is stored securely and used only to match food
                  donations within the OutBackShare network.
                </p>
              </div>
            </>
          )}

          {/* ── STEP 2: Code display ───────────────────────────────── */}
          {step === 'code' && (
            <>
              <h1 className="register-title">
                {isDonor ? 'Your Donor Code' : 'Your Organisation Code'}
              </h1>
              <p className="register-desc">
                {isDonor
                  ? 'Save this code — you will need it to post food listings.'
                  : "Keep this code safe and share it only with your team."}
              </p>

              {/* Mode tabs — org only */}
              {!isDonor && (
                <div className="register-mode-tabs" role="tablist">
                  <button
                    role="tab"
                    aria-selected={codeMode === 'generate'}
                    className={`mode-tab ${codeMode === 'generate' ? 'active' : ''}`}
                    onClick={() => { setCodeMode('generate'); setSubmitError('') }}
                    type="button"
                  >
                    New code
                  </button>
                  <button
                    role="tab"
                    aria-selected={codeMode === 'existing'}
                    className={`mode-tab ${codeMode === 'existing' ? 'active' : ''}`}
                    onClick={() => { setCodeMode('existing'); setSubmitError('') }}
                    type="button"
                  >
                    I have a code
                  </button>
                </div>
              )}

              {/* Generated code */}
              {codeMode === 'generate' && (
                <>
                  <div
                    className={`code-display-box ${color}`}
                    aria-label={`Your unique code: ${generatedCode}`}
                    aria-live="polite"
                  >
                    <span className="code-display-text">{generatedCode}</span>
                  </div>

                  <div className="code-actions">
                    <button type="button" className="btn-copy" onClick={handleCopy}
                      aria-label="Copy code to clipboard">
                      <span className="material-symbols-outlined">
                        {copied ? 'check' : 'content_copy'}
                      </span>
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button type="button" className="btn-regenerate" onClick={handleRegenerate}
                      aria-label="Generate a different code">
                      <span className="material-symbols-outlined">refresh</span>
                      New code
                    </button>
                  </div>
                </>
              )}

              {/* Existing code input — org only */}
              {codeMode === 'existing' && (
                <input
                  className="org-code-input"
                  type="text"
                  value={existingInput}
                  onChange={handleExistingInput}
                  placeholder="e.g. HCFB-2841"
                  maxLength={20}
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Enter your existing organisation code"
                />
              )}

              {submitError && (
                <div className="error-message" role="alert" aria-live="assertive">
                  {submitError}
                </div>
              )}

              <button
                type="button"
                className="submit-btn"
                onClick={handleConfirm}
                disabled={submitLoading || (codeMode === 'existing' && !existingInput)}
              >
                {submitLoading ? 'Setting up…' : 'Start using OutBackShare →'}
              </button>

              <p className="privacy-note">
                Your code is stored on this device only and is used solely to
                identify your contributions within the app.
              </p>
            </>
          )}

        </div>
      </main>
    </div>
  )
}

export default RegisterPage
