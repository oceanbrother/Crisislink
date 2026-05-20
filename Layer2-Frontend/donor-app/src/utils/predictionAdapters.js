import { ALERT_ZONE_SAMPLES } from '../utils/alertsSampleData'
import { SUPPLY_GAP_ZONE_SAMPLES } from '../utils/supplyGapSampleData'
import { hotspotSampleZones } from '../utils/hotspotSampleData'

// build fast postcode-keyed lookup maps from the sample data arrays
const ALERT_SAMPLE_BY_POSTCODE = Object.fromEntries(
  ALERT_ZONE_SAMPLES.map((zone) => [String(zone.postcode), zone]),
)

const SUPPLY_SAMPLE_BY_POSTCODE = Object.fromEntries(
  SUPPLY_GAP_ZONE_SAMPLES.map((zone) => [String(zone.postcode), zone]),
)

const HOTSPOT_SAMPLE_BY_POSTCODE = Object.fromEntries(
  hotspotSampleZones.map((zone) => [String(zone.postcode), zone]),
)

// known keys that may hold an array in various backend response shapes
const ARRAY_KEYS = ['results', 'items', 'rows', 'data', 'alerts', 'postcodes', 'hotspots']

// coerces a postcode value to a trimmed string
const normalizePostcode = (value) => String(value || '').trim()

// extracts an array from a payload that may wrap results in a named key
const toArray = (payload) => {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []

  for (const key of ARRAY_KEYS) {
    if (Array.isArray(payload[key])) {
      return payload[key]
    }
  }

  for (const key of ARRAY_KEYS) {
    if (payload[key] && typeof payload[key] === 'object') {
      const nested = toArray(payload[key])
      if (nested.length > 0) return nested
    }
  }

  return []
}

// converts a value to a finite number, returning a fallback if conversion fails
const getNumber = (value, fallback = 0) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

// clamps a number between a min and max boundary
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

// reads the first non-empty value from a row using a list of candidate key names
const readField = (row, keys, fallback = undefined) => {
  if (!row || typeof row !== 'object') return fallback

  for (const key of keys) {
    const value = row[key]
    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }

  return fallback
}

// converts a 0-1 decimal or an integer percentage to a rounded whole-number percent
const getPercent = (value, fallback = 0) => {
  const numeric = getNumber(value, fallback)
  if (numeric <= 1) return Math.round(numeric * 100)
  return Math.round(numeric)
}

// normalizes a value to an array of trimmed non-empty strings, splitting on common delimiters
const normalizeStringArray = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim()
        if (item && typeof item === 'object') {
          return String(
            item.factor || item.feature || item.name || item.label || item.category || '',
          ).trim()
        }
        return ''
      })
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(/[,;|]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

// builds a human-readable predicted window string from various backend field names
const formatPredictedWindow = (row) => {
  const directValue = readField(row, [
    'predictedWindow',
    'predicted_window',
    'prediction_window',
    'window_label',
  ])

  if (directValue) return String(directValue)

  const windowStart = readField(row, ['predicted_window_start', 'window_start', 'start_date'])
  const windowEnd = readField(row, ['predicted_window_end', 'window_end', 'end_date'])

  if (windowStart && windowEnd) {
    return `${windowStart} to ${windowEnd}`
  }

  if (windowStart) return String(windowStart)
  if (windowEnd) return String(windowEnd)
  return 'Next 7 days'
}

// derives a demand lift percentage from risk score fields when no explicit lift value exists
const normalizeDemandLift = (row) => {
  const explicitValue = readField(row, ['demandLift', 'demand_lift', 'lift_pct', 'lift'])
  if (explicitValue !== undefined) return Math.round(getNumber(explicitValue, 0))

  const riskScore = getNumber(
    readField(row, ['demand_risk_score', 'risk_score', 'riskScore', 'score']),
    0,
  )

  if (riskScore <= 1) return Math.max(12, Math.round(riskScore * 35))
  if (riskScore <= 10) return Math.max(12, Math.round(riskScore * 3.5))
  return Math.max(12, Math.round(riskScore / 3))
}

// extracts a confidence percentage from a row, clamped between 0 and 100
const normalizeConfidence = (row) => {
  const confidenceValue = readField(row, ['confidence', 'confidence_pct', 'confidence_score'])
  return clamp(getPercent(confidenceValue, 72), 0, 100)
}

// builds a plain-language alert reason sentence from risk label and contributing factors
const buildAlertReason = (riskLabel, factors) => {
  if (factors.length > 0) {
    return `Signals such as ${factors.slice(0, 2).join(' and ')} indicate rising local demand pressure.`
  }

  if (/high|critical/i.test(riskLabel)) {
    return 'This postcode is showing elevated demand pressure and should stay near the top of the response queue.'
  }

  return 'This postcode is starting to trend upward and should remain on the organisation watchlist.'
}

// maps a raw coverage label string to one of the four known coverage level keys
const normalizeCoverageLevel = (value, fallback = 'watch') => {
  const label = String(value || '').trim().toLowerCase()

  if (label.includes('none') || label.includes('zero') || label.includes('no supply')) return 'none'
  if (label.includes('critical')) return 'none'
  if (label.includes('low')) return 'low'
  if (label.includes('watch') || label.includes('monitor')) return 'watch'
  if (label.includes('healthy') || label.includes('covered') || label.includes('stable')) return 'healthy'

  return fallback
}

// derives the coverage level from numeric supply and demand values when no label is provided
const deriveCoverageLevel = ({ listingCount, coverageRatePercent, shortfallPortions }) => {
  if (listingCount <= 0 || coverageRatePercent < 35 || shortfallPortions >= 180) return 'none'
  if (coverageRatePercent < 60 || shortfallPortions >= 110) return 'low'
  if (coverageRatePercent < 85 || shortfallPortions >= 40) return 'watch'
  return 'healthy'
}

// estimates total demand in portions from population and pressure score when no direct value exists
const buildEstimatedDemand = ({ estimatedPopulationInNeed, pressureScore }) => {
  return Math.max(60, Math.round(estimatedPopulationInNeed * 0.22 + pressureScore * 1.9))
}

// combines pressure score and SEIFA disadvantage index into a single requirement score
const buildRequirementScore = ({ pressureScore, seifaScore }) => {
  const seifaPenalty = Math.max(0, (1000 - seifaScore) / 6)
  return Math.round(pressureScore + seifaPenalty)
}

// resolves the nearest supply point name from row data, sample data, or a generated fallback
const normalizeNearestSupplyName = (row, sample, postcode) => {
  const directName = readField(row, [
    'nearest_active_supply_name',
    'nearestSupplyPoint',
    'nearest_supply_name',
    'nearest_active_supply_postcode',
    'nearest_supply_postcode',
  ])

  if (directName) return String(directName)
  if (sample?.nearestSupplyPoint) return sample.nearestSupplyPoint
  if (sample?.nearestHub?.name) return sample.nearestHub.name
  return postcode ? `Nearby supply point ${postcode}` : 'Nearby supply point'
}

// resolves the distance to the nearest supply point in km from row data or sample data
const normalizeNearestDistance = (row, sample) => {
  const directValue = readField(row, [
    'nearest_active_supply_distance_km',
    'nearestSupplyDistanceKm',
    'nearest_supply_distance_km',
    'distance_km',
    'distanceKm',
  ])

  if (directValue !== undefined) return Number(getNumber(directValue, 0).toFixed(1))
  if (sample?.nearestSupplyDistanceKm !== undefined) return sample.nearestSupplyDistanceKm
  if (sample?.nearestHub?.distanceKm !== undefined) return sample.nearestHub.distanceKm
  return 0
}

// maps a postcode to a broad Victorian region name using prefix ranges
const fallbackRegionForPostcode = (postcode, sample) => {
  if (sample?.region) return sample.region

  const prefix = Number(String(postcode).slice(0, 2))
  if (prefix >= 30 && prefix < 31) return 'Inner Melbourne'
  if (prefix >= 31 && prefix < 32) return 'South-East'
  if (prefix >= 32 && prefix < 33) return 'South-East'
  if (prefix >= 33 && prefix < 36) return 'Regional West'
  if (prefix >= 36 && prefix < 38) return 'Regional North'
  return 'Greater Melbourne'
}

// normalizes shortage items from various backend shapes into a consistent array format
const normalizeShortageItems = (row, sample) => {
  const rawItems = readField(row, [
    'shortage_items',
    'shortageItems',
    'food_shortfalls',
    'food_category_shortfalls',
    'shortfalls',
    'categories',
    'needed_food_types',
  ])

  const arrayItems = Array.isArray(rawItems) ? rawItems : []
  const normalized = arrayItems
    .map((item) => {
      if (typeof item === 'string') {
        return {
          category: item,
          shortfallPortions: Math.max(20, Math.round(getNumber(readField(row, ['shortfall', 'shortfall_portions']), 80) / 2)),
          isSurplus: false,
        }
      }

      if (!item || typeof item !== 'object') return null

      const category = String(
        item.category || item.foodType || item.food_type || item.name || item.label || '',
      ).trim()
      if (!category) return null

      return {
        category,
        shortfallPortions: Math.max(
          0,
          Math.round(
            getNumber(
              item.shortfallPortions || item.shortfall_portions || item.shortfall || item.portions || item.quantity,
              0,
            ),
          ),
        ),
        isSurplus: Boolean(item.isSurplus || item.is_surplus),
      }
    })
    .filter((item) => item && item.shortfallPortions > 0)

  if (normalized.length > 0) return normalized

  const explicitShortfall = Math.round(getNumber(readField(row, ['shortfall', 'shortfall_portions']), 0))
  if (explicitShortfall > 0) {
    return [
      {
        category: 'Priority food',
        shortfallPortions: explicitShortfall,
        isSurplus: false,
      },
    ]
  }

  return sample?.shortageItems || []
}

// converts a risk score API payload into the demand insights shape used by the UI
export const buildDemandInsightsFromRiskScores = (payload) => {
  const alerts = toArray(payload)
    .map((row) => {
      const postcode = normalizePostcode(readField(row, ['postcode', 'postal_code', 'poa_code']))
      if (!postcode) return null

      const sample = ALERT_SAMPLE_BY_POSTCODE[postcode] || {}
      const factors = normalizeStringArray(
        readField(row, ['top_features', 'topFactors', 'contributing_factors', 'factors']),
      )
      const riskLabel = String(readField(row, ['risk_label', 'riskLabel', 'label'], 'Demand alert'))
      const demandLift = normalizeDemandLift(row)
      const confidence = normalizeConfidence(row)
      const pressureScore = Math.round(
        getNumber(readField(row, ['demand_risk_score', 'risk_score', 'riskScore', 'score']), sample.pressureScore || demandLift),
      )

      return {
        postcode,
        suburb: String(readField(row, ['suburb', 'locality', 'name'], sample.suburb || `Postcode ${postcode}`)),
        council: String(readField(row, ['council', 'lga_name'], sample.council || 'Service area')),
        pressureScore,
        householdsAtRisk: Math.round(
          getNumber(
            readField(row, ['estimated_population_in_need', 'households_at_risk', 'householdsAtRisk']),
            sample.householdsAtRisk || 0,
          ),
        ),
        demandLift,
        confidence,
        predictedWindow: formatPredictedWindow(row),
        contributingFactors: factors.length > 0 ? factors : sample.contributingFactors || [],
        alertReason:
          readField(row, ['alert_reason', 'alertReason']) ||
          sample.alertReason ||
          buildAlertReason(riskLabel, factors),
        activePortions: Math.round(
          getNumber(
            readField(row, ['active_portions', 'activePortions', 'available_supply', 'active_listing_count']),
            0,
          ),
        ),
      }
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (right.demandLift !== left.demandLift) return right.demandLift - left.demandLift
      if (right.confidence !== left.confidence) return right.confidence - left.confidence
      return right.pressureScore - left.pressureScore
    })

  return {
    source: 'prediction',
    alerts,
    topAlert: alerts[0] || null,
    fallbackTopAlert: alerts[0] || null,
  }
}

// converts a gap postcodes API payload into the coverage insights shape used by the UI
export const buildCoverageInsightsFromGapPostcodes = (payload) => {
  const zones = toArray(payload)
    .map((row) => {
      const postcode = normalizePostcode(readField(row, ['postcode', 'postal_code', 'poa_code']))
      if (!postcode) return null

      const sample = SUPPLY_SAMPLE_BY_POSTCODE[postcode] || {}
      const listingCount = Math.max(
        0,
        Math.round(
          getNumber(
            readField(row, ['active_listing_count', 'listingCount', 'activeListings']),
            sample.baselineActiveListings || 0,
          ),
        ),
      )
      const availableSupply = Math.max(
        0,
        Math.round(
          getNumber(
            readField(row, ['available_supply', 'availableSupply', 'active_portions', 'activePortions']),
            sample.baselineActivePortions || 0,
          ),
        ),
      )
      const seifaScore = Math.round(
        getNumber(readField(row, ['seifa_score', 'seifaScore', 'irsd_score']), sample.seifaScore || 950),
      )
      const estimatedPopulationInNeed = Math.round(
        getNumber(
          readField(row, ['estimated_population_in_need', 'estimatedPopulationInNeed', 'total_population']),
          sample.estimatedPopulationInNeed || 0,
        ),
      )
      const pressureScore = Math.round(
        getNumber(
          readField(row, ['pressure_score', 'pressureScore', 'resource_requirement_score', 'risk_score']),
          sample.pressureScore || 80,
        ),
      )
      const estimatedDemand = Math.max(
        0,
        Math.round(
          getNumber(
            readField(row, ['estimated_demand', 'estimatedDemand', 'demand_estimate']),
            buildEstimatedDemand({ estimatedPopulationInNeed, pressureScore }),
          ),
        ),
      )
      const shortfallPortions = Math.max(
        0,
        Math.round(
          getNumber(
            readField(row, ['shortfall', 'shortfall_portions', 'shortfallPortions']),
            Math.max(0, estimatedDemand - availableSupply),
          ),
        ),
      )
      const coverageRatePercent = clamp(
        Math.round(
          getNumber(
            readField(row, ['coverage_rate', 'coverageRatePercent', 'coverage_percent']),
            estimatedDemand > 0 ? (availableSupply / estimatedDemand) * 100 : 0,
          ),
        ),
        0,
        999,
      )
      const requirementScore = Math.round(
        getNumber(
          readField(row, ['resource_requirement_score', 'requirementScore', 'risk_score']),
          buildRequirementScore({ pressureScore, seifaScore }),
        ),
      )
      const supplyStrength = availableSupply + listingCount * 10
      const gapScore = Math.max(0, requirementScore - supplyStrength) + shortfallPortions
      const explicitCoverageLevel = readField(row, ['coverage_level', 'coverageLevel', 'status'])
      const coverageLevel = explicitCoverageLevel
        ? normalizeCoverageLevel(explicitCoverageLevel)
        : deriveCoverageLevel({ listingCount, coverageRatePercent, shortfallPortions })

      return {
        postcode,
        suburb: String(readField(row, ['suburb', 'locality', 'name'], sample.suburb || `Postcode ${postcode}`)),
        council: String(readField(row, ['council', 'lga_name'], sample.council || 'Service area')),
        pressureScore,
        seifaScore,
        estimatedPopulationInNeed,
        nearestSupplyPoint: normalizeNearestSupplyName(row, sample, postcode),
        nearestSupplyDistanceKm: normalizeNearestDistance(row, sample),
        listingCount,
        availableSupply,
        activePortions: availableSupply,
        estimatedDemand,
        shortfallPortions,
        coverageRatePercent,
        requirementScore,
        supplyStrength,
        gapScore,
        coverageLevel,
        hasActiveSupply: listingCount > 0 || availableSupply > 0,
      }
    })
    .filter(Boolean)
    .sort((left, right) => right.gapScore - left.gapScore)

  const hotspotZones = zones
    .filter((zone) => zone.coverageLevel === 'none')
    .sort((left, right) => right.gapScore - left.gapScore)

  const watchZones = zones
    .filter((zone) => zone.coverageLevel === 'low' || zone.coverageLevel === 'watch')
    .sort((left, right) => right.gapScore - left.gapScore)

  const flaggedZones = zones.filter((zone) => zone.coverageLevel !== 'healthy')
  const highlightedZone = flaggedZones[0] || zones[0] || null

  return {
    source: 'prediction',
    zones,
    hotspotZones,
    watchZones,
    flaggedZones,
    highlightedZone,
    totals: {
      zeroSupply: zones.filter((zone) => zone.coverageLevel === 'none').length,
      atRisk: zones.filter((zone) => zone.coverageLevel !== 'healthy').length,
      tracked: zones.length,
      averageCoverage:
        zones.length > 0
          ? Math.round(zones.reduce((sum, zone) => sum + zone.coverageRatePercent, 0) / zones.length)
          : 0,
    },
  }
}

// converts a hotspots API payload into the zone array shape used by the map UI
export const buildHotspotsFromPredictionData = (payload) => {
  const zones = toArray(payload)
    .map((row) => {
      const postcode = normalizePostcode(readField(row, ['postcode', 'postal_code', 'poa_code']))
      if (!postcode) return null

      const sample = HOTSPOT_SAMPLE_BY_POSTCODE[postcode] || {}
      const shortageItems = normalizeShortageItems(row, sample)
      if (shortageItems.length === 0) return null

      return {
        postcode,
        region: String(readField(row, ['region', 'broad_region', 'service_region'], fallbackRegionForPostcode(postcode, sample))),
        seifaScore: Math.round(
          getNumber(readField(row, ['seifa_score', 'seifaScore', 'irsd_score']), sample.seifaScore || 950),
        ),
        resourceRequirement: Math.round(
          getNumber(
            readField(row, ['resource_requirement_score', 'resourceRequirement', 'risk_score']),
            sample.resourceRequirement || 80,
          ),
        ),
        activeListings: Math.max(
          0,
          Math.round(
            getNumber(readField(row, ['active_listing_count', 'activeListings']), sample.activeListings || 0),
          ),
        ),
        estimatedPopulationInNeed: Math.round(
          getNumber(
            readField(row, ['estimated_population_in_need', 'estimatedPopulationInNeed', 'total_population']),
            sample.estimatedPopulationInNeed || 0,
          ),
        ),
        distanceToDonorKm: Number(
          getNumber(
            readField(row, ['distance_to_donor_km', 'distance_km', 'distanceKm']),
            sample.distanceToDonorKm || normalizeNearestDistance(row, sample),
          ).toFixed(1),
        ),
        nearestHub: {
          name: normalizeNearestSupplyName(row, sample, postcode),
          distanceKm: normalizeNearestDistance(row, sample),
        },
        shortageItems,
      }
    })
    .filter(Boolean)

  return {
    source: 'prediction',
    zones,
  }
}
