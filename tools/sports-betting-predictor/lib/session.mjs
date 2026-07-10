import { readFileSync, writeFileSync, existsSync } from 'fs'
import { EloRatings } from './elo.mjs'
import { expectedGoals, matchProbabilities } from './poisson.mjs'
import { edge as computeEdge, fairProbabilities } from './odds.mjs'
import { recommendedStake } from './kelly.mjs'
import { parseCsv } from './csv.mjs'

// A "session" is a persisted, human-in-the-loop betting run: it keeps a
// running bankroll across separate CLI invocations (one match finishes
// at a time, in real life, over days/weeks) and reinvests every gain
// automatically because each new stake is a fraction of the *current*
// bankroll (compounding), not of the original one. It refuses to
// recommend further bets once a take-profit or stop-loss target is hit.

export function loadSession(statePath) {
  if (!existsSync(statePath)) {
    throw new Error(`No hay ninguna sesión en ${statePath}. Ejecuta "session start" primero.`)
  }
  const raw = JSON.parse(readFileSync(statePath, 'utf-8'))
  raw.ratings = new Map(raw.ratings)
  return raw
}

export function saveSession(statePath, session) {
  const serializable = { ...session, ratings: [...session.ratings.entries()] }
  writeFileSync(statePath, JSON.stringify(serializable, null, 2))
}

export function startSession(statePath, {
  dataPath,
  bankroll,
  takeProfitPct,
  stopLossPct,
  kellyMultiplier = 0.25,
  maxStakeFraction = 0.05,
  edgeThreshold = 0.03,
  elo = { initialRating: 1500, k: 20, homeAdvantage: 60 },
}) {
  const ratings = new EloRatings(elo)

  if (dataPath) {
    const rows = parseCsv(readFileSync(dataPath, 'utf-8'))
    const matches = rows
      .map(r => ({ date: r.date, home: r.home, away: r.away, home_goals: Number(r.home_goals), away_goals: Number(r.away_goals) }))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
    for (const m of matches) ratings.update(m.home, m.away, m.home_goals, m.away_goals)
  }

  const session = {
    createdAt: new Date().toISOString(),
    initialBankroll: bankroll,
    bankroll,
    takeProfitPct,
    stopLossPct,
    kellyMultiplier,
    maxStakeFraction,
    edgeThreshold,
    eloConfig: elo,
    status: 'active', // active | stopped_profit | stopped_loss
    pending: null,
    history: [],
    ratings: ratings.ratings,
  }
  saveSession(statePath, session)
  return session
}

function statusMessage(session) {
  const profitPct = (session.bankroll - session.initialBankroll) / session.initialBankroll
  if (session.status === 'stopped_profit') {
    return `🎯 Objetivo de ganancia alcanzado (+${(profitPct * 100).toFixed(1)}%). La sesión está PARADA — no se recomiendan más apuestas.`
  }
  if (session.status === 'stopped_loss') {
    return `🛑 Límite de pérdida alcanzado (${(profitPct * 100).toFixed(1)}%). La sesión está PARADA — no se recomiendan más apuestas.`
  }
  return `🟢 Sesión activa. Ganancia actual: ${profitPct >= 0 ? '+' : ''}${(profitPct * 100).toFixed(1)}%` +
    (session.takeProfitPct != null ? ` (objetivo +${(session.takeProfitPct * 100).toFixed(0)}%)` : '') +
    (session.stopLossPct != null ? ` (stop-loss -${(session.stopLossPct * 100).toFixed(0)}%)` : '')
}

export function evaluateFixture(session, { home, away, oddsHome, oddsDraw, oddsAway }) {
  if (session.status !== 'active') {
    return { canBet: false, message: statusMessage(session) }
  }
  if (session.pending) {
    return { canBet: false, message: `⚠️  Hay una apuesta pendiente de resolver (${session.pending.home} vs ${session.pending.away}). Registra su resultado con "session result" antes de evaluar otro partido.` }
  }

  const ratings = new EloRatings(session.eloConfig)
  ratings.ratings = session.ratings
  const ratingHome = ratings.getRating(home)
  const ratingAway = ratings.getRating(away)
  const eloDiff = ratingHome + ratings.homeAdvantage - ratingAway
  const { lambdaHome, lambdaAway } = expectedGoals(eloDiff)
  const model = matchProbabilities(lambdaHome, lambdaAway)

  const outcomes = [
    { key: 'home', label: home, prob: model.home, odds: oddsHome },
    { key: 'draw', label: 'Empate', prob: model.draw, odds: oddsDraw },
    { key: 'away', label: away, prob: model.away, odds: oddsAway },
  ]
  const fair = fairProbabilities(outcomes.map(o => o.odds))

  let best = null
  outcomes.forEach((o, i) => {
    const edgeVsMarket = computeEdge(o.prob, o.odds)
    const edgeVsFair = o.prob - fair[i]
    if (edgeVsMarket > session.edgeThreshold && edgeVsFair > 0) {
      if (!best || edgeVsMarket > best.edgeVsMarket) best = { ...o, edgeVsMarket, edgeVsFair }
    }
  })

  if (!best) {
    return { canBet: false, message: 'ℹ️  No hay edge suficiente en ningún resultado — no se recomienda apostar en este partido.' }
  }

  const { stake, fraction, fullKelly } = recommendedStake(session.bankroll, best.prob, best.odds, {
    kellyMultiplier: session.kellyMultiplier,
    maxStakeFraction: session.maxStakeFraction,
  })

  if (stake <= 0) {
    return { canBet: false, message: 'ℹ️  Kelly recomienda apuesta 0 en este partido — se descarta.' }
  }

  session.pending = {
    home, away, pick: best.key, label: best.label,
    odds: best.odds, prob: best.prob, edge: best.edgeVsMarket,
    stake, stakeFraction: fraction, fullKelly,
    bankrollAtBet: session.bankroll,
  }

  return { canBet: true, recommendation: session.pending }
}

export function resolveBet(session, outcome) {
  if (!session.pending) throw new Error('No hay ninguna apuesta pendiente que resolver.')

  const bet = session.pending
  const won = outcome === bet.pick
  const profit = won ? bet.stake * (bet.odds - 1) : -bet.stake
  session.bankroll += profit

  session.history.push({
    date: new Date().toISOString(), home: bet.home, away: bet.away, pick: bet.pick,
    odds: bet.odds, prob: bet.prob, edge: bet.edge, stake: bet.stake,
    outcome, won, profit, bankrollAfter: session.bankroll,
  })

  // Elo update from the real result. We only know W/D/L (not the scoreline),
  // so a decisive result uses a neutral 1-0/0-1 goal difference (multiplier 1).
  const ratings = new EloRatings(session.eloConfig)
  ratings.ratings = session.ratings
  const syntheticGoals = outcome === 'home' ? [1, 0] : outcome === 'away' ? [0, 1] : [0, 0]
  ratings.update(bet.home, bet.away, syntheticGoals[0], syntheticGoals[1])
  session.ratings = ratings.ratings

  session.pending = null

  const profitPct = (session.bankroll - session.initialBankroll) / session.initialBankroll
  if (session.takeProfitPct != null && profitPct >= session.takeProfitPct) session.status = 'stopped_profit'
  else if (session.stopLossPct != null && profitPct <= -session.stopLossPct) session.status = 'stopped_loss'

  return { bet: session.history[session.history.length - 1], message: statusMessage(session) }
}

export function sessionStatus(session) {
  return { ...session, message: statusMessage(session) }
}
