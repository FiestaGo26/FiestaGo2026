// Converts an Elo rating gap into expected goals (lambda) for each side,
// then uses independent Poisson distributions over the scoreline matrix
// to derive match-outcome and totals probabilities. This is the same
// family of model used by most public football-prediction sites
// (Elo/power-rating -> expected goal difference -> Poisson scoreline grid).

const GOALS_PER_ELO_POINT = 1 / 200 // ~200 Elo points ≈ 1 expected goal of difference

function poissonPmf(k, lambda) {
  if (lambda <= 0) return k === 0 ? 1 : 0
  let logPmf = -lambda + k * Math.log(lambda)
  for (let i = 2; i <= k; i++) logPmf -= Math.log(i)
  return Math.exp(logPmf)
}

// eloDiff should already include home advantage, i.e. (ratingHome + homeAdv - ratingAway)
export function expectedGoals(eloDiff, avgTotalGoals = 2.6) {
  const goalDiff = eloDiff * GOALS_PER_ELO_POINT
  const lambdaHome = Math.max(0.15, avgTotalGoals / 2 + goalDiff / 2)
  const lambdaAway = Math.max(0.15, avgTotalGoals / 2 - goalDiff / 2)
  return { lambdaHome, lambdaAway }
}

export function matchProbabilities(lambdaHome, lambdaAway, maxGoals = 10) {
  let home = 0, draw = 0, away = 0, over25 = 0, btts = 0
  const scoreGrid = []

  for (let h = 0; h <= maxGoals; h++) {
    const row = []
    for (let a = 0; a <= maxGoals; a++) {
      const p = poissonPmf(h, lambdaHome) * poissonPmf(a, lambdaAway)
      row.push(p)
      if (h > a) home += p
      else if (h === a) draw += p
      else away += p
      if (h + a > 2.5) over25 += p
      if (h > 0 && a > 0) btts += p
    }
    scoreGrid.push(row)
  }

  return {
    home, draw, away,
    over25, under25: 1 - over25,
    btts, nobtts: 1 - btts,
    scoreGrid,
  }
}
