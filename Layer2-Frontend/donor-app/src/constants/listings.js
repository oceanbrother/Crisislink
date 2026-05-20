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

// Keep legacy and backend naming variants mapped into the same UI category
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

// Fallback keyword buckets used when category metadata is missing or noisy
const CATEGORY_KEYWORDS = {
  'Prepared meals': [
    'sandwich',
    'burger',
    'wings',
    'chicken',
    'meal',
    'rice',
    'curry',
    'pasta',
    'soup',
    'pizza',
    'lasagna',
    'noodle',
    'dumpling',
    'salad',
    'wrap',
    'taco',
    'sushi',
    'burrito',
    'quesadilla',
    'hot dog',
  ],
  Dairy: ['cheese', 'milk', 'yogurt', 'yoghurt', 'cream', 'butter', 'egg'],
  'Baked goods': ['bread', 'cake', 'muffin', 'pastry', 'croissant', 'donut', 'cookie', 'brownie', 'bun', 'scone', 'loaf', 'pie', 'tart'],
  'Fruit & veg': ['apple', 'banana', 'orange', 'berry', 'berries', 'grape', 'melon', 'lettuce', 'tomato', 'carrot', 'broccoli', 'spinach', 'fruit', 'vegetable', 'veg'],
  Pantry: ['cereal', 'beans', 'lentils', 'flour', 'oil', 'spice', 'seasoning', 'jar', 'tin', 'canned', 'sauce', 'crackers', 'pasta pack', 'rice pack'],
}

const DIETARY_KEYWORDS = {
  vegan: ['vegan', 'tofu', 'falafel', 'hummus', 'lentil', 'bean'],
  vegetarian: ['vegetarian', 'cheese', 'egg', 'omelette', 'macaroni', 'grilled cheese'],
  'non-vegetarian': ['chicken', 'beef', 'pork', 'ham', 'bacon', 'fish', 'salmon', 'tuna', 'shrimp', 'meat', 'wings', 'burger', 'steak'],
}

// Search the keyword groups and return the first matching group key
function findKeywordMatch(value, keywordGroups) {
  const text = String(value || '').trim().toLowerCase()
  if (!text) return null

  for (const [group, keywords] of Object.entries(keywordGroups)) {
    if (keywords.some((keyword) => text.includes(keyword))) {
      return group
    }
  }

  return null
}

// Normalise a raw category string to one of the canonical UI category values
export function normalizeCategory(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return 'Other'
  }
  const normalized = String(value).trim().toLowerCase().replace(/[_-]/g, ' ')
  const compact = normalized.replace(/\s+/g, '')
  return CATEGORY_ALIASES[compact] || CATEGORY_ALIASES[normalized] || inferCategoryFromFoodName(value)
}

// Infer category from food name using keyword matching
export function inferCategoryFromFoodName(value) {
  return findKeywordMatch(value, CATEGORY_KEYWORDS) || 'Other'
}

// Resolve the best category to use, preferring food-name inference when upstream category is generic
export function resolveListingCategory(category, foodName) {
  const normalizedCategory = normalizeCategory(category)
  const inferredCategory = inferCategoryFromFoodName(foodName)

  // If upstream category is generic "Other", prefer food-name inference
  if (normalizedCategory === 'Other' && inferredCategory !== 'Other') {
    return inferredCategory
  }

  if (normalizedCategory === 'Baked goods' && inferredCategory === 'Prepared meals') {
    // Reduce false positives from model outputs that overuse "Baked goods"
    return inferredCategory
  }

  return normalizedCategory
}

export const DIETARY_OPTIONS = [
  { value: 'none', key: 'none' },
  { value: 'vegan', key: 'vegan' },
  { value: 'vegetarian', key: 'vegetarian' },
  { value: 'non-vegetarian', key: 'nonVegetarian' },
]

export const DIETARY_FILTER_OPTIONS = [
  { value: 'all', key: 'all' },
  ...DIETARY_OPTIONS.filter((option) => option.value !== 'none'),
  { value: 'dairy-free', key: 'dairyFree' },
  { value: 'gluten-free', key: 'glutenFree' },
]

// Return the most specific dietary choice from a tags array
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

// Infer dietary choice from the food name using keyword matching
export function inferDietaryChoiceFromFoodName(value) {
  return findKeywordMatch(value, DIETARY_KEYWORDS) || 'none'
}

// Convert a dietary choice string to the tags array expected by the API
export function buildDietaryTags(choice) {
  if (choice === undefined || choice === null || choice === 'none' || choice === '') {
    return []
  }
  return [choice]
}

// Format an ISO expiry date as a localised display string
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
