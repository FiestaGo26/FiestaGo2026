#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// Sports Betting Predictor — Elo + Poisson value-betting model
//
// USO:
//   node predict.mjs backtest --data data/sample-matches.csv
//   node predict.mjs backtest --data data/sample-matches.csv --bankroll 500 --edge 0.05
//   node predict.mjs fixture --data data/sample-matches.csv \
//       --home "Team A" --away "Team B" \
//       --odds-home 2.10 --odds-draw 3.40 --odds-away 3.20
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

const args = parseArgs(process.argv.slice(2))
const command = args._[0]

if (command === 'backtest') runBacktestCommand(args)
else if (command === 'fixture') runFixtureCommand(args)
else {
  console.log(`
Uso:
  node predict.mjs backtest --data <archivo.csv> [--bankroll 1000] [--edge 0.03] [--kelly 0.25] [--stake-cap 0.05] [--verbose]
  node predict.mjs fixture  --data <archivo.csv> --home "Equipo A" --away "Equipo B" --odds-home 2.10 --odds-draw 3.40 --odds-away 3.20

Ver README.md para el formato del CSV y el descargo de responsabilidad.
`)
  process.exit(command ? 1 : 0)
}
