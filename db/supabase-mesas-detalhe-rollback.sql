-- Desfaz db/supabase-mesas-detalhe.sql: volta mrpg_table_view, mrpg_table_create e mrpg_table_update ao que eram e remove a coluna details.
-- Os detalhes digitados nas páginas das mesas se perdem; o resto da mesa fica como está.
begin;

create or replace function mrpg_table_view(t mrpg_tables, p_with_token boolean default false)
returns jsonb language sql immutable as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', t.id, 'code', t.code, 'name', t.name, 'system', t.system, 'modality', t.modality,
    'priceType', t.price_type, 'priceValue', t.price_value, 'schedule', t.schedule, 'gmName', t.gm_name,
    'seatsTotal', t.seats_total, 'seatsFilled', t.seats_filled, 'ageRating', t.age_rating,
    'vttPlatform', t.vtt_platform, 'description', t.description, 'imageUrl', t.image_url,
    'contactInfo', t.contact_info, 'liveRoomCode', t.live_room_code, 'kind', t.kind,
    'isPublic', t.is_public,
    'ratingAvg', case when t.rating_count > 0 then round(t.rating_sum::numeric / t.rating_count, 1) else null end,
    'ratingCount', t.rating_count, 'createdAt', t.created_at,
    'managementToken', case when p_with_token then t.management_token else null end
  ));
$$;

create or replace function mrpg_table_create(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text;
  row_t mrpg_tables;
begin
  if coalesce(trim(p->>'name'), '') = '' then raise exception 'Nome da mesa é obrigatório.'; end if;
  loop
    new_code := '';
    for i in 1..8 loop new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    exit when not exists (select 1 from mrpg_tables where code = new_code);
  end loop;
  insert into mrpg_tables (code, management_token, name, system, modality, price_type, price_value, schedule, gm_name,
                           seats_total, age_rating, vtt_platform, description, image_url, contact_info, live_room_code, kind, is_public)
  values (new_code, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), left(trim(p->>'name'), 120), coalesce(left(p->>'system', 60), 'Tormenta20'),
          case when p->>'modality' = 'presencial' then 'presencial' else 'online' end,
          case when p->>'priceType' = 'paga' then 'paga' else 'gratuita' end,
          case when p->>'priceType' = 'paga' then greatest(0, coalesce((p->>'priceValue')::numeric, 0)) else 0 end,
          coalesce(left(p->>'schedule', 120), ''), coalesce(left(p->>'gmName', 120), ''),
          greatest(1, coalesce((p->>'seatsTotal')::int, 4)), coalesce(left(p->>'ageRating', 10), 'livre'),
          coalesce(left(p->>'vttPlatform', 120), 'Mesa de Arton (deste site)'), coalesce(left(p->>'description', 1500), ''),
          coalesce(left(p->>'imageUrl', 400000), ''), coalesce(left(p->>'contactInfo', 200), ''),
          coalesce(left(p->>'liveRoomCode', 12), ''), case when p->>'kind' = 'campanha' then 'campanha' else 'oneshot' end,
          coalesce((p->>'isPublic')::boolean, false))
  returning * into row_t;
  return mrpg_table_view(row_t, true);
end $$;

create or replace function mrpg_table_update(p_id uuid, p_token text, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare row_t mrpg_tables;
begin
  update mrpg_tables set
    name = coalesce(left(p->>'name', 120), name), system = coalesce(left(p->>'system', 60), system),
    modality = case when p->>'modality' in ('online', 'presencial') then p->>'modality' else modality end,
    price_type = case when p->>'priceType' in ('gratuita', 'paga') then p->>'priceType' else price_type end,
    price_value = coalesce((p->>'priceValue')::numeric, price_value), schedule = coalesce(left(p->>'schedule', 120), schedule),
    gm_name = coalesce(left(p->>'gmName', 120), gm_name), seats_total = coalesce((p->>'seatsTotal')::int, seats_total),
    seats_filled = coalesce((p->>'seatsFilled')::int, seats_filled), age_rating = coalesce(left(p->>'ageRating', 10), age_rating),
    vtt_platform = coalesce(left(p->>'vttPlatform', 120), vtt_platform), description = coalesce(left(p->>'description', 1500), description),
    image_url = coalesce(left(p->>'imageUrl', 400000), image_url), contact_info = coalesce(left(p->>'contactInfo', 200), contact_info),
    live_room_code = coalesce(left(p->>'liveRoomCode', 12), live_room_code),
    kind = case when p->>'kind' in ('campanha', 'oneshot') then p->>'kind' else kind end,
    is_public = coalesce((p->>'isPublic')::boolean, is_public)
   where id = p_id and management_token = p_token
   returning * into row_t;
  if not found then raise exception 'Mesa não encontrada ou token inválido.'; end if;
  return mrpg_table_view(row_t);
end $$;

alter table mrpg_tables drop column if exists details;

commit;
