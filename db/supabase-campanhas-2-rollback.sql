-- Desfaz db/supabase-campanhas-2.sql: remove as funções novas, volta as duas antigas (sem a cópia da ficha) e tira a coluna `sheet`.
begin;
drop function if exists mrpg_character_sheet(uuid);
drop function if exists mrpg_table_party(uuid);
drop function if exists mrpg_character_link_by_code(text, text, jsonb, jsonb);
drop function if exists mrpg_character_request(uuid, text, jsonb, jsonb);
alter table mrpg_character_links drop column if exists sheet;

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

grant execute on function mrpg_character_request(uuid, text, jsonb), mrpg_character_link_by_code(text, text, jsonb) to authenticated;
commit;
