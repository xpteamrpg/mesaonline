-- ModernRPG — entrar sem confirmar o e-mail (a conta mostra "Não verificado" até a pessoa clicar no link).
-- O Supabase não deixa entrar com e-mail não confirmado (a opção mailer_allow_unverified_email_sign_ins não muda isso),
-- então o banco libera a conta logo DEPOIS que o Supabase grava o envio do e-mail de confirmação (o e-mail segue válido).
-- "Verificado" = user_metadata.email_verified = true, que o Supabase só liga quando a pessoa clica no link do e-mail.
-- Atenção: vale para todo o projeto Supabase (o login do Foundry, que está aposentado, também passa a entrar sem confirmar).
-- Desfazer: db/supabase-login-sem-confirmar-rollback.sql
begin;

create or replace function mrpg_autoconfirm_email() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  if new.email_confirmed_at is null and old.confirmation_sent_at is null and new.confirmation_sent_at is not null then
    new.email_confirmed_at := now();
    new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('email_verified', false);
  end if;
  return new;
end $$;

drop trigger if exists mrpg_autoconfirm_email on auth.users;
create trigger mrpg_autoconfirm_email before update of confirmation_sent_at on auth.users
  for each row execute function mrpg_autoconfirm_email();

-- "Reenviar e-mail de confirmação": o Supabase só reenvia para conta não confirmada.
-- O site chama prepare → reenviar → finish (este último sempre, mesmo se o envio falhar), para ninguém ficar trancado.
create or replace function mrpg_prepare_resend() returns void
language sql security definer set search_path = public, auth as $$
  update auth.users set email_confirmed_at = null
   where id = auth.uid() and email_confirmed_at is not null and coalesce(raw_user_meta_data->>'email_verified', '') <> 'true';
$$;

create or replace function mrpg_finish_resend() returns void
language sql security definer set search_path = public, auth as $$
  update auth.users set email_confirmed_at = now()
   where id = auth.uid() and email_confirmed_at is null and coalesce(raw_user_meta_data->>'email_verified', '') <> 'true';
$$;

revoke all on function mrpg_prepare_resend(), mrpg_finish_resend() from public, anon;
grant execute on function mrpg_prepare_resend(), mrpg_finish_resend() to authenticated;

commit;
