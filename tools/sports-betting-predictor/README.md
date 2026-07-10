# Sports Betting Predictor

Herramienta de línea de comandos, independiente del resto del proyecto
FiestaGo, que estima probabilidades de resultado en partidos de fútbol
y detecta **value bets**: apuestas donde la probabilidad estimada por
el modelo es mayor que la que implican las cuotas de la casa.

## ⚠️ Descargo de responsabilidad — leer antes de usar

**Ningún algoritmo puede garantizar ganancias en apuestas deportivas.**
Los mercados de apuestas son razonablemente eficientes, las casas de
apuestas ajustan las cuotas constantemente y aplican un margen (el
"overround") que hace que, en promedio y a largo plazo, el apostador
pierda dinero salvo que tenga una ventaja real y sostenida sobre el
mercado. Este modelo:

- Es una estimación estadística basada en resultados históricos e Elo,
  **no información privilegiada ni un sistema infalible**.
- Puede estar mal calibrado, sobreajustado a los datos de ejemplo, o
  quedarse obsoleto según cambian las plantillas/forma de los equipos.
- El backtest sobre datos pasados **no garantiza resultados futuros**
  (riesgo de "curve fitting").
- No constituye asesoramiento financiero.

Si decides apostar dinero real: hazlo solo con dinero que puedas
permitirte perder, usa siempre un tamaño de apuesta fraccionado
(ver Kelly más abajo) y comprueba la legislación de tu país/región
sobre apuestas online. Si sientes que el juego se te va de las manos,
en España puedes contactar con el teléfono de ayuda al jugador
(900 200 225) o con Jugadores Anónimos.

## Cómo funciona el modelo

1. **Elo rating** (`lib/elo.mjs`) — cada equipo tiene un rating que se
   actualiza partido a partido según el resultado real y la diferencia
   de goles (metodología de [eloratings.net](https://www.eloratings.net/about)),
   con ventaja de campo configurable.
2. **Modelo de Poisson** (`lib/poisson.mjs`) — la diferencia de Elo
   entre dos equipos se traduce en goles esperados (λ) para cada uno,
   y se calcula la probabilidad de cada marcador posible asumiendo
   goles independientes con distribución de Poisson. Sumando la
   matriz de marcadores se obtiene P(victoria local), P(empate),
   P(victoria visitante), over/under 2.5 y ambos marcan.
3. **Cuotas y margen** (`lib/odds.mjs`) — convierte las cuotas
   decimales en probabilidades implícitas y calcula la probabilidad
   "justa" quitando el margen de la casa (overround).
4. **Detección de valor** — si `probabilidad del modelo > probabilidad
   implícita de la cuota` por encima de un umbral (`--edge`, 3% por
   defecto), y también por encima de la probabilidad "justa" del
   mercado (para reducir falsos positivos por error del modelo), se
   marca como value bet.
5. **Kelly Criterion** (`lib/kelly.mjs`) — calcula el tamaño de
   apuesta óptimo para crecimiento de bankroll a largo plazo, pero por
   defecto usa **Kelly fraccional (25%)** y un tope máximo (5% del
   bankroll) porque el Kelly completo es extremadamente sensible a
   errores en la probabilidad estimada.
6. **Backtest** (`lib/backtest.mjs`) — simula el bankroll a lo largo
   del histórico, actualizando el Elo *después* de evaluar cada
   apuesta (walk-forward, sin fuga de información del futuro).

## Uso

```bash
cd tools/sports-betting-predictor

# Backtest sobre el histórico de ejemplo (datos SINTÉTICOS, ver más abajo)
node predict.mjs backtest --data data/sample-matches.csv

# Con más detalle, apuesta por apuesta
node predict.mjs backtest --data data/sample-matches.csv --verbose

# Ajustando parámetros de riesgo
node predict.mjs backtest --data data/sample-matches.csv \
  --bankroll 500 --edge 0.05 --kelly 0.25 --stake-cap 0.05

# Predecir un partido nuevo dado el histórico + cuotas actuales
node predict.mjs fixture --data data/sample-matches.csv \
  --home "Real Norte" --away "Sporting Este" \
  --odds-home 1.60 --odds-draw 4.20 --odds-away 6.50

# Backtest con reglas de parada (para validar la estrategia antes de usarla en vivo)
node predict.mjs backtest --data data/sample-matches.csv --take-profit 0.2 --stop-loss 0.15
```

### Parámetros

| Flag | Comando | Por defecto | Descripción |
|------|---------|-------------|-------------|
| `--data` | ambos | — | CSV con histórico de partidos + cuotas de cierre |
| `--bankroll` | ambos | 1000 | Bankroll inicial / actual |
| `--edge` | backtest | 0.03 | Edge mínimo vs cuota para apostar |
| `--kelly` | ambos | 0.25 | Multiplicador de Kelly fraccional |
| `--stake-cap` | backtest | 0.05 | Tope máximo de apuesta (fracción del bankroll) |
| `--take-profit` | backtest | — | Fracción de ganancia sobre el bankroll inicial a partir de la cual se para la sesión (p.ej. `0.2` = +20%) |
| `--stop-loss` | backtest | — | Fracción de pérdida a partir de la cual se para la sesión (p.ej. `0.15` = -15%) |
| `--home/--away` | fixture | — | Nombres de los equipos (deben existir en `--data`) |
| `--odds-home/--odds-draw/--odds-away` | fixture | — | Cuotas decimales actuales del partido a evaluar |

## Modo `session` — apuestas encadenadas con reinversión automática y parada al objetivo

`backtest` y `fixture` son de un solo uso (todo el histórico de una vez, o
un partido suelto). `session` es distinto: mantiene un **bankroll
persistente entre ejecuciones** (guardado en un archivo JSON local) para
usarlo partido a partido según van ocurriendo en la vida real, a lo
largo de días o semanas.

- **Reinversión automática**: cada nueva apuesta se calcula con Kelly
  fraccional sobre el bankroll *actual*, no sobre el inicial — si vas
  ganando, la siguiente apuesta recomendada es mayor en términos
  absolutos (interés compuesto); si vas perdiendo, es menor.
- **Parada automática**: en cuanto la ganancia acumulada alcanza
  `--take-profit` o la pérdida alcanza `--stop-loss`, la sesión pasa a
  estado `stopped_profit`/`stopped_loss` y deja de recomendar apuestas
  hasta que inicies una sesión nueva.
- **No ejecuta apuestas reales**: no se conecta a ninguna casa de
  apuestas ni mueve dinero. Tú metes la cuota disponible, la
  herramienta te dice si hay valor y cuánto apostar, y cuando termina
  el partido le dices el resultado real para que actualice el
  bankroll.

```bash
# 1. Arrancar sesión: bankroll inicial, objetivo de ganancia y límite de pérdida
node predict.mjs session start --data data/sample-matches.csv \
  --bankroll 1000 --take-profit 0.2 --stop-loss 0.15

# 2. Antes de cada partido: ¿hay valor? ¿cuánto apostar?
node predict.mjs session bet \
  --home "Real Norte" --away "Sporting Este" \
  --odds-home 1.60 --odds-draw 4.20 --odds-away 6.50

# 3. Cuando termina el partido: registrar el resultado real
node predict.mjs session result --outcome away

# 4. Ver el estado de la sesión en cualquier momento
node predict.mjs session status
```

El estado se guarda por defecto en `.session-state.json` (ignorado por
git); usa `--state <archivo>` para llevar varias sesiones en paralelo
(por ejemplo, una por competición o por bankroll).

Solo se permite una apuesta pendiente a la vez: hay que resolver el
resultado (`session result`) antes de evaluar el siguiente partido.

## Formato del CSV

```
date,home,away,home_goals,away_goals,odds_home,odds_draw,odds_away
2024-08-10,Real Norte,Atletico Sur,4,1,1.97,3.81,5.49
```

- `date`: cualquier formato que entienda `new Date()` (recomendado `YYYY-MM-DD`).
- `home`/`away`: nombre del equipo (debe ser consistente entre filas).
- `home_goals`/`away_goals`: goles del partido ya finalizado.
- `odds_home`/`odds_draw`/`odds_away`: cuotas decimales (formato europeo) de cierre.

## Datos de ejemplo

`data/sample-matches.csv` es un dataset **completamente sintético**
(8 equipos ficticios, 3 vueltas de liga), generado con
`data/generate-sample-data.mjs` para poder probar la herramienta sin
necesitar una fuente de datos real. Regenéralo con:

```bash
node data/generate-sample-data.mjs > data/sample-matches.csv
```

Para uso real necesitas tus propios datos históricos (resultados +
cuotas de cierre) de una fuente fiable (proveedor de datos deportivos,
API de una casa de apuestas, etc.) — este repositorio no incluye ni
se conecta a ninguna.

## Limitaciones conocidas

- El modelo asume que la fuerza de un equipo se resume en un único
  rating Elo; no incorpora lesiones, alineaciones, clima, motivación,
  etc.
- La conversión Elo → goles esperados usa una constante de calibración
  simple (`GOALS_PER_ELO_POINT` en `lib/poisson.mjs`); en un uso serio
  conviene recalibrarla con tus propios datos.
- Cuantas menos partidos históricos tenga un equipo, menos fiable es
  su rating Elo (arranca en 1500 para todos).
- El backtest usa cuotas de **cierre**; en la práctica solo vas a
  poder apostar a las cuotas disponibles en el momento, que pueden ser
  peores.
