/**
 * Conta de usuário pelo Supabase Auth (e-mail e senha, com confirmação por e-mail).
 * É o login do site publicado. Sem o Supabase configurado (`.env.local`), o Portal cai no servidor local (`server/`).
 */
import type { User } from "@supabase/supabase-js";
import { supabase } from "../supabase/client";
import { SITE_ROOT } from "../../../utils/assetUrl";
import type { AuthUser } from "./client";

export const supabaseAuthEnabled = supabase !== null;

export class EmailNotConfirmedError extends Error {
  constructor() { super("Confirme o seu e-mail para entrar: abra a mensagem que enviamos e clique no link."); this.name = "EmailNotConfirmedError"; }
}

const toUser = (user: User): AuthUser => ({
  id: user.id,
  email: user.email ?? "",
  nickname: typeof user.user_metadata?.nickname === "string" ? user.user_metadata.nickname : undefined,
  confirmed: Boolean(user.email_confirmed_at),
});

/** Para onde o link do e-mail leva depois de confirmar: a página Mesa online do próprio site. */
function redirectUrl(): string {
  return `${window.location.origin}${SITE_ROOT}#/mesa-online`;
}

function explain(error: { message: string; status?: number; code?: string }): Error {
  const text = error.message || "";
  if (/invalid login credentials/i.test(text)) return new Error("E-mail ou senha incorretos.");
  if (/email not confirmed/i.test(text)) return new EmailNotConfirmedError();
  if (/already registered|already been registered/i.test(text)) return new Error("Este e-mail já tem conta. Use “Entrar”.");
  if (/rate limit|too many|over_email_send_rate_limit|email_send/i.test(`${text} ${error.code ?? ""}`) || error.status === 429) return new Error("Muitos e-mails enviados em pouco tempo. Espere alguns minutos e tente de novo.");
  if (/password/i.test(text)) return new Error("Senha fraca demais: use pelo menos 8 caracteres, com letras e números.");
  if (/invalid.*email|email.*invalid/i.test(text)) return new Error("Esse e-mail não parece válido.");
  return new Error(text || "Não foi possível falar com o servidor de contas.");
}

export async function currentUser(): Promise<AuthUser | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user ? toUser(data.session.user) : null;
}

/** Avisa quando o login muda (inclusive depois de clicar no link de confirmação, em outra aba). */
export function onUserChange(listener: (user: AuthUser | null) => void): () => void {
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange((_event, session) => listener(session?.user ? toUser(session.user) : null));
  return () => data.subscription.unsubscribe();
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  if (!supabase) throw new Error("Contas indisponíveis.");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw explain(error);
  return toUser(data.user);
}

/** Cria a conta. Com confirmação de e-mail ligada no Supabase, `needsConfirmation` vem verdadeiro e ninguém entra antes de clicar no link. */
export async function signUp(nickname: string, email: string, password: string): Promise<{ needsConfirmation: boolean; user?: AuthUser }> {
  if (!supabase) throw new Error("Contas indisponíveis.");
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { nickname }, emailRedirectTo: redirectUrl() } });
  if (error) throw explain(error);
  // E-mail que já existe: o Supabase não acusa erro (para não revelar quem tem conta), mas devolve a lista de identidades vazia.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new Error("Este e-mail já tem conta. Use “Entrar”.");
  return { needsConfirmation: !data.session, user: data.session && data.user ? toUser(data.user) : undefined };
}

export async function resendConfirmation(email: string): Promise<void> {
  if (!supabase) throw new Error("Contas indisponíveis.");
  const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: redirectUrl() } });
  if (error) throw explain(error);
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}
