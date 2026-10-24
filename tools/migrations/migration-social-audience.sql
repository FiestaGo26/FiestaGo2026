-- Redes separadas: cuentas de clientes (las de siempre, @fiestago) y cuentas
-- nuevas para proveedores. Cada pieza lleva a quién va dirigida y el
-- publicador la manda al perfil de Upload-Post que corresponde.
alter table public.social_posts   add column if not exists audience text;
alter table public.content_videos add column if not exists audience text;

-- Todo lo creado hasta ahora hablaba a proveedores
update public.social_posts   set audience = 'proveedores' where audience is null;
update public.content_videos set audience = 'proveedores' where audience is null;

alter table public.social_posts   alter column audience set default 'proveedores';
alter table public.content_videos alter column audience set default 'proveedores';
