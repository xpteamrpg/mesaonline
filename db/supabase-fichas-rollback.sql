-- Desfaz as partes novas de db/supabase-fichas.sql (fichas na conta e identificadores).
-- As 3 tabelas antigas (vazias) voltam rodando os trechos de db/supabase-schema.sql.
begin;
drop function if exists mrpg_set_handle(text);
drop function if exists mrpg_handle_free(text);
drop table if exists mrpg_handles;
drop table if exists mrpg_characters;
commit;
