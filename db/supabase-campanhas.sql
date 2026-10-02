-- ModernRPG — Membros, convites, expulsão e vínculo de personagens com as mesas (campanhas e one-shots).
-- Só CRIA objetos novos com prefixo mrpg_ (4 tabelas + funções). Não altera nenhuma tabela, política, função ou
-- configuração que já exista (nem a mrpg_tables). Usa o login do Supabase Auth (auth.uid()).
-- Todas as tabelas ficam fechadas (RLS ligada, nenhuma política): todo acesso passa pelas funções abaixo.
-- Desfazer: db/supabase-campanhas-rollback.sql
-- Rodar tudo de uma vez (uma transação: ou cria tudo, ou não cria nada).

begin;

-- Quem faz parte de cada mesa (o mestre e os jogadores).
create table if not exists mrpg_table_members (
  table_id  uuid not null references mrpg_tables(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      text not null check (role in ('mestre', 'jogador')),
  joined_at timestamptz not null default now(),
  primary key (table_id, user_id)
);
alter table mrpg_table_members enable row level security;
create index if not exists mrpg_table_members_user_idx on mrpg_table_members (user_id);

-- Convites do mestre (por e-mail ou apelido), aceitos no site pelo jogador logado.
create table if not exists mrpg_table_invites (
  id            uuid primary key default gen_random_uuid(),
  table_id      uuid not null references mrpg_tables(id) on delete cascade,
  invited_email text not null default '',
  invited_user  uuid references auth.users(id) on delete cascade,
  invited_by    uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'pendente' check (status in ('pendente', 'aceito', 'recusado')),
  created_at    timestamptz not null default now()
);
alter table mrpg_table_invites enable row level security;
create index if not exists mrpg_table_invites_user_idx on mrpg_table_invites (invited_user, status);
create index if not exists mrpg_table_invites_email_idx on mrpg_table_invites (invited_email, status);

-- Expulsos: não entram de novo pelo código até o mestre convidar outra vez.
create table if not exists mrpg_table_banned (
  table_id uuid not null references mrpg_tables(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  primary key (table_id, user_id)
);
alter table mrpg_table_banned enable row level security;

-- Personagem ligado a uma mesa. O resumo (nome, raça, classe, nível) é uma cópia leve para o mestre ver sem acessar a ficha.
create table if not exists mrpg_character_links (
  id           uuid primary key default gen_random_uuid(),
  table_id     uuid not null references mrpg_tables(id) on delete cascade,
  owner_id     uuid not null references auth.users(id) on delete cascade,
  character_id text not null,
  summary      jsonb not null default '{}'::jsonb,
  status       text not null default 'solicitado' check (status in ('solicitado', 'aceito', 'recusado')),
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  unique (table_id, owner_id, character_id)
);
alter table mrpg_character_links enable row level security;
create index if not exists mrpg_character_links_owner_idx on mrpg_character_links (owner_id);

-- Nome mostrado para uma conta (identificador, nome de exibição, apelido ou o começo do e-mail).
create or replace function mrpg_user_name(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(u.raw_user_meta_data->>'display_name', ''), nullif(u.raw_user_meta_data->>'handle', ''),
                  nullif(u.raw_user_meta_data->>'nickname', ''), split_part(u.email, '@', 1))
    from auth.users u where u.id = p_user;
$$;

create or replace function mrpg_is_gm(p_table uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from mrpg_table_members m where m.table_id = p_table and m.user_id = auth.uid() and m.role = 'mestre');
$$;

-- O mestre (quem tem o token da mesa) liga a mesa à própria conta.
create or replace function mrpg_table_claim(p_id uuid, p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t mrpg_tables;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
  select * into t from mrpg_tables where id = p_id and management_token = p_token;
  if not found then raise exception 'Mesa não encontrada ou token inválido.'; end if;
  insert into mrpg_table_members (table_id, user_id, role) values (p_id, auth.uid(), 'mestre')
    on conflict (table_id, user_id) do update set role = 'mestre';
  return mrpg_table_view(t);
end $$;

-- Jogador entra pelo código da mesa.
create or replace function mrpg_table_join(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t mrpg_tables;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
  select * into t from mrpg_tables where code = upper(trim(p_code));
  if not found then raise exception 'Mesa não encontrada.'; end if;
  if exists (select 1 from mrpg_table_banned b where b.table_id = t.id and b.user_id = auth.uid()) then
    raise exception 'Você foi removido desta mesa. Peça um novo convite ao mestre.';
  end if;
  insert into mrpg_table_members (table_id, user_id, role) values (t.id, auth.uid(), 'jogador') on conflict do nothing;
  return mrpg_table_view(t);
end $$;

-- Mesas de que a pessoa faz parte (com o papel dela e a lista de membros).
create or replace function mrpg_my_tables()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('table', mrpg_table_view(t), 'role', m.role,
             'members', (select count(*) from mrpg_table_members x where x.table_id = t.id)) order by m.joined_at desc)
      from mrpg_table_members m join mrpg_tables t on t.id = m.table_id where m.user_id = auth.uid()
  ), '[]'::jsonb);
end $$;

create or replace function mrpg_table_members_list(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from mrpg_table_members where table_id = p_id and user_id = auth.uid()) then
    raise exception 'Você não faz parte desta mesa.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('userId', m.user_id, 'name', mrpg_user_name(m.user_id), 'role', m.role, 'joinedAt', m.joined_at)
                     order by (m.role = 'mestre') desc, m.joined_at)
      from mrpg_table_members m where m.table_id = p_id
  ), '[]'::jsonb);
end $$;

-- O mestre convida por e-mail ou por apelido/identificador. Convidar de novo também tira a pessoa da lista de expulsos.
create or replace function mrpg_table_invite(p_id uuid, p_email text default '', p_nickname text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare target uuid; mail text := lower(trim(coalesce(p_email, ''))); nick text := lower(trim(coalesce(p_nickname, '')));
begin
  if not mrpg_is_gm(p_id) then raise exception 'Só o mestre da mesa pode convidar.'; end if;
  if mail = '' and nick = '' then raise exception 'Informe um e-mail ou um apelido.'; end if;
  if mail <> '' then select id into target from auth.users where lower(email) = mail limit 1;
  else select id into target from auth.users
        where lower(raw_user_meta_data->>'handle') = nick or lower(raw_user_meta_data->>'nickname') = nick limit 1;
    if target is null then raise exception 'Nenhuma conta com esse apelido.'; end if;
  end if;
  if target = auth.uid() then raise exception 'Você já é o mestre desta mesa.'; end if;
  if target is not null then delete from mrpg_table_banned where table_id = p_id and user_id = target; end if;
  insert into mrpg_table_invites (table_id, invited_email, invited_user, invited_by) values (p_id, mail, target, auth.uid());
  return jsonb_build_object('ok', true, 'hasAccount', target is not null);
end $$;

-- Convites pendentes da pessoa logada (por conta ou pelo e-mail dela).
create or replace function mrpg_my_invites()
returns jsonb language plpgsql security definer set search_path = public as $$
declare mail text;
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  select lower(email) into mail from auth.users where id = auth.uid();
  return coalesce((
    select jsonb_agg(jsonb_build_object('inviteId', i.id, 'table', mrpg_table_view(t), 'invitedBy', mrpg_user_name(i.invited_by), 'createdAt', i.created_at)
                     order by i.created_at desc)
      from mrpg_table_invites i join mrpg_tables t on t.id = i.table_id
     where i.status = 'pendente' and (i.invited_user = auth.uid() or (i.invited_email <> '' and i.invited_email = mail))
  ), '[]'::jsonb);
end $$;

create or replace function mrpg_invite_answer(p_invite uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare inv mrpg_table_invites; mail text;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
  select lower(email) into mail from auth.users where id = auth.uid();
  select * into inv from mrpg_table_invites
   where id = p_invite and status = 'pendente' and (invited_user = auth.uid() or (invited_email <> '' and invited_email = mail));
  if not found then raise exception 'Convite não encontrado.'; end if;
  update mrpg_table_invites set status = case when p_accept then 'aceito' else 'recusado' end, invited_user = auth.uid() where id = inv.id;
  if p_accept then
    insert into mrpg_table_members (table_id, user_id, role) values (inv.table_id, auth.uid(), 'jogador') on conflict do nothing;
  end if;
  return jsonb_build_object('ok', true, 'accepted', p_accept);
end $$;

-- O mestre expulsa um jogador (some da lista, perde os personagens ligados e não volta pelo código).
create or replace function mrpg_table_kick(p_id uuid, p_user uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not mrpg_is_gm(p_id) then raise exception 'Só o mestre da mesa pode expulsar.'; end if;
  if p_user = auth.uid() then raise exception 'O mestre não pode se expulsar.'; end if;
  delete from mrpg_character_links where table_id = p_id and owner_id = p_user;
  delete from mrpg_table_members where table_id = p_id and user_id = p_user and role <> 'mestre';
  insert into mrpg_table_banned (table_id, user_id) values (p_id, p_user) on conflict do nothing;
  return true;
end $$;

-- Jogador sai da mesa por conta própria.
create or replace function mrpg_table_leave(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  delete from mrpg_character_links where table_id = p_id and owner_id = auth.uid();
  delete from mrpg_table_members where table_id = p_id and user_id = auth.uid() and role <> 'mestre';
  return true;
end $$;

-- Solicita a entrada de um personagem na mesa (o mestre aceita ou recusa). Se quem pede é o mestre, já entra aceito.
create or replace function mrpg_character_request(p_table uuid, p_character text, p_summary jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l mrpg_character_links; gm boolean;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
  if not exists (select 1 from mrpg_table_members where table_id = p_table and user_id = auth.uid()) then
    raise exception 'Entre na mesa antes de ligar um personagem.';
  end if;
  gm := mrpg_is_gm(p_table);
  insert into mrpg_character_links (table_id, owner_id, character_id, summary, status, decided_at)
  values (p_table, auth.uid(), left(p_character, 80), coalesce(p_summary, '{}'::jsonb), case when gm then 'aceito' else 'solicitado' end, case when gm then now() end)
  on conflict (table_id, owner_id, character_id) do update
    set summary = excluded.summary, status = case when gm then 'aceito' else 'solicitado' end, decided_at = case when gm then now() end
  returning * into l;
  return jsonb_build_object('id', l.id, 'status', l.status);
end $$;

-- Entrar pelo código do convite e já ligar o personagem (o código é o convite do mestre: entra aceito).
create or replace function mrpg_character_link_by_code(p_code text, p_character text, p_summary jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t mrpg_tables; l mrpg_character_links;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
  select * into t from mrpg_tables where code = upper(trim(p_code));
  if not found then raise exception 'Código de campanha não encontrado.'; end if;
  if exists (select 1 from mrpg_table_banned b where b.table_id = t.id and b.user_id = auth.uid()) then
    raise exception 'Você foi removido desta mesa. Peça um novo convite ao mestre.';
  end if;
  insert into mrpg_table_members (table_id, user_id, role) values (t.id, auth.uid(), 'jogador') on conflict do nothing;
  insert into mrpg_character_links (table_id, owner_id, character_id, summary, status, decided_at)
  values (t.id, auth.uid(), left(p_character, 80), coalesce(p_summary, '{}'::jsonb), 'aceito', now())
  on conflict (table_id, owner_id, character_id) do update set summary = excluded.summary, status = 'aceito', decided_at = now()
  returning * into l;
  return jsonb_build_object('id', l.id, 'status', l.status, 'table', mrpg_table_view(t));
end $$;

-- O mestre vê os personagens ligados à mesa dele (e os que pediram entrada).
create or replace function mrpg_character_requests(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not mrpg_is_gm(p_id) then raise exception 'Só o mestre da mesa vê isto.'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', l.id, 'characterId', l.character_id, 'summary', l.summary, 'status', l.status,
             'ownerId', l.owner_id, 'ownerName', mrpg_user_name(l.owner_id), 'createdAt', l.created_at)
             order by (l.status = 'solicitado') desc, l.created_at desc)
      from mrpg_character_links l where l.table_id = p_id
  ), '[]'::jsonb);
end $$;

create or replace function mrpg_character_decide(p_link uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l mrpg_character_links;
begin
  select * into l from mrpg_character_links where id = p_link;
  if not found or not mrpg_is_gm(l.table_id) then raise exception 'Só o mestre da mesa pode aceitar ou recusar.'; end if;
  update mrpg_character_links set status = case when p_accept then 'aceito' else 'recusado' end, decided_at = now() where id = p_link;
  return jsonb_build_object('ok', true, 'status', case when p_accept then 'aceito' else 'recusado' end);
end $$;

create or replace function mrpg_character_unlink(p_link uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare l mrpg_character_links;
begin
  select * into l from mrpg_character_links where id = p_link;
  if not found then return false; end if;
  if l.owner_id <> auth.uid() and not mrpg_is_gm(l.table_id) then raise exception 'Sem permissão.'; end if;
  delete from mrpg_character_links where id = p_link;
  return true;
end $$;

-- Ligações dos personagens da pessoa logada (para a linha "Mesas Online:" em Meus Personagens).
create or replace function mrpg_my_character_links()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', l.id, 'characterId', l.character_id, 'status', l.status, 'tableId', t.id, 'tableName', t.name,
             'kind', t.kind, 'code', t.code) order by l.created_at)
      from mrpg_character_links l join mrpg_tables t on t.id = l.table_id where l.owner_id = auth.uid()
  ), '[]'::jsonb);
end $$;

revoke all on function mrpg_user_name(uuid), mrpg_is_gm(uuid) from public, anon, authenticated;
grant execute on function mrpg_table_claim(uuid, text), mrpg_table_join(text), mrpg_my_tables(), mrpg_table_members_list(uuid),
  mrpg_table_invite(uuid, text, text), mrpg_my_invites(), mrpg_invite_answer(uuid, boolean), mrpg_table_kick(uuid, uuid),
  mrpg_table_leave(uuid), mrpg_character_request(uuid, text, jsonb), mrpg_character_link_by_code(text, text, jsonb),
  mrpg_character_requests(uuid), mrpg_character_decide(uuid, boolean), mrpg_character_unlink(uuid), mrpg_my_character_links()
  to authenticated;

commit;
