import { SUPPLY_GAP_DATA_SOURCE, SUPPLY_GAP_ZONE_SAMPLES } from '../utils/supplyGapSampleData'

const normalizePostcode = (value) => String(value || '').trim()

const getNumericQuantity = (listing) => {
  const numeric = Number(listing?.quantity)
  return Number.isFinite(numeric) ? numeric : 0
}

const getNumericValue = (value) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

const buildResourceRequirementScore = (zone) => {
  const pressure = getNumericValue(zone?.pressureScore)
  const seifaPenalty = Math.max(0, (1000 - getNumericValue(zone?.seifaScore)) / 6)
  return Math.round(pressure + seifaPenalty)
}

const formatCoverageLevel = ({ listingCount, gapScore }) => {
  if ((listingCount <= 0 && gapScore >= 55) || gapScore >= 75) return 'none'
  if (gapScore >= 45) return 'low'
  if (gapScore >= 20) return 'watch'
  return 'healthy'
}

export const buildSupplyGapInsights = (listings) => {
  const supplyByPostcode = (Array.isArray(listings) ? listings : []).reduce((accumulator, listing) => {
    if (listing?.status !== 'available') return accumulator

    const postcode = normalizePostcode(listing?.postcode)
    if (!postcode) return accumulator

    if (!accumulator[postcode]) {
      accumulator[postcode] = {
        listingCount: 0,
        quantity: 0,
      }
    }

    accumulator[postcode].listingCount += 1
    accumulator[postcode].quantity += getNumericQuantity(listing)
    return accumulator
  }, {})

  const zones = SUPPLY_GAP_ZONE_SAMPLES.map((profile) => {
    const supply = supplyByPostcode[profile.postcode] || { listingCount: 0, quantity: 0 }
    const listingCount = supply.listingCount + getNumericValue(profile.baselineActiveListings)
    const activePortions = supply.quantity + getNumericValue(profile.baselineActivePortions)
    const requirementScore = buildResourceRequirementScore(profile)
    const supplyStrength = activePortions + listingCount * 10
    const gapScore = Math.max(0, requirementScore - supplyStrength)
    const coverageLevel = formatCoverageLevel({ listingCount, gapScore })

    return {
      ...profile,
      listingCount,
      activePortions,
      requirementScore,
      supplyStrength,
      gapScore,
      coverageLevel,
      hasActiveSupply: listingCount > 0,
    }
  }).sort((left, right) => right.gapScore - left.gapScore)

  const hotspotZones = zones
    .filter((zone) => zone.coverageLevel === 'none')
    .sort((left, right) => right.gapScore - left.gapScore)

  const watchZones = zones
    .filter((zone) => zone.coverageLevel === 'low' || zone.coverageLevel === 'watch')
    .sort((left, right) => right.gapScore - left.gapScore)

  const flaggedZones = zones.filter((zone) => zone.coverageLevel !== 'healthy')

  const highlightedZone = flaggedZones[0] || zones[0] || null

  return {
    source: SUPPLY_GAP_DATA_SOURCE,
    zones,
    hotspotZones,
    watchZones,
    flaggedZones,
    highlightedZone,
    totals: {
      zeroSupply: zones.filter((zone) => zone.coverageLevel === 'none').length,
      atRisk: zones.filter((zone) => zone.coverageLevel !== 'healthy').length,
      tracked: zones.length,
    },
  }
}
