import React from "react";
import { useAuth } from "../../lib/auth/AuthContext";
import { REQUIRE_LOGIN_FOR_PERSONAL_DATA } from "../../lib/accountConfig";

/** Protege uma área pessoal: sem login, pede para entrar (quando a exigência está ligada). */
export const RequireLogin: React.FC<{ what: string; children: React.ReactNode }> = ({ what, children }) => {
  const { user, loading, openAuthModal } = useAuth();
  if (!REQUIRE_LOGIN_FOR_PERSONAL_DATA || user) return <>{children}</>;
  return (
    <div className="mx-auto max-w-xl p-6 sm:p-10">
      <div className="rounded-lg border border-[#ded7c6] bg-white p-8 text-center shadow-sm">
        <div className="text-4xl">🔒</div>
        <h1 className="mt-2 font-serif text-2xl font-black text-[#b92b3a]">Entre para ver {what}</h1>
        <p className="mt-2 text-sm leading-6 text-[#726859]">Esta área é só sua: cada pessoa vê apenas o que criou na própria conta.</p>
        <button onClick={() => openAuthModal()} disabled={loading} className="mt-5 rounded bg-[#b92b3a] px-6 py-2.5 text-xs font-black uppercase text-white hover:bg-[#9c1f2d] disabled:opacity-50">Entrar ou criar conta</button>
      </div>
    </div>
  );
};
