import React, { useMemo, useState } from "react";
import {
  ITEM_CATEGORIES,
  pathLabel,
  POWER_CATEGORIES,
  powerMatchesCategory,
  SELECTABLE_POWERS,
  SPELL_SCHOOLS,
  T20_EQUIPMENT,
  T20_SPELLS,
  type T20Item,
  type T20Power,
  type T20Spell,
} from "../../lib/t20/compendium";

const Shell: React.FC<{ title: string; subtitle: string; onClose: () => void; children: React.ReactNode }> = ({ title, subtitle, onClose, children }) => (
  <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
    <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border border-[#ded7c6] bg-[#fbf9f4] p-5 shadow-2xl">
      <div className="mb-3 flex items-center justify-between border-b border-[#ded7c6] pb-3">
        <div>
          <h2 className="font-serif text-lg font-black text-[#2b261f]">{title}</h2>
          <p className="text-xs text-[#726859]">{subtitle}</p>
        </div>
        <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded text-sm font-bold text-[#726859] hover:bg-[#eae4d5] hover:text-[#b92b3a]">✕</button>
      </div>
      {children}
    </div>
  </div>
);

const Pill: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; tone?: "red" | "blue" }> = ({ active, onClick, children, tone = "red" }) => (
  <button
    onClick={onClick}
    className={`rounded px-2.5 py-1 text-xs font-bold transition-all ${
      active ? (tone === "red" ? "bg-[#b92b3a] text-white" : "bg-[#1c7ed6] text-white") : "border border-[#ded7c6] bg-white text-[#726859] hover:bg-[#fbf9f4]"
    }`}
  >
    {children}
  </button>
);

/* --------------------------------- Poderes ---------------------------------- */

export const PowerCard: React.FC<{ p: T20Power; action?: React.ReactNode }> = ({ p, action }) => (
  <div className="flex items-start justify-between gap-3 rounded border border-[#ded7c6] bg-white p-3 transition-all hover:border-[#b92b3a]">
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="font-serif text-sm font-bold text-[#2b261f]">{p.nome}</h4>
        <span className="rounded bg-[#fbebee] px-2 py-0.5 text-[10px] font-bold uppercase text-[#b92b3a]">
          {p.subtipo === "Geral" || p.subtipo === p.categoria ? p.categoria : `${p.categoria} · ${p.subtipo}`}{p.caminho ? ` (${pathLabel(p.caminho)})` : ""}
        </span>
        {p.nivel ? <span className="rounded bg-[#e7f5ff] px-1.5 py-0.5 text-[10px] font-bold text-[#1c7ed6]">{p.nivel}º nível</span> : null}
        {p.requisito && <span className="text-[10px] italic text-[#726859]">Pré-requisito: {p.requisito}</span>}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-[#5c5446]">{p.descricao}</p>
      <div className="mt-1 text-[10px] text-[#9c9180]">{p.fonte}</div>
    </div>
    {action}
  </div>
);

export const AddPowerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onAdd: (p: T20Power) => void;
  ownedIds?: string[];
  /** filtros iniciais úteis: nome da classe/raça do personagem */
  className?: string;
  raceName?: string;
}> = ({ isOpen, onClose, onAdd, ownedIds = [], className, raceName }) => {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return SELECTABLE_POWERS.filter(
      (p) =>
        powerMatchesCategory(p, cat) &&
        (!q || p.nome.toLowerCase().includes(q) || p.descricao.toLowerCase().includes(q) || p.subtipo.toLowerCase().includes(q)),
    ).slice(0, 300);
  }, [search, cat]);

  if (!isOpen) return null;
  return (
    <Shell title="💪 Catálogo de Poderes — Tormenta 20" subtitle={`${SELECTABLE_POWERS.length} poderes do Jogo Básico e suplementos (combate, destino, magia, Tormenta, concedidos, classe, raça, grupo).`} onClose={onClose}>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, efeito ou tipo…" className="mb-2 w-full rounded border border-[#ded7c6] bg-white p-2 text-xs font-semibold" autoFocus />
      <div className="mb-3 flex flex-wrap gap-1.5">
        {POWER_CATEGORIES.map((c) => (
          <Pill key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.label}</Pill>
        ))}
        {className && <Pill active={search === className} onClick={() => { setSearch(className); setCat("Classe"); }}>⚔️ {className}</Pill>}
        {raceName && <Pill active={search === raceName.split("/")[0]} onClick={() => { setSearch(raceName.split("/")[0]); setCat("Racial"); }}>🧬 {raceName}</Pill>}
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {list.map((p) => (
          <PowerCard
            key={p.id}
            p={p}
            action={
              <button
                disabled={ownedIds.includes(p.id)}
                onClick={() => onAdd(p)}
                className="shrink-0 rounded bg-[#2b8a3e] px-3 py-1.5 text-xs font-bold uppercase text-white shadow-sm hover:bg-[#237032] disabled:opacity-40"
              >
                {ownedIds.includes(p.id) ? "Já possui" : "+ Adicionar"}
              </button>
            }
          />
        ))}
        {list.length === 0 && <div className="p-8 text-center text-xs text-[#9c9180]">Nenhum poder encontrado.</div>}
      </div>
    </Shell>
  );
};

/* ---------------------------------- Magias ---------------------------------- */

export const SpellCard: React.FC<{ s: T20Spell; action?: React.ReactNode }> = ({ s, action }) => (
  <div className="flex items-start justify-between gap-3 rounded border border-[#ded7c6] bg-white p-3 transition-all hover:border-[#b92b3a]">
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="font-serif text-sm font-bold text-[#b92b3a]">{s.nome}</h4>
        <span className="rounded bg-[#e7f5ff] px-1.5 py-0.5 text-[10px] font-bold text-[#1c7ed6]">{s.circulo}º círculo</span>
        <span className="rounded bg-[#fbebee] px-1.5 py-0.5 text-[10px] font-bold text-[#b92b3a]">{s.custo} PM</span>
        <span className="text-[10px] text-[#726859]">{s.escola} · {s.tipo}</span>
        {s.fonte && <span className="rounded bg-[#f5f2eb] px-1.5 py-0.5 text-[10px] text-[#726859]" data-spell-source>{s.fonte}</span>}
      </div>
      <div className="mt-0.5 text-[10px] text-[#726859]">
        Execução: {s.execucao} · Alcance: {s.alcance} · Duração: {s.duracao}
        {s.alvo ? ` · Alvo: ${s.alvo}` : ""}{s.resistencia && s.resistencia !== "Nenhuma" ? ` · Resistência: ${s.resistencia}` : ""}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-[#5c5446]">{s.descricao}</p>
      {s.aprimoramentos?.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 border-t border-[#f0ebd9] pt-1.5">
          {s.aprimoramentos.map((a, i) => (
            <li key={i} className="text-[11px] text-[#5c5446]"><span className="font-bold text-[#1c7ed6]">+{a.custo} PM:</span> {a.desc}</li>
          ))}
        </ul>
      )}
    </div>
    {action}
  </div>
);

export const AddSpellModal: React.FC<{ isOpen: boolean; onClose: () => void; onAdd: (s: T20Spell) => void; ownedIds?: string[] }> = ({ isOpen, onClose, onAdd, ownedIds = [] }) => {
  const [search, setSearch] = useState("");
  const [circle, setCircle] = useState<number | null>(null);
  const [type, setType] = useState("");
  const [school, setSchool] = useState("");

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return T20_SPELLS.filter(
      (s) =>
        (circle === null || s.circulo === circle) &&
        (!type || s.tipo === type || s.tipo === "Universal") &&
        (!school || s.escola === school) &&
        (!q || s.nome.toLowerCase().includes(q) || s.descricao.toLowerCase().includes(q)),
    );
  }, [search, circle, type, school]);

  if (!isOpen) return null;
  return (
    <Shell title="✨ Grimório — Tormenta 20" subtitle={`${T20_SPELLS.length} magias arcanas, divinas e universais do 1º ao 5º círculo.`} onClose={onClose}>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar magia…" className="mb-2 w-full rounded border border-[#ded7c6] bg-white p-2 text-xs font-semibold" autoFocus />
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[10px] font-bold uppercase text-[#726859]">Círculo</span>
        <Pill active={circle === null} onClick={() => setCircle(null)}>Todos</Pill>
        {[1, 2, 3, 4, 5].map((c) => <Pill key={c} active={circle === c} onClick={() => setCircle(c)}>{c}º</Pill>)}
        <span className="ml-3 mr-1 text-[10px] font-bold uppercase text-[#726859]">Tipo</span>
        {["", "Arcana", "Divina"].map((t) => <Pill key={t} tone="blue" active={type === t} onClick={() => setType(t)}>{t || "Todos"}</Pill>)}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[10px] font-bold uppercase text-[#726859]">Escola</span>
        <Pill tone="blue" active={!school} onClick={() => setSchool("")}>Todas</Pill>
        {SPELL_SCHOOLS.map((s) => <Pill key={s} tone="blue" active={school === s} onClick={() => setSchool(s)}>{s}</Pill>)}
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {list.map((s) => (
          <SpellCard
            key={s.id}
            s={s}
            action={
              <button disabled={ownedIds.includes(s.id)} onClick={() => onAdd(s)} className="shrink-0 rounded bg-[#2b8a3e] px-3 py-1.5 text-xs font-bold uppercase text-white shadow-sm hover:bg-[#237032] disabled:opacity-40">
                {ownedIds.includes(s.id) ? "No grimório" : "+ Aprender"}
              </button>
            }
          />
        ))}
      </div>
    </Shell>
  );
};

/* -------------------------------- Equipamento -------------------------------- */

export const ItemRow: React.FC<{ it: T20Item; action?: React.ReactNode }> = ({ it, action }) => (
  <div className="flex items-center justify-between gap-3 rounded border border-[#ded7c6] bg-white p-2.5 transition-all hover:border-[#b92b3a]">
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-bold text-[#2b261f]">{it.nome}</h4>
        <span className="rounded border border-[#ded7c6] bg-[#f5f2eb] px-1.5 py-0.5 text-[10px] font-bold text-[#726859]">{it.categoria}</span>
        <span className="text-xs font-bold text-[#c2892c]">{it.precoTexto ?? (it.preco !== null ? `T$ ${it.preco}` : "T$ —")}</span>
        <span className="text-[11px] text-[#726859]">{it.slots} slot{it.slots === 1 ? "" : "s"}</span>
        {it.subtipo && <span className="text-[10px] text-[#9c9180]">{it.subtipo}</span>}
      </div>
      <div className="mt-0.5 text-[11px] text-[#5c5446]">
        {it.dano && <span className="mr-2 font-bold text-[#b92b3a]">{it.dano} {it.critico}{it.danoTipo ? ` · ${it.danoTipo}` : ""}{it.alcance ? ` · ${it.alcance}` : ""}</span>}
        {it.defesa !== undefined && <span className="mr-2 font-bold text-[#1c7ed6]">+{it.defesa} Defesa{it.penalidade ? ` · ${it.penalidade} penalidade` : ""}</span>}
        {[it.proficiencia, it.empunhadura].filter(Boolean).join(" · ")}
        {it.descricao && <span className="text-[#726859]"> {it.descricao.slice(0, 140)}{it.descricao.length > 140 ? "…" : ""}</span>}
      </div>
    </div>
    {action}
  </div>
);

export const AddEquipmentModal: React.FC<{ isOpen: boolean; onClose: () => void; onAdd: (it: T20Item) => void }> = ({ isOpen, onClose, onAdd }) => {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<string>("");

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return T20_EQUIPMENT.filter((e) => (!cat || e.categoria === cat) && (!q || e.nome.toLowerCase().includes(q) || e.descricao.toLowerCase().includes(q)));
  }, [search, cat]);

  if (!isOpen) return null;
  return (
    <Shell title="🎒 Arsenal & Loja — Tormenta 20" subtitle={`${T20_EQUIPMENT.length} armas, armaduras, escudos, itens, consumíveis, encantos, maldições e modificações. Armas adicionadas viram ataques automaticamente.`} onClose={onClose}>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar item…" className="mb-2 w-full rounded border border-[#ded7c6] bg-white p-2 text-xs font-semibold" autoFocus />
      <div className="mb-3 flex flex-wrap gap-1.5">
        <Pill active={!cat} onClick={() => setCat("")}>Todos</Pill>
        {ITEM_CATEGORIES.map((c) => <Pill key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Pill>)}
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {list.map((it) => (
          <ItemRow key={it.id} it={it} action={<button onClick={() => onAdd(it)} className="shrink-0 rounded bg-[#2b8a3e] px-3 py-1.5 text-xs font-bold uppercase text-white shadow-sm hover:bg-[#237032]">+ Adicionar</button>} />
        ))}
      </div>
    </Shell>
  );
};
