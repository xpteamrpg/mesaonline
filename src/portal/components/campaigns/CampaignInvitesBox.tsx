import React, { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth/AuthContext";
import { getTableByCode } from "../../lib/tables/client";
import { clearCampaignDraft, getCampaignDraft, myInvites, myTables, setCampaignDraft, type CampaignDraft, type MyTable, type TableInvite } from "../../lib/campaigns/client";

const extract = (raw: string) => (raw.toUpperCase().match(/[A-Z0-9]{8}/)?.[0] ?? raw.trim().toUpperCase());

/**
 * Aba "Convites para mesa online" da criação/edição do personagem.
 * A pessoa cola o código que o mestre mandou, ou marca um convite/campanha da conta. Nada é gravado agora:
 * quando a ficha é salva, o personagem passa a aparecer em "Mesas Online" com a campanha (ver applyCampaignDraft).
 */
export const CampaignInvitesBox: React.FC = () => {
  const { user, openAuthModal } = useAuth();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CampaignDraft>(getCampaignDraft);
  const [names, setNames] = useState<Record<string, string>>({});
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [invites, setInvites] = useState<TableInvite[]>([]);
  const [tables, setTables] = useState<MyTable[]>([]);

  // O rascunho vale só enquanto a tela de ficha está aberta; ao salvar, quem salvou já o aplicou.
  useEffect(() => () => clearCampaignDraft(), []);
  useEffect(() => {
    if (!open || !user) return;
    myInvites().then(setInvites).catch(() => setInvites([]));
    myTables().then(setTables).catch(() => setTables([]));
  }, [open, user?.id]);

  const update = (next: CampaignDraft) => { setDraft(next); setCampaignDraft(next); };
  // O que está digitado no campo já vale ao salvar, mesmo sem apertar "Adicionar".
  useEffect(() => {
    const typed = extract(code);
    const current = getCampaignDraft();
    if ((current.pendingCode || "") !== (typed && typed.length >= 6 ? typed : "")) { const next = { ...current, pendingCode: typed && typed.length >= 6 ? typed : undefined }; setDraft(next); setCampaignDraft(next); }
  }, [code]);
  const toggleTable = (id: string) => update({ ...draft, tables: draft.tables.includes(id) ? draft.tables.filter((x) => x !== id) : [...draft.tables, id] });
  const toggleInvite = (inv: TableInvite) => {
    const has = draft.invites.some((i) => i.inviteId === inv.inviteId);
    update({ ...draft, invites: has ? draft.invites.filter((i) => i.inviteId !== inv.inviteId) : [...draft.invites, { inviteId: inv.inviteId, tableId: inv.table.id }] });
  };
  const addCode = async () => {
    const c = extract(code);
    if (!c) return;
    if (!user) { openAuthModal("Para usar o código de uma mesa online você precisa estar logado."); return; }
    setMsg("");
    try {
      const t = await getTableByCode(c);
      setNames((n) => ({ ...n, [c]: t.name }));
      if (!draft.codes.includes(c)) update({ ...draft, codes: [...draft.codes, c] });
      setCode("");
    } catch { setMsg("Não achei nenhuma mesa online com esse código."); }
  };

  const count = draft.codes.length + draft.invites.length + draft.tables.length;
  const row = "flex items-center gap-2 rounded border border-[#ded7c6] bg-white px-2 py-1.5 text-xs";
  return (
    <div className="rounded border border-[#ded7c6] bg-[#fbf9f4]">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-black uppercase tracking-wide text-[#1c5fb5]" aria-expanded={open}>
        <span>Convites para mesa online{count > 0 ? ` (${count} para salvar)` : ""}</span><span className="text-[10px]">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-[#ded7c6] p-3">
          {!user && <p className="text-xs text-[#726859]">Entre na sua conta para usar convites e códigos de mesa online. <button type="button" onClick={() => openAuthModal("Para usar convites de mesa online você precisa estar logado.")} className="font-bold text-[#b92b3a] underline">Entrar</button></p>}
          <div>
            <label className="text-[11px] font-bold text-[#726859]">Código que o mestre te enviou</label>
            <div className="mt-1 flex gap-2">
              <input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addCode(); } }} placeholder="Ex.: K8NZL9AB" className="w-full rounded border border-[#ded7c6] bg-white p-2 font-mono text-xs uppercase" />
              <button type="button" onClick={() => void addCode()} className="shrink-0 rounded bg-[#1c5fb5] px-3 text-xs font-bold text-white">Adicionar</button>
            </div>
            {msg && <p className="mt-1 text-[11px] font-bold text-[#b92b3a]">{msg}</p>}
            {draft.codes.map((c) => <div key={c} className={`${row} mt-1`}><b className="font-mono">{c}</b><span className="truncate text-[#726859]">{names[c] ?? ""}</span><button type="button" onClick={() => update({ ...draft, codes: draft.codes.filter((x) => x !== c) })} className="ml-auto text-[#b92b3a]" aria-label="Remover">✕</button></div>)}
          </div>
          {user && invites.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-[#726859]">Convites recebidos</div>
              <div className="mt-1 space-y-1">{invites.map((inv) => (
                <label key={inv.inviteId} className={row}><input type="checkbox" checked={draft.invites.some((i) => i.inviteId === inv.inviteId)} onChange={() => toggleInvite(inv)} /><span className="truncate"><b>{inv.table.name}</b> <span className="text-[#9c9180]">convite de {inv.invitedBy}</span></span></label>
              ))}</div>
            </div>
          )}
          {user && tables.length > 0 && (
            <div>
              <div className="text-[11px] font-bold text-[#726859]">Minhas mesas online</div>
              <div className="mt-1 space-y-1">{tables.map((m) => (
                <label key={m.table.id} className={row}><input type="checkbox" checked={draft.tables.includes(m.table.id)} onChange={() => toggleTable(m.table.id)} /><span className="truncate"><b>{m.table.name}</b> <span className="text-[#9c9180]">{m.role === "mestre" ? "você é o mestre" : "jogador"}</span></span></label>
              ))}</div>
            </div>
          )}
          <p className="text-[11px] leading-4 text-[#9c9180]">Ao salvar o personagem, a mesa aparece em “Mesas Online”. Com o código do mestre, o personagem já entra; pelos outros caminhos o mestre precisa aceitar.</p>
        </div>
      )}
    </div>
  );
};
