function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function normalizeSeifaDisadvantage(seifaScore) {
  const score = toNumber(seifaScore, 1000)
  const bounded = clamp(score, 750, 1100)
  return Math.round(((1100 - bounded) / 350) * 100)
}

export function getNeededItems(shortageItems = []) {
  return shortageItems.filter((item) => {
    const shortfall = toNumber(item?.shortfallPortions, 0)
    return item?.isSurplus !== true && shortfall > 0
  })
}

export function computeTotalShortfall(shortageItems = []) {
  return getNeededItems(shortageItems).reduce((sum, item) => {
    return sum + toNumber(item?.shortfallPortions, 0)
  }, 0)
}

export function computeHotspotPriorityScore(zone) {
  const requirement = toNumber(zone?.resourceRequirement, 0)
  const activeListings = toNumber(zone?.activeListings, 0)
  const populationNeed = toNumber(zone?.estimatedPopulationInNeed, 0)
  const seifaDisadvantage = normalizeSeifaDisadvantage(zone?.seifaScore)
  const noSupplyBonus = activeListings === 0 ? 34 : 0
  const lowSupplyBoost = activeListings > 0 ? clamp(16 - activeListings * 4, 0, 16) : 0
  const populationFactor = clamp(populationNeed / 120, 0, 22)

  const score =
    requirement * 0.58 +
    seifaDisadvantage * 0.26 +
    noSupplyBonus +
    lowSupplyBoost +
    populationFactor

  return Math.round(score)
}

export function getPriorityBand(score) {
  const normalized = toNumber(score, 0)
  if (normalized >= 105) return { tone: 'critical', label: 'Critical hotspot' }
  if (normalized >= 85) return { tone: 'high', label: 'High hotspot' }
  return { tone: 'watch', label: 'Watchlist hotspot' }
}
