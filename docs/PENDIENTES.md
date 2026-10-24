# Pendientes FiestaGo

Lo que queda por hacer tras la simulación de clientes del 24-10-2026
(152 clientes sintéticos, tabla `sim_runs` en Supabase). Ordenado por prioridad.

## Necesita datos o decisiones de Mariano

- [ ] **Salir del modo prueba** (`FIESTAGO_TEST_MODE=true` en Netlify) cuando se
  vaya a cobrar de verdad: los datos fiscales ya son los reales.
- [ ] **Redes separadas** (decidido: las cuentas de siempre = clientes; nuevas = proveedores):
  1. Vaciar las cuentas actuales de Instagram y TikTok (borrar todos los posts).
  2. Crear las cuentas nuevas de proveedores en Instagram y TikTok.
  3. En Upload-Post, crear un segundo perfil (p. ej. `fiestago-pro`) y conectar ahí
     las cuentas nuevas (comprobar que el plan permite 2 perfiles).
  4. Guardar en Netlify `UPLOADPOST_USER_PRO` con el nombre de ese perfil.
  5. Bio de cada cuenta: clientes → fiestago.es · proveedores → fiestago.es/profesionales.
  Mientras no exista `UPLOADPOST_USER_PRO`, los posts para proveedores esperan en cola
  y la cuenta de siempre solo publica posts para clientes.
- [ ] **Borrar a mano el post** "¿Cansado de pagar cuota cada mes sin clientes?…
  pagas comisión solo cuando vendes" (publicado el 15-05-2026) en Instagram y TikTok:
  es falso y sus APIs no permiten borrar publicaciones. Ya está marcado como
  retirado en `social_posts`.
- [ ] **Recargar la API de HeyGen** (0 segundos de vídeo: no hay vídeo diario).
- [ ] **Enlaces de la bio** de Instagram y TikTok (prompt de Cowork ya dado).
- [ ] **Marcar como secretas en Netlify** las claves que están en texto plano
  (Anthropic, WhatsApp, Supabase service role, Google, Resend, Apify, fal,
  contraseña de admin...).
- [ ] Opcional: activar en Supabase la protección contra contraseñas filtradas.

## Lo hago yo cuando tenga lo anterior

- [ ] "Quiénes somos" en los destacados de Instagram/TikTok.
- [ ] Botón de WhatsApp también en las fichas de proveedor; el primer paso
  pasa a ser "pide presupuesto / pregúntanos".
- [ ] Texto final de "sustituto equivalente" en la garantía y en los términos.
- [ ] Cuando el CEO pase a captar clientes: usar el ángulo "tranquilidad"
  (fue el claro ganador, 81 %) adaptado a cada tipo de evento con su imagen.
- [ ] Reseñas reales: pedir opinión tras cada evento y mostrarlas por tipo de evento.
- [ ] Cobertura: más proveedores fuera de Valencia ciudad (Sueca, Cullera, Gandia,
  Sagunto, Xàtiva...) y de catering (solo hay 1).
- [ ] Repetir la simulación tras los cambios para comparar (misma tabla `sim_runs`,
  se pueden reutilizar las mismas personas).

## Hecho el 24-10-2026

- Publicador por públicos: cada post/vídeo lleva `audience` (clientes/proveedores);
  `UPLOADPOST_USER` publica para clientes y `UPLOADPOST_USER_PRO` para proveedores,
  con tope diario y revisión de marca propios. El CEO elige el público de cada post.

- Foto y horario (L-V 10:00-20:00) en /quienes-somos y en el acuse de WhatsApp.
- "Sustituto equivalente" definido en garantía y términos: mismas funciones que
  las contratadas, a un precio similar.
- Datos fiscales reales en Netlify (Francisco Mariano González Tejedo, 09437664M,
  C/ Turina 6, 33011 Oviedo); las facturas llevan "FiestaGo" arriba y estos datos
  como emisor. Dirección también en aviso legal y quiénes somos.

- Página /quienes-somos (Mariano, NIF, Oviedo, WhatsApp leído de la cuenta de
  WhatsApp Business, email) enlazada desde portada, pie y garantía.
- NIF real en el aviso legal (antes salía "{NIF}").
- WhatsApp: si escribe un número que no es proveedor (cliente), recibe un acuse
  de recibo fijo (máx. 1 cada 24 h) y llega un email a ADMIN_EMAIL.

- Garantía con ejemplo en euros y el 8 % aclarado (incluido en el precio, se paga siempre).
- Portada sin "reserva en dos minutos"; el sustituto va antes que el reembolso.
- El CEO ve el saldo real de fal.ai y HeyGen (ya no repite fallos antiguos).
- Latido del CEO cada 10 min desde Supabase (pg_cron) con función en segundo plano.
- Simulación de clientes (`lib/client-sim.ts`, `netlify/functions/client-sim-background.mts`).
