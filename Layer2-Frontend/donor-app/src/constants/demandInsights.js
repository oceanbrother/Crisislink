import { ALERT_DATA_SOURCE, ALERT_ZONE_SAMPLES } from '../utils/alertsSampleData'

const normalizePostcode = (value) => String(value || '').trim()

const getNumericQuantity = (listing) => {
  const numeric = Number(listing?.quantity)
  return Number.isFinite(numeric) ? numeric : 0
}

const getFallbackTopAlert = () => {
  if (ALERT_ZONE_SAMPLES.length === 0) {
    return null
  }

  return [...ALERT_ZONE_SAMPLES].sort((left, right) => {
    if (right.demandLift !== left.demandLift) return right.demandLift - left.demandLift
    return right.pressureScore - left.pressureScore
  })[0]
}

export const buildDemandInsights = (listings) => {
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

  const enriched = ALERT_ZONE_SAMPLES.map((zone) => {
    const supply = supplyByPostcode[zone.postcode] || { listingCount: 0, quantity: 0 }
    return {
      ...zone,
      listingCount: supply.listingCount,
      activePortions: supply.quantity,
    }
  })

  const topAlert = (() => {
    if (enriched.length === 0) return null

    return [...enriched].sort((left, right) => {
      if (right.demandLift !== left.demandLift) return right.demandLift - left.demandLift
      if (right.confidence !== left.confidence) return right.confidence - left.confidence
      return right.pressureScore - left.pressureScore
    })[0]
  })()

  const alerts = [...enriched].sort((left, right) => {
    if (right.demandLift !== left.demandLift) return right.demandLift - left.demandLift
    if (right.confidence !== left.confidence) return right.confidence - left.confidence
    return right.pressureScore - left.pressureScore
  })

  const fallbackTopAlert = getFallbackTopAlert()

  return {
    source: ALERT_DATA_SOURCE,
    alerts,
    topAlert,
    fallbackTopAlert,
  }
}
