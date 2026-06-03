-- ═════════════════════════════════════════════════════════════════
-- FiestaGo · URL del formulario de contacto del proveedor
-- El scraper de extract-email detecta links a /contacto, /contact,
-- /presupuesto… y guarda la URL aquí. El botón 🌐 del panel admin la
-- abre directamente, evitando que el admin tenga que navegar la home
-- buscando el formulario.
-- ═════════════════════════════════════════════════════════════════

alter table providers add column if not exists contact_form_url text;

create index if not exists providers_contact_form_url_idx
  on providers(contact_form_url) where contact_form_url is not null;

notify pgrst, 'reload schema';

-- Verificación
select count(*) filter (where contact_form_url is not null) as con_form_detectado,
       count(*) filter (where website is not null)         as con_web
from providers;
