-- Desfaz db/supabase-login-sem-confirmar.sql (contas já liberadas continuam liberadas).
begin;
drop trigger if exists mrpg_autoconfirm_email on auth.users;
drop function if exists mrpg_autoconfirm_email();
drop function if exists mrpg_prepare_resend();
drop function if exists mrpg_finish_resend();
commit;
