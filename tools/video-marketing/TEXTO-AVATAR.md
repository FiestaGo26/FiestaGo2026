# Texto para grabar el avatar y la voz

Esto **no se publica**. Es el material con el que HeyGen construye el gemelo
digital y ElevenLabs (o HeyGen) clona la voz. Se graba una sola vez y manda
sobre todo lo que venga después.

Son 205 palabras ≈ **85 segundos hablando** + pausas ≈ minuto y medio de
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

Va dirigido a **cliente**: quien está organizando una celebración, no el
proveedor.

---

**1 · Presentación** · tranquilo, como si te presentaras a alguien

> Me llamo Mariano y soy el fundador de FiestaGo. Llevo años viendo cómo
> organiza la gente sus celebraciones en España, y me encontré el mismo
> problema una y otra vez. Por eso monté esto.

**2 · El problema** · serio, sin sonreír

> Estás organizando una boda. Pides precio a cinco fotógrafos. Te contestan
> dos, y una semana después. Ninguno te dice lo que cuesta hasta que no
> rellenas un formulario y dejas tu teléfono. Y cuando por fin cierras con
> alguien, pagas una señal y te quedas con la duda: ¿y si el día de la boda
> no aparece?

**3 · Los números** · vocaliza, no corras

> En FiestaGo ves el precio antes de escribir a nadie. Reservas en cinco
> minutos y pagas un ocho por ciento más. Ese ocho por ciento no se lo queda
> el proveedor: es tu garantía. Tu dinero se queda en depósito hasta que la
> celebración ocurre. Si el proveedor cancela, lo recuperas. No arriesgas
> nada.

**4 · Preguntas** · entonación de pregunta de verdad, no de lectura

> ¿Cuánto cuesta de verdad una boda en España? ¿Y si mi proveedor cancela
> dos días antes? ¿Puedo ver precios sin dejar mi teléfono? ¿Esto vale
> también para una comunión?

**5 · Cierre** · cálido, aquí sí puedes sonreír

> Bodas, comuniones, bautizos, cumpleaños, despedidas, fiestas de empresa.
> Si estás organizando algo, entra en fiestago punto es y calcula lo que te
> va a costar. Son sesenta segundos y es gratis.

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
*España*, *años*, *cumpleaños*, *rellenas*, *arriesgas*, *dejar*, *cinco*,
*ciento*, *celebración*.

Y el bloque 3 dice el ocho por ciento **de frente**, porque es un coste real
para el cliente y queda mejor explicado por ti que descubierto en el
checkout. Lo que compra ese ocho por ciento —el depósito hasta el evento— es
justo el argumento.

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
