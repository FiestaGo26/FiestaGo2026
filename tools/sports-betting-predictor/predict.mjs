#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// Sports Betting Predictor — Elo (+ Poisson en fútbol) value-betting model
// Deportes soportados: football, tennis, basketball (solo mercado de
// ganador del partido / 1X2 / moneyline — ver README.md).
//
// USO:
//   node predict.mjs backtest --data data/sample-matches.csv
//   node predict.mjs backtest --data data/sample-matches.csv --bankroll 500 --edge 0.05
//   node predict.mjs backtest --data data/sample-matches.csv --take-profit 0.2 --stop-loss 0.15
//   node predict.mjs fixture --data data/sample-matches.csv --sport football \
//       --home "Team A" --away "Team B" \
//       --odds-home 2.10 --odds-draw 3.40 --odds-away 3.20
//   node predict.mjs session start --data data/sample-matches.csv --bankroll 1000 --take-profit 0.2 --stop-loss 0.15
//   node predict.mjs session bet --sport tennis --home "Player A" --away "Player B" --odds-home 1.80 --odds-away 2.00
//   node predict.mjs session result --outcome home
//   node predict.mjs session status
//
// IMPORTANTE: esto es un modelo estadístico, no una garantía de
// ganancias. Ver README.md para el descargo de responsabilidad completo.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync } from 'fs'
import { parseCsv } from './lib/csv.mjs'
import { fairProbabilities, edge as computeEdge, overround } from './lib/odds.mjs'
import { recommendedStake } from './lib/kelly.mjs'
import { runBacktest } from './lib/backtest.mjs'
import { startSession, loadSession, saveSession, evaluateFixture, scanFixtures, resolveBet, sessionStatus } from './lib/session.mjs'
import { SPORT_CONFIG, isValidSport, createRatingsBySport, modelProbabilities, updateRatings } from './lib/sports.mjs'
import { simulateProjection } from './lib/projection.mjs'

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) args[key] = true
      else { args[key] = next; i++ }
    } else args._.push(a)
  }
  return args
}

function loadMatches(path) {
  const rows = parseCsv(readFileSync(path, 'utf-8'))
  return rows.map(r => ({
    sport: r.sport,
    date: r.date,
    home: r.home,
    away: r.away,
    home_score: Number(r.home_score),
    away_score: Number(r.away_score),
    odds_home: Number(r.odds_home),
    odds_draw: r.odds_draw ? Number(r.odds_draw) : null,
    odds_away: Number(r.odds_away),
  }))
}

function pct(x) { return `${(x * 100).toFixed(1)}%` }
function money(x) { return x.toFixed(2) }

function requireSport(sport) {
  if (!isValidSport(sport)) {
    console.error(`❌ --sport debe ser uno de: ${Object.keys(SPORT_CONFIG).join(', ')}`)
    process.exit(1)
  }
}

function printRecommendation(r) {
  console.log(`\n✅ Value bet [${SPORT_CONFIG[r.sport].label}]: ${r.label} (${r.pick}) @ ${r.odds}`)
  console.log(`   Probabilidad del modelo: ${pct(r.prob)} | edge vs cuota: +${pct(r.edge)}`)
  console.log(`   Bankroll actual: ${money(r.bankrollAtBet)} | apuesta recomendada: ${money(r.stake)} (${pct(r.stakeFraction)} del bankroll, Kelly completo ${pct(r.fullKelly)})`)
  console.log('\nColócala tú en bet365 y luego: node predict.mjs session result --sport ' + r.sport + ' --home "' + r.home + '" --away "' + r.away + '" --outcome home|draw|away\n')
}

function runBacktestCommand(args) {
  if (!args.data) {
    console.error('❌ Falta --data <archivo.csv>')
    process.exit(1)
  }
  const matches = loadMatches(args.data)
  const options = {
    initialBankroll: Number(args.bankroll || 1000),
    edgeThreshold: Number(args.edge || 0.03),
    kellyMultiplier: Number(args.kelly || 0.25),
    maxStakeFraction: Number(args['stake-cap'] || 0.05),
    takeProfitPct: args['take-profit'] !== undefined ? Number(args['take-profit']) : null,
    stopLossPct: args['stop-loss'] !== undefined ? Number(args['stop-loss']) : null,
  }

  const result = runBacktest(matches, options)
  const s = result.summary

  console.log('\n📊 BACKTEST — Elo (+ Poisson en fútbol) value-betting model\n')
  console.log(`Partidos analizados:      ${s.numMatches}`)
  console.log(`Apuestas realizadas:      ${s.numBets} (umbral de edge: ${pct(options.edgeThreshold)})`)
  console.log(`Tasa de acierto:          ${pct(s.winRate)}`)
  console.log(`Bankroll inicial:         ${money(s.initialBankroll)}`)
  console.log(`Bankroll final:           ${money(s.finalBankroll)}`)
  console.log(`Beneficio/pérdida total:  ${s.totalProfit >= 0 ? '+' : ''}${money(s.totalProfit)}`)
  console.log(`ROI sobre lo apostado:    ${s.roiOnStaked >= 0 ? '+' : ''}${pct(s.roiOnStaked)}`)
  console.log(`Máximo drawdown:          ${pct(s.maxDrawdownPct)}`)
  if (s.stoppedEarly) {
    const label = s.stopReason === 'take_profit' ? '🎯 objetivo de ganancia alcanzado' : '🛑 stop-loss alcanzado'
    console.log(`Sesión parada:            ${label} el ${s.stopDate} (quedaban partidos sin usar)`)
  }

  if (args.verbose) {
    console.log('\nDetalle de apuestas:')
    for (const b of result.bets) {
      console.log(`  [${b.sport}] ${b.date}  ${b.home} vs ${b.away}  → ${b.pick.toUpperCase()} @ ${b.odds}  ` +
        `edge=${pct(b.edge)}  stake=${money(b.stake)}  ${b.won ? '✅ +' + money(b.profit) : '❌ ' + money(b.profit)}` +
        `  bankroll=${money(b.bankrollAfter)}`)
    }
  }

  console.log('\n⚠️  Resultado histórico, no garantiza resultados futuros. Ver README.md.\n')
}

function runFixtureCommand(args) {
  const required = ['data', 'sport', 'home', 'away', 'odds-home', 'odds-away']
  for (const key of required) {
    if (!args[key]) {
      console.error(`❌ Falta --${key}`)
      process.exit(1)
    }
  }
  requireSport(args.sport)
  const hasDraw = SPORT_CONFIG[args.sport].outcomes.includes('draw')
  if (hasDraw && !args['odds-draw']) {
    console.error('❌ Falta --odds-draw (obligatoria en fútbol)')
    process.exit(1)
  }

  const matches = loadMatches(args.data).filter(m => m.sport === args.sport)
  const ratingsBySport = createRatingsBySport()
  const ratings = ratingsBySport[args.sport]
  for (const m of [...matches].sort((a, b) => new Date(a.date) - new Date(b.date))) {
    updateRatings(args.sport, ratings, m.home, m.away, { homeScore: m.home_score, awayScore: m.away_score, homeWon: m.home_score > m.away_score })
  }

  const model = modelProbabilities(args.sport, ratings, args.home, args.away)
  const ratingHome = ratings.getRating(args.home)
  const ratingAway = ratings.getRating(args.away)

  const oddsHome = Number(args['odds-home'])
  const oddsDraw = hasDraw ? Number(args['odds-draw']) : null
  const oddsAway = Number(args['odds-away'])
  const oddsList = hasDraw ? [oddsHome, oddsDraw, oddsAway] : [oddsHome, oddsAway]
  const fair = fairProbabilities(oddsList)
  const bankroll = Number(args.bankroll || 1000)
  const kellyMultiplier = Number(args.kelly || 0.25)

  console.log(`\n🏆 [${SPORT_CONFIG[args.sport].label}] ${args.home} (Elo ${ratingHome.toFixed(0)}) vs ${args.away} (Elo ${ratingAway.toFixed(0)})\n`)
  console.log(`Margen de la casa:        ${pct(overround(oddsList) - 1)}\n`)

  const rows = hasDraw
    ? [
        { key: 'home', label: args.home, odds: oddsHome, prob: model.home, fair: fair[0] },
        { key: 'draw', label: 'Empate', odds: oddsDraw, prob: model.draw, fair: fair[1] },
        { key: 'away', label: args.away, odds: oddsAway, prob: model.away, fair: fair[2] },
      ]
    : [
        { key: 'home', label: args.home, odds: oddsHome, prob: model.home, fair: fair[0] },
        { key: 'away', label: args.away, odds: oddsAway, prob: model.away, fair: fair[1] },
      ]

  console.log('Resultado   Modelo   Mercado(justo)   Cuota   Edge vs cuota')
  for (const r of rows) {
    const e = computeEdge(r.prob, r.odds)
    console.log(`${r.label.padEnd(11)} ${pct(r.prob).padStart(6)}   ${pct(r.fair).padStart(13)}   ${r.odds.toFixed(2).padStart(5)}   ${(e >= 0 ? '+' : '') + pct(e)}`)
  }

  const best = rows
    .map(r => ({ ...r, e: computeEdge(r.prob, r.odds) }))
    .sort((a, b) => b.e - a.e)[0]

  console.log()
  if (best.e > 0.03 && best.prob > best.fair) {
    const { stake, fraction, fullKelly } = recommendedStake(bankroll, best.prob, best.odds, { kellyMultiplier })
    console.log(`✅ Value bet detectado: ${best.label} @ ${best.odds}`)
    console.log(`   Kelly completo: ${pct(fullKelly)} | Kelly fraccional (${kellyMultiplier}x): ${pct(fraction)}`)
    console.log(`   Apuesta sugerida sobre bankroll de ${money(bankroll)}: ${money(stake)}`)
  } else {
    console.log('ℹ️  No hay edge suficiente en ningún resultado — no se recomienda apostar en este partido.')
  }

  console.log('\n⚠️  Estimación de un modelo estadístico, no una garantía. Ver README.md.\n')
}

function runProjectCommand(args) {
  if (!args.bankroll) { console.error('❌ Falta --bankroll <cantidad>'); process.exit(1) }
  const params = {
    initialBankroll: Number(args.bankroll),
    days: Number(args.days || 30),
    betsPerDay: Number(args['bets-per-day'] || 1.5),
    avgOdds: Number(args['avg-odds'] || 2.2),
    edgeRange: [Number(args['edge-min'] || 0.03), Number(args['edge-max'] || 0.08)],
    kellyMultiplier: Number(args.kelly || 0.25),
    maxStakeFraction: Number(args['stake-cap'] || 0.05),
    trials: Number(args.trials || 5000),
  }
  const r = simulateProjection(params)

  console.log(`\n🎲 PROYECCIÓN (Monte Carlo, ${r.trials} simulaciones de ${params.days} días)\n`)
  console.log(`Supuestos: ~${params.betsPerDay} apuestas de valor/día, cuota media ${params.avgOdds}, ` +
    `edge real asumido ${pct(params.edgeRange[0])}-${pct(params.edgeRange[1])}, Kelly ${params.kellyMultiplier}x\n`)
  console.log(`Bankroll inicial:         ${money(params.initialBankroll)}`)
  console.log(`Peor 10% de los casos:    ${money(r.p10)}`)
  console.log(`Percentil 25:             ${money(r.p25)}`)
  console.log(`Mediana:                  ${money(r.median)}`)
  console.log(`Percentil 75:             ${money(r.p75)}`)
  console.log(`Mejor 10% de los casos:   ${money(r.p90)}`)
  console.log(`Media:                    ${money(r.mean)}`)
  console.log(`Probabilidad de acabar en ganancia: ${pct(r.probProfit)}`)
  console.log(`Probabilidad de caer por debajo del 20% del bankroll en algún momento: ${pct(r.probSevereDrawdown)}`)
  console.log('\n⚠️  Esto asume que el edge existe de verdad y se mantiene todo el periodo — la')
  console.log('    incertidumbre real más grande no está en esta simulación, sino en si esa')
  console.log('    ventaja existe en el mercado real. Ver README.md.\n')
}

// --- session: apuestas encadenadas con bankroll persistente que se ---
// --- reinvierte automáticamente y se para sola al llegar al objetivo ---
// --- de ganancia o al límite de pérdida. -----------------------------

function runSessionCommand(args) {
  const sub = args._[1]
  const statePath = args.state || '.session-state.json'

  if (sub === 'start') {
    if (!args.bankroll) { console.error('❌ Falta --bankroll <cantidad>'); process.exit(1) }
    if (!args['take-profit'] && !args['stop-loss']) {
      console.error('❌ Especifica al menos --take-profit (p.ej. 0.2 = parar al +20%) o --stop-loss (p.ej. 0.15 = parar al -15%)')
      process.exit(1)
    }
    const session = startSession(statePath, {
      dataPath: args.data,
      bankroll: Number(args.bankroll),
      takeProfitPct: args['take-profit'] !== undefined ? Number(args['take-profit']) : null,
      stopLossPct: args['stop-loss'] !== undefined ? Number(args['stop-loss']) : null,
      kellyMultiplier: Number(args.kelly || 0.25),
      maxStakeFraction: Number(args['stake-cap'] || 0.05),
      edgeThreshold: Number(args.edge || 0.03),
    })
    console.log(`\n✅ Sesión creada en ${statePath} (fútbol, tenis y baloncesto)`)
    console.log(`   Bankroll inicial: ${money(session.bankroll)}`)
    if (session.takeProfitPct != null) console.log(`   Se parará automáticamente al ganar +${pct(session.takeProfitPct)}`)
    if (session.stopLossPct != null) console.log(`   Se parará automáticamente al perder -${pct(session.stopLossPct)}`)
    console.log('\nSiguiente paso: node predict.mjs session bet --sport football|tennis|basketball --home ... --away ... --odds-home ... [--odds-draw ...] --odds-away ...\n')
    return
  }

  if (sub === 'bet') {
    requireSport(args.sport)
    const hasDraw = SPORT_CONFIG[args.sport].outcomes.includes('draw')
    const required = ['home', 'away', 'odds-home', 'odds-away', ...(hasDraw ? ['odds-draw'] : [])]
    for (const key of required) {
      if (!args[key]) { console.error(`❌ Falta --${key}`); process.exit(1) }
    }
    const session = loadSession(statePath)
    const result = evaluateFixture(session, {
      sport: args.sport, home: args.home, away: args.away,
      oddsHome: Number(args['odds-home']),
      oddsDraw: hasDraw ? Number(args['odds-draw']) : null,
      oddsAway: Number(args['odds-away']),
    })
    saveSession(statePath, session)

    if (!result.canBet) { console.log(`\n${result.message}\n`); return }

    printRecommendation(result.recommendation)
    return
  }

  if (sub === 'scan') {
    if (!args.fixtures) { console.error('❌ Falta --fixtures <archivo.csv>'); process.exit(1) }
    const fixtures = parseCsv(readFileSync(args.fixtures, 'utf-8')).map(r => ({
      sport: r.sport, home: r.home, away: r.away,
      oddsHome: Number(r.odds_home),
      oddsDraw: r.odds_draw ? Number(r.odds_draw) : null,
      oddsAway: Number(r.odds_away),
    }))
    const session = loadSession(statePath)
    const { results, message } = scanFixtures(session, fixtures)
    saveSession(statePath, session)

    if (results.length === 0) { console.log(`\n${message}\n`); return }

    console.log(`\n📋 Boletín analizado (${fixtures.length} partidos)\n`)
    const value = results.filter(r => r.canBet)
    for (const r of results) {
      if (r.canBet) console.log(`✅ [${r.sport}] ${r.home} vs ${r.away} → apostar ${r.recommendation.pick.toUpperCase()} @ ${r.recommendation.odds}, ${money(r.recommendation.stake)}`)
      else console.log(`—  [${r.sport}] ${r.home} vs ${r.away}: ${r.message}`)
    }
    console.log(`\n${value.length} apuesta(s) recomendada(s) de ${results.length} partidos analizados.`)
    if (value.length > 0) console.log(`Exposición total si las colocas todas: ${money(value.reduce((s, r) => s + r.recommendation.stake, 0))}`)
    console.log('\nColócalas tú en bet365 y luego registra cada resultado con:')
    console.log('  node predict.mjs session result --sport ... --home "..." --away "..." --outcome home|draw|away\n')
    return
  }

  if (sub === 'result') {
    if (!args.outcome || !['home', 'draw', 'away'].includes(args.outcome)) {
      console.error('❌ Falta --outcome home|draw|away')
      process.exit(1)
    }
    const session = loadSession(statePath)
    try {
      const { bet, message } = resolveBet(session, { sport: args.sport, home: args.home, away: args.away, outcome: args.outcome })
      saveSession(statePath, session)
      console.log(`\n${bet.won ? '✅ Acertada' : '❌ Fallada'}: [${bet.sport}] ${bet.home} vs ${bet.away} → ${bet.pick.toUpperCase()} @ ${bet.odds}`)
      console.log(`   ${bet.profit >= 0 ? '+' : ''}${money(bet.profit)}  →  bankroll: ${money(bet.bankrollAfter)}`)
      console.log(`\n${message}\n`)
    } catch (e) {
      console.error(`❌ ${e.message}`)
      process.exit(1)
    }
    return
  }

  if (sub === 'status') {
    const session = sessionStatus(loadSession(statePath))
    const profitPct = (session.bankroll - session.initialBankroll) / session.initialBankroll
    console.log(`\n📈 Estado de la sesión (${statePath})`)
    console.log(`   Bankroll: ${money(session.bankroll)} (inicial ${money(session.initialBankroll)})`)
    console.log(`   Ganancia/pérdida: ${profitPct >= 0 ? '+' : ''}${pct(profitPct)}`)
    console.log(`   Apuestas resueltas: ${session.history.length}`)
    if (session.pendingBets.length > 0) {
      console.log(`   Apuestas pendientes (${session.pendingBets.length}):`)
      for (const b of session.pendingBets) console.log(`     - [${b.sport}] ${b.home} vs ${b.away} → ${b.pick.toUpperCase()} @ ${b.odds}, ${money(b.stake)}`)
    }
    console.log(`\n${session.message}\n`)
    return
  }

  console.log(`
Uso:
  node predict.mjs session start  --bankroll 1000 --take-profit 0.2 --stop-loss 0.15 [--data historico.csv] [--kelly 0.25] [--stake-cap 0.05] [--edge 0.03] [--state archivo.json]
  node predict.mjs session bet    --sport football|tennis|basketball --home "A" --away "B" --odds-home 2.10 [--odds-draw 3.40] --odds-away 3.20 [--state archivo.json]
  node predict.mjs session scan   --fixtures boletin.csv [--state archivo.json]
  node predict.mjs session result --outcome home|draw|away [--sport ... --home "A" --away "B"] [--state archivo.json]
  node predict.mjs session status [--state archivo.json]
`)
  process.exit(sub ? 1 : 0)
}

const args = parseArgs(process.argv.slice(2))
const command = args._[0]

if (command === 'backtest') runBacktestCommand(args)
else if (command === 'fixture') runFixtureCommand(args)
else if (command === 'session') runSessionCommand(args)
else if (command === 'project') runProjectCommand(args)
else {
  console.log(`
Uso:
  node predict.mjs backtest --data <archivo.csv> [--bankroll 1000] [--edge 0.03] [--kelly 0.25] [--stake-cap 0.05] [--take-profit 0.2] [--stop-loss 0.15] [--verbose]
  node predict.mjs fixture  --data <archivo.csv> --sport football|tennis|basketball --home "A" --away "B" --odds-home 2.10 [--odds-draw 3.40] --odds-away 3.20
  node predict.mjs session  start|bet|scan|result|status ...   (ver "node predict.mjs session" para el detalle)
  node predict.mjs project  --bankroll 5 --days 30 [--bets-per-day 1.5] [--avg-odds 2.2] [--edge-min 0.03] [--edge-max 0.08] [--kelly 0.25] [--trials 5000]

Deportes soportados: football, tennis, basketball (solo mercado de ganador del partido).
Ver README.md para el formato del CSV y el descargo de responsabilidad.
`)
  process.exit(command ? 1 : 0)
}
