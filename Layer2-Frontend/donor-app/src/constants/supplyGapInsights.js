import { SUPPLY_GAP_DATA_SOURCE, SUPPLY_GAP_ZONE_SAMPLES } from '../utils/supplyGapSampleData'

const normalizePostcode = (value) => String(value || '').trim()

const getNumericQuantity = (listing) => {
  const numeric = Number(listing?.quantity)
  return Number.isFinite(numeric) ? numeric : 0
}

const formatCoverageLevel = (coverageScore) => {
  if (coverageScore <= 0) return 'none'
  if (coverageScore < 8) return 'low'
  if (coverageScore < 16) return 'watch'
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
    const coverageScore = Math.max(0, supply.quantity + supply.listingCount * 3 - Math.round(profile.pressureScore / 12))
    const gapScore = Math.max(0, profile.pressureScore - coverageScore * 4)

    return {
      ...profile,
      listingCount: supply.listingCount,
      activePortions: supply.quantity,
      coverageScore,
      gapScore,
      coverageLevel: formatCoverageLevel(coverageScore),
      hasActiveSupply: supply.listingCount > 0,
    }
  })

  const hotspotZones = zones
    .filter((zone) => zone.hasActiveSupply === false && zone.pressureScore >= 78)
    .sort((left, right) => right.gapScore - left.gapScore)

  const watchZones = zones
    .filter((zone) => zone.gapScore >= 50)
    .sort((left, right) => right.gapScore - left.gapScore)

  const highlightedZone = hotspotZones[0] || watchZones[0] || null

  return {
    source: SUPPLY_GAP_DATA_SOURCE,
    hotspotZones,
    watchZones,
    highlightedZone,
    totals: {
      zeroSupply: zones.filter((zone) => zone.coverageLevel === 'none').length,
      atRisk: zones.filter((zone) => zone.coverageLevel === 'none' || zone.coverageLevel === 'low').length,
      tracked: zones.length,
    },
  }
}
