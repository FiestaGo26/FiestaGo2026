import { edge as computeEdge, fairProbabilities } from './odds.mjs'
import { recommendedStake } from './kelly.mjs'
import { SPORT_CONFIG, createRatingsBySport, modelProbabilities, updateRatings } from './sports.mjs'

// Walk-forward backtest: for every match (in chronological order) the
// model only ever sees Elo ratings built from *earlier* matches, so
// there's no lookahead bias. Ratings are updated with the real result
// only after the bet for that match has already been evaluated. Matches
// from different sports share the same bankroll but keep separate Elo
// rating pools (a football rating has no meaning in tennis).
export function runBacktest(matches, {
  initialBankroll = 1000,
  edgeThreshold = 0.03,
  kellyMultiplier = 0.25,
  maxStakeFraction = 0.05,
  // Session-style stop rules: takeProfitPct/stopLossPct are fractions of
  // initialBankroll (e.g. 0.2 = stop once up/down 20%). null/undefined = no limit.
  takeProfitPct = null,
  stopLossPct = null,
} = {}) {
  const ratingsBySport = createRatingsBySport()
  const sorted = [...matches].sort((a, b) => new Date(a.date) - new Date(b.date))

  let bankroll = initialBankroll
  let peakBankroll = initialBankroll
  let maxDrawdown = 0
  let stoppedEarly = false
  let stopReason = null
  let stopDate = null
  const bets = []
  const bankrollCurve = [{ date: sorted[0]?.date ?? null, bankroll }]

  for (const m of sorted) {
    if (stoppedEarly) break
    if (!SPORT_CONFIG[m.sport]) throw new Error(`Deporte no soportado en el CSV: "${m.sport}"`)

    const ratings = ratingsBySport[m.sport]
    const model = modelProbabilities(m.sport, ratings, m.home, m.away)

    const outcomes = [
      { key: 'home', prob: model.home, odds: m.odds_home },
      ...(SPORT_CONFIG[m.sport].outcomes.includes('draw') ? [{ key: 'draw', prob: model.draw, odds: m.odds_draw }] : []),
      { key: 'away', prob: model.away, odds: m.odds_away },
    ]
    const fair = fairProbabilities(outcomes.map(o => o.odds))

    let best = null
    outcomes.forEach((o, i) => {
      const edgeVsMarket = computeEdge(o.prob, o.odds)
      const edgeVsFair = o.prob - fair[i]
      if (edgeVsMarket > edgeThreshold && edgeVsFair > 0) {
        if (!best || edgeVsMarket > best.edgeVsMarket) best = { ...o, edgeVsMarket, edgeVsFair }
      }
    })

    const homeWon = m.home_score > m.away_score

    if (best) {
      const { stake, fraction } = recommendedStake(bankroll, best.prob, best.odds, { kellyMultiplier, maxStakeFraction })
      if (stake > 0) {
        const actualResult = SPORT_CONFIG[m.sport].outcomes.includes('draw')
          ? (m.home_score > m.away_score ? 'home' : (m.home_score < m.away_score ? 'away' : 'draw'))
          : (homeWon ? 'home' : 'away')
        const won = actualResult === best.key
        const profit = won ? stake * (best.odds - 1) : -stake
        bankroll += profit
        bets.push({
          sport: m.sport, date: m.date, home: m.home, away: m.away, pick: best.key,
          odds: best.odds, modelProb: best.prob, edge: best.edgeVsMarket,
          stakeFraction: fraction, stake, won, profit, bankrollAfter: bankroll,
        })
        peakBankroll = Math.max(peakBankroll, bankroll)
        maxDrawdown = Math.max(maxDrawdown, (peakBankroll - bankroll) / peakBankroll)
        bankrollCurve.push({ date: m.date, bankroll })

        const profitPct = (bankroll - initialBankroll) / initialBankroll
        if (takeProfitPct !== null && profitPct >= takeProfitPct) {
          stoppedEarly = true; stopReason = 'take_profit'; stopDate = m.date
        } else if (stopLossPct !== null && profitPct <= -stopLossPct) {
          stoppedEarly = true; stopReason = 'stop_loss'; stopDate = m.date
        }
      }
    }

    updateRatings(m.sport, ratings, m.home, m.away, { homeScore: m.home_score, awayScore: m.away_score, homeWon })
  }

  const wins = bets.filter(b => b.won).length
  const totalStaked = bets.reduce((s, b) => s + b.stake, 0)
  const totalProfit = bankroll - initialBankroll

  return {
    summary: {
      initialBankroll,
      finalBankroll: bankroll,
      totalProfit,
      roiOnStaked: totalStaked > 0 ? totalProfit / totalStaked : 0,
      numBets: bets.length,
      numMatches: sorted.length,
      winRate: bets.length > 0 ? wins / bets.length : 0,
      maxDrawdownPct: maxDrawdown,
      stoppedEarly, stopReason, stopDate,
    },
    bets,
    bankrollCurve,
    ratingsBySport,
  }
}
