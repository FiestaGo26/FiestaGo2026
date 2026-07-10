// Kelly Criterion stake sizing. Kelly maximizes long-run bankroll growth
// but is highly sensitive to errors in your probability estimate, so this
// module always supports (and defaults to) fractional Kelly plus a hard
// cap on the stake as a share of bankroll.

// b = net decimal odds (e.g. odds 2.10 -> b = 1.10), p = your model's win probability
export function kellyFraction(p, decimalOdds) {
  const b = decimalOdds - 1
  const q = 1 - p
  const f = (b * p - q) / b
  return Math.max(0, f)
}

export function recommendedStake(bankroll, p, decimalOdds, {
  kellyMultiplier = 0.25, // "quarter Kelly" - standard risk-reduction practice
  maxStakeFraction = 0.05, // never risk more than 5% of bankroll on one bet
} = {}) {
  const fullKelly = kellyFraction(p, decimalOdds)
  const fraction = Math.min(fullKelly * kellyMultiplier, maxStakeFraction)
  return { fullKelly, fraction, stake: bankroll * fraction }
}
