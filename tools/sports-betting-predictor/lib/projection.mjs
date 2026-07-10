import { recommendedStake } from './kelly.mjs'

// Monte Carlo projection of bankroll growth under EXPLICIT assumptions
// about how often a genuine value bet shows up and how big its edge
// really is. This does not use real data - it answers "if the model's
// edge assumptions hold, what would N days look like", which is the
// honest way to answer "how much could I make" without pretending to
// know the future. The biggest unknown is whether the assumed edge
// exists at all in real markets; see README.md.

function poissonSample(lambda, rand) {
  const L = Math.exp(-lambda)
  let k = 0, p = 1
  do { k++; p *= rand() } while (p > L)
  return k - 1
}

function percentile(sorted, p) {
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length))
  return sorted[idx]
}

export function simulateProjection({
  initialBankroll,
  days,
  betsPerDay = 1.5,       // avg number of qualifying value bets/day found across all sports combined
  avgOdds = 2.2,          // typical decimal odds of the bets that clear the edge threshold
  edgeRange = [0.03, 0.08], // uniform range of *true* edge assumed (vs the raw market odds)
  kellyMultiplier = 0.25,
  maxStakeFraction = 0.05,
  trials = 5000,
  rand = Math.random,
} = {}) {
  const finals = []
  let ruinCount = 0 // trials that fall below 20% of the starting bankroll at some point

  for (let t = 0; t < trials; t++) {
    let bankroll = initialBankroll
    let minBankroll = initialBankroll
    for (let d = 0; d < days; d++) {
      const numBets = poissonSample(betsPerDay, rand)
      for (let b = 0; b < numBets; b++) {
        if (bankroll <= 0.01) break
        const odds = Math.max(1.2, avgOdds + (rand() - 0.5) * 0.8)
        const edge = edgeRange[0] + rand() * (edgeRange[1] - edgeRange[0])
        const trueProb = Math.min(0.95, 1 / odds + edge)
        const { stake } = recommendedStake(bankroll, trueProb, odds, { kellyMultiplier, maxStakeFraction })
        if (stake <= 0) continue
        const won = rand() < trueProb
        bankroll += won ? stake * (odds - 1) : -stake
        minBankroll = Math.min(minBankroll, bankroll)
      }
    }
    finals.push(bankroll)
    if (minBankroll < initialBankroll * 0.2) ruinCount++
  }

  finals.sort((a, b) => a - b)
  return {
    p10: percentile(finals, 0.10),
    p25: percentile(finals, 0.25),
    median: percentile(finals, 0.50),
    p75: percentile(finals, 0.75),
    p90: percentile(finals, 0.90),
    mean: finals.reduce((s, x) => s + x, 0) / finals.length,
    probProfit: finals.filter(x => x > initialBankroll).length / finals.length,
    probSevereDrawdown: ruinCount / trials,
    trials,
  }
}
