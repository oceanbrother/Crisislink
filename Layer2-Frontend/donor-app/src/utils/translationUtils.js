/**
 * Translation utilities for handling multi-language listing data
 * 
 * The backend is expected to return listing data in this format:
 * {
 *   id: "123",
 *   title: "Artisan Sourdough",
 *   translations: {
 *     "en": { description: "...", tags: [...], allergens: "..." },
 *     "zh-CN": { description: "...", tags: [...], allergens: "..." },
 *     "vi": { description: "...", tags: [...], allergens: "..." }
 *   }
 * }
 */

/**
 * Get translated content for a listing based on current language
 * @param {Object} listing - The listing object with translations
 * @param {string} currentLanguage - The current language code (e.g., 'en', 'zh-CN')
 * @param {string} fallbackLanguage - Fallback language if translation not available (default: 'en')
 * @returns {Object} The translated listing content
 */
export const getTranslatedListing = (listing, currentLanguage, fallbackLanguage = 'en') => {
  if (!listing || !listing.translations) {
    return listing
  }

  // Try to get translation in current language
  let translation = listing.translations[currentLanguage]

  // Fallback to English if not available
  if (!translation) {
    translation = listing.translations[fallbackLanguage] || {}
  }

  return {
    ...listing,
    description: translation.description || listing.description || '',
    tags: translation.tags || listing.tags || [],
    allergens: translation.allergens || listing.allergens || '',
    // Keep other fields from the main listing object
  }
}

/**
 * Get all supported languages
 * @returns {Array} List of language objects with code and name
 */
export const getSupportedLanguages = () => {
  return [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'zh-CN', name: '简体中文', flag: '🇨🇳' },
    { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' }
  ]
}

/**
 * Check if a language is supported
 * @param {string} languageCode - The language code to check
 * @returns {boolean} True if language is supported
 */
export const isSupportedLanguage = (languageCode) => {
  return getSupportedLanguages().some(lang => lang.code === languageCode)
}

/**
 * Get the browser's preferred language from localStorage or browser settings
 * @returns {string} The language code
 */
export const getPreferredLanguage = () => {
  // First, check localStorage
  const storedLanguage = localStorage.getItem('preferred-language')
  if (storedLanguage && isSupportedLanguage(storedLanguage)) {
    return storedLanguage
  }

  // Check URL params
  const params = new URLSearchParams(window.location.search)
  const urlLanguage = params.get('lang')
  if (urlLanguage && isSupportedLanguage(urlLanguage)) {
    localStorage.setItem('preferred-language', urlLanguage)
    return urlLanguage
  }

  // Fallback to English
  return 'en'
}

/**
 * Save language preference to localStorage and URL
 * @param {string} languageCode - The language code to save
 */
export const setPreferredLanguage = (languageCode) => {
  if (isSupportedLanguage(languageCode)) {
    localStorage.setItem('preferred-language', languageCode)
    
    // Update URL without reloading
    const params = new URLSearchParams(window.location.search)
    params.set('lang', languageCode)
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}?${params.toString()}`
    )
  }
}

/**
 * Batch translate multiple listings
 * @param {Array} listings - Array of listing objects with translations
 * @param {string} currentLanguage - The current language code
 * @returns {Array} Array of translated listings
 */
export const getTranslatedListings = (listings, currentLanguage) => {
  if (!Array.isArray(listings)) {
    return []
  }
  return listings.map(listing => getTranslatedListing(listing, currentLanguage))
}
