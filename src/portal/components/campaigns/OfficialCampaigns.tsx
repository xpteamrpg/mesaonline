import React, { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth/AuthContext";
import { addToBoard, OFFICIAL_CAMPAIGN_DATA, type CampaignBoard, type OfficialCampaignData } from "../../lib/campaigns/board";
import { claimTable, myTables, type MyTable } from "../../lib/campaigns/client";
import { createTable, updateTable, type TableEntry } from "../../lib/tables/client";
import { addMyTable, getMyTables } from "../../lib/tables/myTables";
import { CampaignBoardSections, type BoardKind } from "./CampaignBoardSections";

/** Para incluir outra campanha oficial, basta acrescentar um item em OFFICIAL_CAMPAIGN_DATA (lib/campaigns/board.ts). */

interface Destination { id: string; name: string }

const randomCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (n) => alphabet[n % alphabet.length]).join("");
};

/** Cria uma campanha nova em "Minhas campanhas" (no servidor de mesas; sem ele, só neste navegador). */
async function createCampaignCopy(name: string, gmName: string): Promise<Destination> {
  try {
    const t = await createTable({ name, kind: "campanha", system: "Tormenta20", gmName, vttPlatform: "Mesa de Arton (deste site)", description: "Cópia de uma campanha oficial.", isPublic: false });
    let table: TableEntry = t;
    try { table = { ...(await updateTable(t.id, t.managementToken!, { liveRoomCode: t.code })), managementToken: t.managementToken }; } catch { table = { ...t, liveRoomCode: t.code }; }
    if (table.id && table.managementToken) void claimTable(table.id, table.managementToken).catch(() => undefined);
    addMyTable({ id: table.id, code: table.code, managementToken: table.managementToken!, name: table.name, kind: "campanha", liveRoomCode: table.code, data: { ...table, managementToken: undefined } });
    return { id: table.id, name: table.name };
  } catch {
    const code = randomCode();
    addMyTable({ id: `local-${code}`, code, managementToken: "local", name, kind: "campanha", liveRoomCode: code, local: true, data: { name, kind: "campanha", system: "Tormenta20", gmName, code, liveRoomCode: code } as Partial<TableEntry> });
    return { id: `local-${code}`, name };
  }
}

/** Quais campanhas suas podem receber o item clonado (as que você criou ou em que é mestre). */
function useMyCampaigns(refresh: number): Destination[] {
  const { user } = useAuth();
  const [joined, setJoined] = useState<MyTable[]>([]);
  useEffect(() => { if (user) myTables().then(setJoined).catch(() => setJoined([])); else setJoined([]); }, [user?.id, refresh]);
  const local = getMyTables().filter((l) => (l.kind ?? l.data?.kind) === "campanha").map((l) => ({ id: l.id, name: l.name }));
  const remote = joined.filter((m) => m.role === "mestre" && m.table.kind === "campanha").map((m) => ({ id: m.table.id, name: m.table.name }));
  return [...local, ...remote.filter((r) => !local.some((l) => l.id === r.id))];
}

const OfficialCampaignView: React.FC<{ campaign: OfficialCampaignData; onClose: () => void; onCloned?: () => void }> = ({ campaign, onClose, onCloned }) => {
  const { user, requireLogin } = useAuth();
  const [version, setVersion] = useState(0);
  const mine = useMyCampaigns(version);
  const [pending, setPending] = useState<{ kind: BoardKind; id: string } | "all" | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const gmName = user?.nickname || user?.email || "";

  const itemsOf = (pick: { kind: BoardKind; id: string } | "all"): Partial<CampaignBoard> => {
    if (pick === "all") return campaign.board;
    const list = campaign.board[pick.kind] as { id: string }[];
    return { [pick.kind]: list.filter((x) => x.id === pick.id) } as Partial<CampaignBoard>;
  };
  const cloneTo = async (destination: Destination | "new") => {
    if (!pending) return;
    setBusy(true);
    try {
      const dest = destination === "new" ? await createCampaignCopy(`${campaign.title} (minha cópia)`, gmName) : destination;
      addToBoard(dest.id, itemsOf(pending));
      setMsg(`Clonado para “${dest.name}”. Abra a área do mestre dessa campanha em Minhas campanhas para editar.`);
      setVersion((n) => n + 1);
      onCloned?.();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Não foi possível clonar."); }
    setPending(null); setBusy(false);
  };
  const ask = (pick: { kind: BoardKind; id: string } | "all") => { if (requireLogin("Para clonar para as suas campanhas você precisa estar logado.")) setPending(pick); };

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-[#f5f2eb]" role="dialog" aria-modal="true" aria-label={campaign.title} data-official-campaign>
      <div className="mx-auto max-w-[1200px] p-3 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button onClick={onClose} className="rounded border border-[#ded7c6] bg-white px-3 py-1.5 text-xs font-bold text-[#726859] hover:bg-[#eae4d5]">← Voltar às mesas</button>
          <button onClick={() => ask("all")} className="ml-auto rounded bg-[#1c5fb5] px-4 py-1.5 text-xs font-black uppercase text-white hover:bg-[#164c93]" data-clone-all>Clonar a campanha inteira</button>
        </div>
        <div className="mb-4 overflow-hidden rounded-lg border border-[#ded7c6] bg-white shadow-sm sm:flex">
          <img src={campaign.image} alt="" className="aspect-video w-full object-cover sm:w-80" />
          <div className="p-4"><div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#9c9180]">Campanha oficial · {campaign.tag}</div><h1 className="font-serif text-3xl font-black text-[#2b261f]">{campaign.title}</h1><p className="mt-1 text-sm leading-6 text-[#5c5446]">{campaign.text}</p><p className="mt-2 text-[11px] text-[#9c9180]">Leitura. Use “Clonar” em cada item (ou na campanha inteira) para levar para as suas campanhas e editar do seu jeito.</p></div>
        </div>
        {msg && <p role="status" className="mb-3 rounded border border-[#c2892c]/60 bg-[#fff6dc] px-2 py-1 text-[11px] font-semibold text-[#6b4a12]">{msg}</p>}
        <CampaignBoardSections board={campaign.board} readOnly onClone={(kind, id) => ask({ kind, id })} />
      </div>
      {pending && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Clonar para" onMouseDown={(e) => { if (e.target === e.currentTarget) setPending(null); }}>
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl">
            <h2 className="font-serif text-lg font-black text-[#2b261f]">Clonar para qual campanha?</h2>
            <ul className="mt-3 space-y-1.5">
              {mine.map((d) => <li key={d.id}><button disabled={busy} onClick={() => void cloneTo(d)} className="w-full rounded border border-[#ded7c6] bg-[#fbf9f4] px-3 py-2 text-left text-sm font-bold hover:bg-[#eae4d5]">{d.name}</button></li>)}
              <li><button disabled={busy} onClick={() => void cloneTo("new")} className="w-full rounded bg-[#1c5fb5] px-3 py-2 text-sm font-black uppercase text-white hover:bg-[#164c93]">+ Nova campanha com {pending === "all" ? "tudo" : "este item"}</button></li>
            </ul>
            <button onClick={() => setPending(null)} className="mt-3 text-xs font-bold text-[#726859]">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
};

export const OfficialCampaigns: React.FC<{ onCloned?: () => void }> = ({ onCloned }) => {
  const { user, requireLogin } = useAuth();
  const [open, setOpen] = useState<OfficialCampaignData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  /** Clonar direto do cartão: cria a campanha em Minhas campanhas já com tudo da oficial, para editar do seu jeito. */
  const clone = async (c: OfficialCampaignData) => {
    if (!requireLogin("Para clonar para as suas campanhas você precisa estar logado.")) return;
    setBusy(c.id); setNotice("");
    try {
      const dest = await createCampaignCopy(`${c.title} (minha cópia)`, user?.nickname || user?.email || "");
      addToBoard(dest.id, c.board);
      setNotice(`“${dest.name}” foi para Minhas campanhas. Lá você abre a área do mestre e edita do jeito que quiser.`);
      onCloned?.();
    } catch (e) { setNotice(e instanceof Error ? e.message : "Não foi possível clonar."); }
    setBusy(null);
  };
  return (
    <section className="mb-4 rounded-lg border border-[#d7ad5d]/60 bg-[#2b261f] p-3 text-white shadow-sm sm:p-4" aria-label="Campanhas Oficiais">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-lg font-black text-[#f2c572]">📜 Campanhas Oficiais</h2>
        <span className="text-[11px] text-white/60">Veja, clone e edite do seu jeito</span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {OFFICIAL_CAMPAIGN_DATA.map((c) => (
          <div key={c.id} className="flex overflow-hidden rounded border border-white/15 bg-[#3b3428]">
            <img src={c.image} alt="" className="h-auto w-28 shrink-0 object-cover sm:w-36" />
            <div className="flex min-w-0 flex-1 flex-col p-3">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f2c572]">{c.tag}</span>
              <h3 className="font-serif text-lg font-black leading-tight">{c.title}</h3>
              <p className="mt-1 flex-1 text-xs leading-5 text-white/75">{c.text}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={() => void clone(c)} disabled={busy === c.id} className="w-fit rounded bg-[#1c5fb5] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#164c93] disabled:opacity-60" data-clone-official>{busy === c.id ? "Clonando…" : "Clonar"}</button>
                <button onClick={() => setOpen(c)} className="w-fit rounded bg-[#b92b3a] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#9c1f2d]">▶ Abrir campanha</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {notice && <p role="status" className="mt-3 rounded border border-[#d7ad5d]/60 bg-[#3b3428] px-3 py-2 text-xs font-semibold text-[#f2c572]">{notice}</p>}
      {open && <OfficialCampaignView campaign={open} onClose={() => setOpen(null)} onCloned={onCloned} />}
    </section>
  );
};
