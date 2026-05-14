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
  // Keep legacy/backend naming variants mapped into the same UI category.
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

const CATEGORY_KEYWORDS = {
  // Fallback keyword buckets when category metadata is missing or noisy.
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

export function normalizeCategory(value) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return 'Other'
  }
  const normalized = String(value).trim().toLowerCase().replace(/[_-]/g, ' ')
  const compact = normalized.replace(/\s+/g, '')
  return CATEGORY_ALIASES[compact] || CATEGORY_ALIASES[normalized] || inferCategoryFromFoodName(value)
}

export function inferCategoryFromFoodName(value) {
  return findKeywordMatch(value, CATEGORY_KEYWORDS) || 'Other'
}

export function resolveListingCategory(category, foodName) {
  // If upstream category is generic "Other", prefer food-name inference.
  const normalizedCategory = normalizeCategory(category)
  const inferredCategory = inferCategoryFromFoodName(foodName)

  if (normalizedCategory === 'Other' && inferredCategory !== 'Other') {
    return inferredCategory
  }

  if (normalizedCategory === 'Baked goods' && inferredCategory === 'Prepared meals') {
    // Reduce false positives from model outputs that overuse "Baked goods".
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

export function inferDietaryChoiceFromFoodName(value) {
  return findKeywordMatch(value, DIETARY_KEYWORDS) || 'none'
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
