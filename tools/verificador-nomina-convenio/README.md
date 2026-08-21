# Verificador de nóminas — X Convenio de Enseñanza y Formación No Reglada

Script local (no corre en Netlify, igual que `fiegago-agent`) que lee una nómina en PDF,
extrae sus datos con Claude y comprueba si el salario y las cotizaciones a la Seguridad
Social coinciden con lo que corresponde según:

- La categoría/grupo profesional del **X Convenio Colectivo Estatal de Enseñanza y
  Formación No Reglada** (BOE-A-2025-14198, vigente 2024-2027).
- Las horas lectivas/mes (para personal docente) o el % de jornada (resto de grupos).
- Los tipos de cotización a la Seguridad Social vigentes para el trabajador.

## ⚠️ Antes de usarlo: rellena las tablas salariales

Por restricciones de red del entorno donde se generó este script, **no se pudieron
descargar las cifras exactas del Anexo I** (tablas salariales) del convenio. El fichero
`convenio-x-ensenanza-no-reglada.json` trae ya la estructura real (4 grupos, categorías,
jornadas anuales) pero con los importes en `null`.

**Rellénalos una vez** copiando literalmente las cifras del Anexo I desde una fuente oficial:

- BOE: https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-14198
- Tablas salariales (sindicatos firmantes): UGT, FSIE, USO o CCOO Enseñanza suelen publicar
  el PDF con las tablas 2024-2027 ya extraídas del BOE.

Mientras una categoría/año tenga `null`, el script **no emite veredicto de correcto/incorrecto**
para el salario de esa nómina — avisa explícitamente que falta el dato, en vez de arriesgarse a
dar un resultado erróneo con una cifra inventada.

El fichero `cotizacion-ss.json` sí trae los tipos de cotización del trabajador (contingencias
comunes 4,70 %, desempleo 1,55 %/1,60 %, formación profesional 0,10 %, MEI variable por año)
para 2024-2026 — estos no dependen del convenio, son de aplicación general por ley. Revísalos
si vas a analizar nóminas de años no incluidos, porque el MEI sube cada año.

## Setup

```bash
cd tools/verificador-nomina-convenio
cp .env.example .env
# Añade tu ANTHROPIC_API_KEY en .env
```

## Uso

```bash
node verificar-nomina.mjs "/ruta/a/nomina-enero-2026.pdf"

# Para guardar el informe en JSON:
node verificar-nomina.mjs "/ruta/a/nomina.pdf" --out=informe.json
```

El script:

1. Envía el PDF a Claude y extrae: periodo, categoría declarada, horas lectivas/mes,
   jornada, salario base, complementos, bases y cuotas de cotización, IRPF.
2. Identifica a qué grupo/categoría del convenio corresponde el trabajador.
3. Calcula el salario que le correspondería (prorrateado por horas lectivas si es personal
   docente, o por % de jornada en el resto de grupos) y lo compara con el de la nómina.
4. Calcula la cuota de Seguridad Social que le correspondería sobre la base que declara la
   propia nómina, y la compara con lo retenido.
5. Imprime un informe con veredicto por cada comprobación (✅ correcto / ⚠️ revisar /
   ❌ por debajo de lo esperado / ⚪ sin datos suficientes).

## Limitaciones

- No es asesoramiento legal. Es una ayuda de primer cribado; cualquier discrepancia debe
  contrastarse con un/a graduado/a social o el sindicato del sector antes de reclamar nada.
- No comprueba complementos de antigüedad, pluses de convenio distintos del salario base,
  ni la clasificación del "grupo de cotización" de la Seguridad Social (que es una tabla
  legal aparte de la del convenio) — solo la base mínima general 2026 (1.424,40 €/mes) queda
  anotada como referencia informativa en `cotizacion-ss.json`.
- La categorización del trabajador dentro del convenio la decide Claude a partir del texto
  de la nómina — revisa siempre el campo `categoria_convenio_id` del informe antes de confiar
  en el resultado, sobre todo si la nómina usa una denominación de puesto poco habitual.
