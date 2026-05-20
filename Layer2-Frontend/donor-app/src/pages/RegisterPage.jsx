import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  generateDonorCode,
  generateOrgCode,
  isSafeCode,
  isNewDonorCode,
  isNewOrgCode,
  getStoredDonorCode,
  getStoredOrgCode,
  storeDonorCode,
  storeOrgCode,
  storeDonorName,
  storeOrgName,
} from '../utils/codeGeneration'
import { registerUser, checkCodeAvailability } from '../services/api'
import logoUrl from '../assets/outbackshare-logo.png'
import donorBgImg from '../assets/Gemini_Generated_Image_9mucwo9mucwo9muc.png'

// strip HTML-sensitive characters and trim to safe length
const sanitiseText      = (v) => v.replace(/[<>"'`;]/g, '').slice(0, 500)

// uppercase and strip non-alphanumeric/dash characters from code input
const sanitiseCodeInput = (v) => v.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20)
const DISTANCE_OPTIONS  = [5, 10, 20, 30, 50, 100]

const ORG_TYPES = [
  'Food Bank',
  'Community Pantry',
  'Soup Kitchen',
  'Volunteer Food Group',
  'School / Early Childhood',
  'Aged Care Facility',
  'Emergency Relief Centre',
  'Other',
]

/* shared input/button base styles — referenced inline */
const INPUT_BASE = {
  width: '100%', padding: '16px 20px', borderRadius: '14px',
  border: '1.5px solid #e2e3e0', fontSize: '16px', color: '#1a1c1b',
  background: '#fff', outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.15s, box-shadow 0.15s',
}
const LABEL_BASE = {
  display: 'block', fontSize: '13px', fontWeight: 700,
  letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280', marginBottom: '10px',
}
const HELPER_BASE = { fontSize: '13px', color: '#9ca3af', marginTop: '7px', lineHeight: 1.5 }

// return a filled primary button style for the given accent colour
const BTN_PRIMARY = (accent) => ({
  width: '100%', padding: '17px 24px', borderRadius: '14px', border: 'none',
  cursor: 'pointer', background: accent, color: '#fff', fontSize: '16px',
  fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
  gap: '10px', transition: 'opacity 0.15s',
})

// return an outline button style for the given accent colour
const BTN_OUTLINE = (accent, accentPale) => ({
  width: '100%', padding: '17px 24px', borderRadius: '14px',
  border: `1.5px solid ${accentPale}`, cursor: 'pointer',
  background: accentPale, color: accent, fontSize: '16px', fontWeight: 700,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
})

// Donor left hero panel with background image and feature list
function DonorHeroPanel() {
  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${donorBgImg})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(6,18,10,0.91) 0%, rgba(6,18,10,0.72) 55%, rgba(6,18,10,0.45) 100%)' }} />

      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', height: '100%', padding: '48px 52px' }}>
        <img src={logoUrl} alt="OutBackShare" style={{ height: '36px', width: 'auto', objectFit: 'contain', alignSelf: 'flex-start', filter: 'brightness(0) invert(1)', opacity: 0.95, marginBottom: 'auto' }} />

        <div style={{ paddingTop: '60px' }}>
          <span style={{
            display: 'inline-block', marginBottom: '28px', padding: '8px 20px',
            background: 'rgba(177,240,206,0.14)', border: '1px solid rgba(177,240,206,0.35)',
            borderRadius: '999px', color: '#b1f0ce', fontSize: '13px', fontWeight: 700,
            letterSpacing: '0.18em', textTransform: 'uppercase'
          }}>Join Our Community</span>

          <h2 style={{
            fontSize: 'clamp(36px, 4.5vw, 58px)', fontWeight: 900, color: '#fff',
            lineHeight: 1.08, letterSpacing: '-0.035em', marginBottom: '24px',
            textShadow: '0 3px 24px rgba(0,0,0,0.5)'
          }}>
            Your surplus<br />feeds Victoria's<br />
            <span style={{ color: '#95d4b3' }}>families.</span>
          </h2>

          <p style={{
            fontSize: '18px', color: 'rgba(255,255,255,0.82)', lineHeight: 1.72,
            maxWidth: '360px', marginBottom: '44px', textShadow: '0 1px 8px rgba(0,0,0,0.3)'
          }}>
            Cafes, bakeries, and local businesses post their end-of-day surplus in seconds.
            No waste. No admin. Just food where it is needed most.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {[
              { icon: 'bolt',         text: 'Post a listing in under 60 seconds' },
              { icon: 'location_on',  text: 'Community groups collect from your door' },
              { icon: 'shield',       text: 'No personal information collected — ever' },
              { icon: 'group',        text: 'Join 84+ towns already sharing across Victoria' },
            ].map(item => (
              <div key={item.icon} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(177,240,206,0.14)', border: '1px solid rgba(177,240,206,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#b1f0ce' }}>{item.icon}</span>
                </div>
                <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.8)', fontWeight: 500, lineHeight: 1.4 }}>{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Org left panel showing Sarah's coordinator pain points
function OrgStoryPanel() {
  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(160deg, #0d2b1a 0%, #152e1e 50%, #0f3d20 100%)' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(177,240,206,0.055) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', height: '100%', padding: '48px 52px' }}>
        <img src={logoUrl} alt="OutBackShare" style={{ height: '36px', width: 'auto', objectFit: 'contain', alignSelf: 'flex-start', filter: 'brightness(0) invert(1)', opacity: 0.9, marginBottom: 'auto' }} />

        <div style={{ paddingTop: '60px' }}>
          <span style={{
            display: 'inline-block', marginBottom: '28px', padding: '8px 20px',
            background: 'rgba(154,68,45,0.22)', border: '1px solid rgba(154,68,45,0.38)',
            borderRadius: '999px', color: '#ffb4a1', fontSize: '13px', fontWeight: 700,
            letterSpacing: '0.18em', textTransform: 'uppercase'
          }}>The Challenge</span>

          <span className="material-symbols-outlined" style={{ fontSize: '44px', color: 'rgba(177,240,206,0.22)', display: 'block', marginBottom: '14px' }}>format_quote</span>
          <blockquote style={{
            fontSize: 'clamp(20px, 2.6vw, 27px)', fontWeight: 700, color: '#fff',
            lineHeight: 1.38, letterSpacing: '-0.02em', fontStyle: 'italic',
            borderLeft: '3px solid rgba(177,240,206,0.38)', paddingLeft: '22px',
            marginBottom: '28px'
          }}>
            "I spend half my day on the phone just trying to find out who has extra food.
            I need to see everything in one place so I can plan better."
          </blockquote>

          {/* Persona chip */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '36px',
            padding: '16px 20px', background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)', borderRadius: '14px'
          }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '9999px', background: 'rgba(177,240,206,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#b1f0ce' }}>person</span>
            </div>
            <div>
              <p style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: '3px' }}>Sarah, 38 &mdash; Bendigo</p>
              <p style={{ fontSize: '13px', color: 'rgba(177,240,206,0.65)' }}>Food Relief Coordinator, volunteer-run pantry</p>
            </div>
          </div>

          {/* Pain points list */}
          <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.38)', marginBottom: '18px' }}>
            What she faces every week
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '36px' }}>
            {[
              { icon: 'phone_disabled',  text: 'Hours lost chasing food availability by phone' },
              { icon: 'no_food',         text: 'Surprise donations she cannot store or use' },
              { icon: 'directions_car',  text: 'Wasted trips for food already taken by others' },
              { icon: 'group_off',       text: 'Nearby orgs with surplus she never knew existed' },
            ].map(p => (
              <div key={p.icon} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(154,68,45,0.18)', border: '1px solid rgba(154,68,45,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#ffb4a1' }}>{p.icon}</span>
                </div>
                <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.72)', lineHeight: 1.5 }}>{p.text}</p>
              </div>
            ))}
          </div>

          {/* Bridge message */}
          <div style={{ padding: '18px 22px', background: 'rgba(177,240,206,0.07)', border: '1px solid rgba(177,240,206,0.18)', borderRadius: '14px' }}>
            <p style={{ fontSize: '15px', fontWeight: 700, color: '#b1f0ce', marginBottom: '6px' }}>
              For coordinators like Sarah &mdash; and the thousands facing these same challenges every week.
            </p>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.58)', lineHeight: 1.65 }}>
              Real-time listings, smart alerts, and one shared view of what's available near you.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Main registration and sign-in component
const RegisterPage = () => {
  const { role } = useParams()
  const navigate  = useNavigate()
  const isDonor   = role === 'donor'

  const [step, setStep] = useState('signin')

  const [orgName,           setOrgName]           = useState('')
  const [businessAddress,   setBusinessAddress]   = useState('')
  const [preferredLocation, setPreferredLocation] = useState('')
  const [maxDistance,       setMaxDistance]       = useState('')
  const [orgTypeSelect,     setOrgTypeSelect]     = useState('')
  const [formError,         setFormError]         = useState('')

  const [codeMode,      setCodeMode]      = useState('generate')
  const [generatedCode, setGeneratedCode] = useState('')
  const [existingInput, setExistingInput] = useState('')
  const [copied,        setCopied]        = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError,   setSubmitError]   = useState('')

  // redirect invalid roles and pre-fill any stored code
  useEffect(() => {
    if (role !== 'donor' && role !== 'org') { navigate('/', { replace: true }); return }
    const stored = isDonor ? getStoredDonorCode() : getStoredOrgCode()
    if (stored) setExistingInput(stored)
    setStep('signin')
  }, [role, isDonor, navigate])

  // verify an existing code and navigate to the correct workspace
  const handleSignIn = async () => {
    setSubmitError('')
    const code = existingInput.trim()
    if (!code) { setSubmitError('Please enter your access code.'); return }
    const isValidFormat = isDonor ? isNewDonorCode(code) : isNewOrgCode(code)
    if (!isValidFormat) {
      setSubmitError(isDonor ? 'Donor codes must be in the format DNR-XXXXXX.' : 'Partner codes must be in the format CBO-XXX-1234.')
      return
    }
    setSubmitLoading(true)
    try {
      const { available } = await checkCodeAvailability(code)
      if (available) { setSubmitError('Code not found. Check your code and try again.'); return }
      if (isDonor) { storeDonorCode(code); navigate('/postcode') }
      else { storeOrgCode(code); navigate('/org/listings', { state: { orgCode: code } }) }
    } catch {
      setSubmitError('Could not verify your code. Please try again.')
    } finally {
      setSubmitLoading(false)
    }
  }

  // validate the registration form fields before proceeding to the code step
  const handleFormContinue = () => {
    setFormError('')
    if (!orgName.trim()) { setFormError(isDonor ? 'Business name is required.' : 'Organisation name is required.'); return }
    if (isDonor && !businessAddress.trim()) { setFormError('Public business address is required.'); return }
    if (isDonor && !preferredLocation.trim()) { setFormError('Preferred drop-off location is required.'); return }
    if (!isDonor && !maxDistance) { setFormError('Please select a maximum pickup distance.'); return }
    setGeneratedCode(''); setCodeMode('generate'); setSubmitError(''); setStep('code')
  }

  // generate a new random code for the current role
  const handleGenerateCode = useCallback(() => {
    setGeneratedCode(isDonor ? generateDonorCode() : generateOrgCode())
    setCopied(false); setSubmitError('')
  }, [isDonor])

  // copy the generated code to clipboard and show brief confirmation
  const handleCopy = useCallback(async () => {
    if (!generatedCode) return
    try { await navigator.clipboard.writeText(generatedCode); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { /* silent */ }
  }, [generatedCode])

  // sanitise code input and clear any previous error
  const handleExistingInputChange = (e) => { setExistingInput(sanitiseCodeInput(e.target.value)); setSubmitError('') }

  // confirm the chosen code, check availability, register if new, and navigate
  const handleConfirm = async () => {
    if (submitLoading) return
    const code = codeMode === 'existing' ? existingInput : generatedCode
    if (!code) { setSubmitError(codeMode === 'generate' ? 'Please generate a code first.' : 'Please enter your access code.'); return }
    if (!isSafeCode(code)) { setSubmitError('Invalid code format.'); return }
    if (codeMode === 'existing') {
      const isValidFormat = isDonor ? isNewDonorCode(code) : isNewOrgCode(code)
      if (!isValidFormat) {
        setSubmitError(isDonor ? 'Donor codes must be in the format DNR-XXXXXX.' : 'Partner codes must be in the format CBO-XXX-1234.')
        setSubmitLoading(false)
        return
      }
      try {
        const { available } = await checkCodeAvailability(code)
        if (available) { setSubmitError('Code not found. Check your code and try again.'); return }
        if (isDonor) { storeDonorCode(code); navigate('/postcode') }
        else { storeOrgCode(code); navigate('/org/listings', { state: { orgCode: code } }) }
      } catch {
        setSubmitError('Could not verify your code. Please try again.')
      } finally {
        setSubmitLoading(false)
      }
      return
    }
    setSubmitLoading(true); setSubmitError('')
    try {
      try {
        const { available } = await checkCodeAvailability(code)
        if (!available) { setGeneratedCode(''); setSubmitError('That code is taken. Please generate a new one.'); setSubmitLoading(false); return }
      } catch { /* best-effort */ }
      await registerUser({
        orgType: isDonor ? 'donor' : 'community_org', orgCode: code,
        orgName: orgName.trim(), businessAddress: businessAddress.trim() || null,
        preferredLocation: isDonor ? preferredLocation.trim() || null : null,
        maxPickupDistanceKm: !isDonor ? Number(maxDistance) || null : null,
      })
      if (isDonor) { storeDonorCode(code); storeDonorName(orgName.trim()); navigate('/postcode') }
      else { storeOrgCode(code); storeOrgName(orgName.trim()); navigate('/org/listings', { state: { orgCode: code, orgName: orgName.trim() } }) }
    } catch (err) {
      const status = err?.response?.status
      setSubmitError(status === 429 ? 'Too many attempts. Please wait.' : 'Registration failed. Please try again.')
    } finally { setSubmitLoading(false) }
  }

  if (role !== 'donor' && role !== 'org') return null

  const accent      = isDonor ? '#9a442d' : '#0f5238'
  const accentPale  = isDonor ? '#ffdbd2' : '#b1f0ce'
  const accentLight = isDonor ? '#fc9174' : '#52b788'

  // apply focus ring style matching the accent colour
  const focusStyle = (e) => { e.target.style.borderColor = accent; e.target.style.boxShadow = `0 0 0 3px ${accentPale}66` }

  // remove focus ring on blur
  const blurStyle  = (e) => { e.target.style.borderColor = '#e2e3e0'; e.target.style.boxShadow = 'none' }

  // navigate backwards through the multi-step form
  const backStep = () => {
    if (step === 'form') { setStep('signin'); setFormError('') }
    else if (step === 'code') { setStep('form'); setSubmitError('') }
    else navigate('/')
  }

  const stepMeta = {
    signin: {
      icon: isDonor ? 'storefront'     : 'corporate_fare',
      title: isDonor ? 'Donor Workspace'        : 'Partner Workspace',
      sub:   'Enter your access code, or register for the first time.',
    },
    form: {
      icon: isDonor ? 'edit_note'      : 'domain_add',
      title: isDonor ? 'Register Your Business' : 'Register Your Organisation',
      sub:  isDonor
        ? 'Tell us about your business so food groups can find and collect from you.'
        : 'Help us understand your organisation so we can match the right donations.',
    },
    code: {
      icon: isDonor ? 'key'            : 'lock',
      title: isDonor ? 'Your Donor Code'        : 'Your Partner Code',
      sub:  isDonor
        ? 'Save this code — it is your key to the donor dashboard.'
        : 'Keep this code safe and share it only with your team.',
    },
  }[step]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Left hero/story panel */}
      <div className="hidden lg:block" style={{ width: '42%', flexShrink: 0, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>
        {isDonor ? <DonorHeroPanel /> : <OrgStoryPanel />}
      </div>

      {/* Right form panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f9f9f6', overflowY: 'auto', minHeight: '100vh' }}>

        {/* Top navigation strip */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 40, height: '64px',
          display: 'flex', alignItems: 'center', padding: '0 48px',
          background: 'rgba(249,249,246,0.94)', backdropFilter: 'blur(14px)',
          borderBottom: '1px solid #e2e3e0'
        }}>
          <button onClick={backStep} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '15px', fontWeight: 600 }}>
            <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>arrow_back</span>
            Back
          </button>
          <button onClick={() => navigate('/')} className="lg:hidden" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <img src={logoUrl} alt="OutBackShare" style={{ height: '28px', width: 'auto' }} />
          </button>
        </div>

        {/* Form body */}
        <div style={{ flex: 1, padding: '52px 64px 72px', display: 'flex', flexDirection: 'column' }}>

          {/* Step icon and heading */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', marginBottom: '40px' }}>
            <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: accentPale, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span className="material-symbols-outlined" style={{ fontSize: '34px', color: accent }}>{stepMeta.icon}</span>
            </div>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#1a1c1b', letterSpacing: '-0.025em', marginBottom: '8px', lineHeight: 1.2 }}>{stepMeta.title}</h1>
              <p style={{ fontSize: '16px', color: '#6b7280', lineHeight: 1.6, maxWidth: '44ch' }}>{stepMeta.sub}</p>
            </div>
          </div>

          {/* Sign in step */}
          {step === 'signin' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

              {/* Returning user block */}
              <div style={{ padding: '28px', background: '#fff', borderRadius: '18px', border: '1.5px solid #e2e3e0' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280', marginBottom: '6px' }}>Returning {isDonor ? 'Donor' : 'Partner'}?</p>
                <p style={{ fontSize: '15px', color: '#4b5563', lineHeight: 1.6, marginBottom: '20px' }}>
                  Use the unique access code generated when your {isDonor ? 'business' : 'organisation'} first registered.
                  It lives on your device — no email or password needed.
                </p>
                <label style={LABEL_BASE}>Your Access Code</label>
                <input
                  type="text" value={existingInput} onChange={handleExistingInputChange}
                  onKeyDown={e => e.key === 'Enter' && handleSignIn()}
                  onFocus={focusStyle} onBlur={blurStyle}
                  placeholder={isDonor ? 'e.g. DNR-ABCDEF' : 'e.g. CBO-ABC-1234'}
                  maxLength={20} autoComplete="off" spellCheck={false}
                  style={{ ...INPUT_BASE, marginBottom: '8px' }}
                />
                <p style={HELPER_BASE}>Stored on this device only — we collect no personal data.</p>

                {submitError && <div style={{ fontSize: '14px', padding: '14px 18px', borderRadius: '12px', background: '#fbe2e5', color: '#9b1e28', marginTop: '12px' }} role="alert">{submitError}</div>}

                <button onClick={handleSignIn} disabled={submitLoading}
                  style={{ ...BTN_PRIMARY(accent), marginTop: '20px', opacity: submitLoading ? 0.55 : 1, cursor: submitLoading ? 'not-allowed' : 'pointer' }}
                  onMouseEnter={e => { if (!submitLoading) e.currentTarget.style.opacity = '0.88' }}
                  onMouseLeave={e => { if (!submitLoading) e.currentTarget.style.opacity = '1' }}
                >
                  {submitLoading
                    ? <><span className="material-symbols-outlined" style={{ fontSize: '20px' }}>progress_activity</span> Checking...</>
                    : <>Sign in <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_forward</span></>
                  }
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ flex: 1, height: '1px', background: '#e2e3e0' }} />
                <span style={{ fontSize: '13px', color: '#9ca3af' }}>First time here?</span>
                <div style={{ flex: 1, height: '1px', background: '#e2e3e0' }} />
              </div>

              {/* New user registration block */}
              <div style={{ padding: '28px', background: `${accentPale}33`, borderRadius: '18px', border: `1.5px solid ${accentPale}` }}>
                <p style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: accent, marginBottom: '6px' }}>
                  {isDonor ? 'Register Your Business' : 'Register Your Organisation'}
                </p>
                <p style={{ fontSize: '15px', color: '#4b5563', lineHeight: 1.6, marginBottom: '20px' }}>
                  {isDonor
                    ? 'Setting up takes under 2 minutes. We only need your business name and address — no email, no password, no personal data collected.'
                    : 'Join in under 2 minutes. We only need your organisation name and service area to start matching you with nearby donors.'}
                </p>
                <button onClick={() => { setSubmitError(''); setExistingInput(''); setStep('form') }}
                  style={BTN_OUTLINE(accent, accentPale)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>person_add</span>
                  {isDonor ? 'Register your business' : 'Register your organisation'}
                </button>
              </div>

              {/* Trust strip */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', paddingTop: '8px' }}>
                {[
                  { icon: 'shield', text: 'No personal data' },
                  { icon: 'bolt',   text: '2-min setup' },
                  { icon: 'group',  text: '84+ towns active' },
                ].map(item => (
                  <div key={item.icon} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '22px', color: accent }}>{item.icon}</span>
                    <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 600 }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Form step */}
          {step === 'form' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

              {/* Privacy notice */}
              <div style={{ padding: '22px 26px', background: `${accentPale}28`, borderRadius: '16px', border: `1px solid ${accentPale}` }}>
                <p style={{ fontSize: '15px', color: '#374151', lineHeight: 1.65 }}>
                  {isDonor
                    ? 'We only collect what is needed to connect you with the right community groups — your business name, where you operate, and where food can be collected from.'
                    : 'We use these details to match your organisation with nearby donors and ensure listings reach you at the right time. No personal information is stored.'}
                </p>
              </div>

              {/* Business or org name field */}
              <div>
                <p style={{ fontSize: '15px', color: '#374151', lineHeight: 1.6, marginBottom: '14px' }}>
                  {isDonor
                    ? 'Start with the trading name of your business — the name your customers and local community already know.'
                    : 'Enter the name your organisation uses publicly so donors can identify who is collecting their surplus.'}
                </p>
                <label style={LABEL_BASE}>
                  {isDonor ? 'Business Name' : 'Organisation Name'}{' '}
                  <span style={{ color: accent }}>*</span>
                </label>
                <input
                  type="text" value={orgName}
                  onChange={e => setOrgName(sanitiseText(e.target.value))}
                  onFocus={focusStyle} onBlur={blurStyle}
                  placeholder={isDonor ? 'e.g. Sunrise Bakery, The Corner Cafe' : 'e.g. Bendigo Community Food Pantry'}
                  maxLength={255} autoComplete="organization"
                  style={INPUT_BASE}
                />
                <p style={HELPER_BASE}>
                  {isDonor ? 'The trading name your customers know.' : 'Your pantry, food bank, or relief service name.'}
                </p>
              </div>

              {/* Org type selector — shown only for organisations */}
              {!isDonor && (
                <div>
                  <p style={{ fontSize: '15px', color: '#374151', lineHeight: 1.6, marginBottom: '14px' }}>
                    Selecting your organisation type helps donors understand who receives their surplus and how it is used.
                  </p>
                  <label style={LABEL_BASE}>Organisation Type</label>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={orgTypeSelect} onChange={e => setOrgTypeSelect(e.target.value)}
                      onFocus={focusStyle} onBlur={blurStyle}
                      style={{ ...INPUT_BASE, paddingRight: '44px', appearance: 'none', cursor: 'pointer', color: orgTypeSelect ? '#1a1c1b' : '#9ca3af' }}
                    >
                      <option value="" disabled>Select type...</option>
                      {ORG_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <span className="material-symbols-outlined" style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '22px', color: '#9ca3af', pointerEvents: 'none' }}>expand_more</span>
                  </div>
                </div>
              )}

              {/* Address field */}
              <div>
                <p style={{ fontSize: '15px', color: '#374151', lineHeight: 1.6, marginBottom: '14px' }}>
                  {isDonor
                    ? 'This is the street address community groups will use to find and collect food from you. It is visible to verified organisations in the network only.'
                    : 'Your operating address helps us calculate distances and match you with the nearest available donations.'}
                </p>
                <label style={LABEL_BASE}>
                  {isDonor ? 'Public Business Address' : 'Service Address'}
                  {isDonor && <span style={{ color: accent }}> *</span>}
                </label>
                <input
                  type="text" value={businessAddress}
                  onChange={e => setBusinessAddress(sanitiseText(e.target.value))}
                  onFocus={focusStyle} onBlur={blurStyle}
                  placeholder={isDonor ? 'e.g. 14 Baker Street, Fitzroy VIC 3065' : 'e.g. 12 Church St, Bendigo VIC 3550'}
                  maxLength={500} autoComplete="street-address"
                  style={INPUT_BASE}
                />
                <p style={HELPER_BASE}>
                  {isDonor
                    ? 'The physical address where food groups can verify and collect from you.'
                    : 'Where your organisation operates from. Used to match you with nearby donors.'}
                </p>
              </div>

              {/* Preferred drop-off — shown only for donors */}
              {isDonor && (
                <div>
                  <p style={{ fontSize: '15px', color: '#374151', lineHeight: 1.6, marginBottom: '14px' }}>
                    Let us know where recipients should collect donations from. This can be your front counter, a loading bay, or a nearby community drop point.
                  </p>
                  <label style={LABEL_BASE}>
                    Preferred Drop-off Location <span style={{ color: accent }}>*</span>
                  </label>
                  <input
                    type="text" value={preferredLocation}
                    onChange={e => setPreferredLocation(sanitiseText(e.target.value))}
                    onFocus={focusStyle} onBlur={blurStyle}
                    placeholder="e.g. Fitzroy Community Centre, 123 Smith St"
                    maxLength={500}
                    style={INPUT_BASE}
                  />
                  <p style={HELPER_BASE}>Where recipients should collect donations from your business.</p>
                </div>
              )}

              {/* Max pickup distance — shown only for organisations */}
              {!isDonor && (
                <div>
                  <p style={{ fontSize: '15px', color: '#374151', lineHeight: 1.6, marginBottom: '14px' }}>
                    This helps us filter listings to only show donations your team can realistically collect — saving you time and wasted trips.
                  </p>
                  <label style={LABEL_BASE}>
                    Max Pickup Distance <span style={{ color: accent }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={maxDistance} onChange={e => setMaxDistance(e.target.value)}
                      onFocus={focusStyle} onBlur={blurStyle}
                      style={{ ...INPUT_BASE, paddingRight: '44px', appearance: 'none', cursor: 'pointer', color: maxDistance ? '#1a1c1b' : '#9ca3af' }}
                    >
                      <option value="" disabled>How far can you travel to collect?</option>
                      {DISTANCE_OPTIONS.map(d => <option key={d} value={d}>Up to {d} km</option>)}
                    </select>
                    <span className="material-symbols-outlined" style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '22px', color: '#9ca3af', pointerEvents: 'none' }}>expand_more</span>
                  </div>
                  <p style={HELPER_BASE}>Furthest your team can travel to collect a donation.</p>
                </div>
              )}

              {formError && <div style={{ fontSize: '14px', padding: '14px 18px', borderRadius: '12px', background: '#fbe2e5', color: '#9b1e28' }} role="alert">{formError}</div>}

              <button onClick={handleFormContinue} style={{ ...BTN_PRIMARY(accent), marginTop: '4px' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                Continue <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_forward</span>
              </button>

              <p style={{ textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>
                No personal information is stored. Details are used only to match donations within the network.
              </p>
            </div>
          )}

          {/* Code step */}
          {step === 'code' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

              {/* Code explanation */}
              <div style={{ padding: '22px 26px', background: `${accentPale}28`, borderRadius: '16px', border: `1px solid ${accentPale}` }}>
                <p style={{ fontSize: '15px', color: '#374151', lineHeight: 1.65 }}>
                  Your access code is a short unique identifier that links to your {isDonor ? 'business' : 'organisation'} within the OutBackShare network.
                  There are no passwords. Anyone on your team who has this code can sign in and manage {isDonor ? 'listings' : 'collections'} on your behalf.
                </p>
              </div>

              {/* Generate / existing code tabs */}
              <div style={{ display: 'flex', background: '#eeeeeb', borderRadius: '14px', padding: '5px', gap: '5px' }}>
                {[{ id: 'generate', label: 'Get a new code' }, { id: 'existing', label: 'I have a code' }].map(tab => (
                  <button key={tab.id} onClick={() => { setCodeMode(tab.id); setSubmitError('') }}
                    style={{
                      flex: 1, padding: '13px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                      fontSize: '15px', fontWeight: 700, transition: 'all 0.15s',
                      background: codeMode === tab.id ? '#fff' : 'transparent',
                      color: codeMode === tab.id ? accent : '#6b7280',
                      boxShadow: codeMode === tab.id ? '0 1px 6px rgba(61,64,91,0.09)' : 'none'
                    }}
                  >{tab.label}</button>
                ))}
              </div>

              {codeMode === 'generate' && (
                <>
                  {/* Generated code display */}
                  <div style={{
                    borderRadius: '18px', padding: '32px', textAlign: 'center', minHeight: '108px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: generatedCode ? `${accentPale}44` : '#eeeeeb',
                    border: `2px dashed ${generatedCode ? accentLight : '#d1cdc4'}`
                  }} aria-live="polite">
                    {generatedCode
                      ? <span style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '0.18em', fontFamily: 'monospace', color: accent }}>{generatedCode}</span>
                      : <span style={{ fontSize: '15px', color: '#9ca3af' }}>Click "Generate code" below</span>
                    }
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    {generatedCode && (
                      <button onClick={handleCopy}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 22px', borderRadius: '12px', border: `1.5px solid ${accentPale}`, background: accentPale, color: accent, fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{copied ? 'check' : 'content_copy'}</span>
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    )}
                    <button onClick={handleGenerateCode}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px 22px', borderRadius: '12px', border: '1.5px solid #e2e3e0', background: '#fff', color: '#6b7280', fontSize: '15px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>refresh</span>
                      {generatedCode ? 'New code' : 'Generate code'}
                    </button>
                  </div>

                  {generatedCode && (
                    <div style={{ padding: '16px 20px', borderRadius: '12px', background: '#fffbeb', border: '1px solid #fbbf24', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#d97706', flexShrink: 0, marginTop: '1px' }}>warning</span>
                      <p style={{ fontSize: '14px', color: '#92400e', lineHeight: 1.55 }}>
                        Save this code somewhere safe — it is the only way to access your workspace. We cannot recover it for you.
                      </p>
                    </div>
                  )}
                </>
              )}

              {codeMode === 'existing' && (
                <input
                  type="text" value={existingInput} onChange={handleExistingInputChange}
                  onFocus={focusStyle} onBlur={blurStyle}
                  placeholder={isDonor ? 'e.g. DNR-ABCDEF' : 'e.g. CBO-ABC-1234'}
                  maxLength={20} autoComplete="off" spellCheck={false}
                  style={INPUT_BASE}
                />
              )}

              {submitError && <div style={{ fontSize: '14px', padding: '14px 18px', borderRadius: '12px', background: '#fbe2e5', color: '#9b1e28' }} role="alert">{submitError}</div>}

              <button onClick={handleConfirm}
                disabled={submitLoading || (codeMode === 'generate' && !generatedCode) || (codeMode === 'existing' && !existingInput)}
                style={{
                  ...BTN_PRIMARY(accent),
                  opacity: (submitLoading || (codeMode === 'generate' && !generatedCode) || (codeMode === 'existing' && !existingInput)) ? 0.45 : 1,
                  cursor: (submitLoading || (codeMode === 'generate' && !generatedCode) || (codeMode === 'existing' && !existingInput)) ? 'not-allowed' : 'pointer',
                }}
              >
                {submitLoading
                  ? <><span className="material-symbols-outlined" style={{ fontSize: '20px' }}>progress_activity</span> Setting up...</>
                  : <>Start using OutBackShare <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_forward</span></>
                }
              </button>

              <p style={{ textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>Your code is stored on this device only.</p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

export default RegisterPage
