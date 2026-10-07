import React, { useState } from "react";
import { useAuth } from "../../lib/auth/AuthContext";
import { buildAuthor, publicName, publishSpell, type AuthorChoice } from "../../lib/homebrew/publicSpells";
import type { MagiaCriada } from "../../lib/homebrew/spellText";

const avatarOf = (id: string) => { try { return localStorage.getItem(`mrpg_avatar_${id}`) || ""; } catch { return ""; } };
const choiceKey = (id: string) => `tormenta20_spell_author_choice:${id}`;
const loadChoice = (id: string): AuthorChoice => {
  try { const raw = JSON.parse(localStorage.getItem(choiceKey(id)) || "null"); if (raw) return { showHandle: !!raw.showHandle, showBio: !!raw.showBio, showAvatar: !!raw.showAvatar, contact: String(raw.contact || "") }; } catch { /* usa o padrão */ }
  return { showHandle: true, showBio: false, showAvatar: true, contact: "" };
};

/**
 * Publicar a magia no Homebrew. Mostra o que vai ficar público (o perfil de quem criou) e deixa a pessoa escolher o que aparece;
 * o contato é opcional e é só o que ela digitar aqui. O e-mail da conta nunca é publicado.
 */
export const PublishSpellDialog: React.FC<{ magia: MagiaCriada; onClose: () => void; onPublished: () => void }> = ({ magia, onClose, onPublished }) => {
  const { user } = useAuth();
  const [choice, setChoice] = useState<AuthorChoice>(() => loadChoice(user?.id ?? ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!user) return null;
  const avatar = avatarOf(user.id);
  const set = (patch: Partial<AuthorChoice>) => setChoice((c) => ({ ...c, ...patch }));
  const row = "flex items-center gap-2 text-sm";

  const publish = async () => {
    setBusy(true); setError("");
    try { localStorage.setItem(choiceKey(user.id), JSON.stringify(choice)); } catch { /* sem armazenamento */ }
    const author = await buildAuthor(user, choice, avatar);
    const res = await publishSpell(user.id, magia, author);
    setBusy(false);
    if (!res.ok) { setError(res.error || "Não foi possível publicar."); return; }
    onPublished();
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Publicar magia" data-publish-dialog onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl">
        <h2 className="font-serif text-xl font-black text-[#2b261f]">Publicar “{magia.nome || "Sem Nome"}” no Homebrew</h2>
        <p className="mt-1 text-xs leading-5 text-[#726859]">Qualquer pessoa vai poder ver esta magia na página Homebrew, com o seu perfil. Você pode despublicar quando quiser (a magia continua sua).</p>
        <div className="mt-3 rounded border border-[#ded7c6] bg-[#fbf9f4] p-3">
          <div className="text-[10px] font-black uppercase text-[#9c9180]">O que vai aparecer de você</div>
          <div className="mt-2 flex items-center gap-3">
            {choice.showAvatar && avatar ? <img src={avatar} alt="" className="h-12 w-12 rounded-full border-2 border-[#b92b3a]/60 object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-full border-2 border-[#b92b3a]/60 bg-[#ece7d3] text-lg font-black text-[#7a705d]">{publicName(user)[0]?.toUpperCase()}</span>}
            <div><div className="font-serif text-base font-black text-[#2b261f]">{publicName(user)}</div>{choice.showHandle && user.handle && <div className="text-xs text-[#726859]">@{user.handle}</div>}</div>
          </div>
          {choice.showBio && user.bio && <p className="mt-2 text-xs text-[#5c5446]">{user.bio}</p>}
        </div>
        <div className="mt-3 space-y-1.5">
          <label className={row}><input type="checkbox" checked={choice.showHandle} disabled={!user.handle} onChange={(e) => set({ showHandle: e.target.checked })} /> mostrar meu @identificador{!user.handle ? " (você ainda não tem um)" : ""}</label>
          <label className={row}><input type="checkbox" checked={choice.showBio} disabled={!user.bio} onChange={(e) => set({ showBio: e.target.checked })} /> mostrar minha bio{!user.bio ? " (vazia)" : ""}</label>
          <label className={row}><input type="checkbox" checked={choice.showAvatar} disabled={!avatar} onChange={(e) => set({ showAvatar: e.target.checked })} /> mostrar meu retrato{!avatar ? " (sem retrato)" : ""}</label>
        </div>
        <label className="mt-3 block"><span className="mb-1 block text-[10px] font-bold uppercase text-[#726859]">Contato (opcional) — como as pessoas podem falar com você</span>
          <input value={choice.contact} maxLength={200} onChange={(e) => set({ contact: e.target.value })} className="w-full rounded border border-[#ded7c6] bg-[#fbf9f4] p-2 text-sm" placeholder="Ex.: Discord fulano#1234, ou fulano@email.com" /></label>
        <p className="mt-1 text-[11px] text-[#9c9180]">O e-mail da sua conta nunca é publicado. Só aparece o contato que você digitar acima.</p>
        {error && <p className="mt-2 rounded border border-[#b92b3a] bg-[#fbebee] p-2 text-xs font-semibold text-[#b92b3a]">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button type="button" disabled={busy} onClick={() => void publish()} className="rounded bg-[#b92b3a] px-5 py-2 text-xs font-black uppercase text-white hover:bg-[#9c1f2d] disabled:opacity-60" data-confirm-publish>{busy ? "Publicando…" : "Publicar"}</button>
          <button type="button" onClick={onClose} className="rounded border border-[#ded7c6] px-4 py-2 text-xs font-black uppercase text-[#726859]">Cancelar</button>
        </div>
      </div>
    </div>
  );
};
