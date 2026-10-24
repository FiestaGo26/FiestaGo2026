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

### Decisiones tras la 2.ª simulación (24-10-2026, run `f66c74d3` en `sim_runs`)
- [ ] **Primeras reseñas**: ¿ofrecemos los primeros eventos sin el 8 % de garantía a cambio
  de una reseña pública con foto? (lo que más frena: "ni una reseña").
- [ ] **Dónde está el dinero retenido**: los pagos aún son simulados. Hay que elegir cómo
  cobrar de verdad (p. ej. Stripe Connect, entidad de pago regulada) para poder decir
  en la web "tu dinero está en [entidad], a tu nombre, hasta el evento".
- [ ] **Horario y canal**: ¿abrimos WhatsApp el sábado por la mañana? ¿mostramos un
  teléfono para llamar? (lo piden quien trabaja entre semana y los mayores de 50).
- [ ] **Oviedo**: dos líneas para "Quiénes somos" explicando por qué el titular está en
  Oviedo y por qué empezamos en Valencia (o un contacto en Valencia si lo hay).

## 2. Lo que hace Claude cuando lo anterior esté listo

Resultado de la 2.ª simulación (mismas 152 personas): la confianza en la web pasa de
2,41 a 2,89 sobre 5, la claridad de 3,52 a 3,93, quien entra en la web del 38 % al 64 %
y el quiz del 5 % al 16 %. El perfil de clientes ya no empeora a nadie (antes al 100 %).
Reservas: siguen en 0. Freno: reseñas, catálogo corto, dudas sobre el 8 % y el dinero.

- [ ] **Garantía v2** (web y post): "si todo va bien, pagas 1.080 € y ya está; los 80 €
  son el seguro, como el de un viaje"; dejar claro que es un 8 % (animador de 250 € →
  20 €); tabla cubre / no cubre (lluvia, cambio de fecha, si cancelas tú); quién decide
  el sustituto y en cuántos días se devuelve el dinero.
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
