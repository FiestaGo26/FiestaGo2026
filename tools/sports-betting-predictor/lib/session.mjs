import { readFileSync, writeFileSync, existsSync } from 'fs'
import { edge as computeEdge, fairProbabilities } from './odds.mjs'
import { recommendedStake } from './kelly.mjs'
import { parseCsv } from './csv.mjs'
import { SPORT_CONFIG, isValidSport, createRatingsBySport, ratingsBySportFromMap, serializeRatingsBySport, modelProbabilities, updateRatings } from './sports.mjs'

// A "session" is a persisted, human-in-the-loop betting run: it keeps a
// running bankroll across separate CLI invocations (matches finish at
// different times, in real life, over days/weeks) and reinvests every
// gain automatically because each new stake is a fraction of the
// *current* bankroll (compounding), not of the original one. It refuses
// to recommend further bets once a take-profit or stop-loss target is
// hit. It never places real bets itself - you place them yourself
// (e.g. on bet365) and report the outcome back with "session result".
//
// Football, tennis and basketball share one bankroll but keep separate
// Elo rating pools per sport.

export function loadSession(statePath) {
  if (!existsSync(statePath)) {
    throw new Error(`No hay ninguna sesión en ${statePath}. Ejecuta "session start" primero.`)
  }
  const raw = JSON.parse(readFileSync(statePath, 'utf-8'))
  raw.ratingsBySport = ratingsBySportFromMap(raw.ratingsBySport)
  return raw
}

export function saveSession(statePath, session) {
  const serializable = { ...session, ratingsBySport: serializeRatingsBySport(session.ratingsBySport) }
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
}) {
  const ratingsBySport = createRatingsBySport()

  if (dataPath) {
    const rows = parseCsv(readFileSync(dataPath, 'utf-8'))
    const matches = rows
      .map(r => ({
        sport: r.sport, date: r.date, home: r.home, away: r.away,
        home_score: Number(r.home_score), away_score: Number(r.away_score),
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
    for (const m of matches) {
      if (!isValidSport(m.sport)) throw new Error(`Deporte no soportado en el CSV: "${m.sport}"`)
      updateRatings(m.sport, ratingsBySport[m.sport], m.home, m.away, {
        homeScore: m.home_score, awayScore: m.away_score, homeWon: m.home_score > m.away_score,
      })
    }
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
    status: 'active', // active | stopped_profit | stopped_loss
    pendingBets: [],
    history: [],
    ratingsBySport,
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

function findPending(session, sport, home, away) {
  return session.pendingBets.findIndex(b =>
    b.sport === sport && b.home.toLowerCase() === home.toLowerCase() && b.away.toLowerCase() === away.toLowerCase())
}

// Evaluates one fixture against the session's current bankroll and rules.
// Does NOT mutate session state except appending to pendingBets when a
// value bet is found - safe to call repeatedly (e.g. from a batch scan).
function evaluateOne(session, { sport, home, away, oddsHome, oddsDraw, oddsAway }) {
  if (!isValidSport(sport)) {
    return { sport, home, away, canBet: false, message: `Deporte no soportado: "${sport}" (usa football, tennis o basketball).` }
  }
  if (findPending(session, sport, home, away) !== -1) {
    return { sport, home, away, canBet: false, message: 'Ya hay una apuesta pendiente para este partido.' }
  }

  const ratings = session.ratingsBySport[sport]
  const model = modelProbabilities(sport, ratings, home, away)
  const hasDraw = SPORT_CONFIG[sport].outcomes.includes('draw')

  const outcomes = [
    { key: 'home', label: home, prob: model.home, odds: oddsHome },
    ...(hasDraw ? [{ key: 'draw', label: 'Empate', prob: model.draw, odds: oddsDraw }] : []),
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
    return { sport, home, away, canBet: false, message: 'No hay edge suficiente en ningún resultado.' }
  }

  // Sized off the bankroll *at the moment of the scan* - simultaneous bets
  // from the same batch don't compound against each other since none of
  // them are resolved yet. If several fire from one scan, remember your
  // real total exposure that day is the sum of all their stakes.
  const { stake, fraction, fullKelly } = recommendedStake(session.bankroll, best.prob, best.odds, {
    kellyMultiplier: session.kellyMultiplier,
    maxStakeFraction: session.maxStakeFraction,
  })

  if (stake <= 0) {
    return { sport, home, away, canBet: false, message: 'Kelly recomienda apuesta 0 en este partido — se descarta.' }
  }

  const bet = {
    sport, home, away, pick: best.key, label: best.label,
    odds: best.odds, prob: best.prob, edge: best.edgeVsMarket,
    stake, stakeFraction: fraction, fullKelly,
    bankrollAtBet: session.bankroll,
  }
  session.pendingBets.push(bet)
  return { sport, home, away, canBet: true, recommendation: bet }
}

export function evaluateFixture(session, fixture) {
  if (session.status !== 'active') return { canBet: false, message: statusMessage(session) }
  return evaluateOne(session, fixture)
}

// Evaluates a whole batch of upcoming fixtures (e.g. today's bet365
// coupon, mixing sports) in one go and returns the list of individual results.
export function scanFixtures(session, fixtures) {
  if (session.status !== 'active') {
    return { results: [], message: statusMessage(session) }
  }
  const results = fixtures.map(f => evaluateOne(session, f))
  return { results, message: statusMessage(session) }
}

export function resolveBet(session, { sport, home, away, outcome }) {
  if (session.pendingBets.length === 0) throw new Error('No hay ninguna apuesta pendiente que resolver.')

  let index = 0
  if (home && away) {
    index = findPending(session, sport, home, away)
    if (index === -1) throw new Error(`No hay ninguna apuesta pendiente para ${home} vs ${away}.`)
  } else if (session.pendingBets.length > 1) {
    throw new Error(`Hay ${session.pendingBets.length} apuestas pendientes — especifica --sport, --home y --away para indicar cuál resolver.`)
  }

  const [bet] = session.pendingBets.splice(index, 1)
  const won = outcome === bet.pick
  const profit = won ? bet.stake * (bet.odds - 1) : -bet.stake
  session.bankroll += profit

  session.history.push({
    date: new Date().toISOString(), sport: bet.sport, home: bet.home, away: bet.away, pick: bet.pick,
    odds: bet.odds, prob: bet.prob, edge: bet.edge, stake: bet.stake,
    outcome, won, profit, bankrollAfter: session.bankroll,
  })

  // We only know W/D/L here (not the real scoreline), so football gets a
  // neutral synthetic 1-0/0-1/0-0 goal difference (multiplier stays at 1).
  const syntheticGoals = outcome === 'home' ? [1, 0] : outcome === 'away' ? [0, 1] : [0, 0]
  updateRatings(bet.sport, session.ratingsBySport[bet.sport], bet.home, bet.away, {
    homeScore: syntheticGoals[0], awayScore: syntheticGoals[1], homeWon: outcome === 'home',
  })

  const profitPct = (session.bankroll - session.initialBankroll) / session.initialBankroll
  if (session.takeProfitPct != null && profitPct >= session.takeProfitPct) session.status = 'stopped_profit'
  else if (session.stopLossPct != null && profitPct <= -session.stopLossPct) session.status = 'stopped_loss'

  return { bet: session.history[session.history.length - 1], message: statusMessage(session) }
}

export function sessionStatus(session) {
  return { ...session, message: statusMessage(session) }
}
