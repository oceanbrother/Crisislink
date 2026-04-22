export const CATEGORY_OPTIONS = [
  { value: 'Baked goods', key: 'bakedGoods' },
  { value: 'Fruit & veg', key: 'produce' },
  { value: 'Dairy', key: 'dairy' },
  { value: 'Pantry', key: 'pantry' },
  { value: 'Prepared meals', key: 'preparedMeals' },
  { value: 'Other', key: 'other' },
]

export const FILTER_OPTIONS = [{ value: 'All', key: 'all' }, ...CATEGORY_OPTIONS]

export const SIZE_CUE_OPTIONS = [
  { value: '', key: 'none' },
  { value: 'Small', key: 'small' },
  { value: 'Medium', key: 'medium' },
  { value: 'Large', key: 'large' },
  { value: 'Extra large', key: 'extraLarge' },
  { value: 'Bulk / heavy', key: 'bulkHeavy' },
]

const CATEGORY_ALIASES = {
  all: 'All',
  bakery: 'Baked goods',
  bakedgoods: 'Baked goods',
  'bakery & grains': 'Baked goods',
  'baked goods': 'Baked goods',
  produce: 'Fruit & veg',
  'fresh produce': 'Fruit & veg',
  fruitveg: 'Fruit & veg',
  fruitandveg: 'Fruit & veg',
  'fruit & veg': 'Fruit & veg',
  'fruit and veg': 'Fruit & veg',
  dairy: 'Dairy',
  'dairy & eggs': 'Dairy',
  pantry: 'Pantry',
  grocery: 'Pantry',
  'canned goods': 'Pantry',
  prepared: 'Prepared meals',
  preparedmeals: 'Prepared meals',
  'prepared meals': 'Prepared meals',
  other: 'Other',
}

export function normalizeCategory(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return 'Other'
  }
  const normalized = String(value).trim().toLowerCase().replace(/[_-]/g, ' ')
  const compact = normalized.replace(/\s+/g, '')
  return CATEGORY_ALIASES[compact] || CATEGORY_ALIASES[normalized] || 'Other'
}

export const DIETARY_OPTIONS = [
  { value: 'none', key: 'none' },
  { value: 'vegan', key: 'vegan' },
  { value: 'vegetarian', key: 'vegetarian' },
  { value: 'non-vegetarian', key: 'nonVegetarian' },
]

export function getPrimaryDietaryChoice(tags = []) {
  if (Array.isArray(tags) === false || tags.length === 0) {
    return 'none'
  }
  const normalized = String(tags[0]).toLowerCase()
  if (normalized.includes('vegan')) return 'vegan'
  if (normalized.includes('vegetarian') && normalized.includes('non') === false) {
    return 'vegetarian'
  }
  if (normalized.includes('non')) return 'non-vegetarian'
  return 'none'
}

export function buildDietaryTags(choice) {
  if (choice === undefined || choice === null || choice === 'none' || choice === '') {
    return []
  }
  return [choice]
}

export function formatBestBeforeLabel(expiryDate, locale = 'en-AU') {
  if (expiryDate === undefined || expiryDate === null || expiryDate === '') {
    return null
  }
  const parsed = new Date(expiryDate)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return parsed.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
}
