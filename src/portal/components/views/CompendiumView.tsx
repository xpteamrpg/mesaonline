import React, { useMemo, useRef, useState } from "react";
import type { View } from "../../types/view";
import { renderPdfCoverToDataUrl } from "../../lib/pdf/renderPdfCover";
import { PublicBooksView } from "./PublicBooksView";
import { PageBanner } from "../layout/PageBanner";
import imgRacasWide from "../../assets/menu/racas-wide.jpg";
import imgClasses from "../../assets/menu/classes.jpg";
import imgEquip from "../../assets/menu/equipamentos.jpg";
import imgMagias from "../../assets/menu/magias.jpg";
import imgMonstros from "../../assets/menu/monstros.jpg";
import imgLivrosNovo from "../../assets/menu/livros-novo.jpg";
import imgCompendio from "../../assets/menu/compendio.jpg";
import {
  ATTR_KEYS,
  COMPENDIUM_COUNTS,
  ITEM_CATEGORIES,
  pathLabel,
  POWER_CATEGORIES,
  powerMatchesCategory,
  SELECTABLE_POWERS,
  skillName,
  SPELL_SCHOOLS,
  T20_CLASSES,
  T20_DEITIES,
  T20_DISTINCTIONS,
  T20_EQUIPMENT,
  T20_ORIGINS,
  T20_RACES,
  raceWithVariant,
  type T20Race,
  T20_SKILLS,
  T20_SPELLS,
  T20_THREATS,
  THREAT_NDS,
  THREAT_TYPES,
  type T20Class,
  type T20Threat,
} from "../../lib/t20/compendium";
import { sign } from "../../lib/t20/sheetRules";
import { ItemRow, PowerCard, SpellCard } from "../sheet/SheetCatalogModals";
import { XP_TABLE, formatXp } from "../../lib/t20/xp";

/* ------------------------------- primitivas ---------------------------------- */

export const PageHead: React.FC<{ icon: string; title: string; subtitle: string; right?: React.ReactNode; children?: React.ReactNode; image?: string; position?: string; wide?: boolean }> = ({ icon, title, subtitle, right, children, image, position, wide }) => (
  <>
    {image && <PageBanner image={image} wide={wide} position={position} title={title} crumb={title} />}
    <div className="mb-4 rounded-lg border border-[#ded7c6] bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {image
            ? <p className="text-sm text-[#5c5446]">{subtitle}</p>
            : <><h1 className="flex items-center gap-2 font-serif text-2xl font-black"><span className="flex h-7 w-7 items-center justify-center rounded bg-[#b92b3a] text-xs text-white">{icon}</span> {title}</h1><p className="mt-1 text-xs text-[#726859]">{subtitle}</p></>}
        </div>
        {right}
      </div>
      {children && <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-[#ded7c6] pt-3">{children}</div>}
    </div>
  </>
);

export const Pill: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button onClick={onClick} className={`rounded px-2.5 py-1 text-xs font-bold ${active ? "bg-[#b92b3a] text-white" : "border border-[#ded7c6] bg-white text-[#726859] hover:bg-[#fbf9f4]"}`}>{children}</button>
);

const Search: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string }> = ({ value, onChange, placeholder }) => (
  <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? "Buscar…"} className="w-full rounded border border-[#ded7c6] bg-[#fbf9f4] p-2 text-xs font-semibold outline-none focus:border-[#b92b3a] sm:w-72" />
);

const Wrap: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="mx-auto max-w-[1400px] p-3 text-[#2b261f] sm:p-5">{children}</div>;
const hitIn = (q: string, ...f: (string | undefined)[]) => !q || f.some((x) => x?.toLowerCase().includes(q));

/* ----------------------------------- RAÇAS ----------------------------------- */

const RaceCard: React.FC<{ r: T20Race }> = ({ r: base }) => {
  const [variantId, setVariantId] = useState("");
  const r = raceWithVariant(base, variantId);
  return (
    <div className="space-y-2 rounded-lg border border-[#ded7c6] bg-white p-3.5 shadow-sm">
      <div className="flex items-center justify-between border-b border-[#eee] pb-1.5">
        <span className="font-serif text-base font-black text-[#b92b3a]">{r.nome}</span>
        <span className="rounded border border-[#ded7c6] bg-[#f5f2eb] px-2 py-0.5 text-[10px] text-[#726859]">{r.tamanho} · {r.deslocamento}m</span>
      </div>
      <div className="text-[10px] text-[#9c9180]">{r.fonte}{r.tipoCriatura ? ` · ${r.tipoCriatura}` : ""}</div>
      {base.variantes && base.variantes.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase text-[#726859]">{base.varianteRotulo ?? "Variante"}</div>
          <div className="flex flex-wrap gap-1">
            <Pill active={!variantId} onClick={() => setVariantId("")}>Base</Pill>
            {base.variantes.map((v) => <Pill key={v.id} active={variantId === v.id} onClick={() => setVariantId(v.id)}>{v.nome}</Pill>)}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-1 text-[10px]">
        {ATTR_KEYS.filter((k) => r.atributos[k]).map((k) => <span key={k} className={`rounded px-1.5 py-0.5 font-bold ${(r.atributos[k] ?? 0) > 0 ? "bg-[#ebfbee] text-[#2b8a3e]" : "bg-[#fbebee] text-[#b92b3a]"}`}>{sign(r.atributos[k]!)} {k.toUpperCase()}</span>)}
        {r.escolhas.quantidade > 0 && <span className="rounded bg-[#e7f5ff] px-1.5 py-0.5 font-bold text-[#1c7ed6]">+{r.escolhas.valor} em {r.escolhas.quantidade} à escolha</span>}
      </div>
      <ul className="space-y-1 whitespace-pre-line text-xs text-[#5c5446]">{r.habilidades.map((t, i) => <li key={i}><strong className="text-[#2b261f]">• {t.nome}:</strong> {t.descricao}</li>)}</ul>
    </div>
  );
};

export const RacesView: React.FC = () => {
  const [q, setQ] = useState("");
  const [src, setSrc] = useState("");
  const s = q.trim().toLowerCase();
  const sources = [...new Set(T20_RACES.map((r) => r.fonte))];
  const list = T20_RACES.filter((r) => (!src || r.fonte === src) && hitIn(s, r.nome, r.fonte, ...r.habilidades.map((h) => h.nome), ...(r.variantes ?? []).map((v) => v.nome)));
  return (
    <Wrap>
      <PageHead image={imgRacasWide} wide position="50% 50%" icon="🧬" title="Raças de Arton" subtitle={`${T20_RACES.length} raças do Jogo Básico, Heróis de Arton, Ameaças de Arton, Ruff Ghanor e Duelo de Dragões.`} right={<Search value={q} onChange={setQ} />}>
        <Pill active={!src} onClick={() => setSrc("")}>Todas as fontes</Pill>
        {sources.map((f) => <Pill key={f} active={src === f} onClick={() => setSrc(f)}>{f}</Pill>)}
      </PageHead>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {list.map((r) => <RaceCard key={r.id} r={r} />)}
      </div>
    </Wrap>
  );
};

/* ------------------------------ CLASSES & DISTINÇÕES -------------------------- */

const ClassCard: React.FC<{ c: T20Class }> = ({ c }) => {
  const [path, setPath] = useState<string>("");
  const [showPowers, setShowPowers] = useState(false);
  const abilities = [...c.habilidades, ...(path ? c.habilidadesCaminho[path] ?? [] : [])].sort((a, b) => a.nivel - b.nivel);
  const powers = SELECTABLE_POWERS.filter((p) => p.classe === c.id && (!path || !p.caminho || p.caminho === path));
  const variant = c.variantes.find((v) => v.id === path);
  return (
    <div className="space-y-2 rounded-lg border border-[#ded7c6] bg-white p-3.5 shadow-sm">
      <div className="flex items-center justify-between border-b border-[#eee] pb-1.5">
        <span className="font-serif text-lg font-black text-[#b92b3a]">{c.nome}</span>
        <span className="rounded bg-[#f5f2eb] px-2 py-0.5 text-[10px] text-[#726859]">{c.fonte}</span>
      </div>
      <p className="text-xs italic text-[#5c5446]">{c.descricao}</p>
      <div className="grid grid-cols-2 gap-1 rounded border border-[#ded7c6] bg-[#fbf9f4] p-2 text-[11px] font-semibold sm:grid-cols-4">
        <span>PV: {variant?.pvInicial ?? c.pvInicial}+CON</span><span>+{variant?.pvPorNivel ?? c.pvPorNivel}+CON/nível</span><span>PM: {variant?.pm ?? c.pmInicial}</span><span>+{variant?.pm ?? c.pmPorNivel}/nível</span>
      </div>
      <p className="text-xs text-[#5c5446]"><strong>Atributo-chave:</strong> {c.atributoTexto} · <strong>Perícias:</strong> {variant?.skills ?? c.periciasTexto}</p>
      <p className="text-xs text-[#5c5446]"><strong>Proficiências:</strong> {variant?.proficiencias ?? c.proficiencias}</p>
      {c.caminhos.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase text-[#726859]">Caminhos / variantes:</span>
          <Pill active={!path} onClick={() => setPath("")}>Base</Pill>
          {c.caminhos.map((p) => { const v = c.variantes.find((x) => x.id === p); return <Pill key={p} active={path === p} onClick={() => setPath(p)}>{pathLabel(p)}{v?.fonte && v.fonte !== "Tormenta 20 — Jogo Básico" ? ` (${v.fonte})` : ""}</Pill>; })}
        </div>
      )}
      {variant?.flavor && <p className="rounded border border-[#e7f5ff] bg-[#f4faff] p-2 text-[11px] text-[#5c5446]">{variant.flavor}</p>}
      <div>
        <div className="text-[10px] font-bold uppercase text-[#726859]">Habilidades de classe por nível</div>
        <ul className="mt-1 space-y-1 text-[11px] text-[#5c5446]">{abilities.map((h, i) => <li key={i}><span className="font-serif font-bold text-[#b92b3a]">{h.nivel}º</span> <strong className="text-[#2b261f]">{h.nome}</strong> — {h.descricao}</li>)}</ul>
      </div>
      <button onClick={() => setShowPowers((v) => !v)} className="text-[11px] font-bold text-[#b92b3a] hover:underline">{showPowers ? "▼" : "▶"} {powers.length} poderes de {c.nome}{path ? ` (${pathLabel(path)})` : ""}</button>
      {showPowers && <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1">{powers.map((p) => <PowerCard key={p.id} p={p} />)}</div>}
    </div>
  );
};

export const ClassesView: React.FC = () => {
  const [tab, setTab] = useState<"classes" | "distincoes">("classes");
  const [q, setQ] = useState("");
  const s = q.trim().toLowerCase();
  const classes = T20_CLASSES.filter((c) => hitIn(s, c.nome, c.descricao, ...c.variantes.map((v) => v.nome)));
  const dist = T20_DISTINCTIONS.filter((d) => hitIn(s, d.nome, d.admissao, d.fonte));
  return (
    <Wrap>
      <PageHead image={imgClasses} position="50% 35%" icon="⚔️" title="Classes & Distinções" subtitle={`${T20_CLASSES.length} classes (Jogo Básico, Dragão Brasil, Ruff Ghanor) com caminhos/variantes e ${T20_DISTINCTIONS.length} distinções de Heróis de Arton e suplementos.`} right={<Search value={q} onChange={setQ} />}>
        <Pill active={tab === "classes"} onClick={() => setTab("classes")}>⚔️ Classes ({T20_CLASSES.length})</Pill>
        <Pill active={tab === "distincoes"} onClick={() => setTab("distincoes")}>🏅 Distinções ({T20_DISTINCTIONS.length})</Pill>
      </PageHead>
      {tab === "classes" && <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{classes.map((c) => <ClassCard key={c.id} c={c} />)}</div>}
      {tab === "distincoes" && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {dist.map((d) => (
            <div key={d.id} className="space-y-2 rounded-lg border border-[#ded7c6] bg-white p-3.5 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#eee] pb-1.5"><span className="font-serif text-base font-black text-[#b92b3a]">{d.nome}</span><span className="rounded bg-[#f5f2eb] px-2 py-0.5 text-[10px] text-[#726859]">{d.fonte}{d.exclusiva ? " · exclusiva" : ""}</span></div>
              <p className="text-xs text-[#5c5446]"><strong>Admissão:</strong> {d.admissao}</p>
              {d.marca && <p className="rounded border border-[#fbebee] bg-[#fff5f5] p-2 text-xs"><strong className="text-[#b92b3a]">{d.marca.nome}:</strong> {d.marca.descricao}</p>}
              {d.detalhes && <p className="text-[11px] text-[#5c5446]"><strong>{d.detalhes.titulo}:</strong> {d.detalhes.conteudo}</p>}
              <details><summary className="cursor-pointer text-[11px] font-bold text-[#b92b3a]">{d.poderes.length} poderes de distinção</summary>
                <ul className="mt-1 space-y-1 text-[11px] text-[#5c5446]">{d.poderes.map((p, i) => <li key={i}><strong className="text-[#2b261f]">{p.nome}</strong>{p.requisito ? <span className="italic text-[#9c9180]"> (pré-requisito: {p.requisito})</span> : null} — {p.descricao}</li>)}</ul>
              </details>
            </div>
          ))}
        </div>
      )}
    </Wrap>
  );
};

/* -------------------------------- EQUIPAMENTOS ------------------------------- */

export const EquipmentView: React.FC = () => {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const s = q.trim().toLowerCase();
  const list = useMemo(() => T20_EQUIPMENT.filter((e) => (!cat || e.categoria === cat) && hitIn(s, e.nome, e.descricao, e.subtipo)).slice(0, 400), [s, cat]);
  return (
    <Wrap>
      <PageHead image={imgEquip} position="50% 40%" icon="🎒" title="Equipamentos" subtitle={`${T20_EQUIPMENT.length} armas, armaduras, escudos, itens gerais, ferramentas, vestuário, consumíveis, montarias, serviços, itens mágicos, encantos, maldições e modificações.`} right={<Search value={q} onChange={setQ} />}>
        <Pill active={!cat} onClick={() => setCat("")}>Todos</Pill>
        {ITEM_CATEGORIES.map((c) => <Pill key={c} active={cat === c} onClick={() => setCat(c)}>{c} ({T20_EQUIPMENT.filter((e) => e.categoria === c).length})</Pill>)}
      </PageHead>
      <div className="space-y-1.5">{list.map((e) => <ItemRow key={e.id} it={e} />)}</div>
      {list.length === 400 && <p className="mt-2 text-center text-[11px] text-[#9c9180]">Mostrando 400 itens — refine a busca.</p>}
    </Wrap>
  );
};

/* ---------------------------------- GRIMÓRIO --------------------------------- */

export const SpellsView: React.FC = () => {
  const [q, setQ] = useState("");
  const [circle, setCircle] = useState<number | null>(null);
  const [type, setType] = useState("");
  const [school, setSchool] = useState("");
  const s = q.trim().toLowerCase();
  const list = useMemo(() => T20_SPELLS.filter((m) => (circle === null || m.circulo === circle) && (!type || m.tipo === type || m.tipo === "Universal") && (!school || m.escola === school) && hitIn(s, m.nome, m.descricao)), [s, circle, type, school]);
  return (
    <Wrap>
      <PageHead image={imgMagias} position="50% 35%" icon="✨" title="Grimório — Magias" subtitle={`${T20_SPELLS.length} magias arcanas, divinas e universais do 1º ao 5º círculo, com aprimoramentos.`} right={<Search value={q} onChange={setQ} placeholder="Buscar magia…" />}>
        <span className="mr-1 text-[10px] font-bold uppercase text-[#726859]">Círculo</span>
        <Pill active={circle === null} onClick={() => setCircle(null)}>Todos</Pill>
        {[1, 2, 3, 4, 5].map((c) => <Pill key={c} active={circle === c} onClick={() => setCircle(c)}>{c}º ({T20_SPELLS.filter((m) => m.circulo === c).length})</Pill>)}
        <span className="ml-3 mr-1 text-[10px] font-bold uppercase text-[#726859]">Tipo</span>
        {["", "Arcana", "Divina"].map((t) => <Pill key={t} active={type === t} onClick={() => setType(t)}>{t || "Todas"}</Pill>)}
        <span className="ml-3 mr-1 text-[10px] font-bold uppercase text-[#726859]">Escola</span>
        <Pill active={!school} onClick={() => setSchool("")}>Todas</Pill>
        {SPELL_SCHOOLS.map((e) => <Pill key={e} active={school === e} onClick={() => setSchool(e)}>{e}</Pill>)}
      </PageHead>
      <div className="space-y-2">{list.map((m) => <SpellCard key={m.id} s={m} />)}</div>
    </Wrap>
  );
};

/* --------------------------------- BESTIÁRIO --------------------------------- */

export const ThreatCard: React.FC<{ t: T20Threat; onRoll?: (label: string, formula: string) => void }> = ({ t, onRoll }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-[#ded7c6] bg-white p-3.5 shadow-sm">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-start justify-between gap-3 text-left">
        <div className="flex items-center gap-3">
          {t.imagem && <img src={t.imagem} alt="" loading="lazy" className="h-14 w-14 rounded border border-[#ded7c6] object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />}
          <div>
            <div className="font-serif text-base font-black text-[#b92b3a]">{t.nome}</div>
            <div className="text-[11px] text-[#726859]">{t.tipo} · <span className="text-[#9c9180]">{t.fonte}</span></div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded bg-[#2b261f] px-2 py-1 font-serif text-sm font-black text-white">ND {t.nd}</span>
          <span className="text-xs text-[#9c9180]">{open ? "▲" : "▼"}</span>
        </div>
      </button>
      <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[11px] sm:grid-cols-6">
        {[["Defesa", t.defesa ?? "—"], ["PV", t.pv ?? "—"], ["PM", t.pm ?? "—"], ["Fort", t.fort], ["Ref", t.ref], ["Von", t.von]].map(([l, v]) => (
          <div key={l as string} className="rounded border border-[#ded7c6] bg-[#fbf9f4] p-1"><div className="text-[9px] font-bold uppercase text-[#726859]">{l}</div><div className="font-serif font-bold">{v as string}</div></div>
        ))}
      </div>
      {open && (
        <div className="mt-3 space-y-2 border-t border-[#eee] pt-2 text-xs">
          <p className="text-[#5c5446]"><strong>Iniciativa</strong> {t.iniciativa} · <strong>Percepção</strong> {t.percepcao}{t.sentidos ? ` (${t.sentidos})` : ""} · <strong>Desloc.</strong> {t.deslocamento}</p>
          {t.defesaObs && <p className="text-[#5c5446]"><strong>Defesas:</strong> {t.defesaObs}</p>}
          <div className="grid grid-cols-6 gap-1 text-center">{ATTR_KEYS.map((k) => <div key={k} className="rounded border border-[#ded7c6] bg-[#fbf9f4] p-1"><div className="text-[9px] font-bold uppercase text-[#726859]">{k}</div><div className="font-serif font-bold">{sign(t.atributos[k] ?? 0)}</div></div>)}</div>
          {t.ataques.length > 0 && (
            <div><div className="text-[10px] font-bold uppercase text-[#726859]">Ataques</div>
              <ul className="mt-1 space-y-1">{t.ataques.map((a, i) => (
                <li key={i} className="flex items-start justify-between gap-2 rounded border border-[#f0ebd9] bg-[#fbf9f4] p-1.5">
                  <span><strong>{a.nome}</strong> {a.bonus} <span className="text-[#b92b3a]">({a.dano})</span>{a.desc ? <span className="text-[#5c5446]"> — {a.desc}</span> : null}</span>
                  {onRoll && <span className="flex shrink-0 gap-1"><button onClick={() => onRoll(`${t.nome}: ${a.nome} (ataque)`, `1d20${a.bonus}`)} className="rounded bg-[#b92b3a] px-1.5 py-0.5 text-[10px] font-bold text-white">🎲</button><button onClick={() => onRoll(`${t.nome}: ${a.nome} (dano)`, a.dano.replace(/[^\dd+\- ]/g, "").trim() || "1d6")} className="rounded border border-[#b92b3a] px-1.5 py-0.5 text-[10px] font-bold text-[#b92b3a]">Dano</button></span>}
                </li>
              ))}</ul>
            </div>
          )}
          {t.habilidades.length > 0 && <div><div className="text-[10px] font-bold uppercase text-[#726859]">Habilidades</div><ul className="mt-1 space-y-1 text-[#5c5446]">{t.habilidades.map((h, i) => <li key={i}><strong className="text-[#2b261f]">{h.nome}</strong>{h.tipo ? ` (${h.tipo})` : ""}: {h.desc}</li>)}</ul></div>}
          {t.pericias.length > 0 && <p className="text-[#5c5446]"><strong>Perícias:</strong> {t.pericias.map((p) => `${p.nome} ${p.valor}`).join(", ")}</p>}
          {t.equipamento && <p className="text-[#5c5446]"><strong>Equipamento:</strong> {t.equipamento}</p>}
          {t.tesouro && <p className="text-[#5c5446]"><strong>Tesouro:</strong> {t.tesouro}</p>}
          {t.observacao && <p className="text-[11px] italic text-[#726859]">{t.observacao}</p>}
        </div>
      )}
    </div>
  );
};

export const BestiaryView: React.FC<{ onRoll?: (label: string, formula: string) => void }> = ({ onRoll }) => {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [nd, setNd] = useState("");
  const [src, setSrc] = useState("");
  const s = q.trim().toLowerCase();
  const sources = [...new Set(T20_THREATS.map((t) => t.fonte))];
  const list = useMemo(() => T20_THREATS.filter((t) => (!type || t.tipo.startsWith(type)) && (!nd || t.nd === nd) && (!src || t.fonte === src) && hitIn(s, t.nome, t.tipo)).slice(0, 200), [s, type, nd, src]);
  return (
    <Wrap>
      <PageHead image={imgMonstros} position="50% 25%" icon="🐉" title="Monstros & Inimigos — Bestiário" subtitle={`${T20_THREATS.length} ameaças do Livro Básico, Ameaças de Arton, Deuses de Arton, Guia de NPCs e Dragão Brasil. Clique numa criatura para ver o bloco completo e rolar ataques.`} right={<Search value={q} onChange={setQ} placeholder="Buscar criatura…" />}>
        <span className="mr-1 text-[10px] font-bold uppercase text-[#726859]">Tipo</span>
        <Pill active={!type} onClick={() => setType("")}>Todos</Pill>
        {THREAT_TYPES.map((t) => <Pill key={t} active={type === t} onClick={() => setType(t)}>{t}</Pill>)}
        <span className="ml-3 mr-1 text-[10px] font-bold uppercase text-[#726859]">ND</span>
        <select value={nd} onChange={(e) => setNd(e.target.value)} className="rounded border border-[#ded7c6] bg-white px-2 py-1 text-xs font-bold"><option value="">Todos</option>{THREAT_NDS.map((n) => <option key={n} value={n}>ND {n}</option>)}</select>
        <span className="ml-3 mr-1 text-[10px] font-bold uppercase text-[#726859]">Fonte</span>
        <select value={src} onChange={(e) => setSrc(e.target.value)} className="rounded border border-[#ded7c6] bg-white px-2 py-1 text-xs font-bold"><option value="">Todas</option>{sources.map((f) => <option key={f} value={f}>{f}</option>)}</select>
      </PageHead>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{list.map((t) => <ThreatCard key={t.id} t={t} onRoll={onRoll} />)}</div>
      {list.length === 200 && <p className="mt-2 text-center text-[11px] text-[#9c9180]">Mostrando 200 criaturas — refine a busca.</p>}
    </Wrap>
  );
};

/* ----------------------------------- LIVROS ---------------------------------- */

export interface BookEntry {
  id: string;
  title: string;
  publisher?: string;
  year?: string;
  cover?: string;
  url?: string;
  notes?: string;
  pdfDataUrl?: string;
  pdfName?: string;
  addedAt: string;
}

export const BooksView: React.FC<{ books: BookEntry[]; onChange: (b: BookEntry[]) => void }> = ({ books, onChange }) => {
  const [form, setForm] = useState<Partial<BookEntry>>({});
  const [tab, setTab] = useState<"meus" | "publicos">("meus");
  const pdfInput = useRef<HTMLInputElement>(null);
  const add = () => {
    if (!form.title?.trim()) return;
    onChange([{ id: `book-${Date.now().toString(36)}`, title: form.title.trim(), publisher: form.publisher, year: form.year, cover: form.cover, url: form.url, notes: form.notes, pdfDataUrl: form.pdfDataUrl, pdfName: form.pdfName, addedAt: new Date().toISOString() }, ...books]);
    setForm({});
  };
  const inp = "w-full rounded border border-[#ded7c6] bg-[#fbf9f4] p-2 text-xs";
  return (
    <Wrap>
      <PageHead image={imgLivrosNovo} position="50% 40%" icon="📚" title="Livros" subtitle="Sua biblioteca pessoal e o catálogo público de materiais homebrew da comunidade." />
      <div className="mb-4 flex gap-1.5">
        <Pill active={tab === "meus"} onClick={() => setTab("meus")}>📚 Meus Livros ({books.length})</Pill>
        <Pill active={tab === "publicos"} onClick={() => setTab("publicos")}>🌐 Livros disponíveis</Pill>
      </div>
      {tab === "publicos" ? (
        <PublicBooksView />
      ) : (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-lg border border-[#ded7c6] bg-white p-4 shadow-sm lg:col-span-4">
          <h2 className="mb-2 font-serif text-sm font-black text-[#b92b3a]">Adicionar livro</h2>
          <div className="space-y-2">
            <input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Título *" className={`${inp} font-bold`} />
            <div className="grid grid-cols-2 gap-2"><input value={form.publisher ?? ""} onChange={(e) => setForm({ ...form, publisher: e.target.value })} placeholder="Editora" className={inp} /><input value={form.year ?? ""} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="Ano" className={inp} /></div>
            <input value={form.cover ?? ""} onChange={(e) => setForm({ ...form, cover: e.target.value })} placeholder="URL da capa" className={inp} />
            <input ref={pdfInput} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setForm({ ...form, pdfDataUrl: String(reader.result), pdfName: file.name, title: form.title || file.name.replace(/\.pdf$/i, "") }); reader.readAsDataURL(file); renderPdfCoverToDataUrl(file).then((cover) => { if (cover) setForm((prev) => (prev.cover?.trim() ? prev : { ...prev, cover })); }); }} />
            <button onClick={() => pdfInput.current?.click()} className="w-full rounded border border-[#ded7c6] bg-[#fbf9f4] py-2 text-xs font-bold text-[#726859]">📄 {form.pdfName ? `PDF: ${form.pdfName}` : "Carregar PDF do computador"}</button>
            <input value={form.url ?? ""} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="Link do PDF / loja" className={inp} />
            <textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Anotações" rows={2} className={inp} />
            <button onClick={add} className="w-full rounded bg-[#b92b3a] py-2 text-xs font-bold uppercase text-white hover:bg-[#9c1f2d]">+ Adicionar à biblioteca</button>
          </div>
        </div>
        <div className="lg:col-span-8">
          {books.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#ded7c6] bg-white p-12 text-center text-xs text-[#726859]">Nenhum livro cadastrado ainda.</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {books.map((b) => (
                <div key={b.id} className="flex flex-col rounded-lg border border-[#ded7c6] bg-white p-2 shadow-sm">
                  <div className="book-3d flex aspect-[3/4] items-center justify-center text-center font-serif text-xs font-bold text-white"><div className="book-3d-cover">{b.cover ? <img src={b.cover} alt="" /> : <span>{b.title}</span>}</div></div>
                  <div className="mt-2 flex-1"><div className="text-xs font-bold">{b.title}</div><div className="text-[10px] text-[#726859]">{[b.publisher, b.year].filter(Boolean).join(" · ")}</div>{b.notes && <div className="mt-1 text-[10px] text-[#9c9180]">{b.notes}</div>}</div>
                  <div className="mt-2 flex gap-1">{(b.pdfDataUrl || b.url) && <a href={b.pdfDataUrl || b.url} target="_blank" rel="noreferrer" className="flex-1 rounded bg-[#b92b3a] py-1 text-center text-[10px] font-bold text-white">Abrir material</a>}<button onClick={() => onChange(books.filter((x) => x.id !== b.id))} className="rounded border border-[#ded7c6] px-2 text-[10px]">✕</button></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}
    </Wrap>
  );
};

/* ----------------------------- COMPÊNDIO (hub geral) ------------------------- */

export const CompendiumView: React.FC<{ onNavigate: (v: View) => void }> = ({ onNavigate }) => {
  const [tab, setTab] = useState<"pericias" | "origens" | "poderes" | "divindades" | "xp">("poderes");
  const [q, setQ] = useState("");
  const [sub, setSub] = useState("");
  const s = q.trim().toLowerCase();
  const powers = useMemo(() => SELECTABLE_POWERS.filter((p) => powerMatchesCategory(p, sub) && hitIn(s, p.nome, p.descricao, p.subtipo)).slice(0, 300), [s, sub]);
  const cards: { view: View; label: string; count: number; icon: string }[] = [
    { view: "races", label: "Raças", count: COMPENDIUM_COUNTS.racas, icon: "🧬" },
    { view: "classes", label: "Classes & Distinções", count: COMPENDIUM_COUNTS.classes + COMPENDIUM_COUNTS.distincoes, icon: "⚔️" },
    { view: "equipment", label: "Equipamentos", count: COMPENDIUM_COUNTS.equipamentos, icon: "🎒" },
    { view: "spells", label: "Magias", count: COMPENDIUM_COUNTS.magias, icon: "✨" },
    { view: "bestiary", label: "Monstros & Inimigos", count: COMPENDIUM_COUNTS.ameacas, icon: "🐉" },
  ];
  return (
    <Wrap>
      <PageHead image={imgCompendio} position="50% 40%" icon="📖" title="Compêndio de Arton — Tormenta 20" subtitle={`${Object.values(COMPENDIUM_COUNTS).reduce((a, b) => a + b, 0).toLocaleString("pt-BR")} registros do Jogo Básico e suplementos (Heróis, Ameaças, Deuses, Atlas, Jornadas, Dragão Brasil, Ruff Ghanor).`} right={<Search value={q} onChange={setQ} />}>
        {cards.map((c) => <button key={c.view} onClick={() => onNavigate(c.view)} className="rounded border border-[#ded7c6] bg-white px-3 py-1.5 text-xs font-bold text-[#2b261f] hover:border-[#b92b3a] hover:text-[#b92b3a]">{c.icon} {c.label} <span className="opacity-60">({c.count})</span></button>)}
        <span className="mx-2 h-5 w-px bg-[#ded7c6]" />
        <Pill active={tab === "poderes"} onClick={() => { setTab("poderes"); setSub(""); }}>💪 Poderes ({COMPENDIUM_COUNTS.poderes})</Pill>
        <Pill active={tab === "pericias"} onClick={() => setTab("pericias")}>🎯 Perícias ({COMPENDIUM_COUNTS.pericias})</Pill>
        <Pill active={tab === "origens"} onClick={() => setTab("origens")}>📜 Origens ({COMPENDIUM_COUNTS.origens})</Pill>
        <Pill active={tab === "divindades"} onClick={() => setTab("divindades")}>👑 Panteão ({COMPENDIUM_COUNTS.divindades})</Pill>
        <Pill active={tab === "xp"} onClick={() => setTab("xp")}>📈 Tabela de PE</Pill>
      </PageHead>

      {tab === "poderes" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">{POWER_CATEGORIES.map((c) => <Pill key={c.id} active={sub === c.id} onClick={() => setSub(c.id)}>{c.label}{c.id ? ` (${SELECTABLE_POWERS.filter((p) => p.categoria === c.id).length})` : ""}</Pill>)}</div>
          <div className="space-y-2">{powers.map((p) => <PowerCard key={p.id} p={p} />)}</div>
          {powers.length === 300 && <p className="text-center text-[11px] text-[#9c9180]">Mostrando 300 poderes — refine a busca.</p>}
        </div>
      )}
      {tab === "pericias" && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {T20_SKILLS.filter((k) => hitIn(s, k.nome)).map((k) => (
            <div key={k.id} className="flex items-center justify-between rounded-lg border border-[#ded7c6] bg-white p-2.5 shadow-sm">
              <div><div className="text-xs font-bold">{k.nome}</div><div className="text-[10px] text-[#726859]">{k.somenteTreinado ? "Somente treinada · " : "Livre · "}{k.penalidadeArmadura ? "sofre penalidade de armadura" : "sem penalidade"}{["for", "ref", "von"].includes(k.id) ? " · resistência" : ""}{k.id === "ini" ? " · iniciativa" : ""}</div></div>
              <span className="rounded bg-[#fbebee] px-2 py-1 text-xs font-bold uppercase text-[#b92b3a]">{k.atributo}</span>
            </div>
          ))}
        </div>
      )}
      {tab === "origens" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {T20_ORIGINS.filter((o) => hitIn(s, o.nome, o.descricao, o.fonte, o.regiao)).map((o) => (
            <div key={o.id} className="space-y-1.5 rounded-lg border border-[#ded7c6] bg-white p-3.5 shadow-sm">
              <div className="flex items-center justify-between"><h3 className="font-serif text-sm font-bold text-[#b92b3a]">{o.nome}</h3><span className="rounded bg-[#f5f2eb] px-1.5 py-0.5 text-[9px] text-[#726859]">{o.fonte}{o.regiao ? ` · ${o.regiao}` : ""}</span></div>
              <p className="text-[11px] text-[#5c5446]">{o.descricao.slice(0, 220)}{o.descricao.length > 220 ? "…" : ""}</p>
              <p className="text-xs text-[#5c5446]"><strong>Itens:</strong> {o.itens || "—"}</p>
              <div className="text-xs"><strong className="text-[#b92b3a]">{o.tipo === "atlas" ? "Benefícios:" : `Escolha ${o.escolhas}:`}</strong><ul className="mt-0.5 space-y-0.5">{o.beneficios.map((b, i) => <li key={i} className="text-[#5c5446]">• <strong className="text-[#2b261f]">{b.nome}</strong>{b.tipo === "skill" ? ` (${skillName(b.skillId ?? "")})` : ""} — {b.descricao}</li>)}</ul></div>
            </div>
          ))}
        </div>
      )}
      {tab === "divindades" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {T20_DEITIES.filter((d) => hitIn(s, d.nome, d.epiteto, d.devotos)).map((d) => (
            <div key={d.id} className="space-y-2 rounded-lg border border-[#ded7c6] bg-white p-3.5 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#eee] pb-1"><h3 className="font-serif text-sm font-black text-[#b92b3a]">{d.nome}</h3><span className="rounded bg-[#f5f2eb] px-1.5 py-0.5 text-[10px] text-[#726859]">{d.energia}</span></div>
              <div className="text-xs italic text-[#726859]">{d.epiteto} · Arma: {d.arma}</div>
              <div className="text-[11px] text-[#5c5446]"><strong>Devotos:</strong> {d.devotos}</div>
              <div className="text-[11px] text-[#5c5446]"><strong>Obrigações:</strong> {d.obrigacoes.join("; ")}</div>
              <details><summary className="cursor-pointer text-[11px] font-bold text-[#b92b3a]">{d.poderesConcedidos.length} poderes concedidos</summary><ul className="mt-1 space-y-1 text-[11px] text-[#5c5446]">{d.poderesConcedidos.map((p) => <li key={p.id}><strong className="text-[#2b261f]">{p.nome}</strong> — {p.descricao}</li>)}</ul></details>
            </div>
          ))}
        </div>
      )}
      {tab === "xp" && (
        <div className="max-w-md rounded-lg border border-[#ded7c6] bg-white p-4 shadow-sm">
          <h3 className="mb-2 font-serif text-sm font-black text-[#b92b3a]">Nível de personagem × Pontos de Experiência necessários</h3>
          <table className="w-full text-xs"><thead><tr className="border-b border-[#ded7c6] text-[10px] font-bold uppercase text-[#726859]"><th className="py-1 text-left">Nível</th><th className="py-1 text-right">PE necessários</th></tr></thead>
            <tbody className="divide-y divide-[#f0ebd9]">{XP_TABLE.map((r) => <tr key={r.level}><td className="py-1 font-bold">{r.level}º</td><td className="py-1 text-right font-serif">{formatXp(r.xp)}</td></tr>)}</tbody></table>
        </div>
      )}
    </Wrap>
  );
};
