-- ModernRPG — participantes da mesa com retrato e ficha (continuação de db/supabase-campanhas.sql).
-- Acrescenta a coluna `sheet` (cópia da ficha no momento em que o personagem entra na mesa, sem o retrato e sem o diário),
-- troca duas funções MINHAS para aceitarem essa cópia e cria 2 funções novas:
--   mrpg_table_party(mesa)        → qualquer membro vê quem está na mesa (nome, raça, classe, nível e miniatura do retrato)
--   mrpg_character_sheet(ligação) → só o dono do personagem e o mestre da mesa leem a cópia da ficha
-- Desfazer: db/supabase-campanhas-2-rollback.sql
begin;

alter table mrpg_character_links add column if not exists sheet jsonb;

drop function if exists mrpg_character_request(uuid, text, jsonb);
create or replace function mrpg_character_request(p_table uuid, p_character text, p_summary jsonb default '{}'::jsonb, p_sheet jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l mrpg_character_links; gm boolean;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
  if not exists (select 1 from mrpg_table_members where table_id = p_table and user_id = auth.uid()) then
    raise exception 'Entre na mesa antes de ligar um personagem.';
  end if;
  gm := mrpg_is_gm(p_table);
  insert into mrpg_character_links (table_id, owner_id, character_id, summary, sheet, status, decided_at)
  values (p_table, auth.uid(), left(p_character, 80), coalesce(p_summary, '{}'::jsonb), p_sheet, case when gm then 'aceito' else 'solicitado' end, case when gm then now() end)
  on conflict (table_id, owner_id, character_id) do update
    set summary = excluded.summary, sheet = excluded.sheet, status = case when gm then 'aceito' else 'solicitado' end, decided_at = case when gm then now() end
  returning * into l;
  return jsonb_build_object('id', l.id, 'status', l.status);
end $$;

drop function if exists mrpg_character_link_by_code(text, text, jsonb);
create or replace function mrpg_character_link_by_code(p_code text, p_character text, p_summary jsonb default '{}'::jsonb, p_sheet jsonb default null)
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
  insert into mrpg_character_links (table_id, owner_id, character_id, summary, sheet, status, decided_at)
  values (t.id, auth.uid(), left(p_character, 80), coalesce(p_summary, '{}'::jsonb), p_sheet, 'aceito', now())
  on conflict (table_id, owner_id, character_id) do update set summary = excluded.summary, sheet = excluded.sheet, status = 'aceito', decided_at = now()
  returning * into l;
  return jsonb_build_object('id', l.id, 'status', l.status, 'table', mrpg_table_view(t));
end $$;

-- Quem está na mesa (só personagens já aceitos). Não devolve a ficha, só o resumo.
create or replace function mrpg_table_party(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from mrpg_table_members where table_id = p_id and user_id = auth.uid()) then
    raise exception 'Você não faz parte desta mesa.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', l.id, 'characterId', l.character_id, 'summary', l.summary, 'ownerId', l.owner_id,
             'ownerName', mrpg_user_name(l.owner_id), 'hasSheet', l.sheet is not null) order by l.created_at)
      from mrpg_character_links l where l.table_id = p_id and l.status = 'aceito'
  ), '[]'::jsonb);
end $$;

-- A cópia da ficha: só o dono do personagem e o mestre da mesa.
create or replace function mrpg_character_sheet(p_link uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l mrpg_character_links;
begin
  select * into l from mrpg_character_links where id = p_link;
  if not found or (l.owner_id <> auth.uid() and not mrpg_is_gm(l.table_id)) then raise exception 'Sem permissão para ver esta ficha.'; end if;
  return l.sheet;
end $$;

grant execute on function mrpg_character_request(uuid, text, jsonb, jsonb), mrpg_character_link_by_code(text, text, jsonb, jsonb),
  mrpg_table_party(uuid), mrpg_character_sheet(uuid) to authenticated;

commit;
