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
