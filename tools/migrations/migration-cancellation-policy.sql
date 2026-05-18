-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · Política de cancelación por servicio
-- 3 presets (flexible/moderate/strict) más null = sin política definida.
-- ═════════════════════════════════════════════════════════════════

alter table provider_services
  add column if not exists cancellation_policy text
    check (cancellation_policy in ('flexible', 'moderate', 'strict')) default 'moderate';

select 'OK · cancellation_policy añadido a provider_services' as resultado;
