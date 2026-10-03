-- Desfaz db/supabase-livros.sql: remove as funções e volta a política de leitura pública da tabela (como em supabase-schema.sql).
begin;
drop function if exists mrpg_my_books();
drop function if exists mrpg_book_acquire(uuid);
drop function if exists mrpg_book_delete(uuid);
drop function if exists mrpg_book_publish(jsonb);
drop function if exists mrpg_books_list(text, text, text, integer);
drop function if exists mrpg_book_view(mrpg_books, boolean);
drop policy if exists "mrpg: autor vê os próprios livros" on mrpg_books;
create policy "mrpg: livros são públicos" on mrpg_books for select to anon, authenticated using (true);
commit;
