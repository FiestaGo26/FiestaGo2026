-- Activar Supabase Realtime sobre la tabla messages para que cliente y
-- proveedor reciban los mensajes nuevos sin tener que refrescar.
alter publication supabase_realtime add table messages;
select 'OK · messages añadida a supabase_realtime' as resultado;
