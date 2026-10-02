import React, { createContext, useContext, useEffect, useState } from "react";
import * as authClient from "./client";
import type { AuthUser } from "./client";
import * as sb from "./supabaseAuth";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Cria a conta. `needsConfirmation` = o e-mail de confirmação foi enviado e a pessoa só entra depois de clicar no link. */
  register: (email: string, password: string, nickname?: string) => Promise<{ needsConfirmation: boolean }>;
  resendConfirmation: (email: string) => Promise<void>;
  logout: () => void;
  authModalOpen: boolean;
  /** Motivo mostrado na janela (ex.: "Para criar uma mesa você precisa estar logado."). */
  authReason: string;
  openAuthModal: (reason?: string) => void;
  closeAuthModal: () => void;
  /** Devolve true se já há login; senão abre a janela de login com o motivo e devolve false. */
  requireLogin: (reason: string) => boolean;
}

const AuthCtx = createContext<AuthState | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authReason, setAuthReason] = useState("");

  useEffect(() => {
    if (sb.supabaseAuthEnabled) {
      let alive = true;
      void sb.currentUser().then((u) => { if (alive) { setUser(u); setLoading(false); } });
      const stop = sb.onUserChange((u) => { setUser(u); if (u) setAuthModalOpen(false); });
      return () => { alive = false; stop(); };
    }
    authClient.fetchMe().then((u) => { setUser(u); setLoading(false); });
    return undefined;
  }, []);

  const value: AuthState = {
    user,
    loading,
    login: async (email, password) => setUser(sb.supabaseAuthEnabled ? await sb.signIn(email, password) : await authClient.login(email, password)),
    register: async (email, password, nickname = "") => {
      if (sb.supabaseAuthEnabled) {
        const result = await sb.signUp(nickname.trim(), email, password);
        if (result.user) setUser(result.user);
        return { needsConfirmation: result.needsConfirmation };
      }
      setUser(await authClient.register(email, password));
      return { needsConfirmation: false };
    },
    resendConfirmation: (email) => (sb.supabaseAuthEnabled ? sb.resendConfirmation(email) : Promise.resolve()),
    logout: () => { if (sb.supabaseAuthEnabled) void sb.signOut(); else authClient.logout(); setUser(null); },
    authModalOpen,
    authReason,
    openAuthModal: (reason = "") => { setAuthReason(reason); setAuthModalOpen(true); },
    closeAuthModal: () => setAuthModalOpen(false),
    requireLogin: (reason) => {
      if (user) return true;
      setAuthReason(reason);
      setAuthModalOpen(true);
      return false;
    },
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
};

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
