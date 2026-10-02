import React, { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth/AuthContext";
import { EmailNotConfirmedError } from "../../lib/auth/supabaseAuth";
import { withBase } from "../../../utils/assetUrl";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/** Orbe do d20 (cristal girando dentro das garras de dragão), a mesma arte da Mesa. */
const Orb: React.FC = () => (
  <div className="relative mx-auto mb-3 h-[104px] w-[134px] select-none" aria-hidden="true">
    <style>{`@keyframes orbSpin { to { transform: rotate(360deg); } } @keyframes orbPulse { 0%,100% { opacity: .55; } 50% { opacity: 1; } }`}</style>
    <div className="absolute left-[26%] top-[16%] h-[50%] w-[49%] rounded-full" style={{ background: "radial-gradient(circle, rgba(255,70,50,.55), rgba(120,10,20,.0) 70%)", animation: "orbPulse 3.4s ease-in-out infinite", filter: "blur(6px)" }} />
    <img src={withBase("/ui/expandido/d20-cristal.webp")} alt="" draggable={false} className="absolute left-[25.5%] top-[17.9%] w-[49%]" style={{ animation: "orbSpin 14s linear infinite", filter: "drop-shadow(0 0 10px rgba(255,60,40,.7))" }} />
    <img src={withBase("/ui/expandido/garras-orbe.webp")} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
  </div>
);

const RULES: Array<[string, (s: string) => boolean]> = [
  ["Pelo menos 8 caracteres", (s) => s.length >= 8],
  ["Pelo menos uma letra", (s) => /[A-Za-zÀ-ÿ]/.test(s)],
  ["Pelo menos um número", (s) => /\d/.test(s)],
];

const field = "w-full rounded-lg border border-[#2a3a5c] bg-[#08142a] px-3 py-2.5 text-sm text-[#f0e6cf] placeholder:text-[#6f7c99] outline-none focus:border-[#d9a94c] focus:ring-1 focus:ring-[#d9a94c]";
const label = "mb-1 block text-[11px] font-black uppercase tracking-[0.16em] text-[#c9a25e]";

/**
 * Janela de login e de criação de conta (com confirmação por e-mail). Abre por cima da página, não ocupa a tela toda.
 * Quando alguém tenta criar ou entrar numa mesa sem estar logado, ela aparece com o motivo.
 */
export const AuthModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { login, register, resendConfirmation, authReason } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => { if (isOpen) { setError(""); setSent(false); setNeedsConfirm(false); } }, [isOpen, mode]);
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const passwordOk = RULES.every(([, ok]) => ok(password));
  const canRegister = nickname.trim().length >= 2 && /.+@.+\..+/.test(email.trim()) && passwordOk && password === confirm;

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
        onClose();
      } else {
        const result = await register(email.trim(), password, nickname.trim());
        if (result.needsConfirmation) setSent(true);
        else onClose();
      }
    } catch (e) {
      if (e instanceof EmailNotConfirmedError) setNeedsConfirm(true);
      setError(e instanceof Error ? e.message : "Falha ao autenticar.");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true); setError("");
    try { await resendConfirmation(email.trim()); setError(""); setSent(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível reenviar."); }
    finally { setBusy(false); }
  };

  return (
    <div className="no-print fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Entrar ou criar conta" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative my-auto w-full max-w-[460px] rounded-2xl border border-[#d9a94c]/60 bg-gradient-to-b from-[#0d1f42] to-[#050d1e] p-6 shadow-[0_0_40px_rgba(200,40,30,.35)]">
        <button onClick={onClose} aria-label="Fechar" className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded text-[#c9a25e] hover:bg-white/10">✕</button>
        <Orb />
        <h2 className="text-center font-serif text-2xl font-black text-[#f2c572]">{mode === "login" ? "Entre na sua conta" : "Crie sua conta"}</h2>
        {authReason && <p className="mt-2 rounded-lg border border-[#b92b3a]/60 bg-[#b92b3a]/15 px-3 py-2 text-center text-[13px] font-bold text-[#ffd9d4]">{authReason}</p>}
        <p className="mt-2 text-center text-[12.5px] leading-5 text-[#aeb8d0]">
          A conta guarda os seus <b className="text-[#f0e6cf]">personagens</b> e as suas <b className="text-[#f0e6cf]">campanhas</b>, e permite <b className="text-[#f0e6cf]">compartilhar campanhas</b> com outros jogadores. Seu e-mail precisa ser confirmado.
        </p>

        {sent ? (
          <div className="mt-5 rounded-lg border border-[#2b8a3e]/60 bg-[#2b8a3e]/15 p-4 text-center text-sm text-[#d7f5dc]">
            <div className="text-2xl">✉️</div>
            <b>Confira o seu e-mail</b>
            <p className="mt-1 text-[12.5px] leading-5">Enviamos uma mensagem de confirmação para <b>{email.trim()}</b>. Abra, clique no link e depois volte aqui para entrar. Olhe também a caixa de spam.</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button onClick={resend} disabled={busy} className="rounded border border-[#d9a94c]/70 px-3 py-1.5 text-[11px] font-bold uppercase text-[#f2c572] hover:bg-white/10 disabled:opacity-50">Reenviar e-mail</button>
              <button onClick={() => { setSent(false); setMode("login"); }} className="rounded bg-[#b92b3a] px-3 py-1.5 text-[11px] font-bold uppercase text-white hover:bg-[#9c1f2d]">Já confirmei, entrar</button>
            </div>
            {error && <p className="mt-2 text-[11px] font-bold text-[#ffb0b8]">{error}</p>}
          </div>
        ) : (
          <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
            {mode === "register" && (
              <div><label className={label} htmlFor="auth-nick">Apelido</label><input id="auth-nick" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={30} autoComplete="nickname" placeholder="Como os outros jogadores vão te ver" className={field} /></div>
            )}
            <div><label className={label} htmlFor="auth-email">E-mail</label><input id="auth-email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="seu@email.com" className={field} /></div>
            <div>
              <label className={label} htmlFor="auth-pass">Senha</label>
              <div className="relative"><input id="auth-pass" value={password} onChange={(e) => setPassword(e.target.value)} type={show ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} className={`${field} pr-12`} />
                <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-[11px] font-bold text-[#c9a25e] hover:bg-white/10">{show ? "ocultar" : "mostrar"}</button></div>
              {mode === "register" && (
                <ul className="mt-2 space-y-1 text-[12px] text-[#aeb8d0]">
                  {RULES.map(([text, ok]) => <li key={text} className={ok(password) ? "text-[#7be08f]" : ""}>{ok(password) ? "●" : "○"} {text}</li>)}
                </ul>
              )}
            </div>
            {mode === "register" && (
              <div><label className={label} htmlFor="auth-confirm">Confirmar senha</label><input id="auth-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} type={show ? "text" : "password"} autoComplete="new-password" className={field} />
                {confirm && password !== confirm && <p className="mt-1 text-[11px] font-bold text-[#ffb0b8]">As senhas não são iguais.</p>}</div>
            )}
            {error && (
              <p className="rounded-lg border border-[#b92b3a]/60 bg-[#b92b3a]/15 px-3 py-2 text-[12px] font-bold text-[#ffd9d4]">
                {error}{needsConfirm && <> <button type="button" onClick={resend} className="underline">Reenviar e-mail de confirmação</button></>}
              </p>
            )}
            <button type="submit" disabled={busy || !email.trim() || !password || (mode === "register" && !canRegister)} className="w-full rounded-lg bg-gradient-to-b from-[#d4293f] to-[#8a0f25] py-3 text-sm font-black uppercase tracking-widest text-[#fff0c4] shadow-[0_0_14px_rgba(230,40,60,.45)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45">
              {busy ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
            </button>
            <div className="flex items-center gap-3 text-[11px] text-[#6f7c99]"><span className="h-px flex-1 bg-[#2a3a5c]" />ou<span className="h-px flex-1 bg-[#2a3a5c]" /></div>
            <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setConfirm(""); }} className="w-full rounded-lg border border-[#2a3a5c] bg-[#08142a] py-2.5 text-sm font-bold text-[#f0e6cf] hover:border-[#d9a94c]">
              {mode === "login" ? "Não tenho conta: criar agora" : "Já tenho uma conta"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
