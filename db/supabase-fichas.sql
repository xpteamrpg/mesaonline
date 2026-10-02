-- ModernRPG — fichas de personagem na conta + identificador (@) único, e remoção das 3 tabelas antigas sem uso.
-- Antes de remover as antigas (conferido em 02/10/2026): 0 linhas, nenhuma outra tabela/view/gatilho/política dependia delas,
-- nenhum arquivo do site as usava. O bloco abaixo ABORTA se alguma delas tiver dado.
-- Não mexe em mrpg_companions, mrpg_books, mrpg_book_downloads, mrpg_homebrew, mrpg_tables nem nas tabelas de campanha.
-- Desfazer: db/supabase-fichas-rollback.sql (remove as tabelas novas; as antigas voltam rodando os trechos de db/supabase-schema.sql).
begin;

do $$
begin
  if exists (select 1 from mrpg_campaigns) or exists (select 1 from mrpg_campaign_members) or exists (select 1 from mrpg_characters) then
    raise exception 'As tabelas antigas têm dados; nada foi alterado.';
  end if;
end $$;

drop table if exists mrpg_campaign_members;
drop table if exists mrpg_campaigns;
drop table if exists mrpg_characters;
drop function if exists mrpg_share_campaign(uuid, text);
drop function if exists mrpg_campaign_member_emails(uuid);
drop function if exists mrpg_is_campaign_member(uuid);
drop function if exists mrpg_is_campaign_owner(uuid);

-- Fichas na conta: cada pessoa só enxerga e altera as próprias. `data` é a ficha inteira (mesmo formato do site).
create table mrpg_characters (
  owner_id   uuid not null references auth.users(id) on delete cascade,
  id         text not null,
  name       text not null default '',
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (owner_id, id)
);
alter table mrpg_characters enable row level security;
create policy "mrpg: dono gerencia as próprias fichas" on mrpg_characters
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Identificador público (@nome), único em todo o site. Só as funções mexem na tabela.
create table mrpg_handles (
  handle  text primary key check (handle ~ '^[a-z0-9_-]{3,30}$'),
  user_id uuid not null unique references auth.users(id) on delete cascade
);
alter table mrpg_handles enable row level security;

create or replace function mrpg_handle_free(p_handle text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from mrpg_handles h where h.handle = lower(trim(p_handle)) and h.user_id is distinct from auth.uid());
$$;

create or replace function mrpg_set_handle(p_handle text) returns text
language plpgsql security definer set search_path = public as $$
declare h text := lower(trim(coalesce(p_handle, '')));
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
  if h = '' then delete from mrpg_handles where user_id = auth.uid(); return ''; end if;
  if h !~ '^[a-z0-9_-]{3,30}$' then raise exception 'Identificador inválido: use letras minúsculas, números, - e _ (3 a 30 caracteres).'; end if;
  begin
    insert into mrpg_handles (handle, user_id) values (h, auth.uid())
      on conflict (user_id) do update set handle = excluded.handle;
  exception when unique_violation then
    raise exception 'Esse identificador já está em uso.';
  end;
  return h;
end $$;

grant execute on function mrpg_handle_free(text), mrpg_set_handle(text) to authenticated;

commit;
