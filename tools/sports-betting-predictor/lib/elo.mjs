// Elo rating engine adapted for football (methodology based on the
// public World Football Elo Ratings: https://www.eloratings.net/about),
// extended with a goal-difference multiplier so routs move ratings more
// than 1-goal wins.

export class EloRatings {
  constructor({ initialRating = 1500, k = 20, homeAdvantage = 60 } = {}) {
    this.initialRating = initialRating
    this.k = k
    this.homeAdvantage = homeAdvantage
    this.ratings = new Map()
  }

  getRating(team) {
    if (!this.ratings.has(team)) this.ratings.set(team, this.initialRating)
    return this.ratings.get(team)
  }

  // Expected result for the home team, 0..1 (0.5 = coin flip)
  expectedHome(ratingHome, ratingAway) {
    const diff = ratingHome + this.homeAdvantage - ratingAway
    return 1 / (1 + Math.pow(10, -diff / 400))
  }

  // Goal-difference multiplier (eloratings.net formula)
  goalMultiplier(goalDiff) {
    const g = Math.abs(goalDiff)
    if (g <= 1) return 1
    if (g === 2) return 1.5
    return (11 + g) / 8
  }

  // Updates ratings in place using a finished match. Returns the
  // pre-match expected score so callers can use it for predictions
  // without leaking the match's own result into the estimate.
  update(home, away, homeGoals, awayGoals) {
    const ratingHome = this.getRating(home)
    const ratingAway = this.getRating(away)
    const expected = this.expectedHome(ratingHome, ratingAway)

    let actual = 0.5
    if (homeGoals > awayGoals) actual = 1
    else if (homeGoals < awayGoals) actual = 0

    const multiplier = this.goalMultiplier(homeGoals - awayGoals)
    const delta = this.k * multiplier * (actual - expected)

    this.ratings.set(home, ratingHome + delta)
    this.ratings.set(away, ratingAway - delta)

    return { ratingHome, ratingAway, expectedHome: expected }
  }
}
