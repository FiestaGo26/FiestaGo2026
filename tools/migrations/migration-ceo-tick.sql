-- Latido del agente CEO: cada 10 min, pg_cron llama a la función en
-- segundo plano de Netlify (ceo-tick-background), que ejecuta la rutina
-- diaria/semanal si falta y la cola de acciones (incluida la búsqueda de
-- proveedores, que no cabe en los 30 s de una función normal).
--
-- Requisitos: extensiones pg_cron y pg_net, y el secreto en Vault:
--   select vault.create_secret('<mismo valor que CEO_TICK_SECRET en Netlify>', 'ceo_tick_secret');

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('ceo-tick') where exists (select 1 from cron.job where jobname = 'ceo-tick');

select cron.schedule('ceo-tick', '*/10 * * * *', $$
  select net.http_post(
    url     := 'https://fiestago.es/.netlify/functions/ceo-tick-background',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-tick-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'ceo_tick_secret')
    ),
    body    := '{}'::jsonb
  );
$$);
