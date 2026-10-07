-- ModernRPG — magias criadas pela própria pessoa no Criador de magias (Homebrew).
-- Cria UMA tabela nova (mrpg_my_spells), com RLS: cada pessoa só enxerga, cria, altera e apaga as PRÓPRIAS magias.
-- Ninguém mais lê (nem o mestre, nem outros jogadores); nada aparece em listas públicas. Não altera nenhuma tabela, função ou política existente.
-- Desfazer: db/supabase-homebrew-magias-rollback.sql (apaga a tabela e as magias guardadas nela).
begin;

create table if not exists mrpg_my_spells (
  owner_id   uuid not null references auth.users(id) on delete cascade,
  id         text not null,
  name       text not null default '',
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (owner_id, id),
  check (octet_length(data::text) <= 20000)
);
alter table mrpg_my_spells enable row level security;
create policy "mrpg: dono gerencia as próprias magias" on mrpg_my_spells
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

commit;
