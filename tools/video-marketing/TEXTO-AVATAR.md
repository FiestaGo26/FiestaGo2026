# Texto para grabar el avatar y la voz

Esto **no se publica**. Es el material con el que HeyGen construye el gemelo
digital y ElevenLabs (o HeyGen) clona la voz. Se graba una sola vez y manda
sobre todo lo que venga después.

Son unas 250 palabras ≈ **100 segundos hablando** + pausas ≈ 2 minutos de
grabación. Con eso vas sobrado: el avatar pide 15 segundos y el clon de voz
pide 30, pero cuanto mejor sea la referencia, mejor sale todo lo demás.

## Antes de darle a grabar

- **Trípode o móvil apoyado.** A pulso no.
- **Luz de frente**, nunca ventana detrás.
- **Vertical**, cara y hombros. Tu gemelo actual es retrato: mantenlo.
- **Camiseta lisa**, sin logos de otras marcas.
- **Mira al objetivo**, no a tu cara en la pantalla.
- Graba el **audio en la misma sesión**: misma sala, misma energía, y así la
  voz clonada pega con la imagen.

## Los tres segundos que más importan

Antes de la primera palabra y después de la última, quédate **tres segundos
mirando a cámara, boca cerrada, cara neutra, sin moverte apenas**.

De ahí sale el estado de reposo del avatar: lo que hace cuando no habla. Si
empiezas hablando de golpe y cortas en seco, el gemelo no tiene reposo del
que tirar y se nota.

## El texto

---

**1 · Presentación** · tranquilo, como si te presentaras a alguien

> Me llamo Mariano y soy el fundador de FiestaGo. Llevo años viendo cómo
> funciona el sector de los eventos en España, y hay algo que nunca me
> cuadró. Por eso monté esto.

**2 · El problema** · serio, sin sonreír

> Un fotógrafo paga sesenta euros al mes por aparecer en un portal. Los paga
> en enero, en febrero y en marzo. Venda o no venda. Y cuando llega una
> pareja buscando fotógrafo, solo ve a quien está dado de alta. El que no
> aparece, no existe para ese cliente. Así de simple, y así de injusto.

**3 · Los números** · vocaliza, no corras

> En FiestaGo la cuota es cero. Cero euros al mes, sin permanencia. La
> comisión es del ocho por ciento y la paga el cliente, no el proveedor. Tú
> cobras el cien por cien de tu precio, siempre. Y ese ocho por ciento
> financia la Garantía: el dinero entra en depósito antes del evento, así no
> te arriesgas a cobrar tarde.

**4 · Preguntas** · entonación de pregunta de verdad, no de lectura

> ¿Y si el cliente no paga? ¿Cuánto tardo en aparecer? ¿Qué pasa si quiero
> darme de baja? ¿De verdad no hay letra pequeña?

**5 · Cierre** · cálido, aquí sí puedes sonreír

> Bodas, comuniones, bautizos, cumpleaños, despedidas, fiestas de empresa.
> Si tú organizas celebraciones, esto es para ti. Date de alta gratis en
> fiestago punto es. Se tarda sesenta segundos y no cuesta nada.

---

## Por qué está escrito así

Cada bloque entrena algo distinto, y por eso no vale leerlo de corrido en un
solo tono:

- **Bloque 1** da la cara en reposo y el tono base.
- **Bloque 2** da el gesto serio. Es el que más usarás en los ganchos.
- **Bloque 3** son los números: el clon de voz necesita oírte decir cifras,
  porque es donde más cantan las voces sintéticas.
- **Bloque 4** son preguntas reales. Sin ellas, la voz clonada sube el tono
  al final de las frases de forma rara.
- **Bloque 5** da la sonrisa y el cierre.

Lleva además, a propósito, los sonidos que peor se clonan en español:
*España*, *años*, *llega*, *injusto*, *pareja*, *marzo*, *cero*, *arriesgas*.

## Si te trabas

Sigue. No cortes ni repitas la toma entera: el montador ya quita los
silencios, y una toma larga con un tropiezo vale más que cuatro tomas
cortadas y pegadas.

## Después

```bash
node scripts/voice-sample.mjs grabacion.mov muestra-voz.mp3
```

Te dice si la muestra llega al mínimo antes de que subas nada.

Luego, en HeyGen: el **vídeo** va a crear el gemelo digital, y el **MP3** a
clonar la voz. Son dos subidas distintas del mismo rodaje.
