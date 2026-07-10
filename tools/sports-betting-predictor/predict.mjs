#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// Sports Betting Predictor — Elo + Poisson value-betting model
//
// USO:
//   node predict.mjs backtest --data data/sample-matches.csv
//   node predict.mjs backtest --data data/sample-matches.csv --bankroll 500 --edge 0.05
//   node predict.mjs backtest --data data/sample-matches.csv --take-profit 0.2 --stop-loss 0.15
//   node predict.mjs fixture --data data/sample-matches.csv \
//       --home "Team A" --away "Team B" \
//       --odds-home 2.10 --odds-draw 3.40 --odds-away 3.20
//   node predict.mjs session start --data data/sample-matches.csv --bankroll 1000 --take-profit 0.2 --stop-loss 0.15
//   node predict.mjs session bet --home "Team A" --away "Team B" --odds-home 2.10 --odds-draw 3.40 --odds-away 3.20
//   node predict.mjs session result --outcome home
//   node predict.mjs session status
//
// IMPORTANTE: esto es un modelo estadístico, no una garantía de
// ganancias. Ver README.md para el descargo de responsabilidad completo.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync } from 'fs'
import { parseCsv } from './lib/csv.mjs'
import { EloRatings } from './lib/elo.mjs'
import { expectedGoals, matchProbabilities } from './lib/poisson.mjs'
import { fairProbabilities, edge as computeEdge, overround } from './lib/odds.mjs'
import { recommendedStake } from './lib/kelly.mjs'
import { runBacktest } from './lib/backtest.mjs'
import { startSession, loadSession, saveSession, evaluateFixture, resolveBet, sessionStatus } from './lib/session.mjs'

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
    date: r.date,
    home: r.home,
    away: r.away,
    home_goals: Number(r.home_goals),
    away_goals: Number(r.away_goals),
    odds_home: Number(r.odds_home),
    odds_draw: Number(r.odds_draw),
    odds_away: Number(r.odds_away),
  }))
}

function pct(x) { return `${(x * 100).toFixed(1)}%` }
function money(x) { return x.toFixed(2) }

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

  console.log('\n📊 BACKTEST — Elo + Poisson value-betting model\n')
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
      console.log(`  ${b.date}  ${b.home} vs ${b.away}  → ${b.pick.toUpperCase()} @ ${b.odds}  ` +
        `edge=${pct(b.edge)}  stake=${money(b.stake)}  ${b.won ? '✅ +' + money(b.profit) : '❌ ' + money(b.profit)}` +
        `  bankroll=${money(b.bankrollAfter)}`)
    }
  }

  console.log('\n⚠️  Resultado histórico, no garantiza resultados futuros. Ver README.md.\n')
}

function runFixtureCommand(args) {
  const required = ['data', 'home', 'away', 'odds-home', 'odds-draw', 'odds-away']
  for (const key of required) {
    if (!args[key]) {
      console.error(`❌ Falta --${key}`)
      process.exit(1)
    }
  }

  const matches = loadMatches(args.data)
  const ratings = new EloRatings()
  for (const m of [...matches].sort((a, b) => new Date(a.date) - new Date(b.date))) {
    ratings.update(m.home, m.away, m.home_goals, m.away_goals)
  }

  const ratingHome = ratings.getRating(args.home)
  const ratingAway = ratings.getRating(args.away)
  const eloDiff = ratingHome + ratings.homeAdvantage - ratingAway
  const { lambdaHome, lambdaAway } = expectedGoals(eloDiff)
  const model = matchProbabilities(lambdaHome, lambdaAway)

  const oddsHome = Number(args['odds-home'])
  const oddsDraw = Number(args['odds-draw'])
  const oddsAway = Number(args['odds-away'])
  const fair = fairProbabilities([oddsHome, oddsDraw, oddsAway])
  const bankroll = Number(args.bankroll || 1000)
  const kellyMultiplier = Number(args.kelly || 0.25)

  console.log(`\n⚽ ${args.home} (Elo ${ratingHome.toFixed(0)}) vs ${args.away} (Elo ${ratingAway.toFixed(0)})\n`)
  console.log(`Goles esperados:          ${args.home} ${lambdaHome.toFixed(2)} — ${lambdaAway.toFixed(2)} ${args.away}`)
  console.log(`Margen de la casa:        ${pct(overround([oddsHome, oddsDraw, oddsAway]) - 1)}\n`)

  const rows = [
    { key: 'home', label: args.home, odds: oddsHome, prob: model.home, fair: fair[0] },
    { key: 'draw', label: 'Empate', odds: oddsDraw, prob: model.draw, fair: fair[1] },
    { key: 'away', label: args.away, odds: oddsAway, prob: model.away, fair: fair[2] },
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
    console.log(`\n✅ Sesión creada en ${statePath}`)
    console.log(`   Bankroll inicial: ${money(session.bankroll)}`)
    if (session.takeProfitPct != null) console.log(`   Se parará automáticamente al ganar +${pct(session.takeProfitPct)}`)
    if (session.stopLossPct != null) console.log(`   Se parará automáticamente al perder -${pct(session.stopLossPct)}`)
    console.log('\nSiguiente paso: node predict.mjs session bet --home ... --away ... --odds-home ... --odds-draw ... --odds-away ...\n')
    return
  }

  if (sub === 'bet') {
    const required = ['home', 'away', 'odds-home', 'odds-draw', 'odds-away']
    for (const key of required) {
      if (!args[key]) { console.error(`❌ Falta --${key}`); process.exit(1) }
    }
    const session = loadSession(statePath)
    const result = evaluateFixture(session, {
      home: args.home, away: args.away,
      oddsHome: Number(args['odds-home']), oddsDraw: Number(args['odds-draw']), oddsAway: Number(args['odds-away']),
    })
    saveSession(statePath, session)

    if (!result.canBet) { console.log(`\n${result.message}\n`); return }

    const r = result.recommendation
    console.log(`\n✅ Value bet: ${r.label} (${r.pick}) @ ${r.odds}`)
    console.log(`   Probabilidad del modelo: ${pct(r.prob)} | edge vs cuota: +${pct(r.edge)}`)
    console.log(`   Bankroll actual: ${money(r.bankrollAtBet)} | apuesta recomendada: ${money(r.stake)} (${pct(r.stakeFraction)} del bankroll, Kelly completo ${pct(r.fullKelly)})`)
    console.log('\nCuando termine el partido: node predict.mjs session result --outcome home|draw|away\n')
    return
  }

  if (sub === 'result') {
    if (!args.outcome || !['home', 'draw', 'away'].includes(args.outcome)) {
      console.error('❌ Falta --outcome home|draw|away')
      process.exit(1)
    }
    const session = loadSession(statePath)
    const { bet, message } = resolveBet(session, args.outcome)
    saveSession(statePath, session)

    console.log(`\n${bet.won ? '✅ Acertada' : '❌ Fallada'}: ${bet.home} vs ${bet.away} → ${bet.pick.toUpperCase()} @ ${bet.odds}`)
    console.log(`   ${bet.profit >= 0 ? '+' : ''}${money(bet.profit)}  →  bankroll: ${money(bet.bankrollAfter)}`)
    console.log(`\n${message}\n`)
    return
  }

  if (sub === 'status') {
    const session = sessionStatus(loadSession(statePath))
    const profitPct = (session.bankroll - session.initialBankroll) / session.initialBankroll
    console.log(`\n📈 Estado de la sesión (${statePath})`)
    console.log(`   Bankroll: ${money(session.bankroll)} (inicial ${money(session.initialBankroll)})`)
    console.log(`   Ganancia/pérdida: ${profitPct >= 0 ? '+' : ''}${pct(profitPct)}`)
    console.log(`   Apuestas resueltas: ${session.history.length}`)
    if (session.pending) console.log(`   Apuesta pendiente: ${session.pending.home} vs ${session.pending.away} → ${session.pending.pick}`)
    console.log(`\n${session.message}\n`)
    return
  }

  console.log(`
Uso:
  node predict.mjs session start  --bankroll 1000 --take-profit 0.2 --stop-loss 0.15 [--data historico.csv] [--kelly 0.25] [--stake-cap 0.05] [--edge 0.03] [--state archivo.json]
  node predict.mjs session bet    --home "Equipo A" --away "Equipo B" --odds-home 2.10 --odds-draw 3.40 --odds-away 3.20 [--state archivo.json]
  node predict.mjs session result --outcome home|draw|away [--state archivo.json]
  node predict.mjs session status [--state archivo.json]
`)
  process.exit(sub ? 1 : 0)
}

const args = parseArgs(process.argv.slice(2))
const command = args._[0]

if (command === 'backtest') runBacktestCommand(args)
else if (command === 'fixture') runFixtureCommand(args)
else if (command === 'session') runSessionCommand(args)
else {
  console.log(`
Uso:
  node predict.mjs backtest --data <archivo.csv> [--bankroll 1000] [--edge 0.03] [--kelly 0.25] [--stake-cap 0.05] [--take-profit 0.2] [--stop-loss 0.15] [--verbose]
  node predict.mjs fixture  --data <archivo.csv> --home "Equipo A" --away "Equipo B" --odds-home 2.10 --odds-draw 3.40 --odds-away 3.20
  node predict.mjs session  start|bet|result|status ...   (ver "node predict.mjs session" para el detalle)

Ver README.md para el formato del CSV y el descargo de responsabilidad.
`)
  process.exit(command ? 1 : 0)
}
