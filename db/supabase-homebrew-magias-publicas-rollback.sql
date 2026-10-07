-- Desfaz db/supabase-homebrew-magias-publicas.sql: apaga a tabela mrpg_public_spells (e as magias que as pessoas publicaram nela).
begin;
drop table if exists mrpg_public_spells;
commit;
