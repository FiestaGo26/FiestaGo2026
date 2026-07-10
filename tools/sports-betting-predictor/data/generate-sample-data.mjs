// Generates SYNTHETIC demo data (data/sample-matches.csv) so the
// predictor can be tried out without needing a real historical odds
// feed. Teams have fixed hidden "true strengths"; goals are sampled
// from Poisson distributions and odds are derived from the true
// win/draw/loss probabilities plus a realistic ~6% bookmaker margin
// and a bit of random noise (bookmakers are not perfectly efficient,
// which is exactly what creates the occasional value bet).
//
// Re-run with: node data/generate-sample-data.mjs > data/sample-matches.csv

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(42)

function poissonSample(lambda) {
  const L = Math.exp(-lambda)
  let k = 0, p = 1
  do { k++; p *= rand() } while (p > L)
  return k - 1
}

const TEAMS = [
  { name: 'Real Norte', strength: 1.35 },
  { name: 'Atletico Sur', strength: 1.15 },
  { name: 'Union Central', strength: 1.00 },
  { name: 'Deportivo Costa', strength: 0.95 },
  { name: 'CF Montaña', strength: 0.85 },
  { name: 'Racing Valle', strength: 1.05 },
  { name: 'Sporting Este', strength: 0.75 },
  { name: 'Estrella Oeste', strength: 0.90 },
]

const AVG_GOALS = 1.35 // per team per match, before strength adjustment
const HOME_BOOST = 1.12
const rows = ['date,home,away,home_goals,away_goals,odds_home,odds_draw,odds_away']

let date = new Date('2024-08-10')
const advanceDate = () => { date = new Date(date.getTime() + 3 * 86400000) }

// Round-robin, 3 rounds (double home/away + one extra pass) for a decent sample size
for (let round = 0; round < 3; round++) {
  for (let i = 0; i < TEAMS.length; i++) {
    for (let j = 0; j < TEAMS.length; j++) {
      if (i === j) continue
      const home = TEAMS[i]
      const away = TEAMS[j]

      const lambdaHome = AVG_GOALS * home.strength * HOME_BOOST
      const lambdaAway = AVG_GOALS * away.strength
      const homeGoals = poissonSample(lambdaHome)
      const awayGoals = poissonSample(lambdaAway)

      // "True" probabilities via quick Monte Carlo-free approximation using
      // the same lambdas, just to derive plausible odds.
      const strengthDiff = (home.strength * HOME_BOOST) - away.strength
      const pHome = Math.min(0.85, Math.max(0.08, 0.42 + strengthDiff * 0.28))
      const pAway = Math.min(0.85, Math.max(0.08, 0.30 - strengthDiff * 0.28))
      const pDraw = Math.max(0.05, 1 - pHome - pAway)

      const margin = 1.06 + (rand() - 0.5) * 0.03 // ~6% overround, slightly noisy
      const noise = () => 1 + (rand() - 0.5) * 0.10 // bookmaker isn't a perfect oracle
      const oddsHome = (margin / (pHome * noise())).toFixed(2)
      const oddsDraw = (margin / (pDraw * noise())).toFixed(2)
      const oddsAway = (margin / (pAway * noise())).toFixed(2)

      rows.push(`${date.toISOString().slice(0, 10)},${home.name},${away.name},${homeGoals},${awayGoals},${oddsHome},${oddsDraw},${oddsAway}`)
      advanceDate()
    }
  }
}

console.log(rows.join('\n'))
