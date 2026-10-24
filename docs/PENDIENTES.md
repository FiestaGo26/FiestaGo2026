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

4.ª simulación (pendiente de lanzar): la web y las redes como quedarían con el plan de
confianza aplicado (`catalog: 'plan_fase1'` en `sim_runs`), con posts segmentados por
tipo de evento. Sirve para priorizar qué construir primero.

### Plan de confianza: qué construir (orden según la 4.ª simulación)
- [ ] Botón "Pide presupuesto o bloquea tu fecha 48 h gratis" en las fichas.
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

### 24-10-2026
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
