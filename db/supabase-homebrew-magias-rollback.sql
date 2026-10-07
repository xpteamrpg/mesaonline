-- Desfaz db/supabase-homebrew-magias.sql: apaga a tabela mrpg_my_spells (e as magias que as pessoas guardaram nela).
begin;
drop table if exists mrpg_my_spells;
commit;
