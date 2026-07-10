// Generates SYNTHETIC demo data (data/sample-matches.csv) covering all
// three supported sports so the predictor can be tried out without a
// real historical odds feed. Each sport has fixed hidden "true
// strengths"; results are sampled accordingly and odds are derived from
// the true win probabilities plus a realistic bookmaker margin and some
// random noise (bookmakers are not perfectly efficient, which is
// exactly what creates the occasional value bet).
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

function oddsFromProb(p, margin = 1.06) {
  const noise = 1 + (rand() - 0.5) * 0.10
  return (margin / (p * noise)).toFixed(2)
}

const rows = ['sport,date,home,away,home_score,away_score,odds_home,odds_draw,odds_away']
let date = new Date('2024-08-10')
const advanceDate = () => { date = new Date(date.getTime() + 2 * 86400000) }
const dateStr = () => date.toISOString().slice(0, 10)

// --- Football: round-robin among 8 teams, 3 passes -------------------
const FOOTBALL_TEAMS = [
  { name: 'Real Norte', strength: 1.35 }, { name: 'Atletico Sur', strength: 1.15 },
  { name: 'Union Central', strength: 1.00 }, { name: 'Deportivo Costa', strength: 0.95 },
  { name: 'CF Montaña', strength: 0.85 }, { name: 'Racing Valle', strength: 1.05 },
  { name: 'Sporting Este', strength: 0.75 }, { name: 'Estrella Oeste', strength: 0.90 },
]
const AVG_GOALS = 1.35
const HOME_BOOST_FOOTBALL = 1.12

for (let round = 0; round < 3; round++) {
  for (let i = 0; i < FOOTBALL_TEAMS.length; i++) {
    for (let j = 0; j < FOOTBALL_TEAMS.length; j++) {
      if (i === j) continue
      const home = FOOTBALL_TEAMS[i], away = FOOTBALL_TEAMS[j]
      const homeGoals = poissonSample(AVG_GOALS * home.strength * HOME_BOOST_FOOTBALL)
      const awayGoals = poissonSample(AVG_GOALS * away.strength)

      const strengthDiff = (home.strength * HOME_BOOST_FOOTBALL) - away.strength
      const pHome = Math.min(0.85, Math.max(0.08, 0.42 + strengthDiff * 0.28))
      const pAway = Math.min(0.85, Math.max(0.08, 0.30 - strengthDiff * 0.28))
      const pDraw = Math.max(0.05, 1 - pHome - pAway)

      rows.push(`football,${dateStr()},${home.name},${away.name},${homeGoals},${awayGoals},${oddsFromProb(pHome)},${oddsFromProb(pDraw)},${oddsFromProb(pAway)}`)
      advanceDate()
    }
  }
}

// --- Tennis: round-robin among 8 players, 2 passes (no draws) --------
const TENNIS_PLAYERS = [
  { name: 'A. Rivas', strength: 1.30 }, { name: 'M. Fontes', strength: 1.10 },
  { name: 'J. Bermejo', strength: 1.00 }, { name: 'D. Salcedo', strength: 0.95 },
  { name: 'L. Peralta', strength: 0.80 }, { name: 'R. Aguayo', strength: 1.05 },
  { name: 'T. Ibarra', strength: 0.85 }, { name: 'S. Quiroga', strength: 0.90 },
]
for (let round = 0; round < 4; round++) {
  for (let i = 0; i < TENNIS_PLAYERS.length; i++) {
    for (let j = 0; j < TENNIS_PLAYERS.length; j++) {
      if (i === j) continue
      const p1 = TENNIS_PLAYERS[i], p2 = TENNIS_PLAYERS[j]
      const pWin1 = p1.strength / (p1.strength + p2.strength)
      const p1Wins = rand() < pWin1
      const setsFor = 2, setsAgainst = rand() < 0.5 ? 0 : 1
      const homeScore = p1Wins ? setsFor : setsAgainst
      const awayScore = p1Wins ? setsAgainst : setsFor

      rows.push(`tennis,${dateStr()},${p1.name},${p2.name},${homeScore},${awayScore},${oddsFromProb(pWin1)},,${oddsFromProb(1 - pWin1)}`)
      advanceDate()
    }
  }
}

// --- Basketball: round-robin among 8 teams, 2 passes (no draws) ------
const BASKETBALL_TEAMS = [
  { name: 'Halcones', strength: 1.25 }, { name: 'Titanes', strength: 1.10 },
  { name: 'Lobos', strength: 1.00 }, { name: 'Tiburones', strength: 0.95 },
  { name: 'Águilas', strength: 0.85 }, { name: 'Cóndores', strength: 1.05 },
  { name: 'Panteras', strength: 0.80 }, { name: 'Toros', strength: 0.92 },
]
const HOME_BOOST_BBALL = 1.05

for (let round = 0; round < 4; round++) {
  for (let i = 0; i < BASKETBALL_TEAMS.length; i++) {
    for (let j = 0; j < BASKETBALL_TEAMS.length; j++) {
      if (i === j) continue
      const home = BASKETBALL_TEAMS[i], away = BASKETBALL_TEAMS[j]
      const strengthDiff = (home.strength * HOME_BOOST_BBALL) - away.strength
      const pHome = Math.min(0.90, Math.max(0.10, 0.55 + strengthDiff * 0.35))

      const basePoints = 95
      let homeScore = Math.round(basePoints * home.strength * HOME_BOOST_BBALL + (rand() - 0.5) * 16)
      let awayScore = Math.round(basePoints * away.strength + (rand() - 0.5) * 16)
      if (homeScore === awayScore) { if (rand() < pHome) homeScore++; else awayScore++ } // no draws in basketball

      rows.push(`basketball,${dateStr()},${home.name},${away.name},${homeScore},${awayScore},${oddsFromProb(pHome)},,${oddsFromProb(1 - pHome)}`)
      advanceDate()
    }
  }
}

console.log(rows.join('\n'))
