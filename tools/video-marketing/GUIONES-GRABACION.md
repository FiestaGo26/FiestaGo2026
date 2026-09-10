# Guiones para grabar · proveedores

Siete guiones, uno por cada pilar de `lib/content-planner.ts`. Cada uno son
**15 segundos** y unas **35 palabras**, que es lo que entra hablando a ritmo
normal sin acelerar.

## Antes de grabar: los números tienen que ser tuyos

Los guiones llevan cifras entre `«»`. **Son huecos, no datos.** Sácalos de tu
panel antes de grabar:

- consultas reales de la última semana por categoría y ciudad
- número de proveedores dados de alta
- lo que cobra la competencia hoy (compruébalo, no lo cites de memoria)

Un dato inventado se nota y es exactamente el humo que no queremos. Si no
tienes el dato, quita la cifra y cuenta el mecanismo: el mecanismo siempre
es verdad.

## Cómo se graban

- **Los dos primeros segundos deciden.** Empieza por el dato o la pregunta.
  Nada de "hola", "os traigo" ni presentarte. Ya saben quién eres por el perfil.
- **Mira al objetivo**, no a tu cara en la pantalla.
- **Frases cortas.** Punto. Otra frase. El punto se oye.
- **Una idea por vídeo.** Si metes dos, no se queda ninguna.
- **No leas.** Apréndete la primera frase y la última; el medio, con tus palabras.
- Deja **un segundo de silencio** al empezar y al terminar: el montador corta
  solo, pero necesita margen.

Los rótulos son opcionales: los subtítulos ya salen quemados.

---

## Lunes · Demanda activa en tu zona

> «Cuarenta» parejas han buscado fotógrafo en «Valencia» esta semana.
> Ninguna te ha visto. No porque no seas bueno.
> Porque no estás en la lista donde miran.
> Alta gratis: fiestago punto es.

**Rótulo:** «40» búsquedas · 0 te vieron
**Rodaje:** dilo serio, sin sonreír. Es una mala noticia, no una oferta.

---

## Martes · Quote Generator

> Cuarenta y cinco minutos por presupuesto. Eso tardas hoy.
> Pegas el WhatsApp del cliente. La IA lo lee y te lo escribe.
> Treinta segundos.
> Va incluido al darte de alta.

**Rótulo:** 45 min → 30 s
**Rodaje:** enseña el móvil con un WhatsApp real (tapa el nombre). El gesto de
pegar y que aparezca el presupuesto vale más que la frase.

---

## Miércoles · Cero comisión

> «Sesenta» euros al mes. Vendas o no vendas.
> Eso pagas ahora por aparecer en un portal.
> Aquí pagas cero. Y la comisión no sale de tu bolsillo: la paga el cliente.
> Tú cobras tu precio entero.

**Rótulo:** 60 €/mes → 0 €/mes
**Rodaje:** el "cero" es la palabra clave. Para medio segundo antes de decirla.

---

## Jueves · Velocidad de respuesta

> El que contesta primero se lleva la boda. No el más barato. El primero.
> Tienes plantillas con el nombre, la fecha y el precio ya puestos.
> Contestas en veinte segundos, desde el móvil.

**Rótulo:** Contesta el primero
**Rodaje:** empieza ya hablando, sin respirar antes. La frase es un puñetazo.

---

## Viernes · Google Business

> ¿Cuándo tocaste tu ficha de Google por última vez?
> Google lo nota y te baja en el listado.
> La IA te escribe el post, tú lo copias y lo pegas.
> Un minuto a la semana.

**Rótulo:** 1 minuto/semana
**Rodaje:** haz la pregunta y **calla un segundo**. Ese silencio es el gancho.

---

## Sábado · Garantía

> ¿Y si el cliente no paga?
> El dinero entra en depósito antes del evento. Tú trabajas sabiendo que está.
> Y eso lo financia el ocho por ciento que paga el cliente. No tú.

**Rótulo:** El dinero, antes del evento
**Rodaje:** el miedo a no cobrar es real. Habla despacio, como quien resuelve
una duda, no como quien vende.

---

## Domingo · El pack completo

> Suma lo que pagas al mes en herramientas.
> Presupuestos, plantillas, posts de Google. Sueltas pasan de «doscientos» euros.
> Al darte de alta las tienes gratis. Sin cuota y sin permanencia.

**Rótulo:** «200 €»/mes → 0 €
**Rodaje:** el único guion que puede ir sonriendo. Es la buena noticia de la semana.

---

## Lo que NO decimos

Reglas duras, para que ninguna versión se desvíe:

- **Nada de escasez falsa.** Ni plazas limitadas, ni "solo hoy", ni sellos que
  se acaban. Si no es verdad, no se dice.
- **Ninguna promesa de resultados.** No prometemos bodas ni ingresos.
  Se promete aparecer donde buscan, que es lo que controlamos.
- **Nada de "la mejor plataforma"**, "revolucionario" o "líder". Son adjetivos
  sin dato detrás y le restan credibilidad al resto.
- **FiestaGo, dos veces como mucho.** El nombre no convence: convence el dato.
- **No comparar por el nombre** con un competidor concreto en el audio. Di
  "un portal" y deja la cifra hablar.

## Montarlos

```bash
node scripts/edit.mjs lunes.mov --cut-silence --cta 3
```

---

# Variante B · ganchos de pérdida

Misma información, mismo CTA. Solo cambia la primera frase — que es lo único
que decide si siguen viendo.

El mecanismo es la aversión a la pérdida: dueles más por lo que ya estás
perdiendo que por lo que podrías ganar. Por eso ninguno de estos habla del
futuro, todos hablan de algo que **ya está pasando**.

| Día | Gancho A (actual) | Gancho B (pérdida) |
|---|---|---|
| Lunes | «Cuarenta» parejas han buscado fotógrafo esta semana | **Esta semana has perdido «cuarenta» clientes y no te has enterado** |
| Martes | Cuarenta y cinco minutos por presupuesto | **Mientras tú haces un presupuesto, otro ya ha mandado tres** |
| Miércoles | «Sesenta» euros al mes, vendas o no vendas | **Llevas «setecientos» euros pagados este año. ¿Cuántas bodas te han entrado?** |
| Jueves | El que contesta primero se lleva la boda | **Si tardas dos horas en contestar, esa boda ya no es tuya** |
| Viernes | ¿Cuándo tocaste tu ficha de Google? | **Tu competencia sale antes que tú en Google. No es casualidad** |
| Sábado | ¿Y si el cliente no paga? | **¿Cuántas veces te han dejado a deber el último pago?** |
| Domingo | Suma lo que pagas al mes en herramientas | **Estás pagando por separado lo que otros ya tienen gratis** |

El resto del guion no cambia. Cambiar la primera frase es un cambio de cinco
segundos de grabación, no de vídeo entero.

## La línea entre miedo y humo

Son la misma técnica y se distinguen por una cosa:

- **Miedo honesto**: nombra una pérdida real que el proveedor puede
  comprobar en su propia experiencia. "¿Cuántas veces te han dejado a deber?"
  duele porque le ha pasado.
- **Humo con voz grave**: inventa una amenaza que no puedes demostrar.
  "Tu negocio va a desaparecer", "el sector está cambiando y te vas a quedar
  fuera". Suena a miedo pero no hay nada detrás.

Regla práctica: si el gancho no se puede verificar, no es miedo, es humo.

Y una segunda: **un miedo, una salida**. El gancho abre la herida y el CTA la
cierra en el mismo vídeo. Si abres el miedo y no lo resuelves, has dejado a
alguien peor de lo que estaba y encima se va.

## Cómo decidir cuál funciona

No lo decidas por sensación, y sobre todo no lo decidas por likes.

**La métrica del gancho es la retención a 3 segundos.** Es lo único que mide
si la primera frase hizo su trabajo. Instagram y TikTok te la dan en las
estadísticas de cada Reel.

Pero mide también **altas en `/registro-proveedor`**, porque los dos números
pueden ir en direcciones opuestas: un gancho acusatorio suele retener más y
convertir menos, porque el que se siente señalado se queda mirando pero no se
da de alta. Usa un enlace con UTM distinto por variante para poder separarlos.

Con un vídeo al día tienes muestra suficiente en unas dos semanas: una semana
con la variante A y otra con la B, mismo día de la semana contra mismo día,
para no comparar un lunes con un sábado.
