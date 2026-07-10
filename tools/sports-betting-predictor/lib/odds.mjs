// Bookmaker-odds helpers: implied probabilities, overround (the
// bookmaker's built-in margin) and de-vigged "fair" probabilities.

export function impliedProbabilities(decimalOdds) {
  return decimalOdds.map(o => 1 / o)
}

export function overround(decimalOdds) {
  return impliedProbabilities(decimalOdds).reduce((a, b) => a + b, 0)
}

// Removes the bookmaker margin proportionally so the probabilities sum to 1.
export function fairProbabilities(decimalOdds) {
  const implied = impliedProbabilities(decimalOdds)
  const total = implied.reduce((a, b) => a + b, 0)
  return implied.map(p => p / total)
}

// Edge = your model's probability minus the market's probability.
// `vsImplied` compares against the raw (vig-included) implied probability,
// which is what you actually get paid against - the more conservative and
// more meaningful number when deciding whether to place a bet.
export function edge(modelProb, decimalOdd, { vsImplied = true } = {}) {
  const marketProb = vsImplied ? 1 / decimalOdd : null
  return marketProb === null ? null : modelProb - marketProb
}
