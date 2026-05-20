import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getSavedDonorPostcode, saveDonorPostcode } from '../utils/donorPostcode'
import SideNav from '../components/SideNav'
import '../styles/PostFeedPage.css'
import '../styles/DonorDashboardPage.css'
import logoUrl from '../assets/outbackshare-logo.png'

const DonorDashboardPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { t, i18n } = useTranslation()
  const [showLanguageMenu, setShowLanguageMenu] = useState(false)

  // resolve postcode from route state or local storage
  const postcode = useMemo(() => {
    return String(location.state?.postcode || getSavedDonorPostcode() || '').trim()
  }, [location.state?.postcode])

  // save postcode whenever it changes
  useEffect(() => {
    if (postcode) {
      saveDonorPostcode(postcode)
    }
  }, [postcode])

  // change app language and persist choice
  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang)
    localStorage.setItem('preferredLanguage', lang)
    setShowLanguageMenu(false)
  }

  // navigate to a path while keeping postcode in state
  const goTo = (path) => {
    navigate(path, { state: { postcode } })
  }

  const navItems = [
    {
      label: t('donorWorkspace.nav.dashboard', 'Dashboard'),
      icon: 'home',
      active: true,
      onClick: () => goTo('/donor'),
    },
    {
      label: t('donorWorkspace.cards.post.eyebrow', 'Post Food'),
      icon: 'add_circle',
      active: false,
      onClick: () => goTo('/donor/post'),
    },
    {
      label: 'Area Intelligence',
      icon: 'travel_explore',
      active: false,
      onClick: () => navigate('/org/intelligence', { state: { fromDonor: true, returnPath: '/donor' } }),
    },
    {
      label: 'Around Me',
      icon: 'near_me',
      active: false,
      onClick: () => navigate('/org/coverage-map', { state: { fromDonor: true, returnPath: '/donor' } }),
    },
    {
      label: t('donorWorkspace.cards.listings.title', 'My Listings'),
      icon: 'list_alt',
      active: false,
      onClick: () => goTo('/donor/listings'),
    },
  ]

  return (
    <div className="donor-dashboard-page donor-role-page min-h-screen bg-background">
      {/* Desktop sidebar */}
      <SideNav
        navItems={navItems}
        onPostFood={() => goTo('/donor/post')}
        onLanguage={() => setShowLanguageMenu((prev) => !prev)}
        role="donor"
      />

      {/* Fixed top header */}
      <header className="fixed top-0 left-0 right-0 lg:left-64 z-40 h-16 bg-background/80 backdrop-blur-md border-b border-surface-container-high flex items-center justify-between px-margin-mobile md:px-margin-desktop">
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="lg:hidden p-2 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors"
            onClick={() => navigate('/')}
            aria-label={t('common.back', 'Back')}
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <button
            type="button"
            className="lg:hidden"
            onClick={() => navigate('/')}
            aria-label={t('appName')}
          >
            <img
              src={logoUrl}
              alt={t('appName')}
              style={{ height: '32px', width: 'auto', display: 'block' }}
            />
          </button>
          <h1 className="text-headline-md text-on-surface font-semibold hidden md:block">
            {t('donorWorkspace.title', 'Donor workspace')}
          </h1>
        </div>

        <div className="flex items-center gap-base">
          {/* Language selector */}
          <div className="relative">
            <button
              type="button"
              className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors"
              onClick={() => setShowLanguageMenu((prev) => !prev)}
              aria-label={t('common.language', 'Language')}
            >
              <span className="material-symbols-outlined">language</span>
            </button>
            {showLanguageMenu ? (
              <div className="absolute right-0 top-full mt-1 bg-surface-container-lowest border border-surface-container-high rounded-2xl shadow-paper overflow-hidden z-50 min-w-[120px]">
                <button
                  type="button"
                  className="block w-full text-left px-md py-sm text-body-sm text-on-surface hover:bg-surface-container transition-colors"
                  onClick={() => handleLanguageChange('en')}
                >
                  English
                </button>
                <button
                  type="button"
                  className="block w-full text-left px-md py-sm text-body-sm text-on-surface hover:bg-surface-container transition-colors"
                  onClick={() => handleLanguageChange('zh')}
                >
                  Chinese
                </button>
              </div>
            ) : null}
          </div>

          {/* Profile avatar placeholder */}
          <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary-container text-[18px]">person</span>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className="lg:ml-64 pt-16">
        <div className="px-margin-mobile md:px-margin-desktop py-lg max-w-[1200px] mx-auto">

          {/* Welcome hero section */}
          <section className="mb-lg">
            <div className="flex flex-wrap items-start justify-between gap-md mb-md">
              <div>
                <h2 className="text-display-lg text-on-surface mb-sm">
                  {t('donorWorkspace.greeting', 'Good day,')}
                  <br />
                  <span className="text-primary">{t('donorWorkspace.title', 'Donor workspace')}</span>
                </h2>
                <p className="text-body-lg text-on-surface-variant max-w-[52ch]">
                  {t(
                    'donorWorkspace.subtitle',
                    'Post surplus food, view local hotspots, and manage your listings.',
                  )}
                </p>
              </div>
            </div>

            {/* Postcode pill and stats row */}
            <div className="flex flex-wrap items-center gap-sm">
              <div
                className="inline-flex items-center gap-xs bg-surface-container-lowest border border-outline-variant rounded-full px-sm py-2 shadow-paper"
                role="group"
                aria-label={t('donorWorkspace.currentPostcodeAria', 'Current donor postcode')}
              >
                <span className="material-symbols-outlined text-primary text-[18px]">location_on</span>
                <span className="text-label-sm text-on-surface-variant uppercase tracking-wide font-medium">
                  {t('donorWorkspace.currentPostcodeLabel', 'Postcode')}
                </span>
                <strong className="text-label-md text-on-surface">
                  {postcode || t('donorWorkspace.currentPostcodeFallback', 'Add when you post food')}
                </strong>
              </div>

              {/* Quick stats chips */}
              <div className="inline-flex items-center gap-xs bg-primary/10 rounded-full px-sm py-2">
                <span className="material-symbols-outlined text-primary text-[18px]">eco</span>
                <span className="text-label-sm text-primary font-medium">{t('donorWorkspace.stats.active', 'Active donor')}</span>
              </div>
            </div>
          </section>

          {/* Action card grid */}
          <section
            className="grid grid-cols-1 md:grid-cols-3 gap-md mb-lg"
            aria-label={t('donorWorkspace.actionsAria', 'Donor workspace actions')}
          >
            {/* Post Food card */}
            <div
              className="paper-card rounded-3xl p-md flex flex-col h-full cursor-pointer group"
              onClick={() => goTo('/donor/post')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && goTo('/donor/post')}
            >
              <div className="w-14 h-14 bg-secondary-fixed rounded-2xl flex items-center justify-center mb-lg group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-secondary text-[32px]">add_circle</span>
              </div>
              <p className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-xs">
                {t('donorWorkspace.cards.post.eyebrow', 'Post food')}
              </p>
              <h3 className="text-headline-md text-on-surface mb-sm">
                {t('donorWorkspace.cards.post.title', 'Post Surplus Food')}
              </h3>
              <p className="text-body-md text-on-surface-variant mb-xl flex-grow">
                {t('donorWorkspace.cards.post.description', 'Share food you have available with those who need it most.')}
              </p>
              <div className="flex items-center gap-xs text-secondary text-label-md font-semibold">
                <span>{t('donorWorkspace.cards.post.button', 'Create new listing')}</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </div>
            </div>

            {/* Area Intelligence card */}
            <div
              className="paper-card rounded-3xl p-md flex flex-col h-full cursor-pointer group"
              onClick={() => navigate('/org/intelligence', { state: { fromDonor: true, returnPath: '/donor' } })}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navigate('/org/intelligence', { state: { fromDonor: true, returnPath: '/donor' } })}
            >
              <div className="w-14 h-14 bg-primary-fixed rounded-2xl flex items-center justify-center mb-lg group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-primary text-[32px]">travel_explore</span>
              </div>
              <p className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-xs">
                AI demand signals
              </p>
              <h3 className="text-headline-md text-on-surface mb-sm">
                Area Intelligence
              </h3>
              <p className="text-body-md text-on-surface-variant mb-xl flex-grow">
                AI-predicted demand spikes and supply gaps — see exactly where food is needed most.
              </p>
              <div className="flex items-center gap-xs text-primary text-label-md font-semibold">
                <span>Open Area Intelligence</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </div>
            </div>

            {/* Manage Listings card */}
            <div
              className="paper-card rounded-3xl p-md flex flex-col h-full cursor-pointer group"
              onClick={() => goTo('/donor/listings')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && goTo('/donor/listings')}
            >
              <div className="w-14 h-14 bg-tertiary-fixed rounded-2xl flex items-center justify-center mb-lg group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-tertiary text-[32px]">list_alt</span>
              </div>
              <p className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-xs">
                {t('donorWorkspace.cards.listings.eyebrow', 'My activity')}
              </p>
              <h3 className="text-headline-md text-on-surface mb-sm">
                {t('donorWorkspace.cards.listings.title', 'Manage My Listings')}
              </h3>
              <p className="text-body-md text-on-surface-variant mb-xl flex-grow">
                {t('donorWorkspace.cards.listings.description', 'View, edit, or remove your active food posts.')}
              </p>
              <div className="flex items-center gap-xs text-tertiary text-label-md font-semibold">
                <span>{t('donorWorkspace.cards.listings.button', 'Open my listings')}</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </div>
            </div>
          </section>

          {/* Area Intelligence and Around Me cards */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-md mb-lg">
            {/* Area Intelligence */}
            <div
              className="paper-card rounded-3xl p-md flex flex-col h-full cursor-pointer group"
              onClick={() => navigate('/org/intelligence', { state: { fromDonor: true, returnPath: '/donor' } })}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navigate('/org/intelligence', { state: { fromDonor: true, returnPath: '/donor' } })}
            >
              <div className="w-14 h-14 bg-secondary-fixed rounded-2xl flex items-center justify-center mb-lg group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-secondary text-[32px]">travel_explore</span>
              </div>
              <p className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-xs">AI demand signals</p>
              <h3 className="text-headline-md text-on-surface mb-sm">Area Intelligence</h3>
              <p className="text-body-md text-on-surface-variant mb-xl flex-grow">
                AI-predicted demand spikes and supply gaps across all postcodes — updated live.
              </p>
              <div className="flex items-center gap-xs text-secondary text-label-md font-semibold">
                <span>Open Area Intelligence</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </div>
            </div>

            {/* Around Me */}
            <div
              className="paper-card rounded-3xl p-md flex flex-col h-full cursor-pointer group"
              onClick={() => navigate('/org/coverage-map', { state: { fromDonor: true, returnPath: '/donor' } })}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && navigate('/org/coverage-map', { state: { fromDonor: true, returnPath: '/donor' } })}
            >
              <div className="w-14 h-14 bg-tertiary-fixed rounded-2xl flex items-center justify-center mb-lg group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-tertiary text-[32px]">near_me</span>
              </div>
              <p className="text-label-sm text-on-surface-variant uppercase tracking-widest mb-xs">Coverage map</p>
              <h3 className="text-headline-md text-on-surface mb-sm">Around Me</h3>
              <p className="text-body-md text-on-surface-variant mb-xl flex-grow">
                Full coverage map — every scored postcode from high to low risk shown on a live map.
              </p>
              <div className="flex items-center gap-xs text-tertiary text-label-md font-semibold">
                <span>Open Around Me map</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </div>
            </div>
          </section>

          {/* Quick Analytics panel */}
          <section className="paper-card rounded-3xl p-md mb-lg">
            <h3 className="text-headline-md text-on-surface mb-md">
              {t('donorWorkspace.analytics.title', 'Quick Analytics')}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
              {[
                { label: t('donorWorkspace.analytics.totalPosts', 'Total posts'), value: '—', icon: 'post_add' },
                { label: t('donorWorkspace.analytics.claimed', 'Claimed'), value: '—', icon: 'handshake' },
                { label: t('donorWorkspace.analytics.collected', 'Collected'), value: '—', icon: 'check_circle' },
                { label: t('donorWorkspace.analytics.area', 'Your area'), value: postcode || '—', icon: 'location_city' },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col items-start gap-xs">
                  <span className="material-symbols-outlined text-on-surface-variant text-[20px]">{stat.icon}</span>
                  <span className="text-display-lg text-on-surface font-bold leading-none">{stat.value}</span>
                  <span className="text-label-sm text-on-surface-variant">{stat.label}</span>
                </div>
              ))}
            </div>
          </section>

        </div>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-container-lowest/90 backdrop-blur-md border-t border-surface-container-high shadow-bottom-nav flex items-center justify-around px-xs py-xs">
        {[
          { label: t('donorWorkspace.nav.dashboard', 'Home'), icon: 'home', onClick: () => goTo('/donor'), active: true },
          { label: t('donorWorkspace.nav.intelligence', 'Insights'), icon: 'travel_explore', onClick: () => navigate('/org/intelligence', { state: { fromDonor: true, returnPath: '/donor' } }), active: false },
          { label: t('donorWorkspace.cards.listings.eyebrow', 'Listings'), icon: 'list_alt', onClick: () => goTo('/donor/listings'), active: false },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            className={`flex flex-col items-center gap-xs py-xs px-sm rounded-xl transition-colors ${
              item.active ? 'text-primary' : 'text-on-surface-variant'
            }`}
          >
            <span className={`material-symbols-outlined ${item.active ? 'text-primary' : 'text-on-surface-variant'}`}>
              {item.icon}
            </span>
            <span className="text-label-sm">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* FAB for mobile — quick post button */}
      <button
        type="button"
        onClick={() => goTo('/donor/post')}
        className="lg:hidden fixed bottom-20 right-4 z-50 w-14 h-14 bg-secondary text-on-secondary rounded-2xl shadow-paper-hover flex items-center justify-center hover:bg-secondary-container hover:text-on-secondary-container transition-all"
        aria-label={t('donorWorkspace.cards.post.button', 'Post Food')}
      >
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>

      <style>{`
        .paper-card {
          background-color: #ffffff;
          border: 1px solid #e8e4dd;
          box-shadow: 0px 4px 20px rgba(61, 64, 91, 0.05);
          transition: all 0.3s ease;
        }
        .paper-card:hover {
          box-shadow: 0px 8px 30px rgba(61, 64, 91, 0.08);
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  )
}

export default DonorDashboardPage
