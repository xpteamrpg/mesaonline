import React, { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth/AuthContext";
import { imageFileToDataUrl } from "../../lib/imageFile";
import type { View } from "../../types/view";

const avatarKey = (id: string) => `mrpg_avatar_${id}`;
function readAvatar(id: string): string {
  try { return localStorage.getItem(avatarKey(id)) || ""; } catch { return ""; }
}

const card = "rounded-lg border border-[#ded7c6] bg-white p-5 shadow-sm";
const redBtn = "rounded bg-[#b92b3a] px-3 py-1.5 text-xs font-black text-white hover:bg-[#9c1f2d]";
const greenBtn = "rounded bg-[#2f7d32] px-3 py-1.5 text-xs font-black text-white hover:bg-[#256528]";

const AvatarCircle: React.FC<{ src?: string; size?: number }> = ({ src, size = 96 }) => (
  <div style={{ width: size, height: size }} className="grid shrink-0 place-items-center overflow-hidden rounded-full border border-[#9b6c21] bg-[#faf8f3]">
    {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <span style={{ fontSize: size * 0.5 }} className="text-[#9c9180]" aria-hidden>👤</span>}
  </div>
);

const Side: React.FC<{ view: View; onNavigate: (v: View) => void }> = ({ view, onNavigate }) => {
  const items: Array<[View, string, string]> = [["account", "👤", "Visão geral"], ["accountProfile", "🪪", "Perfil público"], ["accountOrders", "🛍️", "Meus Pedidos"]];
  return (
    <nav className="flex flex-row gap-2 md:flex-col" aria-label="Minha conta">
      {items.map(([v, icon, label]) => (
        <button key={v} onClick={() => onNavigate(v)} className={`flex items-center gap-2 rounded border px-3 py-2 text-left text-xs font-bold ${view === v ? "border-[#b92b3a] bg-[#ece7d3] text-[#b92b3a]" : "border-[#ded7c6] bg-white text-[#2b261f] hover:border-[#b92b3a]"}`}><span aria-hidden>{icon}</span>{label}</button>
      ))}
    </nav>
  );
};

const Shell: React.FC<{ title: string; view: View; onNavigate: (v: View) => void; children: React.ReactNode }> = ({ title, view, onNavigate, children }) => (
  <div className="mx-auto max-w-[1400px] p-3 text-[#2b261f] sm:p-5">
    <h1 className="font-serif text-3xl font-black sm:text-4xl">{title}</h1>
    <div className="mt-2 border-b-2 border-[#b92b3a]" />
    <div className="mt-5 grid gap-5 md:grid-cols-[200px_1fr]">
      <Side view={view} onNavigate={onNavigate} />
      <div className="space-y-4">{children}</div>
    </div>
  </div>
);

const LoginNeeded: React.FC = () => {
  const { openAuthModal } = useAuth();
  return (
    <div className="mx-auto max-w-xl p-6 sm:p-10">
      <div className={`${card} text-center`}>
        <h1 className="font-serif text-2xl font-black text-[#b92b3a]">Entre para ver a sua conta</h1>
        <button onClick={() => openAuthModal("Para abrir a sua conta você precisa estar logado.")} className="mt-4 rounded bg-[#b92b3a] px-6 py-2.5 text-xs font-black uppercase text-white hover:bg-[#9c1f2d]">Entrar ou criar conta</button>
      </div>
    </div>
  );
};

const providerName = (p: string) => (p === "google" ? "Google" : p === "email" ? "E-mail e senha" : p);

/** Minha conta: visão geral. */
export const AccountOverview: React.FC<{ onNavigate: (v: View) => void }> = ({ onNavigate }) => {
  const { user, resendConfirmation, setPassword, logout } = useAuth();
  const [msg, setMsg] = useState("");
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  if (!user) return <LoginNeeded />;
  const name = user.displayName || user.nickname || user.email.split("@")[0];
  const member = user.createdAt ? new Date(user.createdAt).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }) : "—";
  const hasPassword = (user.providers ?? []).some((p) => p.provider === "email");
  const externals = (user.providers ?? []).filter((p) => p.provider !== "email");

  const resend = async () => {
    try { await resendConfirmation(user.email); setMsg("E-mail de confirmação enviado. Confira também a caixa de spam."); } catch (e) { setMsg(e instanceof Error ? e.message : "Não foi possível reenviar."); }
  };
  const savePw = async () => {
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) { setMsg("A senha precisa de 8 caracteres, com letra e número."); return; }
    try { await setPassword(pw); setPw(""); setPwOpen(false); setMsg("Senha definida."); } catch (e) { setMsg(e instanceof Error ? e.message : "Não foi possível definir a senha."); }
  };

  return (
    <Shell title="Minha Conta" view="account" onNavigate={onNavigate}>
      <section className={`${card} flex flex-wrap items-center gap-4`}>
        <AvatarCircle src={readAvatar(user.id)} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-serif text-2xl font-black">{user.handle ? `@${user.handle}` : name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#9c9180]">
            <span>{user.email}</span>
            {user.confirmed
              ? <span className="rounded-full bg-[#d3f9d8] px-2 py-0.5 font-bold text-[#237804]">Verificado</span>
              : <span className="rounded-full bg-[#fff0c2] px-2 py-0.5 font-bold text-[#8a5a00]">Não verificado</span>}
            {!user.confirmed && <button onClick={resend} className="font-bold text-[#b92b3a] underline">Reenviar e-mail de confirmação</button>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => onNavigate("accountOrders")} className={greenBtn}>Meus Pedidos</button>
          <button onClick={() => onNavigate("accountProfile")} className={redBtn}>Editar perfil</button>
        </div>
      </section>
      {msg && <div role="status" className="rounded border border-[#c2892c]/60 bg-[#fff6dc] px-3 py-2 text-xs font-semibold text-[#6b4a12]">{msg}</div>}

      <div className="grid gap-4 md:grid-cols-2">
        <section className={card}>
          <h2 className="font-serif text-xl font-black">Perfil público</h2>
          <p className="mt-1 text-xs text-[#9c9180]">Sua identidade e suas criações compartilhadas com a comunidade.</p>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><dt className="font-bold">Membro desde</dt><dd className="text-[#9c9180]">{member}</dd></div><div><dt className="font-bold">Criações compartilhadas</dt><dd className="text-[#9c9180]">0</dd></div></dl>
        </section>
        <section className={card}>
          <h2 className="font-serif text-xl font-black">Preferências</h2>
          <p className="mt-1 text-xs text-[#9c9180]">Escolha como deseja receber novidades.</p>
          <div className="mt-3 text-xs font-bold">Notícias por e-mail {user.newsletter ? "ativadas" : "desativadas"}</div>
          <button onClick={() => onNavigate("accountProfile")} className="mt-2 text-xs font-bold text-[#b92b3a] underline">Gerenciar preferências</button>
        </section>
      </div>

      <section className={card}>
        <div className="flex items-start justify-between gap-3">
          <div><h2 className="font-serif text-xl font-black">Assinaturas e pagamentos</h2><p className="mt-1 text-xs text-[#9c9180]">Consulte seus planos, cobranças, faturas e recibos.</p></div>
          <button disabled title="Em breve" className="cursor-not-allowed rounded bg-[#2f7d32] px-3 py-1.5 text-xs font-black text-white opacity-60">Ver planos</button>
        </div>
        <div className="mt-3 rounded border border-[#9b6c21] bg-[#ece7d3] p-4 text-sm">Esse ainda é um protótipo. Ainda não há nada aqui para se ver.</div>
      </section>

      <section className={card}>
        <h2 className="font-serif text-xl font-black">Login e segurança</h2>
        <p className="mt-1 text-xs text-[#9c9180]">Atualize suas credenciais e sessões de acesso.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <button onClick={() => setMsg("Para trocar o e-mail de login, fale com o suporte. Isso será liberado em breve.")} className="rounded border border-[#ded7c6] bg-white px-3 py-2 text-left text-xs font-bold hover:border-[#b92b3a]">Alterar Login</button>
          <button onClick={() => setPwOpen((v) => !v)} className="rounded border border-[#ded7c6] bg-white px-3 py-2 text-left text-xs font-bold hover:border-[#b92b3a]">{hasPassword ? "Alterar Senha" : "Definir Senha"}</button>
          <button onClick={() => setMsg("“Lembrar de mim” já fica ligado neste navegador. Mais opções em breve.")} className="rounded border border-[#ded7c6] bg-white px-3 py-2 text-left text-xs font-bold hover:border-[#b92b3a]">Configurar "Lembrar de Mim"</button>
        </div>
        {pwOpen && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" placeholder="Nova senha (8+, letra e número)" className="w-64 rounded border border-[#ded7c6] px-3 py-1.5 text-xs outline-none focus:border-[#b92b3a]" />
            <button onClick={savePw} className={redBtn}>Salvar senha</button>
          </div>
        )}
        {!hasPassword && <p className="mt-3 text-xs text-[#9c9180]">Esta conta não tem senha e entra pela conta externa. Defina uma senha se quiser entrar também com ela.</p>}
        <div className="mt-4 border-t border-[#eee] pt-3">
          <div className="text-xs font-bold">Contas externas integradas</div>
          {externals.length === 0
            ? <div className="mt-1 text-xs text-[#9c9180]">Nenhuma conta externa ligada.</div>
            : externals.map((p) => <div key={p.provider} className="mt-1 text-xs text-[#9c9180]">{p.email ?? user.email} ({providerName(p.provider)})</div>)}
        </div>
      </section>

      <section className="rounded-lg border border-[#e4a1a1] bg-[#fff0f0] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-serif text-xl font-black text-[#c92a2a]">Encerramento da conta</h2><p className="mt-1 text-xs text-[#c92a2a]">O encerramento remove seu acesso e não pode ser desfeito.</p></div>
          <button onClick={() => setMsg("O encerramento de conta ainda não está disponível neste protótipo. Fale com o suporte.")} className="rounded bg-[#2f7d32] px-3 py-1.5 text-xs font-black text-white hover:bg-[#256528]">Encerrar Conta</button>
        </div>
      </section>
      <div><button onClick={() => { logout(); onNavigate("home"); }} className="rounded border border-[#ded7c6] bg-white px-3 py-1.5 text-xs font-bold text-[#726859] hover:text-[#b92b3a]">Sair da conta</button></div>
    </Shell>
  );
};

/** Editar perfil: identidade pública e preferências. */
export const AccountProfile: React.FC<{ onNavigate: (v: View) => void }> = ({ onNavigate }) => {
  const { user, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [news, setNews] = useState(true);
  const [avatar, setAvatar] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName ?? "");
    setHandle(user.handle ?? "");
    setBio(user.bio ?? "");
    setNews(user.newsletter !== false);
    setAvatar(readAvatar(user.id));
  }, [user?.id]);
  if (!user) return <LoginNeeded />;

  const handleOk = /^[a-z0-9_-]{3,30}$/.test(handle);
  const pickAvatar = async (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) { setMsg("Use PNG, JPEG ou WebP, com no máximo 5 MB."); return; }
    try { setAvatar(await imageFileToDataUrl(file, 256, 0.85)); setMsg(""); } catch (e) { setMsg(e instanceof Error ? e.message : "Imagem inválida."); }
  };
  const save = async () => {
    if (handle && !handleOk) { setMsg("O identificador usa só letras minúsculas, números, hífens (-) e sublinhados (_), de 3 a 30 caracteres."); return; }
    setBusy(true);
    try {
      await updateProfile({ displayName: displayName.trim(), handle, bio: bio.slice(0, 500), newsletter: news });
      try { if (avatar) localStorage.setItem(avatarKey(user.id), avatar); else localStorage.removeItem(avatarKey(user.id)); } catch { /* sem espaço */ }
      setMsg("Perfil atualizado.");
    } catch (e) { setMsg(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  };

  const input = "w-full rounded border border-[#ded7c6] bg-white px-3 py-2 text-sm outline-none focus:border-[#b92b3a]";
  return (
    <Shell title="Editar Perfil" view="accountProfile" onNavigate={onNavigate}>
      {msg && <div role="status" className="rounded border border-[#c2892c]/60 bg-[#fff6dc] px-3 py-2 text-xs font-semibold text-[#6b4a12]">{msg}</div>}
      <section className={card}>
        <h2 className="font-serif text-xl font-black">Identidade pública</h2>
        <p className="mt-1 text-xs text-[#9c9180]">Estas informações aparecem para qualquer pessoa que visitar seu perfil.</p>
        <div className="mt-4 grid gap-5 sm:grid-cols-[170px_1fr]">
          <div className="flex flex-col items-center gap-2 text-center text-[11px] text-[#9c9180]">
            <AvatarCircle src={avatar} size={140} />
            <b className="text-xs text-[#2b261f]">Avatar</b>
            <label className="cursor-pointer rounded bg-[#b92b3a] px-3 py-1.5 text-xs font-black text-white hover:bg-[#9c1f2d]">Escolher Arquivo<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { void pickAvatar(e.target.files?.[0]); e.target.value = ""; }} /></label>
            {avatar && <button onClick={() => setAvatar("")} className="underline">Remover</button>}
            <span>PNG, JPEG ou WebP, com no máximo 5 MB.</span>
          </div>
          <div className="space-y-3">
            <div><label htmlFor="pf-name" className="text-xs font-bold">Nome de exibição</label><input id="pf-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} placeholder="Como você quer ser chamado" className={input} /><p className="mt-1 text-[11px] text-[#9c9180]">Se ficar vazio, seu identificador será usado como nome.</p></div>
            <div><label htmlFor="pf-handle" className="text-xs font-bold">Identificador</label>
              <div className="flex items-center gap-1"><span className="text-[#9c9180]">@</span><input id="pf-handle" value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} maxLength={30} className={`${input} ${handle ? (handleOk ? "border-[#2b8a3e]" : "border-[#c92a2a]") : ""}`} /></div>
              <p className="mt-1 text-[11px] text-[#9c9180]">Use apenas letras minúsculas, números, hífens (-) e sublinhados (_).</p>
              {handle && <p className={`text-[11px] ${handleOk ? "text-[#2b8a3e]" : "text-[#c92a2a]"}`}>{handleOk ? "✓ Identificador válido" : "Identificador inválido"}</p>}
            </div>
            <div><label htmlFor="pf-bio" className="text-xs font-bold">Bio</label><textarea id="pf-bio" value={bio} onChange={(e) => setBio(e.target.value.slice(0, 500))} rows={5} placeholder="Conte um pouco sobre você e suas aventuras." className={input} /><p className="mt-1 text-[11px] text-[#9c9180]">Texto simples, com até 500 caracteres ({bio.length}/500).</p></div>
          </div>
        </div>
      </section>
      <section className={card}>
        <h2 className="font-serif text-xl font-black">Preferências de comunicação</h2>
        <p className="mt-1 text-xs text-[#9c9180]">Controle os e-mails enviados para sua conta.</p>
        <label className="mt-3 flex items-start gap-2 text-xs"><input type="checkbox" checked={news} onChange={(e) => setNews(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#b92b3a]" /><span><b>Receber notícias por e-mail</b><br /><span className="text-[#9c9180]">Enviamos novidades no máximo uma vez por semana.</span></span></label>
      </section>
      <div className="flex justify-center gap-2">
        <button onClick={save} disabled={busy} className="rounded bg-[#b92b3a] px-4 py-2 text-xs font-black text-white hover:bg-[#9c1f2d] disabled:opacity-50">Atualizar Perfil</button>
        <button onClick={() => onNavigate("account")} className={greenBtn}>Voltar</button>
      </div>
    </Shell>
  );
};

/** Meus pedidos: a loja ainda não existe. */
export const AccountOrders: React.FC<{ onNavigate: (v: View) => void }> = ({ onNavigate }) => {
  const { user } = useAuth();
  if (!user) return <LoginNeeded />;
  return (
    <Shell title="Meus Pedidos" view="accountOrders" onNavigate={onNavigate}>
      <section className={card}>
        <h2 className="font-serif text-xl font-black">Pedidos</h2>
        <p className="mt-2 text-sm text-[#5c5446]">Aqui vão aparecer as suas compras de livros e materiais. Esse ainda é um protótipo: a loja ainda não existe e não há nada para ver.</p>
      </section>
    </Shell>
  );
};
