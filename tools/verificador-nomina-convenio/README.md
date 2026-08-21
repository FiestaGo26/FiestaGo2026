# Verificador de nóminas — X Convenio de Enseñanza y Formación No Reglada

Script local (no corre en Netlify, igual que `fiegago-agent`) que lee una nómina en PDF,
extrae sus datos con Claude y comprueba si el salario y las cotizaciones a la Seguridad
Social coinciden con lo que corresponde según:

- La categoría/grupo profesional del **X Convenio Colectivo Estatal de Enseñanza y
  Formación No Reglada** (BOE-A-2025-14198, vigente 2024-2027).
- Las horas trabajadas a la semana frente a la jornada semanal de referencia de su grupo
  (o el % de jornada, si la nómina no indica horas/semana).
- Los tipos de cotización a la Seguridad Social vigentes para el trabajador.

## Categorías reales del convenio (confirmadas)

- **Grupo I — Personal docente** (1.446 h/año): Profesor/a Titular, Profesor/a de Taller,
  Profesor/a Auxiliar o Adjunto/a, Profesor/a Auxiliar «on line», Instructor/a o Experto/a,
  Educador/a Social.
- **Grupo II — Personal de administración** (1.715 h/año, 39 h/semana): Jefe/a de
  Administración, Oficial Administrativo/a de 1ª y 2ª, Orientador/a Profesional, Auxiliar
  Administrativo/a, Redactor/a-Corrector/a, Agente Comercial, Televendedor/a, Prospector/a
  de Empleo.
- **Grupo III — Personal de servicios** (1.715 h/año, 39 h/semana): Encargado/a de Almacén,
  Empleado/a de Servicios Generales, Auxiliar no Docente, **Monitor/a-Animador/a**.
- **Grupo IV — Titulados no docentes**: incluye los roles nuevos del X Convenio (Social
  Media Manager, Diseñador/a de Contenidos, Dinamizador/a de Cursos Online).

⚠️ **"Monitor/a" está en el Grupo III (servicios), no en el Grupo I (docente)**, aunque dé
clases o actividades — es la clasificación que hace el propio convenio, y un error habitual
es asumir que por dar clase es personal docente. Esto importa porque cambia la jornada de
referencia usada para prorratear su salario por horas/semana.

Para el Grupo I la jornada semanal de referencia (39 h en los Grupos II/III) **no está
confirmada en fuente oficial** — el script usa de momento una aproximación (1.446 h/año ÷ 44
semanas ≈ 32,86 h/semana) y lo avisa en cada informe donde aplica. Sustitúyela por la cifra
oficial en `convenio-x-ensenanza-no-reglada.json` (campo `jornada_semanal_referencia_horas`
del Grupo I) en cuanto la tengas.

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

1. Envía el PDF a Claude y extrae: periodo, categoría declarada, horas trabajadas a la
   semana, jornada, salario base, complementos, bases y cuotas de cotización, IRPF.
2. Identifica a qué grupo/categoría del convenio corresponde el trabajador (con el aviso
   de que Monitor/a-Animador/a es Grupo III, no Grupo I, incluido en el propio prompt).
3. Calcula el salario que le correspondería prorrateando por horas/semana frente a la
   jornada semanal de referencia de su grupo (o por % de jornada si no hay horas/semana en
   la nómina) y lo compara con el de la nómina.
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
