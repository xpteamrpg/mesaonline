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

const toUser = (user: User): AuthUser => {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const text = (key: string) => (typeof meta[key] === "string" ? (meta[key] as string) : undefined);
  return {
    id: user.id,
    email: user.email ?? "",
    nickname: text("nickname"),
    // "Verificado" só quando a pessoa clicou no link do e-mail (o banco libera o login antes disso; ver db/supabase-login-sem-confirmar.sql).
    confirmed: meta.email_verified === true || (meta.email_verified === undefined && Boolean(user.email_confirmed_at)),
    displayName: text("display_name"),
    handle: text("handle"),
    bio: text("bio"),
    newsletter: meta.newsletter !== false,
    createdAt: user.created_at,
    providers: (user.identities ?? []).map((i) => ({ provider: i.provider, email: typeof i.identity_data?.email === "string" ? i.identity_data.email : undefined })),
  };
};

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

/** Cria a conta e já entra; `needsConfirmation` indica que o e-mail ainda não foi confirmado (mostrado como "Não verificado"). */
export async function signUp(nickname: string, email: string, password: string): Promise<{ needsConfirmation: boolean; user?: AuthUser }> {
  if (!supabase) throw new Error("Contas indisponíveis.");
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { nickname }, emailRedirectTo: redirectUrl() } });
  if (error) throw explain(error);
  // E-mail que já existe: o Supabase não acusa erro (para não revelar quem tem conta), mas devolve a lista de identidades vazia.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new Error("Este e-mail já tem conta. Use “Entrar”.");
  if (data.session && data.user) return { needsConfirmation: !data.user.email_confirmed_at, user: toUser(data.user) };
  // O site deixa entrar sem confirmar o e-mail (a conta fica "Não verificada" até a pessoa clicar no link).
  const login = await supabase.auth.signInWithPassword({ email, password });
  if (!login.error && login.data.user) return { needsConfirmation: !login.data.user.email_confirmed_at, user: toUser(login.data.user) };
  return { needsConfirmation: true };
}

export async function resendConfirmation(email: string): Promise<void> {
  if (!supabase) throw new Error("Contas indisponíveis.");
  // A conta já entra sem confirmar: para o Supabase reenviar, ela volta a "não confirmada" por um instante e é liberada de novo no fim.
  await supabase.rpc("mrpg_prepare_resend");
  try {
    const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: redirectUrl() } });
    if (error) throw explain(error);
  } finally {
    await supabase.rpc("mrpg_finish_resend");
  }
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

export interface ProfilePatch { displayName?: string; handle?: string; bio?: string; newsletter?: boolean }

/** Grava o perfil público nos dados da conta. */
export async function updateProfile(patch: ProfilePatch): Promise<AuthUser> {
  if (!supabase) throw new Error("Contas indisponíveis.");
  // O identificador (@) é único no site: o banco recusa se outra conta já usa.
  if (patch.handle !== undefined) {
    const { error } = await supabase.rpc("mrpg_set_handle", { p_handle: patch.handle });
    if (error) throw new Error(error.message);
  }
  const data: Record<string, unknown> = {};
  if (patch.displayName !== undefined) data.display_name = patch.displayName;
  if (patch.handle !== undefined) data.handle = patch.handle;
  if (patch.bio !== undefined) data.bio = patch.bio;
  if (patch.newsletter !== undefined) data.newsletter = patch.newsletter;
  const { data: res, error } = await supabase.auth.updateUser({ data });
  if (error) throw explain(error);
  return toUser(res.user);
}

/** Troca ou define a senha da conta logada. */
export async function setPassword(password: string): Promise<void> {
  if (!supabase) throw new Error("Contas indisponíveis.");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw explain(error);
}

/** Entrar com o Google (precisa do provedor Google ligado no Supabase). */
export async function signInWithGoogle(): Promise<void> {
  if (!supabase) throw new Error("Contas indisponíveis.");
  const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectUrl() } });
  if (error) throw explain(error);
}
