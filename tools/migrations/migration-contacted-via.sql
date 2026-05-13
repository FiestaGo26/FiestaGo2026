-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Tracking explícito del medio de contacto
-- Añade columna contacted_via para saber por dónde se contactó cada proveedor.
-- ═════════════════════════════════════════════════════════════════

alter table providers add column if not exists contacted_via text
  check (contacted_via in ('email', 'instagram', 'tiktok', 'whatsapp', 'phone', null));

create index if not exists providers_contacted_via_idx on providers(contacted_via);

-- Backfill: rellenar el nuevo campo a partir de los datos existentes
update providers
set contacted_via = case
  when outreach_sent = false then null
  when tag = 'Contactado por DM'                          then 'instagram'
  when tag = 'Contactado' and email is not null           then 'email'
  when tag = 'Contactado' and instagram is not null       then 'instagram'
  when outreach_sent = true and email is not null         then 'email'
  when outreach_sent = true and instagram is not null     then 'instagram'
  else null
end
where contacted_via is null;

-- Verificación
select contacted_via, count(*) from providers group by contacted_via order by count(*) desc;
