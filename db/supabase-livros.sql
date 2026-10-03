-- ModernRPG — acervo de livros no Supabase: acervo público, "meus livros" (publicados e adquiridos) e contador de aquisições.
-- Usa as tabelas que já existiam em db/supabase-schema.sql (mrpg_books, mrpg_book_downloads; 0 linhas em 03/10/2026) e acrescenta funções.
-- Segurança: a leitura passa a ser SÓ pelas funções (o link do arquivo de um livro pago não aparece na lista pública; só para o autor e para quem adquiriu).
-- "Adquirir" = colocar o livro na conta (gratuito ou pago); não há cobrança: o registro é o que vale por enquanto.
-- Desfazer: db/supabase-livros-rollback.sql.
begin;

-- Leitura direta da tabela só para o autor; o público lê pelas funções abaixo.
drop policy if exists "mrpg: livros são públicos" on mrpg_books;
drop policy if exists "mrpg: autor vê os próprios livros" on mrpg_books;
create policy "mrpg: autor vê os próprios livros" on mrpg_books for select to authenticated using (owner_id = auth.uid());

create or replace function mrpg_book_view(b mrpg_books, p_with_file boolean)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'id', b.id, 'title', b.title, 'authorName', b.author_name, 'system', b.system, 'coverUrl', b.cover_url,
    'fileUrl', case when p_with_file or b.price_type = 'gratuita' then b.file_url else '' end,
    'priceType', b.price_type, 'priceValue', b.price_value, 'description', b.description,
    'downloadCount', b.download_count, 'declaresOriginal', b.declares_original, 'createdAt', b.created_at, 'ownerId', b.owner_id
  );
$$;

-- Acervo público, com busca e paginação (12 por página).
create or replace function mrpg_books_list(p_q text default null, p_system text default null, p_price text default null, p_page integer default 1)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  page_size constant integer := 12;
  q text := nullif(btrim(coalesce(p_q, '')), '');
  total integer;
  rows jsonb;
begin
  select count(*) into total from mrpg_books b
   where (q is null or b.title ilike '%' || q || '%' or b.author_name ilike '%' || q || '%' or b.description ilike '%' || q || '%')
     and (nullif(p_system, '') is null or b.system ilike '%' || p_system || '%')
     and (nullif(p_price, '') is null or b.price_type = p_price);
  select coalesce(jsonb_agg(mrpg_book_view(x, x.owner_id = auth.uid())), '[]'::jsonb) into rows from (
    select b.* from mrpg_books b
     where (q is null or b.title ilike '%' || q || '%' or b.author_name ilike '%' || q || '%' or b.description ilike '%' || q || '%')
       and (nullif(p_system, '') is null or b.system ilike '%' || p_system || '%')
       and (nullif(p_price, '') is null or b.price_type = p_price)
     order by b.created_at desc
     offset (greatest(coalesce(p_page, 1), 1) - 1) * page_size limit page_size
  ) x;
  return jsonb_build_object('books', rows, 'total', total, 'hasMore', total > greatest(coalesce(p_page, 1), 1) * page_size);
end $$;

-- Publicar (exige conta e a declaração de autoria).
create or replace function mrpg_book_publish(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); row_b mrpg_books;
begin
  if uid is null then raise exception 'Entre na sua conta para publicar.'; end if;
  if coalesce(btrim(p->>'title'), '') = '' or coalesce(btrim(p->>'fileUrl'), '') = '' then raise exception 'Título e link do arquivo são obrigatórios.'; end if;
  if coalesce((p->>'declaresOriginal')::boolean, false) is not true then raise exception 'Declare que você é o autor e responsável pelo material.'; end if;
  insert into mrpg_books (owner_id, title, author_name, system, cover_url, file_url, price_type, price_value, description, declares_original)
  values (uid, btrim(p->>'title'), coalesce(p->>'authorName', ''), coalesce(nullif(p->>'system', ''), 'Tormenta20'), coalesce(p->>'coverUrl', ''), btrim(p->>'fileUrl'),
          case when p->>'priceType' = 'paga' then 'paga' else 'gratuita' end, greatest(coalesce((p->>'priceValue')::numeric, 0), 0), coalesce(p->>'description', ''), true)
  returning * into row_b;
  return mrpg_book_view(row_b, true);
end $$;

-- Remover (só o autor).
create or replace function mrpg_book_delete(p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  delete from mrpg_books where id = p_id and owner_id = auth.uid();
  return found;
end $$;

-- Adquirir: coloca o livro na conta (uma vez por pessoa) e conta +1. Devolve o livro com o link do arquivo.
create or replace function mrpg_book_acquire(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); row_b mrpg_books; inserted integer;
begin
  if uid is null then raise exception 'Entre na sua conta para adquirir um livro.'; end if;
  select * into row_b from mrpg_books where id = p_id;
  if not found then raise exception 'Livro não encontrado.'; end if;
  insert into mrpg_book_downloads (book_id, user_id) values (p_id, uid) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted > 0 and row_b.owner_id <> uid then
    update mrpg_books set download_count = download_count + 1 where id = p_id returning * into row_b;
  end if;
  return mrpg_book_view(row_b, true);
end $$;

-- Meus livros: os que publiquei (com o contador) e os que adquiri.
create or replace function mrpg_my_books()
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return jsonb_build_object('published', '[]'::jsonb, 'acquired', '[]'::jsonb); end if;
  return jsonb_build_object(
    'published', coalesce((select jsonb_agg(mrpg_book_view(b, true) order by b.created_at desc) from mrpg_books b where b.owner_id = uid), '[]'::jsonb),
    'acquired', coalesce((select jsonb_agg(mrpg_book_view(b, true) || jsonb_build_object('acquiredAt', d.downloaded_at) order by d.downloaded_at desc)
                          from mrpg_book_downloads d join mrpg_books b on b.id = d.book_id where d.user_id = uid and b.owner_id <> uid), '[]'::jsonb)
  );
end $$;

revoke all on function mrpg_books_list(text, text, text, integer), mrpg_book_publish(jsonb), mrpg_book_delete(uuid), mrpg_book_acquire(uuid), mrpg_my_books() from public;
grant execute on function mrpg_books_list(text, text, text, integer) to anon, authenticated;
grant execute on function mrpg_book_publish(jsonb), mrpg_book_delete(uuid), mrpg_book_acquire(uuid), mrpg_my_books() to authenticated;

commit;
