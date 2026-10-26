# Pendientes FiestaGo

Lista única de lo que falta. Se actualiza cada vez que se avanza.
Última revisión: 24-10-2026.

## 1. Lo que tiene que hacer Mariano (en este orden)

### Redes separadas (decidido el 24-10-2026)
Las cuentas de siempre (@fiestago) pasan a ser **de clientes**; las de **proveedores** son nuevas.

- [ ] **1.1 Vaciar las cuentas actuales** de Instagram y TikTok (borrar todos los posts).
  Con eso desaparece también el post falso de la comisión ("¿Cansado de pagar cuota
  cada mes sin clientes?… pagas comisión solo cuando vendes", del 15-05-2026).
- [ ] **1.2 Crear las cuentas nuevas de proveedores** en Instagram y TikTok
  (nombre sugerido: `fiestago.pro` / `fiestagopro`).
- [ ] **1.3 Upload-Post y bios** → hacerlo con Cowork, texto listo más abajo.
- [ ] **1.4 Netlify**: añadir la variable `UPLOADPOST_USER_PRO` con el nombre exacto del
  perfil nuevo de Upload-Post (Project configuration → Environment variables).
  Hasta entonces, los posts para proveedores esperan en cola y no se publican.
- [ ] **1.5 Avisar a Claude** cuando esté para comprobar la primera publicación en cada cuenta.

### Otros
- [ ] **WhatsApp**: reactivar la tarjeta/número en Meta y avisar a Claude para revisar si
  saltó el freno automático del CEO y desbloquearlo.
- [ ] **Recargar la API de HeyGen** (0 segundos de vídeo: no hay vídeo diario).
- [ ] **Salir del modo prueba** (`FIESTAGO_TEST_MODE=true` en Netlify) cuando se vaya a
  cobrar de verdad. Los datos fiscales ya son los reales.
- [ ] Opcional: marcar como secretas el resto de claves de Netlify que sigan en texto
  plano (las importantes ya lo están) y activar en Supabase la protección contra
  contraseñas filtradas. **No marcar como secretas** `SECRETS_SCAN_OMIT_KEYS` ni las
  `NEXT_PUBLIC_*`: no son claves, aparecen en el código o en la web y el escáner de
  Netlify bloquea el despliegue (pasó el 24-10-2026).

### Texto para Cowork (copiar y pegar)

```
Necesito que me ayudes a configurar Upload-Post y las bios de mis redes. Ve paso a paso,
en español, y cuando llegues a una pantalla de inicio de sesión o de contraseña, PARA y
espera a que yo la escriba. No pagues ni cambies de plan sin preguntarme.

1. Entra en https://app.upload-post.com (ya tengo cuenta; espera a que inicie sesión).
2. Mira cuántos perfiles permite mi plan (Basic). Si solo permite 1, para y dímelo.
3. Crea un perfil nuevo llamado exactamente: fiestago-pro
4. En ese perfil, conecta la cuenta NUEVA de Instagram de proveedores y la cuenta NUEVA
   de TikTok de proveedores (cuando pida iniciar sesión en Instagram/TikTok, para y
   espera a que lo haga yo).
5. Comprueba que el perfil antiguo "fiestago" sigue conectado a las cuentas de siempre
   (Instagram y TikTok de clientes). No lo toques.
6. Dime el nombre exacto del perfil nuevo tal y como aparece en Upload-Post.

Después, las bios:
7. Instagram y TikTok de CLIENTES (las de siempre):
   Bio: "Bodas, comuniones y cumpleaños sin sustos ✨ Proveedores verificados ·
   Pago retenido hasta tu evento · Pregúntanos por WhatsApp 👇"
   Enlace: https://fiestago.es
8. Instagram y TikTok de PROVEEDORES (las nuevas):
   Bio: "Para profesionales de eventos 📸🎶🎂 Alta gratis, sin cuotas ni permanencia ·
   Cobras el 100 % de tu precio 👇"
   Enlace: https://fiestago.es/profesionales
9. Al terminar, hazme un resumen de lo que has cambiado.
```

### Decisiones tomadas el 24-10-2026
- Reseñas: **no se publican reseñas inventadas** (ilegal en España: práctica desleal
  sancionable; además Google/Meta las retiran). Alternativas en la sección 2.
- Garantía: a los clientes solo se les dice que **todos los servicios la llevan incluida
  en el precio**; no se menciona el 8 %. (Hecho en web, revisor y generador de posts.)
- Dinero retenido: **en Stripe**. Pendiente: activar los cobros reales con Stripe y
  quitar el modo prueba (ver "Otros").
- Oviedo: no hace falta explicarlo. FiestaGo se presenta **abierto a toda España**.
- WhatsApp: persona de lunes a viernes 10-20 h **y sábados 10-14 h**; fuera de ese horario
  contesta la IA, sin anunciarlo en los posts (hecho). Sin teléfono de momento.
- **Plan de confianza aprobado** (ver sección 2): eventos fundadores (los 10 primeros con
  la garantía de regalo a cambio de una reseña honesta con fotos), señal desde el 30 %
  y el resto 2 meses antes, cancelación gratis 14 días tras reservar si faltan más de
  60 días, bloqueo de fecha / presupuesto gratis 48 h, piloto de cumple infantil en
  Valencia y l'Horta, regla del CEO por "servicio central del evento".

## 2. Lo que hace Claude cuando lo anterior esté listo

Resultado de la 2.ª simulación (mismas 152 personas): la confianza en la web pasa de
2,41 a 2,89 sobre 5, la claridad de 3,52 a 3,93, quien entra en la web del 38 % al 64 %
y el quiz del 5 % al 16 %. El perfil de clientes ya no empeora a nadie (antes al 100 %).
Reservas: siguen en 0. Freno: reseñas, catálogo corto, dudas sobre el 8 % y el dinero.
3.ª simulación (run `b4e8c06f`, catálogo hipotético de 3 por categoría): la confianza no
sube (2,89) y siguen 0 reservas. Con 3 por categoría NO compensa una campaña de ciudad;
sí un piloto de cumple infantil en Valencia y l'Horta. Lo que cuenta es tener el servicio
central de cada evento (restaurante/salón y catering para comuniones, finca y banquete
para bodas, pack completo para cumples), no 3 de cada categoría. Ganador transversal:
"¿Dónde está tu dinero?" (Stripe), 65 % entra a la web, confianza 3,23. Garantía con
números, solo a su público (la de cumple: mejor post para el 56 % de familias de cumple
infantil). Frase más criticada: "el fin de semana te atiende el asistente".
Límite: el catálogo hipotético se describió muy uniforme y pudo sonar a plantilla.

4.ª simulación (run `1bd9af2d`, web y redes hipotéticas con el plan de confianza aplicado,
posts segmentados): confianza 2,89 → 3,35; claridad 4,02; nadie ignora la web; por
primera vez hay intención de apuntarse (13,8 % tras ver la web, 4,6 % al final tras leer
comentarios; cumple infantil 26 % → 13 %, cumple adulto 17 % → 9 %, bodas 11 % → 2 %).
Reservas: 0. Lo que más pesa: 1) dinero en Stripe y cobro al final, 2) primer paso sin
pagar, 3) persona que responde (sábado incluido), 4) packs con precio total. Objeciones que
quedan: no hay bodas, "¿y si FiestaGo cierra?", cifras de la garantía que no cuadran
(500 € frente a 300-3.000 €), packs de un solo tamaño, zonas sin cobertura, sin teléfono.

5.ª simulación (run `e3738ddb`, plan + garantía corregida + ENTREVISTA "¿qué tendría que
pasar para que reservaras?"). Confianza 3,39. Lo que piden para reservar (% que lo menciona):
precio total cerrado por escrito y a la medida de sus invitados 63 %; reseñas de su tipo de
evento 60 %; hablar con una persona 40 %; señal más baja 28 %; seguridad del dinero 28 %
(escépticos 48 %); proveedores de su comarca 16 %. Señal máxima aceptada: mediana 10 %
(cumple infantil 20 %). Canal preferido: teléfono 44 %, WhatsApp 40 %, email 11 % (cumple
de adulto: teléfono 65 %). El vídeo de Mariano respondiendo es ya el post favorito (40 %).
Corregir las cifras de la garantía no movió la confianza en ese post: simplificarla.
"Reservaría si se cumple": 99 % "probablemente" (cortesía, no cuenta); "sí" claro: 2 personas.

Decisiones pendientes tras la 5.ª simulación:
- [ ] **Teléfono / "te llamamos"**: es el canal preferido. ¿Ponemos un botón "pide que te
  llamemos" (sin publicar número) o un teléfono visible?
- [ ] **Señal**: lo aceptado es ~10 % (20 % en cumples). ¿Bajamos la señal por defecto al
  10-20 % o ponemos un importe fijo pequeño? (Hoy cada proveedor elige hasta el 40 %.)

Decisiones pendientes tras la 4.ª simulación:
- [ ] **"¿Y si FiestaGo cierra con mi dinero dentro?"**: necesitamos una respuesta VERDADERA.
  Depende de cómo se configure Stripe (p. ej. Stripe Connect con el dinero en la cuenta
  conectada del proveedor y pago retenido). Hay que decidirlo al activar los cobros reales.
- [ ] **Teléfono** para llamar (lo piden los mayores de 50).
- [ ] **Señal**: el 30 % asusta en bodas grandes; ¿señal menor o tope en euros por encima
  de cierto importe?
- [ ] **Comisión**: algunos (escépticos, parejas que van al céntimo) quieren saber cuánto se
  lleva FiestaGo. Hoy no se dice (decisión del 24-10). Mantener o explicar en una línea.

### Plan de confianza: qué construir (orden según la 4.ª simulación)
- [x] Botón "Bloquear esta fecha 48 h gratis" / "Pedir presupuesto gratis" en las fichas,
  con "sin pagar, sin tarjeta, sin DNI y no te llamaremos si no lo pides" (hecho 24-10).
- [ ] Contar bloqueos y presupuestos (`date_holds`) en el embudo del CEO y del panel.
- [ ] Garantía: cifras coherentes en web y posts (compensación según importe, con tabla).
- [ ] Packs con precio por número de invitados (rangos: 8-14 niños, 15-25 niños; comunión
  30, 50, 80 personas), no un solo tamaño.
- [ ] Mostrar cada proveedor y cada reseña solo a su público y su zona.
- [ ] Bodas: no anunciar bodas hasta tener 2-3 bodas reales hechas; empezar por cumples
  (infantil y adulto) y comuniones.
- [ ] Comentarios en redes: responder con detalle y firmado (los comentarios enfrían la
  intención del 13,8 % al 4,6 % en la simulación).
- [ ] Señal desde el 30 % + cancelación gratis 14 días (si faltan >60 días) en reserva,
  ficha, garantía y términos. Ojo: el reembolso de esos 14 días lo asume FiestaGo o el
  proveedor; definirlo antes de activarlo.
- [ ] Portada por tipo de evento con packs de precio total (precios reales de proveedores).
- [ ] Catálogo por zona con nombres y aviso "aún no estamos en tu pueblo".
- [ ] Garantía en una página con tres casos (cancela el proveedor / no se presenta /
  cancelas tú) y plazos de devolución.
- [ ] Reseñas: sistema de reseñas tras cada evento + nota y enlace de Google en la ficha.
- [ ] Programa de eventos fundadores (10 primeros, garantía de regalo a cambio de reseña).
- [ ] "Te respondemos en menos de 2 h en horario" + pedir llamada de 10 minutos.
- [ ] Reglas del CEO: servicio central por evento; prioridad a animadores y ludotecas
  para el piloto de cumple infantil; posts según lo aprendido.
- [ ] Piloto de cumple infantil en Valencia y l'Horta (anuncios pequeños, 3-4 semanas).

- [ ] **Reseñas reales lo antes posible**: pedir opinión tras cada evento; ofrecer a los
  primeros clientes algo a cambio de una reseña real (descuento o regalo, declarándolo);
  mostrar las reseñas de Google de cada proveedor en su ficha (con su permiso); mientras
  no haya, decirlo con naturalidad ("somos nuevos: estos son nuestros primeros eventos").
- [ ] **Garantía**: tabla cubre / no cubre más visible (lluvia, cambio de fecha, si cancelas
  tú) y quién decide el sustituto.
- [ ] **Posts de clientes**: el mejor para llevar a la web es "garantía con ejemplo en
  euros" (83 % entra), hacer una versión por evento. Serie "una persona responde"
  (fundador + pregúntanos por WhatsApp + cómo verificamos): es lo que más confianza da y
  lo que mejor funciona en cumple infantil. Posts de preguntas frecuentes con las
  objeciones literales. Retirar "precio" y "tranquilidad" tal cual y la hucha.
  Más contenido de cumpleaños infantiles y de adultos, no solo bodas y comuniones.
  → Pasar estas conclusiones al CEO como aprendizajes.
- [ ] **Cobertura en la web**: "hoy llegamos a…" y, para el resto de pueblos,
  "aún no llegamos a [pueblo]: déjanos tu correo y te avisamos" (mide demanda por zona).
- [ ] **Huecos del catálogo** por este orden: catering (solo 1), animación infantil,
  salones/restaurantes para comuniones, DJ.
- [ ] **Packs con precio total** para casos típicos: comunión de 30 personas,
  cumple infantil de 10 niños, cena de 50 años para 40.

- [ ] Comprobar la primera publicación en cada par de cuentas (clientes y proveedores).
- [ ] Destacados de Instagram para clientes: "Quiénes somos", "Garantía", "Cómo reservar",
  "WhatsApp" (preparar las imágenes).
- [ ] Botón de WhatsApp también en las fichas de proveedor; el primer paso pasa a ser
  "pregúntanos / pide presupuesto".
- [ ] Reseñas reales: pedir opinión tras cada evento y mostrarlas por tipo de evento.
- [ ] Cobertura: más proveedores fuera de Valencia ciudad (Sueca, Cullera, Gandia,
  Sagunto, Xàtiva...) y de catering (solo hay 1).
- [ ] Enfocar los posts de clientes según la 2.ª simulación (ver `sim_runs`).

## 3. Hecho

### 26-10-2026
- Precio según invitados: el proveedor pone precio, invitados incluidos y € por invitado de
  más; la ficha calcula el precio final al poner cuántos son y el servidor lo recalcula al
  reservar (ya no se fía del importe que manda el navegador).
- Señal del 10-20 % del TOTAL del cliente (Garantía incluida) en reservas, panel y
  presupuestos; los servicios existentes, normalizados.
- Botón "Prefiero que me llaméis desde FiestaGo" (teléfono + franja): llama FiestaGo, no
  el proveedor; solo avisa a Mariano (`date_holds` kind 'call').
- Venta dentro de FiestaGo: el proveedor no recibe email/teléfono del cliente en presupuestos
  ni bloqueos (responde desde "Peticiones de clientes" en su panel y FiestaGo reenvía la
  respuesta); en reservas los ve al pagar la señal (antes al aceptar); el chat oculta
  emails y teléfonos hasta la señal; regla de baja en /proveedor/compromisos.
- [ ] Más adelante, si hace falta que hablen antes de reservar: línea puente (Twilio o
  llamadas de WhatsApp Business) sin que ninguno vea el número del otro.
- HeyGen: vídeo diario con Avatar V (API v3) y respaldo en v2; el latido lo crea (8, 11 y
  14 h) y recoge los terminados. El avatar admite avatar_v/iv/iii.
- Redes: la revisión de marca se cortaba ("Unterminated string in JSON") y no se publicaba
  nada desde el 23-10. Arreglado; el error se guarda en el post; el latido publica cada
  cuenta (9-21 h, 3 h de separación) y GitHub queda de respaldo.
- Foco del CEO en CLIENTES: métrica `growth.client_demand` (fichas vistas, lista de espera y
  quiz, bloqueos, presupuestos, llamadas, WhatsApps de clientes, reservas, por origen y
  evento); experimentos orgánicos de clientes en cualquier ciudad (anuncios solo con oferta);
  los bloqueos/presupuestos cuentan como conversión de los experimentos.
- Vídeo diario de HeyGen en modo clientes por defecto (CONTENT_MODE), con temas nuevos
  (dinero seguro, cumple infantil, Mariano responde, comuniones, cumple adulto, primer paso,
  quiz) y guion sin cifras inventadas ni el 8 %.

### 24-10-2026
- Primer paso sin pagar en la ficha de proveedor (`/api/holds`, `lib/date-holds.ts`, tabla
  `date_holds`): con servicio y fecha bloquea el día 48 h (sale en ámbar en el calendario y
  solo lo puede reservar quien lo bloqueó); sin fecha, pide presupuesto. Emails al cliente,
  al proveedor y a Mariano. El latido del CEO libera los bloqueos caducados.
- Garantía para clientes sin hablar del 8 %: "incluida en todos los servicios"; pago
  retenido en Stripe en garantía, portada y quiénes somos; FiestaGo abierto a toda España.
- Asistente de WhatsApp para clientes fuera de horario (`lib/client-assistant.ts`):
  responde con datos cerrados, no confirma reservas ni precios, y avisa por email.
- Redes por públicos: cada post/vídeo lleva `audience` (clientes/proveedores);
  `UPLOADPOST_USER` publica para clientes y `UPLOADPOST_USER_PRO` para proveedores,
  con tope diario y revisión de marca propios. El CEO elige el público de cada post.
  Todo lo creado antes queda como "proveedores".
- Post de la comisión marcado como retirado en `social_posts`.
- Foto y horario (L-V 10:00-20:00) en /quienes-somos y en el acuse de WhatsApp.
- "Sustituto equivalente" definido en garantía y términos: mismas funciones que las
  contratadas, a un precio similar.
- Datos fiscales reales en Netlify (Francisco Mariano González Tejedo, 09437664M,
  C/ Turina 6, 33011 Oviedo); las facturas llevan "FiestaGo" arriba y estos datos como
  emisor. Dirección también en aviso legal y quiénes somos.
- Página /quienes-somos enlazada desde portada, pie y garantía. NIF real en el aviso legal.
- WhatsApp: si escribe un número que no es proveedor (cliente), recibe un acuse de recibo
  fijo (máx. 1 cada 24 h) y llega un email a ADMIN_EMAIL.
- Garantía con ejemplo en euros y el 8 % aclarado (incluido en el precio, se paga siempre).
- Portada sin "reserva en dos minutos"; el sustituto va antes que el reembolso.
- El CEO ve el saldo real de fal.ai y HeyGen (ya no repite fallos antiguos).
- Latido del CEO cada 10 min desde Supabase (pg_cron) con función en segundo plano.
- Simulación de clientes (`lib/client-sim.ts`, `netlify/functions/client-sim-background.mts`):
  1.ª simulación (web antigua) y 2.ª (web nueva + perfil de clientes con posts de confianza).
