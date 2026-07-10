# Sports Betting Predictor

Herramienta de línea de comandos, independiente del resto del proyecto
FiestaGo, que estima probabilidades de resultado en partidos de
**fútbol, tenis y baloncesto** y detecta **value bets**: apuestas donde
la probabilidad estimada por el modelo es mayor que la que implican las
cuotas de la casa. Solo cubre el mercado de **ganador del partido**
(1X2 en fútbol, moneyline en tenis/baloncesto) — hándicaps, over/under,
sets, props, etc. no están modelados (ver "Limitaciones conocidas").

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
  quedarse obsoleto según cambian las plantillas/forma/lesiones.
- El backtest sobre datos pasados **no garantiza resultados futuros**
  (riesgo de "curve fitting") — y el dataset de ejemplo incluido es
  sintético, así que sus resultados de backtest no dicen nada sobre el
  mundo real.
- No constituye asesoramiento financiero.

**Sobre objetivos de "hacerse rico rápido" (p.ej. convertir 5€ en
100.000€ encadenando ~36 apuestas seguidas a cuota 1,30):** la
probabilidad de acertar 36 apuestas seguidas sin fallar ninguna, incluso
con un modelo que tenga ventaja real, está en el orden de 1 entre
3.000-50.000 — del mismo orden que un boleto de lotería, no una
estrategia. Por eso esta herramienta está pensada para **apuestas
independientes** que reinvierten ganancias con Kelly fraccional a lo
largo de muchas sesiones, con objetivos de ganancia realistas por
sesión (p.ej. +10-30%), no para encadenar una única racha de todo o
nada.

Si decides apostar dinero real: hazlo solo con dinero que puedas
permitirte perder, usa siempre un tamaño de apuesta fraccionado
(ver Kelly más abajo) y comprueba la legislación de tu país/región
sobre apuestas online. Si sientes que el juego se te va de las manos,
en España puedes contactar con el teléfono de ayuda al jugador
(900 200 225) o con Jugadores Anónimos.

## Cómo funciona el modelo

1. **Elo rating** (`lib/elo.mjs`) — cada equipo/jugador tiene un rating
   que se actualiza partido a partido según el resultado real, con
   ventaja de campo y K-factor configurables por deporte
   (`lib/sports.mjs`). En fútbol se pondera además por diferencia de
   goles (metodología de [eloratings.net](https://www.eloratings.net/about)).
2. **Modelo de probabilidad por deporte** (`lib/sports.mjs`):
   - **Fútbol** — la diferencia de Elo se traduce en goles esperados
     (λ) para cada equipo (`lib/poisson.mjs`), y se calcula la
     probabilidad de cada marcador posible con distribución de Poisson
     independiente por equipo. Sumando la matriz de marcadores se
     obtiene P(victoria local), P(empate), P(victoria visitante).
   - **Tenis y baloncesto** — no hay empate ni un equivalente natural a
     "goles", así que la diferencia de Elo se traduce directamente en
     probabilidad de victoria con la fórmula logística estándar (la
     misma que usa el ajedrez). Es un modelo más simple y menos
     probado que el de fútbol.
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
   del histórico (los tres deportes mezclados, cada uno con su propio
   pool de ratings Elo), actualizando el Elo *después* de evaluar cada
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
node predict.mjs fixture --data data/sample-matches.csv --sport football \
  --home "Real Norte" --away "Sporting Este" \
  --odds-home 1.60 --odds-draw 4.20 --odds-away 6.50

# Tenis/baloncesto: sin --odds-draw (no hay empate)
node predict.mjs fixture --data data/sample-matches.csv --sport tennis \
  --home "A. Rivas" --away "T. Ibarra" --odds-home 1.55 --odds-away 2.60

# Backtest con reglas de parada (para validar la estrategia antes de usarla en vivo)
node predict.mjs backtest --data data/sample-matches.csv --take-profit 0.2 --stop-loss 0.15
```

### Parámetros

| Flag | Comando | Por defecto | Descripción |
|------|---------|-------------|-------------|
| `--data` | ambos | — | CSV con histórico de partidos + cuotas de cierre |
| `--sport` | fixture | — | `football`, `tennis` o `basketball` |
| `--bankroll` | ambos | 1000 | Bankroll inicial / actual |
| `--edge` | backtest | 0.03 | Edge mínimo vs cuota para apostar |
| `--kelly` | ambos | 0.25 | Multiplicador de Kelly fraccional |
| `--stake-cap` | backtest | 0.05 | Tope máximo de apuesta (fracción del bankroll) |
| `--take-profit` | backtest | — | Fracción de ganancia sobre el bankroll inicial a partir de la cual se para la sesión (p.ej. `0.2` = +20%) |
| `--stop-loss` | backtest | — | Fracción de pérdida a partir de la cual se para la sesión (p.ej. `0.15` = -15%) |
| `--home/--away` | fixture | — | Nombres de los competidores (deben existir en `--data`) |
| `--odds-home/--odds-away` | fixture | — | Cuotas decimales actuales del partido a evaluar |
| `--odds-draw` | fixture | — | Solo fútbol; obligatoria en ese caso |

## Modo `session` — apuestas encadenadas con reinversión automática y parada al objetivo

`backtest` y `fixture` son de un solo uso (todo el histórico de una vez, o
un partido suelto). `session` es distinto: mantiene un **bankroll
persistente entre ejecuciones** (guardado en un archivo JSON local) para
usarlo partido a partido según van ocurriendo en la vida real, a lo
largo de días o semanas, **mezclando fútbol, tenis y baloncesto en la
misma sesión** (cada deporte mantiene su propio Elo, pero comparten
bankroll).

- **Reinversión automática**: cada nueva apuesta se calcula con Kelly
  fraccional sobre el bankroll *actual*, no sobre el inicial — si vas
  ganando, la siguiente apuesta recomendada es mayor en términos
  absolutos (interés compuesto); si vas perdiendo, es menor.
- **Parada automática**: en cuanto la ganancia acumulada alcanza
  `--take-profit` o la pérdida alcanza `--stop-loss`, la sesión pasa a
  estado `stopped_profit`/`stopped_loss` y deja de recomendar apuestas
  hasta que inicies una sesión nueva.
- **No ejecuta apuestas reales**: no se conecta a bet365 ni a ninguna
  otra casa de apuestas, y no mueve dinero. bet365 no ofrece una API
  pública para colocar apuestas, y automatizarlo por scraping/ingeniería
  inversa violaría sus términos de servicio (riesgo de cierre de cuenta
  y retención de fondos) — así que el paso de "apostar" lo haces tú, a
  mano, en la app o web de bet365. La herramienta decide qué apostar y
  cuánto; tú ejecutas y le reportas el resultado real.

```bash
# 1. Arrancar sesión: bankroll inicial, objetivo de ganancia y límite de pérdida
node predict.mjs session start --data data/sample-matches.csv \
  --bankroll 1000 --take-profit 0.2 --stop-loss 0.15

# 2a. Un partido suelto: ¿hay valor? ¿cuánto apostar?
node predict.mjs session bet --sport football \
  --home "Real Norte" --away "Sporting Este" \
  --odds-home 1.60 --odds-draw 4.20 --odds-away 6.50

# 2b. O varios de golpe, de cualquier deporte: copia del boletín de
#     bet365 los partidos que te interesan a un CSV
#     (sport,home,away,odds_home,odds_draw,odds_away — odds_draw vacía
#     en tenis/baloncesto) y analízalos todos a la vez
node predict.mjs session scan --fixtures data/sample-upcoming-fixtures.csv

# 3. Colocas tú la(s) apuesta(s) recomendada(s) en bet365. Cuando
#    termina cada partido, registra el resultado real (indicando
#    deporte y equipos si hay varias apuestas pendientes a la vez)
node predict.mjs session result --sport football --home "Real Norte" --away "Sporting Este" --outcome away

# 4. Ver el estado de la sesión en cualquier momento
node predict.mjs session status
```

El estado se guarda por defecto en `.session-state.json` (ignorado por
git); usa `--state <archivo>` para llevar varias sesiones en paralelo
(por ejemplo, una por bankroll).

Puede haber varias apuestas pendientes a la vez (por ejemplo, tras un
`scan` de una jornada completa con varios deportes). Si solo hay una
pendiente, `session result --outcome ...` la resuelve directamente; si
hay varias, hay que indicar `--sport`/`--home`/`--away` para saber cuál.
Ten en cuenta que el stake de cada apuesta de un mismo `scan` se calcula
sobre el bankroll del momento del análisis (no se compensan entre sí
porque ninguna se ha resuelto todavía) — tu exposición real ese día es
la suma de todas las que coloques.

### Sobre el objetivo de ganancia con bankrolls pequeños (p.ej. 5€)

Con un bankroll de 5€ y apuestas del 1-5% del bankroll (Kelly
fraccional), el crecimiento es **lento y modesto por diseño** — esa es
la única forma de que las apuestas sigan siendo del tamaño adecuado
según crece el bankroll, sin arriesgar la ruina en una mala racha. Un
`--take-profit` razonable para una sesión es algo como `0.2`-`0.5`
(parar al ganar 20-50% del bankroll de esa sesión), no un múltiplo de
20.000x. Hacer crecer 5€ hasta una cantidad grande, si es que ocurre,
requeriría encadenar **muchas sesiones independientes** a lo largo de
meses, cada una con su propio objetivo modesto — no una única racha.

## Formato del CSV

```
sport,date,home,away,home_score,away_score,odds_home,odds_draw,odds_away
football,2024-08-10,Real Norte,Atletico Sur,4,1,1.97,3.81,5.49
tennis,2024-08-11,A. Rivas,T. Ibarra,2,0,1.55,,2.60
basketball,2024-08-12,Halcones,Panteras,102,97,1.50,,2.90
```

- `sport`: `football`, `tennis` o `basketball`.
- `date`: cualquier formato que entienda `new Date()` (recomendado `YYYY-MM-DD`).
- `home`/`away`: nombre del equipo o jugador (debe ser consistente entre filas).
- `home_score`/`away_score`: resultado ya finalizado. En fútbol son
  goles reales (se usan también para el modelo de Poisson); en
  tenis/baloncesto basta con que refleje quién ganó (sets o puntos).
- `odds_home`/`odds_away`: cuotas decimales (formato europeo) de cierre.
- `odds_draw`: solo fútbol; déjala vacía en tenis/baloncesto.

El CSV de partidos por analizar (`session scan` / boletín) usa las
mismas columnas menos `date`, `home_score` y `away_score` (aún no se
conoce el resultado).

## Datos de ejemplo

`data/sample-matches.csv` es un dataset **completamente sintético**
(8 equipos/jugadores por deporte), generado con
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

- Solo se modela el mercado de **ganador del partido**. Hándicaps,
  over/under, sets/juegos, props, etc. necesitarían cada uno su propio
  modelo calibrado contra datos reales — no están implementados.
- El modelo asume que la fuerza de un equipo/jugador se resume en un
  único rating Elo; no incorpora lesiones, alineaciones, clima,
  superficie (tenis), motivación, etc.
- El modelo de tenis/baloncesto (Elo → probabilidad logística directa)
  es más simple y está menos contrastado que el de fútbol
  (Elo → Poisson de goles).
- La conversión Elo → goles esperados en fútbol usa una constante de
  calibración simple (`GOALS_PER_ELO_POINT` en `lib/poisson.mjs`); en
  un uso serio conviene recalibrarla con tus propios datos.
- Cuantos menos partidos históricos tenga un equipo/jugador, menos
  fiable es su rating Elo (arranca en 1500 para todos).
- El backtest usa cuotas de **cierre**; en la práctica solo vas a
  poder apostar a las cuotas disponibles en el momento, que pueden ser
  peores.
