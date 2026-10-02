import React, { useEffect, useMemo, useRef, useState } from "react";
import type { CharacterSheet } from "../../types/sheet";
import { defense } from "../../lib/t20/sheetRules";
import { PageBanner } from "../layout/PageBanner";
import { AvatarZoom } from "../common/AvatarZoom";
import { useAuth } from "../../lib/auth/AuthContext";
import { myCharacterLinks, type MyCharacterLink } from "../../lib/campaigns/client";
import imgPersonagens from "../../assets/menu/personagens.jpg";

interface Props {
  characters: CharacterSheet[];
  activeId: string;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onPdf: (id: string) => void;
  onOpenWorkshop: () => void;
  onOpenJson: () => void;
  onOpenPdf: () => void;
  onOpenVtt: () => void;
  onClone: (id: string) => void;
  onDelete: (id: string) => void;
  onImportJson: (json: string) => void;
}

const btn = "inline-flex items-center gap-1 rounded border border-[#b92b3a] bg-white px-2.5 py-1 text-xs font-bold text-[#b92b3a] hover:bg-[#b92b3a] hover:text-white";

export const CharactersListView: React.FC<Props> = ({ characters, activeId, onSelect, onEdit, onPdf, onOpenWorkshop, onOpenJson, onOpenPdf, onOpenVtt, onClone, onDelete, onImportJson }) => {
  const [q, setQ] = useState("");
  const [camp, setCamp] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const [links, setLinks] = useState<MyCharacterLink[]>([]);
  useEffect(() => {
    if (!user) { setLinks([]); return; }
    myCharacterLinks().then(setLinks).catch(() => setLinks([]));
  }, [user?.id]);

  useEffect(() => {
    if (!menuId) return;
    const close = () => setMenuId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuId]);

  const campaigns = useMemo(() => [...new Set(characters.map((c) => c.campaign).filter(Boolean))], [characters]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return characters.filter((c) => (!camp || c.campaign === camp) && (!s || [c.name, c.race, c.class].some((x) => x.toLowerCase().includes(s))));
  }, [characters, q, camp]);

  return (
    <div className="mx-auto max-w-[1340px] p-3 text-[#2b261f] sm:p-5">
      <PageBanner image={imgPersonagens} position="50% 32%" title="Meus Personagens" crumb="Meus Personagens" count={characters.length} action={{ label: "Criar Personagem", icon: "👤", onClick: onOpenWorkshop }} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por nome, raça ou classe…" className="w-full rounded border border-[#ded7c6] bg-white p-1.5 text-xs font-semibold outline-none focus:border-[#b92b3a] sm:w-72" />
        {campaigns.length > 0 && (
          <select value={camp} onChange={(e) => setCamp(e.target.value)} className="rounded border border-[#ded7c6] bg-white p-1.5 text-xs font-semibold">
            <option value="">Todas as campanhas</option>
            {campaigns.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <div className="ml-auto flex flex-wrap gap-1.5">
          <input ref={file} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) f.text().then(onImportJson); e.target.value = ""; }} />
          <button onClick={() => file.current?.click()} className="rounded border border-[#ded7c6] bg-white px-2.5 py-1 text-xs font-bold text-[#726859] hover:text-[#2b261f]">⬆ Importar JSON</button>
          <button onClick={onOpenPdf} className="rounded border border-[#ded7c6] bg-white px-2.5 py-1 text-xs font-bold text-[#726859] hover:text-[#2b261f]">📄 Importar PDF</button>
          <button onClick={onOpenVtt} className="rounded border border-[#ded7c6] bg-white px-2.5 py-1 text-xs font-bold text-[#726859] hover:text-[#2b261f]">🎲 Importar do VTT</button>
          <button onClick={onOpenJson} className="rounded border border-[#ded7c6] bg-white px-2.5 py-1 text-xs font-bold text-[#726859] hover:text-[#2b261f]">{`{ }`} JSON</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {list.map((c) => {
          const def = defense(c);
          return (
            <div key={c.id} className={`overflow-hidden rounded border bg-[#efe9d6] shadow-sm ${c.id === activeId ? "border-[#b92b3a] ring-2 ring-[#b92b3a]/20" : "border-[#ddd5bb]"}`}>
              <div className="flex gap-3 p-3">
                <AvatarZoom src={c.avatar} pos={c.avatarPos} name={c.name} className="h-24 w-24 text-2xl" frameClass="border-[#ccc3a6] bg-white" />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-serif text-xl font-black">{c.name}</h3>
                  <div className="truncate text-xs text-[#7a705d]">{c.race} ◆ {c.class}{c.path ? ` (${c.path})` : ""} ◆ {c.level}º Nível</div>
                  <div className="mt-1.5 flex items-center gap-4 text-sm font-semibold">
                    <span title="Pontos de vida"><span className="text-[#e03131]">♥</span> {c.hp.current}/{c.hp.max}</span>
                    <span title="Defesa"><span className="text-[#1c7ed6]">⛨</span> {def.total}</span>
                  </div>
                  <div className="mt-1.5 flex min-h-[22px] flex-wrap items-center gap-1 text-xs text-[#7a705d]">Mesas Online: {links.filter((l) => l.characterId === c.id).map((l) => <span key={l.id} title={l.status === "solicitado" ? "Aguardando o mestre aceitar" : l.status === "recusado" ? "O mestre recusou" : l.kind === "campanha" ? "Campanha" : "One-shot"} className={`rounded-full border bg-white px-2 py-0.5 text-[11px] ${l.kind === "campanha" ? "border-[#1c5fb5]/60 text-[#1c5fb5]" : "border-[#b92b3a]/60 text-[#b92b3a]"} ${l.status !== "aceito" ? "opacity-60" : ""}`}>{l.tableName}{l.status === "solicitado" ? " (aguardando)" : l.status === "recusado" ? " (recusado)" : ""}</span>)}</div>
                </div>
              </div>
              <div className="relative flex items-center justify-end gap-1.5 border-t border-[#ddd5bb] bg-[#e6dfc8] px-3 py-2">
                <button onClick={(e) => { e.stopPropagation(); setMenuId(menuId === c.id ? null : c.id); }} title="Mais ações" className="rounded border border-[#ccc3a6] bg-white px-2 py-1 text-xs font-black text-[#726859]">⋮</button>
                {menuId === c.id && (
                  <div className="absolute bottom-full right-3 z-10 mb-1 w-36 rounded border border-[#ded7c6] bg-white p-1 text-xs shadow-xl">
                    <button onClick={() => onClone(c.id)} className="block w-full rounded px-2 py-1.5 text-left font-semibold hover:bg-[#fbebee]">📋 Clonar</button>
                    <button onClick={() => confirm(`Excluir ${c.name}?`) && onDelete(c.id)} className="block w-full rounded px-2 py-1.5 text-left font-semibold text-[#b92b3a] hover:bg-[#fbebee]">🗑️ Excluir</button>
                  </div>
                )}
                <button onClick={() => onPdf(c.id)} className={btn}>⬇ PDF</button>
                <button onClick={() => onEdit(c.id)} className={btn}>✏ Editar</button>
                <button onClick={() => onSelect(c.id)} className="inline-flex items-center gap-1 rounded bg-[#b92b3a] px-3 py-1 text-xs font-bold text-white hover:bg-[#9c1f2d]">📄 Ver</button>
              </div>
            </div>
          );
        })}
      </div>
      {list.length === 0 && <div className="rounded-lg border border-dashed border-[#ded7c6] bg-white p-12 text-center text-xs text-[#726859]">Nenhum personagem. Use “Criar Personagem” (Oficina de Heróis) ou importe um PDF/JSON.</div>}
    </div>
  );
};
