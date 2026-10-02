-- ModernRPG — remove as 3 tabelas antigas sem uso (campanhas, membros e fichas do esquema antigo, db/supabase-schema.sql)
-- e as 4 funções que só existiam para elas. Conferido em 02/10/2026 antes de escrever este arquivo:
--   * 0 linhas nas 3 tabelas; nenhuma outra tabela, view, gatilho ou política depende delas;
--   * nenhum arquivo do site (src/, server/, tests/) as usa.
-- NÃO mexe em mrpg_companions, mrpg_books, mrpg_book_downloads, mrpg_homebrew, mrpg_tables nem nas tabelas novas de campanha.
-- Para desfazer: rodar de novo os trechos dessas tabelas/funções de db/supabase-schema.sql (as tabelas estão vazias, não há dado a restaurar).
begin;
drop table if exists mrpg_campaign_members;
drop table if exists mrpg_campaigns;
drop table if exists mrpg_characters;
drop function if exists mrpg_share_campaign(uuid, text);
drop function if exists mrpg_campaign_member_emails(uuid);
drop function if exists mrpg_is_campaign_member(uuid);
drop function if exists mrpg_is_campaign_owner(uuid);
commit;
