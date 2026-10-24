# Pendientes FiestaGo

Lo que queda por hacer tras la simulación de clientes del 24-10-2026
(152 clientes sintéticos, tabla `sim_runs` en Supabase). Ordenado por prioridad.

## Necesita datos o decisiones de Mariano

- [ ] **Foto para "Quiénes somos"**: subirla a `public/equipo/mariano.jpg` y poner
  `hasPhoto = true` en `app/(public)/quienes-somos/page.tsx`.
- [ ] **Horario de atención** del WhatsApp (opcional, para mostrarlo).
- [ ] **Datos fiscales de facturación** en Netlify siguen siendo de prueba
  (`FIESTAGO_TAX_ADDRESS`, `FIESTAGO_TAX_ID`, `FIESTAGO_TAX_NAME`, `FIESTAGO_TEST_MODE`):
  cambiarlos antes de emitir facturas reales (falta la dirección completa).
- [ ] **Definir "sustituto equivalente"** en la garantía: qué cuenta como equivalente
  y si el cliente puede elegir el reembolso del 110 % si no le convence.
- [ ] **Instagram/TikTok**: decidir si se abre una cuenta aparte para proveedores
  (tipo @fiestago.pro) o se mantiene una sola con 3 posts fijados para clientes
  (quiénes somos, cómo funciona la garantía, cómo pedir presupuesto).
- [ ] **Borrar o corregir el post** publicado que dice "pagas comisión solo cuando
  vendes": es falso (el proveedor cobra el 100 % y el 8 % lo paga el cliente).
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
- [ ] Separar el contenido de proveedores y clientes en el publicador automático
  según la decisión de cuentas.
- [ ] Cuando el CEO pase a captar clientes: usar el ángulo "tranquilidad"
  (fue el claro ganador, 81 %) adaptado a cada tipo de evento con su imagen.
- [ ] Reseñas reales: pedir opinión tras cada evento y mostrarlas por tipo de evento.
- [ ] Cobertura: más proveedores fuera de Valencia ciudad (Sueca, Cullera, Gandia,
  Sagunto, Xàtiva...) y de catering (solo hay 1).
- [ ] Repetir la simulación tras los cambios para comparar (misma tabla `sim_runs`,
  se pueden reutilizar las mismas personas).

## Hecho el 24-10-2026

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
