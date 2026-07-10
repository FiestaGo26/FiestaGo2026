import { EloRatings } from './elo.mjs'
import { expectedGoals, matchProbabilities } from './poisson.mjs'

// Per-sport configuration and win-probability model. Only the
// match-winner market (1X2 for football, moneyline for tennis/
// basketball) is modeled here — handicaps, totals, set betting, player
// props etc. would each need their own calibrated model against real
// data, which this tool doesn't attempt.
//
// Football keeps the full Elo -> expected goals -> Poisson scoreline
// model (lib/poisson.mjs) since goals are a meaningful, well-studied
// quantity to model. Tennis and basketball have no draw and no natural
// "goals" equivalent, so they use the Elo rating gap directly as a win
// probability via the standard logistic formula - simpler and less
// battle-tested than the football model.
export const SPORT_CONFIG = {
  football: {
    label: 'Fútbol', outcomes: ['home', 'draw', 'away'],
    elo: { initialRating: 1500, k: 20, homeAdvantage: 60 },
  },
  tennis: {
    label: 'Tenis', outcomes: ['home', 'away'],
    elo: { initialRating: 1500, k: 32, homeAdvantage: 0 },
  },
  basketball: {
    label: 'Baloncesto', outcomes: ['home', 'away'],
    elo: { initialRating: 1500, k: 20, homeAdvantage: 100 },
  },
}

export function isValidSport(sport) {
  return Object.prototype.hasOwnProperty.call(SPORT_CONFIG, sport)
}

export function createRatingsBySport() {
  const bySport = {}
  for (const sport of Object.keys(SPORT_CONFIG)) bySport[sport] = new EloRatings(SPORT_CONFIG[sport].elo)
  return bySport
}

export function ratingsBySportFromMap(serialized) {
  const bySport = createRatingsBySport()
  for (const sport of Object.keys(SPORT_CONFIG)) {
    if (serialized[sport]) bySport[sport].ratings = new Map(serialized[sport])
  }
  return bySport
}

export function serializeRatingsBySport(bySport) {
  const out = {}
  for (const sport of Object.keys(bySport)) out[sport] = [...bySport[sport].ratings.entries()]
  return out
}

export function modelProbabilities(sport, ratings, home, away) {
  if (!isValidSport(sport)) throw new Error(`Deporte no soportado: ${sport}`)
  const ratingHome = ratings.getRating(home)
  const ratingAway = ratings.getRating(away)

  if (sport === 'football') {
    const eloDiff = ratingHome + ratings.homeAdvantage - ratingAway
    const { lambdaHome, lambdaAway } = expectedGoals(eloDiff)
    const m = matchProbabilities(lambdaHome, lambdaAway)
    return { home: m.home, draw: m.draw, away: m.away }
  }

  const pHome = ratings.expectedHome(ratingHome, ratingAway)
  return { home: pHome, away: 1 - pHome }
}

// Updates Elo from a real result. Football uses actual goals (so the
// goal-difference multiplier applies); tennis/basketball only carry a
// win/loss, so it's recorded as a neutral 1-0 (multiplier stays at 1).
export function updateRatings(sport, ratings, home, away, { homeScore, awayScore, homeWon } = {}) {
  if (sport === 'football') {
    ratings.update(home, away, homeScore, awayScore)
  } else {
    ratings.update(home, away, homeWon ? 1 : 0, homeWon ? 0 : 1)
  }
}
