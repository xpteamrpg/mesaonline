import React, { useEffect, useMemo, useState } from "react";
import type { CharacterSheet } from "../../types/sheet";
import type { VttCampaign } from "../../lib/vtt/importVtt";
import { T20_THREATS, type T20Threat } from "../../lib/t20/compendium";
import { defense } from "../../lib/t20/sheetRules";
import { PageHead, Pill, ThreatCard } from "./CompendiumView";
import { CampaignShareModal } from "../campaigns/CampaignShareModal";
import { SharedWithMePanel } from "../campaigns/SharedWithMePanel";
import { OfficialCampaigns } from "../campaigns/OfficialCampaigns";
import { AvatarZoom } from "../common/AvatarZoom";
import { ImagePicker } from "../common/ImagePicker";
import { PageBanner } from "../layout/PageBanner";
import imgCampanhas from "../../assets/menu/campanhas.jpg";
import imgMonstros from "../../assets/menu/monstros.jpg";
import { SITE_ROOT } from "../../../utils/assetUrl";

/** "Ferramentas desta mesa" ficam desligadas por enquanto (decisão do usuário); o código é mantido para reativar depois. */
const SHOW_TABLE_TOOLS = false;

const TABLE_TOOLS = [
  ["combate", "Gerenciador de combate"],
  ["dados", "Dados"],
  ["EncontrosAleatorios", "Encontros aleatórios"],
  ["espolio", "Espólio"],
  ["perigos", "Perigos complexos"],
  ["macrosroll20", "Macros Roll20"],
] as const;

export interface EncounterEntry {
  threatId: string;
  qty: number;
  hpCurrent?: number;
}
export interface CampaignRecord extends VttCampaign {
  notes?: string;
  encounters?: EncounterEntry[];
}

interface Props {
  characters: CharacterSheet[];
  campaigns: CampaignRecord[];
  onChangeCampaigns: (c: CampaignRecord[]) => void;
  onSelect: (id: string) => void;
  onOpenWorkshop: () => void;
  onOpenVtt: () => void;
  onRoll: (label: string, formula: string) => void;
}

export const CampaignsView: React.FC<Props> = ({ characters, campaigns, onChangeCampaigns, onSelect, onOpenWorkshop, onOpenVtt, onRoll }) => {
  const names = useMemo(() => [...new Set([...campaigns.map((c) => c.name), ...characters.map((c) => c.campaign || "Campanha livre")])], [campaigns, characters]);
  const [selected, setSelected] = useState(names[0] ?? "");
  const [tab, setTab] = useState<"mesa" | "bestiario" | "diario">("mesa");
  const [q, setQ] = useState("");
  const [nd, setNd] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [detail, setDetail] = useState(false);
  const [menuName, setMenuName] = useState<string | null>(null);

  useEffect(() => {
    if (!menuName) return;
    const close = () => setMenuName(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuName]);

  useEffect(() => {
    if (!names.length) {
      setSelected("");
      return;
    }
    if (!names.includes(selected)) setSelected(names[0]);
  }, [names, selected]);

  const record = campaigns.find((c) => c.name === selected);
  const roster = characters.filter((c) => (c.campaign || "Campanha livre") === selected);
  const blankRecord = (name: string): CampaignRecord => ({ id: `camp-${Date.now().toString(36)}`, name, source: "json", scenes: [], journals: [], actors: [], npcs: [], importedAt: new Date().toISOString(), encounters: [] });
  const ensure = (): CampaignRecord => record ?? blankRecord(selected);
  const save = (r: CampaignRecord) => onChangeCampaigns([...campaigns.filter((c) => c.name !== r.name), r]);
  const createCampaign = () => {
    const n = prompt("Nome da nova campanha:")?.trim();
    if (!n) return;
    if (names.includes(n)) { alert("Já existe uma campanha com esse nome."); return; }
    save(blankRecord(n));
    setSelected(n);
  };
  const renameRecord = (rec: CampaignRecord) => {
    const name = prompt("Novo nome da campanha:", rec.name)?.trim();
    if (!name || name === rec.name || names.includes(name)) return;
    onChangeCampaigns(campaigns.map((c) => (c.id === rec.id ? { ...c, name } : c)));
    if (selected === rec.name) setSelected(name);
  };
  const renameCampaign = () => {
    if (!record) return;
    const name = prompt("Novo nome da campanha:", record.name)?.trim();
    if (!name || name === record.name || campaigns.some((c) => c.name === name)) return;
    onChangeCampaigns(campaigns.map((c) => (c.id === record.id ? { ...c, name } : c)));
    setSelected(name);
  };
  const deleteCampaign = () => {
    if (!record || !confirm(`Remover a campanha "${record.name}"? Os personagens e arquivos importados não serão apagados.`)) return;
    onChangeCampaigns(campaigns.filter((c) => c.id !== record.id));
    setSelected(names.find((name) => name !== selected) ?? "");
  };

  const threats = useMemo(() => {
    const s = q.trim().toLowerCase();
    return T20_THREATS.filter((t) => (!nd || t.nd === nd) && (!s || t.nome.toLowerCase().includes(s) || t.tipo.toLowerCase().includes(s))).slice(0, 60);
  }, [q, nd]);

  const encounters = (record?.encounters ?? []).map((e) => ({ ...e, t: T20_THREATS.find((t) => t.id === e.threatId) })).filter((e): e is EncounterEntry & { t: T20Threat } => !!e.t);
  const partyLevel = roster.length ? Math.round(roster.reduce((a, c) => a + c.level, 0) / roster.length) : 1;

  if (!detail) {
    return (
      <div className="mx-auto max-w-[1340px] p-3 text-[#2b261f] sm:p-5">
        <PageBanner image={imgCampanhas} position="50% 45%" title="Minhas Campanhas" crumb="Minhas Campanhas" count={names.length} action={{ label: "Criar Campanha", icon: "🏰", onClick: createCampaign }} />
        <div className="mb-4 flex flex-wrap justify-end gap-2">
          <button onClick={onOpenVtt} className="rounded border border-[#ded7c6] bg-white px-2.5 py-1 text-xs font-bold text-[#726859] hover:text-[#2b261f]">🎲 Importar campanha do VTT</button>
        </div>
        <OfficialCampaigns />
        <SharedWithMePanel localCampaigns={campaigns} onImport={(r) => { onChangeCampaigns([...campaigns, r]); setSelected(r.name); }} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {names.map((name) => {
            const rec = campaigns.find((c) => c.name === name);
            const ros = characters.filter((c) => (c.campaign || "Campanha livre") === name);
            const isMaster = !!rec && !rec.id.startsWith("camp-shared-");
            const shown = ros.slice(0, ros.length > 4 ? 3 : 4);
            return (
              <div key={name} className="overflow-hidden rounded border border-[#ddd5bb] bg-[#efe9d6] shadow-sm">
                <div className="flex gap-3 p-3">
                  <div className="grid h-24 w-24 shrink-0 grid-cols-2 gap-0.5 overflow-hidden rounded border border-[#ccc3a6] bg-white">
                    {shown.length === 0 && <div className="col-span-2 flex items-center justify-center bg-[#f5f2eb] text-3xl">🏰</div>}
                    {shown.map((c) => <div key={c.id} className="flex items-center justify-center overflow-hidden bg-[#fbebee] text-xs font-black text-[#b92b3a]">{c.avatar ? <img src={c.avatar} alt="" style={{ objectPosition: c.avatarPos ?? "50% 20%" }} className="h-full w-full object-cover" /> : c.name.slice(0, 2).toUpperCase()}</div>)}
                    {ros.length > 4 && <div className="flex items-center justify-center bg-[#f5f2eb] text-xs font-bold text-[#726859]">+{ros.length - 3}</div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-serif text-xl font-black">{name}</h3>
                    <div className="text-xs text-[#7a705d]">{rec ? `Criada em ${new Date(rec.importedAt).toLocaleDateString("pt-BR")}` : "Formada pelos seus personagens"}</div>
                    <div className="mt-2 flex items-center gap-4 text-sm font-semibold">
                      <span title="Personagens na campanha">👥 {ros.length}</span>
                      <span title="Seu papel" className={isMaster ? "text-[#c2892c]" : "text-[#2b8a3e]"}>{isMaster ? "👑 Mestre" : "★ Jogador"}</span>
                    </div>
                  </div>
                </div>
                <div className="relative flex items-center justify-end gap-1.5 border-t border-[#ddd5bb] bg-[#e6dfc8] px-3 py-2">
                  {rec && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); setMenuName(menuName === name ? null : name); }} title="Mais ações" className="rounded border border-[#ccc3a6] bg-white px-2 py-1 text-xs font-black text-[#726859]">⋮</button>
                      {menuName === name && (
                        <div className="absolute bottom-full right-3 z-10 mb-1 w-40 rounded border border-[#ded7c6] bg-white p-1 text-xs shadow-xl">
                          <button onClick={() => { setSelected(name); setShareOpen(true); }} className="block w-full rounded px-2 py-1.5 text-left font-semibold hover:bg-[#fbebee]">🔗 Compartilhar</button>
                          <button onClick={() => confirm(`Remover a campanha "${name}"? Os personagens e arquivos importados não serão apagados.`) && onChangeCampaigns(campaigns.filter((c) => c.id !== rec.id))} className="block w-full rounded px-2 py-1.5 text-left font-semibold text-[#b92b3a] hover:bg-[#fbebee]">🗑️ Remover</button>
                        </div>
                      )}
                    </>
                  )}
                  {isMaster && rec && <button onClick={() => renameRecord(rec)} className="inline-flex items-center gap-1 rounded border border-[#b92b3a] bg-white px-2.5 py-1 text-xs font-bold text-[#b92b3a] hover:bg-[#b92b3a] hover:text-white">✏ Editar</button>}
                  <button onClick={() => { setSelected(name); setTab("mesa"); setDetail(true); }} className="inline-flex items-center gap-1 rounded bg-[#b92b3a] px-3 py-1 text-xs font-bold text-white hover:bg-[#9c1f2d]">📄 Ver</button>
                </div>
              </div>
            );
          })}
        </div>
        {names.length === 0 && <div className="rounded-lg border border-dashed border-[#ded7c6] bg-white p-12 text-center text-xs text-[#726859]">Nenhuma campanha ainda. Use “Criar Campanha” ou importe uma do VTT.</div>}
        <CampaignShareModal isOpen={shareOpen} onClose={() => setShareOpen(false)} campaign={record ?? null} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] p-3 text-[#2b261f] sm:p-5">
      <button onClick={() => setDetail(false)} className="mb-3 text-xs font-bold text-[#b92b3a] hover:underline">← Todas as campanhas</button>
      <PageHead icon="🏰" title="Minhas Campanhas" subtitle="Mesas com seus personagens, NPCs e cenas importados do VTT, diário e bestiário de encontros." right={
        <div className="flex flex-wrap gap-2">
          <button onClick={() => window.open(`${SITE_ROOT}mesa/?campanha=${encodeURIComponent(selected || "Nova mesa")}`, "_blank", "noopener,noreferrer")} className="rounded border border-[#2b8a3e] bg-[#ebfbee] px-3 py-1.5 text-xs font-bold text-[#2b8a3e] hover:bg-[#2b8a3e] hover:text-white">🎲 Abrir mesa online</button>
          <button onClick={onOpenVtt} className="rounded border border-[#7a3fe0] bg-[#f3eeff] px-3 py-1.5 text-xs font-bold text-[#7a3fe0] hover:bg-[#7a3fe0] hover:text-white">🎲 Importar campanha do VTT</button>
          {record && <button onClick={() => setShareOpen(true)} className="rounded border border-[#1c7ed6] bg-[#e7f5ff] px-3 py-1.5 text-xs font-bold text-[#1c7ed6] hover:bg-[#1c7ed6] hover:text-white">🔗 Compartilhar</button>}
          {record && <button onClick={renameCampaign} className="rounded border border-[#ded7c6] bg-white px-3 py-1.5 text-xs font-bold text-[#726859]">Renomear</button>}
          {record && <button onClick={deleteCampaign} className="rounded border border-[#b92b3a] bg-white px-3 py-1.5 text-xs font-bold text-[#b92b3a]">Remover</button>}
          <button onClick={createCampaign} className="rounded border border-[#ded7c6] bg-white px-3 py-1.5 text-xs font-bold text-[#726859]">+ Nova campanha</button>
          <button onClick={onOpenWorkshop} className="rounded bg-[#b92b3a] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow hover:bg-[#9c1f2d]">⚒️ Oficina de Heróis</button>
        </div>
      }>
        {names.map((c) => <button key={c} onClick={() => setSelected(c)} className={`rounded-full px-3.5 py-1 text-xs font-bold ${selected === c ? "bg-[#b92b3a] text-white shadow" : "border border-[#ded7c6] bg-[#fbf9f4] text-[#726859] hover:bg-[#eae4d5]"}`}>🏰 {c} ({characters.filter((x) => (x.campaign || "Campanha livre") === c).length})</button>)}
      </PageHead>

      <SharedWithMePanel localCampaigns={campaigns} onImport={(r) => { onChangeCampaigns([...campaigns, r]); setSelected(r.name); }} />

      <div className="mb-3 flex flex-wrap gap-1.5">
        <Pill active={tab === "mesa"} onClick={() => setTab("mesa")}>👥 Mesa & NPCs</Pill>
        <Pill active={tab === "bestiario"} onClick={() => setTab("bestiario")}>🐉 Encontros / Bestiário ({encounters.length})</Pill>
        <Pill active={tab === "diario"} onClick={() => setTab("diario")}>📜 Diário & Cenas</Pill>
      </div>

      {SHOW_TABLE_TOOLS && (
        <div className="mb-4 rounded-lg border border-[#ded7c6] bg-white p-3 shadow-sm">
          <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-[#726859]">Ferramentas desta mesa</div>
          <div className="flex flex-wrap gap-1.5">
            {TABLE_TOOLS.map(([path, label]) => <button key={path} onClick={() => window.open(`./${path}/index.html`, "_blank", "noopener,noreferrer")} className="rounded border border-[#ded7c6] bg-[#fbf9f4] px-2.5 py-1.5 text-[11px] font-bold text-[#2b261f] hover:border-[#b92b3a] hover:text-[#b92b3a]">{label}</button>)}
          </div>
        </div>
      )}

      {tab === "mesa" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="rounded-lg border border-[#ded7c6] bg-white p-4 shadow-sm lg:col-span-8">
            <h2 className="mb-3 border-b border-[#ded7c6] pb-2 font-serif text-lg font-black text-[#b92b3a]">Mesa: {selected || "—"} <span className="text-xs font-normal text-[#726859]">· nível médio {partyLevel}{record?.source && record.source !== "json" ? ` · importada do ${record.source}` : ""}</span></h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {roster.map((c) => {
                const d = defense(c);
                return (
                  <button key={c.id} onClick={() => onSelect(c.id)} className="rounded-lg border border-[#ded7c6] bg-[#fbf9f4] p-3 text-left shadow-sm transition-all hover:border-[#b92b3a] hover:bg-white">
                    <div className="flex items-center gap-3">
                      <AvatarZoom src={c.avatar} pos={c.avatarPos} name={c.name} className="h-16 w-16" />
                      <div><div className="font-serif text-sm font-black">{c.name}</div><div className="text-[11px] font-semibold text-[#b92b3a]">{c.race} · {c.class} · {c.level}º</div></div>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-1 border-t border-[#eee] pt-2 text-center text-xs">
                      <div className="rounded border border-[#eee] bg-white p-1"><span className="block text-[9px] font-bold text-[#b92b3a]">PV</span><span className="font-bold">{c.hp.current}/{c.hp.max}</span></div>
                      <div className="rounded border border-[#eee] bg-white p-1"><span className="block text-[9px] font-bold text-[#1c7ed6]">PM</span><span className="font-bold">{c.mp.current}/{c.mp.max}</span></div>
                      <div className="rounded border border-[#eee] bg-white p-1"><span className="block text-[9px] font-bold text-[#726859]">Defesa</span><span className="font-bold">{d.total}</span></div>
                      <div className="rounded border border-[#eee] bg-white p-1"><span className="block text-[9px] font-bold text-[#c2892c]">T$</span><span className="font-bold">{c.money}</span></div>
                    </div>
                  </button>
                );
              })}
            </div>
            {roster.length === 0 && <div className="p-8 text-center text-xs text-[#9c9180]">Nenhum personagem nesta campanha. Edite o campo “Campanha” da ficha ou importe do VTT.</div>}
            {record && record.npcs.length > 0 && (
              <div className="mt-4 border-t border-[#ded7c6] pt-3">
                <div className="mb-1 text-[10px] font-bold uppercase text-[#726859]">NPCs importados do VTT ({record.npcs.length})</div>
                <div className="flex flex-wrap gap-1.5">{record.npcs.map((n, i) => <span key={i} className="rounded border border-[#ded7c6] bg-[#fbf9f4] px-2 py-1 text-[11px]"><strong>{n.name}</strong>{n.nd ? ` · ND ${n.nd}` : ""}{n.hp ? ` · ${n.hp} PV` : ""}</span>)}</div>
              </div>
            )}
          </div>
          <div className="space-y-3 rounded-lg border border-[#ded7c6] bg-white p-4 shadow-sm lg:col-span-4">
            <h3 className="border-b border-[#ded7c6] pb-1.5 font-serif text-xs font-bold uppercase tracking-wider text-[#726859]">Anotações do mestre</h3>
            <textarea value={record?.notes ?? ""} onChange={(e) => save({ ...ensure(), notes: e.target.value })} rows={8} placeholder="Ganchos, pistas, recompensas…" className="w-full rounded border border-[#ded7c6] bg-[#fbf9f4] p-2 text-xs outline-none focus:border-[#b92b3a]" />
            <ul className="space-y-1.5 border-t border-[#ded7c6] pt-2 text-xs text-[#5c5446]">
              <li><strong>Teste:</strong> 1d20 + ½ nível + atributo + treino.</li>
              <li><strong>Descanso:</strong> recupera PV e PM = nível (×2 confortável, ×3 luxuoso).</li>
              <li><strong>Encontro:</strong> ND igual ao nível do grupo = desafio médio; ND +2 = difícil.</li>
              <li><strong>Sobrecarga:</strong> acima de 10 + 2×FOR slots → −3m e −5 em Des/For.</li>
            </ul>
          </div>
        </div>
      )}

      {tab === "bestiario" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-7">
            <div className="rounded-lg border border-[#ded7c6] bg-white p-3 shadow-sm">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar criatura para o encontro…" className="flex-1 rounded border border-[#ded7c6] bg-[#fbf9f4] p-1.5 text-xs" />
                <select value={nd} onChange={(e) => setNd(e.target.value)} className="rounded border border-[#ded7c6] bg-white px-2 py-1 text-xs font-bold"><option value="">ND: todos</option>{[...new Set(T20_THREATS.map((t) => t.nd))].map((n) => <option key={n} value={n}>ND {n}</option>)}</select>
                <button onClick={() => setNd(String(partyLevel))} className="rounded border border-[#b92b3a] bg-[#fbebee] px-2 py-1 text-[11px] font-bold text-[#b92b3a]">ND do grupo ({partyLevel})</button>
              </div>
              <div className="max-h-[60vh] space-y-1.5 overflow-y-auto pr-1">
                {threats.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2 rounded border border-[#ded7c6] bg-[#fbf9f4] p-2 text-xs">
                    <div><strong className="text-[#b92b3a]">{t.nome}</strong> <span className="text-[#726859]">· {t.tipo} · ND {t.nd} · Def {t.defesa ?? "—"} · {t.pv ?? "—"} PV</span></div>
                    <button onClick={() => { const r = ensure(); const ex = r.encounters?.find((e) => e.threatId === t.id); save({ ...r, encounters: ex ? r.encounters!.map((e) => (e.threatId === t.id ? { ...e, qty: e.qty + 1 } : e)) : [...(r.encounters ?? []), { threatId: t.id, qty: 1, hpCurrent: t.pv ?? undefined }] }); }} className="shrink-0 rounded bg-[#2b8a3e] px-2 py-1 text-[10px] font-bold text-white">+ Encontro</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-3 lg:col-span-5">
            <div className="rounded-lg border border-[#ded7c6] bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between"><h3 className="font-serif text-sm font-black text-[#b92b3a]">Encontro atual</h3>{encounters.length > 0 && <button onClick={() => save({ ...ensure(), encounters: [] })} className="text-[10px] font-bold text-[#726859] hover:text-[#b92b3a]">Limpar</button>}</div>
              {encounters.length === 0 ? <div className="p-6 text-center text-xs text-[#9c9180]">Adicione criaturas do bestiário para montar o encontro.</div> : (
                <div className="space-y-2">
                  {encounters.map((e) => (
                    <div key={e.threatId} className="rounded border border-[#ded7c6] bg-[#fbf9f4] p-2 text-xs">
                      <div className="flex items-center justify-between">
                        <div><strong>{e.t.nome}</strong> <span className="text-[#726859]">×{e.qty} · ND {e.t.nd}</span></div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => save({ ...ensure(), encounters: (record?.encounters ?? []).map((x) => (x.threatId === e.threatId ? { ...x, qty: Math.max(1, x.qty - 1) } : x)) })} className="h-5 w-5 rounded border border-[#ded7c6] text-[10px]">−</button>
                          <button onClick={() => save({ ...ensure(), encounters: (record?.encounters ?? []).map((x) => (x.threatId === e.threatId ? { ...x, qty: x.qty + 1 } : x)) })} className="h-5 w-5 rounded border border-[#ded7c6] text-[10px]">+</button>
                          <button onClick={() => save({ ...ensure(), encounters: (record?.encounters ?? []).filter((x) => x.threatId !== e.threatId) })} className="px-1 text-[#9c9180] hover:text-[#b92b3a]">✕</button>
                        </div>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span className="text-[10px] text-[#726859]">PV</span>
                        <input type="number" value={e.hpCurrent ?? e.t.pv ?? 0} onChange={(ev) => save({ ...ensure(), encounters: (record?.encounters ?? []).map((x) => (x.threatId === e.threatId ? { ...x, hpCurrent: Number(ev.target.value) } : x)) })} className="w-16 rounded border border-[#ded7c6] bg-white px-1 text-center text-[11px] font-bold" />
                        <span className="text-[10px] text-[#726859]">/ {e.t.pv ?? "—"} · Def {e.t.defesa}</span>
                        <button onClick={() => onRoll(`${e.t.nome} — Iniciativa`, `1d20${e.t.iniciativa}`)} className="ml-auto rounded bg-[#b92b3a] px-1.5 py-0.5 text-[10px] font-bold text-white">Iniciativa {e.t.iniciativa}</button>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">{e.t.ataques.slice(0, 3).map((a, i) => <button key={i} onClick={() => onRoll(`${e.t.nome}: ${a.nome}`, `1d20${a.bonus}`)} title={`${a.dano}${a.desc ? " — " + a.desc : ""}`} className="rounded border border-[#b92b3a] bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#b92b3a]">🎲 {a.nome} {a.bonus} ({a.dano})</button>)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {encounters[0] && <ThreatCard t={encounters[0].t} onRoll={onRoll} />}
          </div>
        </div>
      )}

      {tab === "diario" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-[#ded7c6] bg-white p-4 shadow-sm">
            <h3 className="mb-2 font-serif text-sm font-black text-[#b92b3a]">Cenas ({record?.scenes.length ?? 0})</h3>
            {record?.scenes.length ? <ul className="space-y-1 text-xs">{record.scenes.map((s, i) => <li key={i} className="rounded border border-[#ded7c6] bg-[#fbf9f4] px-2 py-1">🗺️ {s}</li>)}</ul> : <p className="text-xs text-[#9c9180]">Importe um mundo do Foundry para listar as cenas.</p>}
          </div>
          <div className="rounded-lg border border-[#ded7c6] bg-white p-4 shadow-sm">
            <h3 className="mb-2 font-serif text-sm font-black text-[#b92b3a]">Diários ({record?.journals.length ?? 0})</h3>
            {record?.journals.length ? <div className="max-h-[60vh] space-y-2 overflow-y-auto text-xs">{record.journals.map((j, i) => <details key={i} className="rounded border border-[#ded7c6] bg-[#fbf9f4] p-2"><summary className="cursor-pointer font-bold">{j.name}</summary><p className="mt-1 text-[#5c5446]">{j.text || "(vazio)"}</p></details>)}</div> : <p className="text-xs text-[#9c9180]">Nenhum diário importado.</p>}
          </div>
        </div>
      )}
      <CampaignShareModal isOpen={shareOpen} onClose={() => setShareOpen(false)} campaign={record ?? null} />
    </div>
  );
};

/* ---------------------------------- PARCEIROS -------------------------------- */

const PARTNER_LEVELS = ["Iniciante", "Veterano", "Mestre"] as const;
type PartnerLevel = (typeof PARTNER_LEVELS)[number];

export interface Companion {
  id: string;
  name: string;
  kind: string; // Parceiro, Montaria, Familiar (no T20 atual, aliados são parceiros)
  owner?: string;
  bonus: string;
  notes?: string;
  threatId?: string;
  level?: PartnerLevel;
  image?: string;
  imagePos?: string;
}

interface PartnerInfo {
  tipo: string;
  levels: Record<PartnerLevel, string> | null;
  raw: string;
  familiar: boolean;
}

/** Só as criaturas que trazem a habilidade "Parceiro" no bestiário podem ser parceiros. */
const partnerInfo = (t: T20Threat): PartnerInfo | null => {
  const h = t.habilidades.find((x) => /^(familiar e )?parceiro$/i.test(x.nome));
  if (!h) return null;
  const m = h.desc.match(/^([\s\S]*?)\s*Iniciante:\s*([\s\S]*?)\s*Veterano:\s*([\s\S]*?)\s*Mestre:\s*([\s\S]*)$/i);
  const familiar = /familiar/i.test(h.nome);
  return m
    ? { tipo: m[1].replace(/\.$/, "").trim(), levels: { Iniciante: m[2].trim(), Veterano: m[3].trim(), Mestre: m[4].trim() }, raw: h.desc, familiar }
    : { tipo: "", levels: null, raw: h.desc, familiar };
};

const PARTNER_THREATS = [...new Map(T20_THREATS.map((t) => [t.id, t])).values()]
  .map((t) => ({ t, info: partnerInfo(t) }))
  .filter((x): x is { t: T20Threat; info: PartnerInfo } => !!x.info)
  .sort((a, b) => a.t.nome.localeCompare(b.t.nome, "pt-BR"));

const Portrait: React.FC<{ threat?: T20Threat; name: string; image?: string; pos?: string; className?: string }> = ({ threat, name, image, pos, className = "h-24 w-24" }) => {
  const [failed, setFailed] = useState(false);
  const src = image || (!failed ? threat?.imagem : undefined);
  return (
    <div className={`${className} flex shrink-0 items-center justify-center overflow-hidden rounded border border-[#ccc3a6] bg-white font-serif text-2xl font-black text-[#b92b3a]`}>
      {src ? <img src={src} alt="" onError={() => setFailed(true)} style={{ objectPosition: pos ?? "50% 50%" }} className={`h-full w-full ${image ? "object-cover" : "object-contain"}`} /> : name.slice(0, 2).toUpperCase()}
    </div>
  );
};

const PartnerBonus: React.FC<{ info: PartnerInfo; level?: PartnerLevel; onlyLevel?: boolean }> = ({ info, level, onlyLevel }) => (
  <div className="space-y-1 text-xs">
    {info.tipo && <p><strong className="text-[#b92b3a]">Tipo:</strong> {info.tipo}</p>}
    {info.levels ? PARTNER_LEVELS.filter((l) => !onlyLevel || !level || l === level).map((l) => (
      <p key={l} className={`rounded px-1.5 py-1 ${level === l ? "border border-[#b92b3a]/40 bg-[#fbebee]" : "bg-[#f5f2eb]"}`}><strong className="text-[#2b261f]">{l}:</strong> <span className="text-[#5c5446]">{info.levels![l]}</span></p>
    )) : <p className="rounded bg-[#f5f2eb] px-1.5 py-1 text-[#5c5446]">{info.raw}</p>}
  </div>
);

export const CompanionsView: React.FC<{ companions: Companion[]; characters: CharacterSheet[]; onChange: (c: Companion[]) => void }> = ({ companions, characters, onChange }) => {
  const [showForm, setShowForm] = useState(false);
  const [manual, setManual] = useState(false);
  const [q, setQ] = useState("");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [pickLevel, setPickLevel] = useState<PartnerLevel>("Iniciante");
  const [pickOwner, setPickOwner] = useState("");
  const [pickNotes, setPickNotes] = useState("");
  const [showBlock, setShowBlock] = useState(false);
  const [form, setForm] = useState<Partial<Companion>>({ kind: "Parceiro" });
  const [openThreat, setOpenThreat] = useState<string | null>(null);
  const inp = "w-full rounded border border-[#ded7c6] bg-[#fbf9f4] p-2 text-xs";

  const catalog = useMemo(() => {
    const s = q.trim().toLowerCase();
    return PARTNER_THREATS.filter(({ t, info }) => !s || t.nome.toLowerCase().includes(s) || info.tipo.toLowerCase().includes(s) || t.tipo.toLowerCase().includes(s));
  }, [q]);
  const picked = pickedId ? PARTNER_THREATS.find((x) => x.t.id === pickedId) : undefined;

  const addFromCatalog = () => {
    if (!picked) return;
    const kind = picked.info.familiar ? "Familiar" : /^montaria/i.test(picked.info.tipo) ? "Montaria" : "Parceiro";
    onChange([{ id: `cmp-${Date.now().toString(36)}`, name: picked.t.nome, kind, owner: pickOwner || undefined, bonus: "", notes: pickNotes.trim() || undefined, threatId: picked.t.id, level: pickLevel }, ...companions]);
    setPickedId(null);
    setPickNotes("");
    setShowBlock(false);
    setShowForm(false);
  };
  const addManual = () => {
    if (!form.name?.trim()) return;
    onChange([{ id: `cmp-${Date.now().toString(36)}`, name: form.name.trim(), kind: form.kind ?? "Parceiro", owner: form.owner, bonus: form.bonus ?? "", notes: form.notes, image: form.image || undefined, imagePos: form.image ? form.imagePos : undefined }, ...companions]);
    setForm({ kind: "Parceiro" });
    setShowForm(false);
  };

  return (
    <div className="mx-auto max-w-[1340px] p-3 text-[#2b261f] sm:p-5">
      <PageBanner image={imgMonstros} position="50% 22%" title="Parceiros" crumb="Parceiros" count={companions.length} action={{ label: showForm ? "Fechar" : "Adicionar Parceiro", icon: showForm ? "✕" : "🐺", onClick: () => setShowForm((v) => !v) }} />

      {showForm && (
        <div className="mb-4 rounded-lg border border-[#ded7c6] bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-serif text-lg font-black text-[#b92b3a]">{manual ? "Novo parceiro (preencher manualmente)" : `Parceiros disponíveis (${PARTNER_THREATS.length})`}</h2>
            <button onClick={() => setManual((v) => !v)} className="rounded border border-[#ded7c6] bg-[#fbf9f4] px-3 py-1.5 text-xs font-bold text-[#726859] hover:text-[#b92b3a]">{manual ? "← Escolher da lista" : "Não achei — preencher manualmente"}</button>
          </div>

          {!manual && (
            <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
              <div>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar parceiro…" className={`${inp} mb-2`} />
                <div className="grid max-h-[26rem] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-4">
                  {catalog.map(({ t, info }) => (
                    <button key={t.id} onClick={() => { setPickedId(t.id); setShowBlock(false); }} className={`flex flex-col items-center rounded border p-2 text-center transition-all ${pickedId === t.id ? "border-[#b92b3a] bg-[#fbebee]" : "border-[#ded7c6] bg-[#fbf9f4] hover:border-[#b92b3a]"}`}>
                      <Portrait threat={t} name={t.nome} className="h-16 w-16" />
                      <span className="mt-1 line-clamp-2 text-xs font-bold leading-tight">{t.nome}</span>
                      <span className="line-clamp-1 text-[10px] text-[#9c9180]">{info.tipo || t.tipo}</span>
                    </button>
                  ))}
                  {catalog.length === 0 && <p className="col-span-full p-4 text-center text-xs text-[#726859]">Nenhum parceiro encontrado.</p>}
                </div>
              </div>
              <div className="rounded border border-[#ded7c6] bg-[#faf8f3] p-3">
                {!picked ? (
                  <p className="p-6 text-center text-xs text-[#726859]">Clique em um parceiro para ver a imagem, os dados e o bônus de cada nível.</p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-3">
                      <Portrait threat={picked.t} name={picked.t.nome} className="h-24 w-24" />
                      <div className="min-w-0"><h3 className="font-serif text-lg font-black leading-tight text-[#b92b3a]">{picked.t.nome}</h3><p className="text-[11px] text-[#726859]">{picked.t.tipo} · ND {picked.t.nd}</p><p className="text-[10px] text-[#9c9180]">{picked.t.fonte}</p></div>
                    </div>
                    <PartnerBonus info={picked.info} level={pickLevel} />
                    <div className="grid grid-cols-2 gap-2">
                      <select value={pickLevel} onChange={(e) => setPickLevel(e.target.value as PartnerLevel)} className={inp}>{PARTNER_LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
                      <select value={pickOwner} onChange={(e) => setPickOwner(e.target.value)} className={inp}><option value="">— personagem dono —</option>{characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    </div>
                    <textarea value={pickNotes} onChange={(e) => setPickNotes(e.target.value)} rows={2} placeholder="Anotações (opcional)" className={inp} />
                    <div className="flex gap-2">
                      <button onClick={addFromCatalog} className="flex-1 rounded bg-[#b92b3a] py-2 text-xs font-bold uppercase text-white hover:bg-[#9c1f2d]">+ Adicionar parceiro</button>
                      <button onClick={() => setShowBlock((v) => !v)} className="rounded border border-[#ded7c6] bg-white px-3 py-2 text-xs font-bold text-[#726859]">{showBlock ? "Ocultar dados" : "Ver dados"}</button>
                    </div>
                    {showBlock && <ThreatCard t={picked.t} />}
                  </div>
                )}
              </div>
            </div>
          )}

          {manual && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><ImagePicker label="Imagem ou token (opcional)" value={form.image ?? ""} pos={form.imagePos} onChange={(v, pos) => setForm({ ...form, image: v, imagePos: pos })} /></div>
              <input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome *" className={`${inp} font-bold`} />
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className={inp}>{["Parceiro", "Montaria", "Familiar"].map((k) => <option key={k}>{k}</option>)}</select>
              <select value={form.owner ?? ""} onChange={(e) => setForm({ ...form, owner: e.target.value })} className={inp}><option value="">— personagem dono —</option>{characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <input value={form.bonus ?? ""} onChange={(e) => setForm({ ...form, bonus: e.target.value })} placeholder="Bônus (ex.: +2 em Percepção)" className={inp} />
              <textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Anotações" className={`${inp} sm:col-span-2`} />
              <button onClick={addManual} className="rounded bg-[#b92b3a] py-2 text-xs font-bold uppercase text-white hover:bg-[#9c1f2d] sm:col-span-2">+ Adicionar parceiro</button>
            </div>
          )}
        </div>
      )}

      {companions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#ded7c6] bg-white p-12 text-center text-xs text-[#726859]">Nenhum parceiro ainda. Use “Adicionar Parceiro”, escolha uma criatura da lista e vincule ao seu personagem.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {companions.map((c) => {
            const owner = characters.find((x) => x.id === c.owner);
            const t = c.threatId ? T20_THREATS.find((x) => x.id === c.threatId) : undefined;
            const info = t ? partnerInfo(t) : null;
            return (
              <div key={c.id} className="overflow-hidden rounded border border-[#ddd5bb] bg-[#efe9d6] shadow-sm">
                <div className="flex gap-3 p-3">
                  <Portrait threat={t} name={c.name} image={c.image} pos={c.imagePos} />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-serif text-xl font-black">{c.name}</h3>
                    <div className="truncate text-xs text-[#7a705d]">{c.kind === "Aliado" ? "Parceiro" : c.kind}{c.level ? ` ◆ ${c.level}` : ""}{owner ? ` ◆ de ${owner.name}` : ""}{t ? ` ◆ ND ${t.nd}` : ""}</div>
                    {info && <div className="mt-1.5"><PartnerBonus info={info} level={c.level} onlyLevel /></div>}
                    {c.bonus && <p className="mt-1.5 text-xs"><strong>Bônus:</strong> {c.bonus}</p>}
                    {c.notes && <p className="mt-0.5 text-[11px] text-[#5c5446]">{c.notes}</p>}
                  </div>
                </div>
                {t && openThreat === c.id && <div className="border-t border-[#ddd5bb] bg-white p-2"><ThreatCard t={t} /></div>}
                <div className="flex items-center justify-end gap-1.5 border-t border-[#ddd5bb] bg-[#e6dfc8] px-3 py-2">
                  <button onClick={() => confirm(`Remover ${c.name}?`) && onChange(companions.filter((x) => x.id !== c.id))} title="Remover" className="rounded border border-[#ccc3a6] bg-white px-2 py-1 text-xs font-bold text-[#726859] hover:text-[#b92b3a]">🗑️</button>
                  {t && <button onClick={() => setOpenThreat(openThreat === c.id ? null : c.id)} className="inline-flex items-center gap-1 rounded bg-[#b92b3a] px-3 py-1 text-xs font-bold text-white hover:bg-[#9c1f2d]">📄 {openThreat === c.id ? "Fechar bloco" : "Ver bloco"}</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
