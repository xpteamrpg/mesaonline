import React, { useEffect, useState } from "react";
import type { TableEntry } from "../../lib/tables/client";
import type { CharacterSheet } from "../../types/sheet";
import { emptyBoard, loadBoard, saveBoard, type CampaignBoard } from "../../lib/campaigns/board";
import { CampaignBoardSections } from "./CampaignBoardSections";
import { PartyStrip } from "./MesaAccountSections";

/**
 * Área do mestre da campanha: o quadro de apoio (NPCs aliados, missões, estabelecimentos) e quem está na mesa.
 * Tudo é privado do mestre e fica neste navegador; "Exportar" e "Importar" levam o quadro para outro lugar.
 */
export const CampaignHubView: React.FC<{ table: TableEntry; characters?: CharacterSheet[]; onClose: () => void; onPage: () => void; onEnter: () => void; onOpenCharacter?: (id: string) => void }> = ({ table, characters = [], onClose, onPage, onEnter, onOpenCharacter = () => undefined }) => {
  const [board, setBoard] = useState<CampaignBoard>(() => loadBoard(table.id));
  const [msg, setMsg] = useState("");
  useEffect(() => { setBoard(loadBoard(table.id)); }, [table.id]);
  const change = (next: CampaignBoard) => { setBoard(next); saveBoard(table.id, next); };

  const exportBoard = () => {
    const blob = new Blob([JSON.stringify({ campanha: table.name, ...board }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `${table.name.replace(/[^\w-]+/g, "_")}-quadro.json`; a.click();
    URL.revokeObjectURL(a.href);
  };
  const importBoard = async (file?: File) => {
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      const next = { ...emptyBoard(), allies: raw.allies ?? [], missions: raw.missions ?? [], places: raw.places ?? [] } as CampaignBoard;
      change(next); setMsg("Quadro importado.");
    } catch { setMsg("Arquivo inválido: use um quadro exportado por aqui."); }
  };

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-[#f5f2eb]" role="dialog" aria-modal="true" aria-label={`Área do mestre · ${table.name}`} data-campaign-hub>
      <div className="mx-auto max-w-[1200px] p-3 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button onClick={onClose} className="rounded border border-[#ded7c6] bg-white px-3 py-1.5 text-xs font-bold text-[#726859] hover:bg-[#eae4d5]">← Voltar às mesas</button>
          <button onClick={onPage} className="rounded border border-[#ded7c6] bg-white px-3 py-1.5 text-xs font-bold text-[#2b261f] hover:bg-[#eae4d5]">Página da mesa</button>
          <button onClick={onEnter} className="ml-auto rounded bg-[#b92b3a] px-4 py-1.5 text-xs font-black uppercase text-white hover:bg-[#9c1f2d]">Entrar na mesa online</button>
        </div>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b-4 border-[#b92b3a] pb-2">
          <div><div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#9c9180]">Área do mestre</div><h1 className="font-serif text-3xl font-black text-[#2b261f]">{table.name}</h1></div>
          <div className="flex gap-2">
            <button onClick={exportBoard} className="rounded border border-[#ded7c6] bg-white px-3 py-1.5 text-[11px] font-black uppercase text-[#726859] hover:bg-[#eae4d5]">Exportar quadro</button>
            <label className="cursor-pointer rounded border border-[#ded7c6] bg-white px-3 py-1.5 text-[11px] font-black uppercase text-[#726859] hover:bg-[#eae4d5]">Importar quadro<input type="file" accept=".json,application/json" className="hidden" onChange={(e) => { void importBoard(e.target.files?.[0]); e.target.value = ""; }} /></label>
          </div>
        </div>
        {msg && <p role="status" className="mb-3 rounded border border-[#c2892c]/60 bg-[#fff6dc] px-2 py-1 text-[11px] font-semibold text-[#6b4a12]">{msg}</p>}
        <p className="mb-3 text-[11px] text-[#9c9180]">Este quadro é só seu e fica guardado neste navegador (use Exportar para guardar uma cópia).</p>
        <div className="mb-4"><PartyStrip tableId={table.id} characters={characters} onOpenOwn={onOpenCharacter} /></div>
        <CampaignBoardSections board={board} onChange={change} />
      </div>
    </div>
  );
};
