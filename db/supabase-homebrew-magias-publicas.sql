-- ModernRPG — magias do Criador de magias PUBLICADAS no Homebrew (a pessoa decide publicar; antes disso a magia é privada).
-- Cria UMA tabela nova (mrpg_public_spells). Qualquer pessoa (inclusive sem login) LÊ; só a dona da magia publica, atualiza e despublica
-- as PRÓPRIAS. `author` é um recorte do perfil que a pessoa autorizou mostrar (nome, @identificador, bio curta, retrato pequeno e um
-- contato opcional digitado por ela); nunca o e-mail da conta. Não altera nenhuma tabela, função ou política existente.
-- Desfazer: db/supabase-homebrew-magias-publicas-rollback.sql (apaga a tabela e as magias publicadas).
begin;

create table if not exists mrpg_public_spells (
  owner_id     uuid not null references auth.users(id) on delete cascade,
  id           text not null,
  name         text not null default '',
  circulo      int  not null default 1 check (circulo between 1 and 5),
  data         jsonb not null,
  author       jsonb not null default '{}'::jsonb,
  published_at timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (owner_id, id),
  check (octet_length(data::text) <= 20000),
  check (octet_length(author::text) <= 60000)
);
alter table mrpg_public_spells enable row level security;
create index if not exists mrpg_public_spells_recent_idx on mrpg_public_spells (published_at desc);

create policy "mrpg: qualquer um le as magias publicadas" on mrpg_public_spells
  for select to anon, authenticated using (true);
create policy "mrpg: dono publica as proprias magias" on mrpg_public_spells
  for insert to authenticated with check (owner_id = auth.uid());
create policy "mrpg: dono atualiza as proprias magias publicadas" on mrpg_public_spells
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "mrpg: dono despublica as proprias magias" on mrpg_public_spells
  for delete to authenticated using (owner_id = auth.uid());

commit;
