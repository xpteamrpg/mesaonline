import React, { useMemo, useState } from "react";
import type { AttrKey, AttackItem, CharacterSheet, PowerEntry } from "../../types/sheet";
import type { RollEvent } from "./T20DiceTray";
import { ATTR_KEYS, RESISTANCE_IDS, T20_SKILLS } from "../../lib/t20/compendium";
import { allSkills, attackTotal, defense, itemToAttack, itemToEquipment, load, powerToEntry, racialFlySpeed, sign, skillTotal, spellToItem, uid } from "../../lib/t20/sheetRules";
import { formatXp, levelForXp, xpForLevel, xpForNextLevel, xpProgress } from "../../lib/t20/xp";
import { AddEquipmentModal, AddPowerModal, AddSpellModal } from "./SheetCatalogModals";
import { SheetJournal } from "./SheetJournal";
import { AvatarZoom } from "../common/AvatarZoom";

interface Props {
  sheet: CharacterSheet;
  onUpdate: (s: CharacterSheet) => void;
  onRoll: (e: RollEvent) => void;
  onEdit: () => void;
  /** edição rápida (janela pequena com os campos principais) */
  onQuickEdit?: () => void;
  onClone: () => void;
  onLevelUp: () => void;
}

const Card: React.FC<{ title?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, right, children, className = "" }) => (
  <div className={`od-card-print rounded-lg border border-[#ded7c6] bg-white p-3 shadow-[0_1px_2px_rgba(43,38,31,0.07),0_6px_14px_-8px_rgba(43,38,31,0.22),inset_0_1px_0_rgba(255,255,255,0.9)] sm:p-4 ${className}`}>
    {title && (
      <div className="-mx-3 -mt-3 mb-3 flex items-center justify-between rounded-t-lg border-b border-[#ded7c6] bg-[#f7f3e9] px-3 py-2 sm:-mx-4 sm:-mt-4 sm:px-4">
        <h2 className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[#726859]">
          <span className="text-[#b92b3a]">▼</span> {title}
        </h2>
        {right && <div className="no-print flex items-center gap-2">{right}</div>}
      </div>
    )}
    {children}
  </div>
);

/** Ícone da arma (arquivos em public/itens/data/img, nomeados pelo slug do item); cai para emoji se não houver. */
const WeaponIcon: React.FC<{ name: string; skill: "Luta" | "Pontaria" }> = ({ name, skill }) => {
  const [failed, setFailed] = useState(false);
  const slug = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (failed || !slug) return <span className="text-base">{skill === "Luta" ? "⚔️" : "🏹"}</span>;
  return <img src={`./itens/data/img/${slug}.webp`} alt="" onError={() => setFailed(true)} className="h-6 w-6 shrink-0 rounded object-contain" />;
};

const LinkBtn: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button onClick={onClick} className="text-[11px] font-bold text-[#b92b3a] hover:underline">{children}</button>
);

export const T20CharacterSheet: React.FC<Props> = ({ sheet, onUpdate, onRoll, onEdit, onQuickEdit, onClone, onLevelUp }) => {
  const [hpStep, setHpStep] = useState(1);
  const [mpStep, setMpStep] = useState(1);
  const [copied, setCopied] = useState(false);
  const [powerModal, setPowerModal] = useState(false);
  const [spellModal, setSpellModal] = useState(false);
  const [equipModal, setEquipModal] = useState(false);
  const [attackEditor, setAttackEditor] = useState<AttackItem | null>(null);
  const [showSkills, setShowSkills] = useState(true);

  const def = useMemo(() => defense(sheet), [sheet]);
  const skills = useMemo(() => allSkills(sheet), [sheet]);
  const carga = useMemo(() => load(sheet), [sheet]);
  const resistances = RESISTANCE_IDS.map((id) => skillTotal(sheet, id)).filter((x): x is NonNullable<typeof x> => !!x);
  const luta = skillTotal(sheet, "lut");
  const pontaria = skillTotal(sheet, "pon");

  const xpCur = xpForLevel(sheet.level);
  const xpNext = xpForNextLevel(sheet.level);
  const canLevelUp = sheet.level < 20 && sheet.xp >= xpNext;
  const suggestedLevel = levelForXp(sheet.xp);

  const patch = (p: Partial<CharacterSheet>) => onUpdate({ ...sheet, ...p, updatedAt: new Date().toISOString() });
  const saveAttack = (attack: AttackItem) => {
    const exists = sheet.attacks.some((entry) => entry.id === attack.id);
    patch({ attacks: exists ? sheet.attacks.map((entry) => entry.id === attack.id ? attack : entry) : [...sheet.attacks, attack] });
    setAttackEditor(null);
  };
  const addAttack = () => setAttackEditor({
    id: uid("atk"), name: "", skill: "Luta", damage: "1d6", damageAttr: "for",
    critical: "20/x2", range: "Corpo a corpo", damageType: "Impacto",
  });
  const rollCheck = (label: string, bonus: number) => onRoll({ label, formula: `1d20${sign(bonus)}` });

  const setHp = (v: number) => patch({ hp: { ...sheet.hp, current: Math.max(0, Math.min(sheet.hp.max, v)) } });
  const setMp = (v: number) => patch({ mp: { ...sheet.mp, current: Math.max(0, Math.min(sheet.mp.max, v)) } });
  const rest = () => patch({ hp: { ...sheet.hp, current: sheet.hp.max }, mp: { ...sheet.mp, current: sheet.mp.max } });

  const toggleTrained = (id: string) => {
    const cur = sheet.skills[id] ?? { trained: false };
    patch({ skills: { ...sheet.skills, [id]: { ...cur, trained: !cur.trained } } });
  };
  const setSkillOther = (id: string, v: number) => {
    const cur = sheet.skills[id] ?? { trained: false };
    patch({ skills: { ...sheet.skills, [id]: { ...cur, other: v } } });
  };
  const setSkillAttr = (id: string, attr: AttrKey, defaultAttr: AttrKey) => {
    const cur = sheet.skills[id] ?? { trained: false };
    const { attr: _old, ...rest } = cur;
    patch({ skills: { ...sheet.skills, [id]: attr === defaultAttr ? rest : { ...rest, attr } } });
  };

  const equipOfCategory = (cat: "Armadura" | "Escudo", id: string) =>
    patch({ equipment: sheet.equipment.map((i) => (i.category === cat ? { ...i, equipped: i.id === id } : i)) });

  const share = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const castSpell = (sp: CharacterSheet["spells"][number]) => {
    if (sheet.mp.current < sp.cost) {
      onRoll({ label: `${sp.name}: PM insuficientes (${sheet.mp.current}/${sp.cost})`, formula: "0" });
      return;
    }
    setMp(sheet.mp.current - sp.cost);
    onRoll({ label: `${sp.name} (−${sp.cost} PM)`, formula: sp.effect ?? "1d20" });
  };

  const Btn: React.FC<{ onClick: () => void; icon: string; label: string; tone?: "red" | "green" }> = ({ onClick, icon, label, tone = "red" }) => (
    <button onClick={onClick} className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-bold text-white shadow transition-all active:scale-95 ${tone === "red" ? "bg-[#b92b3a] hover:bg-[#9c1f2d]" : "bg-[#2b8a3e] hover:bg-[#237032]"}`}>
      <span>{icon}</span> {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-[1340px] p-3 text-[#2b261f] sm:p-5">
      {/* ------------------------------- CABEÇALHO ------------------------------ */}
      <div className="od-card-print mb-4 rounded-lg border border-[#ded7c6] bg-white p-3 shadow-[0_1px_2px_rgba(43,38,31,0.07),0_6px_14px_-8px_rgba(43,38,31,0.22),inset_0_1px_0_rgba(255,255,255,0.9)] sm:p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <AvatarZoom src={sheet.avatar} pos={sheet.avatarPos} name={sheet.name} className="h-24 w-24 text-3xl sm:h-32 sm:w-32" frameClass="border-[#ded7c6] bg-gradient-to-br from-[#fbebee] to-[#f5f2eb]" onUpload={(avatar) => patch({ avatar, avatarPos: "50% 20%" })} />
            <div>
              <h1 className="font-serif text-2xl font-black leading-tight sm:text-3xl">{sheet.name}</h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[#b92b3a] sm:text-sm">
                <span>{sheet.race}</span><span>◆</span>
                <span>{sheet.class}{sheet.path ? ` (${sheet.path})` : ""}</span><span>◆</span>
                <span>{sheet.level}º Nível</span>
                {sheet.origin && (<><span>◆</span><span>{sheet.origin}</span></>)}
              </div>
              <div className="mt-0.5 text-xs text-[#726859]">
                Campanha: <span className="font-medium text-[#b92b3a]">{sheet.campaign}</span>
                {sheet.deity && <> · Devoto de <span className="font-medium text-[#b92b3a]">{sheet.deity}</span></>}
              </div>
            </div>
          </div>
          <div className="no-print flex flex-wrap items-center gap-1.5 sm:gap-2">
            <Btn onClick={() => onRoll({ label: "Rolagem de campanha", formula: "1d20" })} icon="🎲" label="Rolagem de Campanha" />
            <Btn onClick={rest} icon="⛺" label="Descanso" />
            {canLevelUp && <Btn onClick={onLevelUp} icon="⬆" label={`Subir para ${suggestedLevel}º`} tone="green" />}
            <Btn onClick={onEdit} icon="✏️" label="Editar" />
            {onQuickEdit && <Btn onClick={onQuickEdit} icon="⚡" label="Edição rápida" tone="green" />}
            <Btn onClick={() => window.print()} icon="📄" label="PDF" />
            <Btn onClick={onClone} icon="📋" label="Clonar" />
            <Btn onClick={share} icon="🔗" label={copied ? "Copiado!" : "Compartilhar"} />
          </div>
        </div>
      </div>

      {/* ---------------------------- ATRIBUTOS + PV/PM --------------------------- */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <h2 className="mb-3 text-center text-xs font-bold uppercase tracking-wider text-[#726859]">Atributos</h2>
          <div className="grid grid-cols-6 gap-2 text-center sm:gap-3">
            {Object.values(sheet.attributes).map((a) => (
              <button
                key={a.key}
                onClick={() => rollCheck(`Teste de ${a.name}`, a.value)}
                title={`${a.name}\nClique para rolar 1d20 ${sign(a.value)}`}
                className="group rounded p-1 transition-colors hover:bg-[#fbf9f4]"
              >
                <span className="od-dotted text-xs font-bold sm:text-sm">{a.short}</span>
                <div className="my-1 flex h-12 w-full items-center justify-center rounded border border-[#ded7c6] bg-white font-serif text-2xl font-black shadow-sm group-hover:border-[#b92b3a]">
                  {sign(a.value)}
                </div>
                <span className="block text-[10px] text-[#9c9180]">{a.name}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-center text-[10px] text-[#9c9180]">Em Tormenta 20 o valor do atributo já é o bônus usado nos testes.</p>
        </Card>

        <Card className="flex flex-col justify-between lg:col-span-5">
          <div>
            <h2 className="mb-2 text-center text-xs font-bold uppercase tracking-wider text-[#726859]">Pontos de Vida</h2>
            <div className="mb-2 flex items-center justify-center gap-6">
              <div className="text-center">
                <span className="text-[10px] font-bold uppercase text-[#726859]">Atual</span>
                <input type="number" value={sheet.hp.current} onChange={(e) => setHp(Number(e.target.value))} className="mt-0.5 block w-20 rounded border border-[#ded7c6] bg-[#fbf9f4] py-1 text-center font-serif text-xl font-bold outline-none focus:border-[#b92b3a]" />
              </div>
              <div className="text-center">
                <span className="text-[10px] font-bold uppercase text-[#726859]">Máximo</span>
                <div className="mt-0.5 flex h-9 w-20 items-center justify-center font-serif text-xl font-bold">{sheet.hp.max}</div>
              </div>
            </div>
            <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-[#eae4d5]">
              <div className={`h-full transition-all ${sheet.hp.current / sheet.hp.max > 0.5 ? "bg-[#2b8a3e]" : sheet.hp.current / sheet.hp.max > 0.2 ? "bg-[#c2892c]" : "bg-[#b92b3a]"}`} style={{ width: `${Math.min(100, (sheet.hp.current / Math.max(1, sheet.hp.max)) * 100)}%` }} />
            </div>
            <div className="no-print flex items-center justify-center gap-1.5">
              <input type="number" min={1} value={hpStep} onChange={(e) => setHpStep(Math.max(1, Number(e.target.value)))} className="w-14 rounded border border-[#ded7c6] bg-white py-1 text-center text-xs font-bold" />
              <button onClick={() => setHp(sheet.hp.current - hpStep)} className="rounded bg-[#b92b3a] px-2.5 py-1 text-xs font-bold text-white shadow hover:bg-[#9c1f2d]">💔 Dano</button>
              <button onClick={() => setHp(sheet.hp.current + hpStep)} className="rounded bg-[#2b8a3e] px-2.5 py-1 text-xs font-bold text-white shadow hover:bg-[#237032]">💚 Cura</button>
            </div>
          </div>
          <div className="mt-3 border-t border-[#eee8da] pt-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#1c7ed6]">Pontos de Mana</span>
              <span className="font-serif text-sm font-bold">{sheet.mp.current} / {sheet.mp.max}</span>
            </div>
            <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-[#eae4d5]">
              <div className="h-full bg-[#1c7ed6] transition-all" style={{ width: `${Math.min(100, (sheet.mp.current / Math.max(1, sheet.mp.max)) * 100)}%` }} />
            </div>
            <div className="no-print flex items-center justify-end gap-1.5">
              <input type="number" min={1} value={mpStep} onChange={(e) => setMpStep(Math.max(1, Number(e.target.value)))} className="w-12 rounded border border-[#ded7c6] bg-white py-0.5 text-center text-[11px] font-bold" />
              <button onClick={() => setMp(sheet.mp.current - mpStep)} className="rounded bg-[#1c7ed6] px-2 py-0.5 text-[11px] font-bold text-white hover:bg-[#1864ab]">Gastar</button>
              <button onClick={() => setMp(sheet.mp.current + mpStep)} className="rounded bg-[#2b8a3e] px-2 py-0.5 text-[11px] font-bold text-white hover:bg-[#237032]">Recuperar</button>
            </div>
          </div>
        </Card>
      </div>

      {/* ------------------- DEFESA · RESISTÊNCIAS · DESLOCAMENTO ------------------ */}
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-12">
        {/* Defesa */}
        <Card className="md:col-span-5">
          <div className="grid grid-cols-[auto_1fr] gap-3">
            <div className="text-center" title={def.formula}>
              <span className="text-xs font-bold uppercase text-[#726859]">Defesa</span>
              <div className="mt-1 flex h-16 w-16 items-center justify-center rounded-lg border-2 border-[#b92b3a] bg-[#fbebee] font-serif text-3xl font-black text-[#2b261f]">{def.total}</div>
              <span className="od-dotted mt-1 block text-[10px] text-[#726859]">10 {sign(def.des)} DES {sign(def.other + def.otherTemp)}</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="rounded border border-[#ded7c6] bg-[#fbf9f4] p-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-[#726859]">🛡 Armadura</span>
                  <span className="font-serif font-bold text-[#b92b3a]">+{def.armorBonus}</span>
                </div>
                <select value={def.armor?.id ?? ""} onChange={(e) => equipOfCategory("Armadura", e.target.value)} className="no-print mt-0.5 w-full rounded border border-[#ded7c6] bg-white p-1 text-[11px] font-semibold">
                  <option value="">Nenhuma</option>
                  {sheet.equipment.filter((i) => i.category === "Armadura").map((i) => <option key={i.id} value={i.id}>{i.name} (+{i.defenseBonus ?? 0})</option>)}
                </select>
                <span className="hidden text-[11px] font-semibold print:block">{def.armor?.name ?? "Nenhuma"}</span>
              </div>
              <div className="rounded border border-[#ded7c6] bg-[#fbf9f4] p-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-[#726859]">⛨ Escudo</span>
                  <span className="font-serif font-bold text-[#b92b3a]">+{def.shieldBonus}</span>
                </div>
                <select value={def.shield?.id ?? ""} onChange={(e) => equipOfCategory("Escudo", e.target.value)} className="no-print mt-0.5 w-full rounded border border-[#ded7c6] bg-white p-1 text-[11px] font-semibold">
                  <option value="">Nenhum</option>
                  {sheet.equipment.filter((i) => i.category === "Escudo").map((i) => <option key={i.id} value={i.id}>{i.name} (+{i.defenseBonus ?? 0})</option>)}
                </select>
                <span className="hidden text-[11px] font-semibold print:block">{def.shield?.name ?? "Nenhum"}</span>
              </div>
              <div className="rounded border border-[#ded7c6] bg-[#fbf9f4] p-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-[#726859]" title="Bônus de poderes, magias e outros efeitos">✨ Outros</span>
                  <span className="font-serif font-bold text-[#b92b3a]">{sign(def.other + def.otherTemp)}</span>
                </div>
                <div className="mt-0.5 grid grid-cols-2 gap-1.5">
                  <label className="text-[9px] font-bold uppercase text-[#9c9180]">Permanente
                    <input type="number" value={def.other} onChange={(e) => patch({ defenseOther: Number(e.target.value) || 0 })} className="mt-0.5 w-full rounded border border-[#ded7c6] bg-white p-1 text-center text-[11px] font-semibold text-[#2b261f]" />
                  </label>
                  <label className="text-[9px] font-bold uppercase text-[#9c9180]">Temporário
                    <input type="number" value={def.otherTemp} onChange={(e) => patch({ defenseOtherTemp: Number(e.target.value) || 0 })} className="mt-0.5 w-full rounded border border-[#ded7c6] bg-white p-1 text-center text-[11px] font-semibold text-[#2b261f]" />
                  </label>
                </div>
              </div>
              <div className="flex items-center justify-between px-1 text-[10px] text-[#726859]">
                <span>Penalidade de armadura</span>
                <span className={`font-bold ${def.penalty ? "text-[#b92b3a]" : ""}`}>{def.penalty || 0}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Resistências */}
        <Card className="md:col-span-4">
          <span className="block text-center text-xs font-bold uppercase text-[#726859]">Testes de Resistência</span>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {resistances.map((r) => (
              <button key={r.id} onClick={() => rollCheck(r.name, r.total)} title={`${r.name}: ${r.formula}\nClique para rolar`} className="rounded-lg border border-[#ded7c6] bg-[#fbf9f4] p-2 text-center transition hover:border-[#b92b3a] hover:bg-[#fbebee]">
                <span className="od-dotted block text-[11px] font-semibold text-[#b92b3a]">{r.name}</span>
                <span className="font-serif text-2xl font-black">{sign(r.total)}</span>
                <span className="block text-[9px] uppercase text-[#9c9180]">{r.attr} · {r.trained ? "treinada" : "—"}</span>
                <span className="mt-1 block rounded bg-[#b92b3a] py-0.5 text-[10px] font-bold text-white">🎲 Rolar</span>
              </button>
            ))}
          </div>
        </Card>

        {/* Deslocamento + Iniciativa */}
        <Card className="md:col-span-3">
          <span className="block text-center text-xs font-bold uppercase text-[#726859]">Deslocamento</span>
          <div className="mt-1 grid grid-cols-2 gap-1 text-center">
            <div><span className="od-dotted text-[10px] text-[#b92b3a]">Normal</span><div className="font-serif text-xl font-black">{sheet.speed}m</div></div>
            <div><span className="od-dotted text-[10px] text-[#b92b3a]">Corrida</span><div className="font-serif text-xl font-black">{sheet.speed * 2}m</div></div>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1 border-t border-[#eee] pt-1 text-center">
            {([["Voo", "flySpeed", sheet.flySpeed ?? racialFlySpeed(sheet.raceId, sheet.race, sheet.raceVariantId)], ["Escavar", "burrowSpeed", sheet.burrowSpeed ?? 0]] as const).map(([label, key, value]) => (
              <div key={key}>
                <span className="od-dotted text-[10px] text-[#b92b3a]" title="Zero, a menos que a raça, um poder ou um item conceda">{label}</span>
                <div className="flex items-center justify-center gap-0.5 font-serif text-xl font-black">
                  <input type="number" min={0} value={value} onChange={(e) => patch({ [key]: Math.max(0, Number(e.target.value) || 0) })} style={{ width: `${String(value).length + 0.6}ch` }} className="rounded border border-transparent bg-transparent p-0 text-center font-serif text-xl font-black [appearance:textfield] hover:border-[#ded7c6] focus:border-[#b92b3a] focus:bg-white focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />m
                </div>
              </div>
            ))}
          </div>
          {(() => {
            const ini = skillTotal(sheet, "ini");
            return ini ? (
              <button onClick={() => rollCheck("Iniciativa", ini.total)} title={ini.formula} className="mt-2 flex w-full items-center justify-between rounded border border-[#ded7c6] bg-[#fbf9f4] px-2 py-1.5 hover:border-[#b92b3a]">
                <span className="text-[10px] font-bold uppercase text-[#726859]">Iniciativa (perícia)</span>
                <span className="font-serif text-lg font-black text-[#b92b3a]">{sign(ini.total)} 🎲</span>
              </button>
            ) : null;
          })()}
        </Card>
      </div>

      {/* ------------------------------- ATAQUES ------------------------------- */}
      <div className="mb-4">
          {/* ATAQUES */}
          <Card title="Ataques" right={<><LinkBtn onClick={addAttack}>+ Adicionar ataque</LinkBtn><LinkBtn onClick={() => setEquipModal(true)}>+ Arma do arsenal</LinkBtn></>}>
            <div className="mb-2 flex gap-3 text-[10px] text-[#726859]">
              <span>Luta <strong className="text-[#b92b3a]">{sign(luta?.total ?? 0)}</strong></span>
              <span>Pontaria <strong className="text-[#b92b3a]">{sign(pontaria?.total ?? 0)}</strong></span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#ded7c6] text-[10px] font-bold uppercase text-[#726859]">
                    <th className="pb-2">Ataque</th>
                    <th className="pb-2 text-center">Teste</th>
                    <th className="pb-2 text-center">Dano</th>
                    <th className="pb-2 text-center">Crít.</th>
                    <th className="pb-2 text-center">Alc.</th>
                    <th className="pb-2">Tipo</th>
                    <th className="no-print pb-2 text-right">Rolar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0ebd9]">
                  {sheet.attacks.map((a) => {
                    const t = attackTotal(sheet, a);
                    return (
                      <tr key={a.id} className="hover:bg-[#fbf9f4]">
                        <td className="py-2">
                          <div className="flex items-center gap-1.5 font-bold"><WeaponIcon name={a.name} skill={a.skill} /> {a.name}</div>
                          {a.properties && <div className="text-[10px] text-[#9c9180]">{a.properties}</div>}
                        </td>
                        <td className="py-2 text-center" title={t.formula}>
                          <span className="od-dotted text-[10px] text-[#726859]">{a.skill}</span>
                          <div className="font-serif font-bold text-[#b92b3a]">{sign(t.bonus)}</div>
                        </td>
                        <td className="py-2 text-center font-serif font-bold">{t.damage}</td>
                        <td className="py-2 text-center text-[#726859]">{a.critical}</td>
                        <td className="py-2 text-center text-[#726859]">{a.range ?? "—"}</td>
                        <td className="py-2 text-[#726859]">{a.damageType}</td>
                        <td className="no-print py-2 text-right whitespace-nowrap">
                          <button onClick={() => setAttackEditor({ ...a })} className="mr-1 text-[#1c7ed6] hover:underline">Editar</button>
                          <button onClick={() => onRoll({ label: `${a.name} — ataque (${a.skill})`, formula: `1d20${sign(t.bonus)}` })} className="rounded bg-[#b92b3a] px-2 py-0.5 text-[10px] font-bold text-white hover:bg-[#9c1f2d]">Atacar</button>
                          <button onClick={() => onRoll({ label: `${a.name} — dano`, formula: t.damage })} className="ml-1 rounded border border-[#b92b3a] px-2 py-0.5 text-[10px] font-bold text-[#b92b3a] hover:bg-[#fbebee]">Dano</button>
                          <button onClick={() => patch({ attacks: sheet.attacks.filter((x) => x.id !== a.id) })} className="ml-1 text-[#9c9180] hover:text-[#b92b3a]">✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

      </div>

      {/* ------------------ HABILIDADES DE RAÇA E DE CLASSE ------------------ */}
      <div className="mb-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          {/* HABILIDADES DE RAÇA */}
          <Card title={`Habilidades de Raça — ${sheet.race}`}>
            <ul className="space-y-2 text-xs">
              {sheet.racialAbilities.map((ab) => (
                <li key={ab.id} className="flex items-start gap-2 leading-relaxed">
                  <span className="mt-0.5 flex h-4 shrink-0 items-center justify-center rounded bg-[#b92b3a] px-1 text-[9px] font-bold text-white">R</span>
                  <div><strong>{ab.name}:</strong> <span className="text-[#5c5446]">{ab.description}</span></div>
                </li>
              ))}
              {!sheet.racialAbilities.length && <li className="text-[#9c9180]">Nenhuma habilidade racial registrada.</li>}
            </ul>
          </Card>

          {/* HABILIDADES DE CLASSE */}
          <Card title={`Habilidades de Classe — ${sheet.class}`}>
            <ul className="space-y-2 text-xs">
              {sheet.classAbilities.map((ab) => (
                <li key={ab.id} className="flex items-start gap-2 leading-relaxed">
                  <span className="mt-0.5 flex h-4 w-5 shrink-0 items-center justify-center rounded bg-[#b92b3a] text-[9px] font-bold text-white">{ab.level ?? 1}º</span>
                  <div><strong>{ab.name}:</strong> <span className="text-[#5c5446]">{ab.description}</span></div>
                </li>
              ))}
              {!sheet.classAbilities.length && <li className="text-[#9c9180]">Nenhuma habilidade de classe registrada.</li>}
            </ul>
          </Card>

      </div>

      {/* -------------------------------- PODERES ------------------------------- */}
      <div className="mb-4">
          {/* PODERES */}
          <Card title={`Poderes (${sheet.powers.length})`} right={<LinkBtn onClick={() => setPowerModal(true)}>+ Adicionar poder</LinkBtn>}>
            {sheet.powers.length === 0 ? (
              <div className="rounded border border-dashed border-[#ded7c6] bg-[#fbf9f4] p-3 text-center text-xs text-[#9c9180]">Nenhum poder. Use “+ Adicionar poder” para escolher no catálogo.</div>
            ) : (
              <ul className="space-y-2 text-xs">
                {sheet.powers.map((p: PowerEntry) => (
                  <li key={p.id} className="flex items-start justify-between gap-2 rounded border border-[#f0ebd9] bg-[#fbf9f4] p-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <strong>{p.name}</strong>
                        <span className="rounded bg-[#fbebee] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#b92b3a]">{p.type}</span>
                        {p.cost ? <span className="rounded bg-[#e7f5ff] px-1.5 py-0.5 text-[9px] font-bold text-[#1c7ed6]">{p.cost} PM</span> : null}
                      </div>
                      <p className="mt-0.5 text-[#5c5446]">{p.description}</p>
                      {p.requirement && <p className="text-[10px] italic text-[#9c9180]">Pré-requisito: {p.requirement}</p>}
                    </div>
                    <button onClick={() => patch({ powers: sheet.powers.filter((x) => x.id !== p.id) })} className="no-print text-[#9c9180] hover:text-[#b92b3a]">✕</button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

      </div>

      {/* --------------------------------- PERÍCIAS --------------------------------- */}
      <Card className="mb-4">
        <div className="mb-3 flex items-center justify-between border-b border-[#ded7c6] pb-2">
          <button onClick={() => setShowSkills((v) => !v)} className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#726859]">
            <span className="text-[#b92b3a]">{showSkills ? "▼" : "▶"}</span> Perícias
          </button>
          <span className="hidden text-[10px] text-[#9c9180] sm:inline">½ nível ({Math.floor(sheet.level / 2)}) + atributo + treino (+{sheet.level >= 15 ? 6 : sheet.level >= 7 ? 4 : 2}) + outros − penalidade</span>
        </div>
        {showSkills && (
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {skills.map((s) => {
              const def = T20_SKILLS.find((d) => d.id === s.id)!;
              return (
                <div key={s.id} className={`flex items-center justify-between gap-1 rounded border p-1.5 text-xs ${s.trained ? "border-[#b92b3a]/40 bg-[#fbebee]" : "border-[#ded7c6] bg-[#fbf9f4]"} ${!s.usable ? "opacity-60" : ""}`}>
                  <label className="flex min-w-0 items-center gap-1.5">
                    <input type="checkbox" checked={s.trained} onChange={() => toggleTrained(s.id)} title="Treinada" className="accent-[#b92b3a]" />
                    <span className="truncate font-semibold" title={`${s.formula}${def.somenteTreinado ? "\n(somente treinada)" : ""}${def.penalidadeArmadura ? "\nSofre penalidade de armadura" : ""}`}>
                      {s.name}
                      {sheet.skills[s.id]?.note ? <span className="text-[#1c7ed6]"> ({sheet.skills[s.id]?.note})</span> : null}
                    </span>
                    <select value={s.attr} onChange={(e) => setSkillAttr(s.id, e.target.value as AttrKey, def.atributo)} title="Atributo-chave (altere se um poder mudar o atributo desta perícia)" className={`no-print cursor-pointer rounded border bg-transparent text-[9px] font-bold uppercase ${s.attr !== def.atributo ? "border-[#b92b3a] text-[#b92b3a]" : "border-transparent text-[#9c9180]"}`}>
                      {ATTR_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <span className="hidden text-[9px] uppercase text-[#9c9180] print:inline">{s.attr}</span>
                    {def.somenteTreinado && <span className="text-[9px] text-[#9c9180]">*</span>}
                  </label>
                  <div className="flex shrink-0 items-center gap-1">
                    <input type="number" value={s.other || 0} onChange={(e) => setSkillOther(s.id, Number(e.target.value))} title="Outros bônus" className="no-print w-9 rounded border border-[#ded7c6] bg-white px-0.5 text-center text-[10px]" />
                    <button onClick={() => s.usable && rollCheck(s.name, s.total)} disabled={!s.usable} className="rounded border border-[#ded7c6] bg-white px-1.5 py-0.5 font-serif text-xs font-bold text-[#b92b3a] hover:border-[#b92b3a] disabled:cursor-not-allowed">
                      {sign(s.total)} 🎲
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-2 text-[10px] text-[#9c9180]">* somente treinada · Iniciativa, Fortitude, Reflexos e Vontade também aparecem acima.</p>
      </Card>

      {/* ------------------------------ EQUIPAMENTO ------------------------------ */}
      <div className="mb-4">
          {/* INVENTÁRIO */}
          <Card title="Equipamento" right={<LinkBtn onClick={() => setEquipModal(true)}>+ Item do arsenal</LinkBtn>}>
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-[#ded7c6] bg-[#fbf9f4] p-3">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#726859]">Tibares</div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-serif text-2xl font-bold text-[#c2892c]">T$ {sheet.money}</span>
                  <div className="no-print flex gap-1">
                    {[-10, -1, 1, 10].map((v) => <button key={v} onClick={() => patch({ money: Math.max(0, sheet.money + v) })} className="rounded border border-[#ded7c6] bg-white px-2 py-0.5 text-[11px] font-bold text-[#726859] hover:border-[#b92b3a]">{v > 0 ? `+${v}` : v}</button>)}
                  </div>
                </div>
              </div>
              <div className={`rounded-lg border p-3 ${carga.overloaded ? "border-[#b92b3a] bg-[#fbebee]" : "border-[#ded7c6] bg-[#fbf9f4]"}`}>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#726859]">Carga (slots)</div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-serif text-2xl font-bold">{carga.used} <span className="text-sm text-[#726859]">/ {carga.max}</span></span>
                  <span className="od-dotted text-[11px] text-[#726859]" title={`10 + 2×FOR (${sign(sheet.attributes.for.value * 2)})${carga.backpack ? " + 2 (mochila)" : ""}`}>{carga.overloaded ? "Sobrecarregado −2 DES/FOR" : "limite ok"}</span>
                </div>
              </div>
              <div className="rounded-lg border border-[#ded7c6] bg-[#fbf9f4] p-3">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#726859]">Itens</div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-serif text-2xl font-bold">{sheet.equipment.length}</span>
                  <span className="text-[11px] text-[#726859]">{sheet.equipment.filter((x) => x.equipped).length} equipado(s)</span>
                </div>
              </div>
            </div>
            <div className="max-h-[30rem] overflow-auto rounded-lg border border-[#ded7c6]">
              <table className="w-full min-w-[720px] text-left text-xs">
                <colgroup>
                  <col className="w-12" />
                  <col className="w-[26%]" />
                  <col className="w-28" />
                  <col className="w-24" />
                  <col className="w-16" />
                  <col className="w-20" />
                  <col />
                  <col className="no-print w-10" />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-[#f7f3e9]">
                  <tr className="border-b border-[#ded7c6] text-[10px] font-bold uppercase tracking-wider text-[#726859]">
                    <th className="px-2 py-2 text-center">Eqp</th>
                    <th className="px-2 py-2">Item</th>
                    <th className="px-2 py-2">Categoria</th>
                    <th className="px-2 py-2 text-center">Qtd</th>
                    <th className="px-2 py-2 text-center">Slots</th>
                    <th className="px-2 py-2 text-center">Preço</th>
                    <th className="px-2 py-2">Descrição</th>
                    <th className="no-print px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0ebd9]">
                  {sheet.equipment.map((it) => (
                    <tr key={it.id} className={`align-top hover:bg-[#fbf9f4] ${it.equipped ? "bg-[#fdf6f7]" : ""}`}>
                      <td className="px-2 py-2 text-center">
                        <input type="checkbox" checked={it.equipped} onChange={() => patch({ equipment: sheet.equipment.map((x) => (x.id === it.id ? { ...x, equipped: !x.equipped } : x)) })} className="mt-0.5 accent-[#b92b3a]" />
                      </td>
                      <td className="px-2 py-2 font-bold">
                        {it.name}
                        {it.source && <div title={it.source} className="mt-0.5 text-[9px] font-bold uppercase leading-none text-[#c2892c]">◆ Item de origem</div>}
                      </td>
                      <td className="px-2 py-2"><span className="rounded border border-[#ded7c6] bg-[#f5f2eb] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#726859]">{it.category}</span></td>
                      <td className="px-2 py-2">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => patch({ equipment: sheet.equipment.map((x) => (x.id === it.id ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x)) })} className="no-print h-5 w-5 rounded border border-[#ded7c6] text-[11px] leading-none text-[#726859] hover:border-[#b92b3a]">−</button>
                          <span className="w-4 text-center font-semibold">{it.quantity}</span>
                          <button onClick={() => patch({ equipment: sheet.equipment.map((x) => (x.id === it.id ? { ...x, quantity: x.quantity + 1 } : x)) })} className="no-print h-5 w-5 rounded border border-[#ded7c6] text-[11px] leading-none text-[#726859] hover:border-[#b92b3a]">+</button>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center text-[#726859]">{it.slots * it.quantity}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-center font-semibold text-[#c2892c]">{it.price !== null ? `T$ ${it.price}` : "—"}</td>
                      <td className="px-2 py-2 text-[11px] leading-snug text-[#726859]"><span className="line-clamp-3" title={it.description}>{it.description}</span></td>
                      <td className="no-print px-2 py-2 text-right"><button onClick={() => patch({ equipment: sheet.equipment.filter((x) => x.id !== it.id) })} title="Remover" className="px-1 text-[#9c9180] hover:text-[#b92b3a]">✕</button></td>
                    </tr>
                  ))}
                  {sheet.equipment.length === 0 && <tr><td colSpan={8} className="px-2 py-6 text-center text-[#9c9180]">Nenhum item. Use “+ Item do arsenal”.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>

      </div>

      {/* --------------------------- MAGIAS E DIÁRIO ---------------------------- */}
      <div className="mb-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          {/* MAGIAS */}
          <Card title={`Magias (${sheet.spells.length})`} right={<LinkBtn onClick={() => setSpellModal(true)}>+ Aprender magia</LinkBtn>}>
            {sheet.spells.length === 0 ? (
              <div className="rounded border border-dashed border-[#ded7c6] bg-[#fbf9f4] p-3 text-center text-xs text-[#9c9180]">Nenhuma magia conhecida.</div>
            ) : (
              <div className="space-y-1.5">
                {[1, 2, 3, 4, 5].map((c) => {
                  const list = sheet.spells.filter((s) => s.circle === c);
                  if (!list.length) return null;
                  return (
                    <div key={c}>
                      <div className="mb-1 text-[10px] font-bold uppercase text-[#726859]">{c}º círculo</div>
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {list.map((sp) => (
                          <div key={sp.id} className="flex items-center justify-between rounded border border-[#ded7c6] bg-[#fbf9f4] p-1.5 text-xs hover:border-[#b92b3a]" title={`${sp.school ?? ""} · ${sp.execution ?? ""} · ${sp.range ?? ""} · ${sp.duration ?? ""}${sp.resistance ? ` · ${sp.resistance}` : ""}\n\n${sp.description ?? ""}`}>
                            <button onClick={() => castSpell(sp)} className="min-w-0 flex-1 truncate text-left font-semibold text-[#b92b3a] hover:underline">
                              {sp.name} <span className="text-[10px] text-[#726859]">({sp.cost} PM)</span>
                            </button>
                            <div className="flex items-center gap-1">
                              {sp.effect && <span className="rounded border border-[#eee] bg-white px-1.5 py-0.5 font-serif text-[10px] font-bold">{sp.effect}</span>}
                              <button onClick={() => patch({ spells: sheet.spells.filter((x) => x.id !== sp.id) })} className="no-print px-1 text-[#9c9180] hover:text-[#b92b3a]">✕</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <p className="text-[10px] text-[#9c9180]">Clique no nome para conjurar: gasta os PM e rola o efeito.</p>
              </div>
            )}
          </Card>

          <SheetJournal entries={sheet.journal ?? []} onChange={(journal) => patch({ journal })} />
      </div>

      {/* --------------------- DETALHES · XP · SUBIR DE NÍVEL --------------------- */}
      <div className="mb-4">
          {/* DETALHES + XP */}
          <Card title="Detalhes" className="space-y-3">
            <div className="space-y-1 text-xs text-[#5c5446]">
              <p><strong className="text-[#2b261f]">Idiomas:</strong> {sheet.languages || "—"}</p>
              <p><strong className="text-[#2b261f]">Aparência:</strong> {sheet.appearance || "—"}</p>
              <p><strong className="text-[#2b261f]">Personalidade:</strong> {sheet.personality || "—"}</p>
            </div>
            <div className="border-t border-[#ded7c6] pt-2">
              <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase text-[#726859]">
                <span>Pontos de Experiência</span>
                <span>Nível {sheet.level} → {sheet.level < 20 ? `${sheet.level + 1}º em ${formatXp(xpNext)} PE` : "nível máximo"}</span>
              </div>
              <div className="flex items-center gap-2">
                <input type="number" value={sheet.xp} onChange={(e) => patch({ xp: Math.max(0, Number(e.target.value)) })} className="w-28 rounded border border-[#ded7c6] bg-[#fbf9f4] p-1 text-center font-serif text-base font-bold" />
                <div className="flex-1">
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#eae4d5]"><div className="h-full bg-[#c2892c] transition-all" style={{ width: `${xpProgress(sheet.xp, sheet.level)}%` }} /></div>
                  <div className="mt-0.5 flex justify-between text-[10px] text-[#9c9180]"><span>{formatXp(xpCur)}</span><span>{formatXp(sheet.xp)} PE</span><span>{formatXp(xpNext)}</span></div>
                </div>
                <div className="no-print flex gap-1">{[100, 500].map((v) => <button key={v} onClick={() => patch({ xp: sheet.xp + v })} className="rounded border border-[#ded7c6] bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#726859] hover:border-[#c2892c]">+{v}</button>)}</div>
              </div>
              {canLevelUp && <button onClick={onLevelUp} className="no-print mt-2 w-full rounded bg-[#2b8a3e] py-1.5 text-xs font-bold uppercase text-white hover:bg-[#237032]">⬆ PE suficientes — subir para o {suggestedLevel}º nível</button>}
            </div>
            <div className="border-t border-[#ded7c6] pt-2">
              <div className="mb-1 text-[10px] font-bold uppercase text-[#726859]">Anotações</div>
              <textarea value={sheet.notes} onChange={(e) => patch({ notes: e.target.value })} rows={3} className="w-full rounded border border-[#ded7c6] bg-[#fbf9f4] p-2 text-xs outline-none focus:border-[#b92b3a]" />
            </div>
          </Card>
      </div>

      <footer className="mt-8 border-t border-[#ded7c6] pt-4 pb-10 text-center text-[11px] text-[#9c9180]">
        Tormenta 20 © Jambô Editora. Ficha digital não-oficial de fã — dados do compêndio da comunidade (vangruver/ficha-tormenta20).
      </footer>

      {attackEditor && (
        <div className="no-print fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-3" onMouseDown={(event) => { if (event.target === event.currentTarget) setAttackEditor(null); }}>
          <form onSubmit={(event) => { event.preventDefault(); saveAttack(attackEditor); }} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[#ded7c6] bg-[#fbf9f4] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-serif text-lg font-black">{sheet.attacks.some((entry) => entry.id === attackEditor.id) ? "Editar ataque" : "Adicionar ataque"}</h2>
              <button type="button" onClick={() => setAttackEditor(null)} className="text-lg text-[#726859]" aria-label="Fechar">✕</button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold">Nome do ataque<input required autoFocus value={attackEditor.name} onChange={(event) => setAttackEditor({ ...attackEditor, name: event.target.value })} className="mt-1 w-full rounded border border-[#ded7c6] bg-white p-2 font-normal" placeholder="Ex.: Rajada arcana" /></label>
              <label className="text-xs font-bold">Perícia do ataque<select value={attackEditor.skill} onChange={(event) => setAttackEditor({ ...attackEditor, skill: event.target.value as AttackItem["skill"] })} className="mt-1 w-full rounded border border-[#ded7c6] bg-white p-2 font-normal"><option value="Luta">Luta</option><option value="Pontaria">Pontaria</option></select></label>
              <label className="text-xs font-bold">Bônus extra no ataque<input type="number" value={attackEditor.bonus ?? 0} onChange={(event) => setAttackEditor({ ...attackEditor, bonus: Number(event.target.value) || 0 })} className="mt-1 w-full rounded border border-[#ded7c6] bg-white p-2 font-normal" /></label>
              <label className="text-xs font-bold">Dano (dados/fórmula)<input required value={attackEditor.damage} onChange={(event) => setAttackEditor({ ...attackEditor, damage: event.target.value })} className="mt-1 w-full rounded border border-[#ded7c6] bg-white p-2 font-normal" placeholder="Ex.: 2d6" /></label>
              <label className="text-xs font-bold">Atributo somado ao dano<select value={attackEditor.damageAttr ?? ""} onChange={(event) => setAttackEditor({ ...attackEditor, damageAttr: (event.target.value || null) as AttrKey | null })} className="mt-1 w-full rounded border border-[#ded7c6] bg-white p-2 font-normal"><option value="">Nenhum</option>{ATTR_KEYS.map((key) => <option key={key} value={key}>{key.toUpperCase()}</option>)}</select></label>
              <label className="text-xs font-bold">Bônus extra no dano<input type="number" value={attackEditor.damageBonus ?? 0} onChange={(event) => setAttackEditor({ ...attackEditor, damageBonus: Number(event.target.value) || 0 })} className="mt-1 w-full rounded border border-[#ded7c6] bg-white p-2 font-normal" /></label>
              <label className="text-xs font-bold">Crítico<input value={attackEditor.critical} onChange={(event) => setAttackEditor({ ...attackEditor, critical: event.target.value })} className="mt-1 w-full rounded border border-[#ded7c6] bg-white p-2 font-normal" placeholder="20/x2" /></label>
              <label className="text-xs font-bold">Alcance<input value={attackEditor.range ?? ""} onChange={(event) => setAttackEditor({ ...attackEditor, range: event.target.value || undefined })} className="mt-1 w-full rounded border border-[#ded7c6] bg-white p-2 font-normal" placeholder="Corpo a corpo ou Curto (9m)" /></label>
              <label className="text-xs font-bold">Tipo de dano<input value={attackEditor.damageType} onChange={(event) => setAttackEditor({ ...attackEditor, damageType: event.target.value })} className="mt-1 w-full rounded border border-[#ded7c6] bg-white p-2 font-normal" placeholder="Impacto, corte, fogo…" /></label>
              <label className="text-xs font-bold sm:col-span-2">Propriedades/observações<input value={attackEditor.properties ?? ""} onChange={(event) => setAttackEditor({ ...attackEditor, properties: event.target.value || undefined })} className="mt-1 w-full rounded border border-[#ded7c6] bg-white p-2 font-normal" placeholder="Descrição curta do poder ou efeito" /></label>
            </div>
            <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setAttackEditor(null)} className="rounded border border-[#ded7c6] bg-white px-3 py-2 text-xs font-bold">Cancelar</button><button type="submit" className="rounded bg-[#b92b3a] px-3 py-2 text-xs font-bold text-white">Salvar ataque</button></div>
          </form>
        </div>
      )}
      <AddPowerModal isOpen={powerModal} onClose={() => setPowerModal(false)} ownedIds={sheet.powers.map((p) => p.id)} className={sheet.class} raceName={sheet.race} onAdd={(p) => patch({ powers: [...sheet.powers, powerToEntry(p)] })} />
      <AddSpellModal isOpen={spellModal} onClose={() => setSpellModal(false)} ownedIds={sheet.spells.map((s) => s.id)} onAdd={(s) => patch({ spells: [...sheet.spells, spellToItem(s)] })} />
      <AddEquipmentModal
        isOpen={equipModal}
        onClose={() => setEquipModal(false)}
        onAdd={(it) => {
          const eq = itemToEquipment(it, 1, it.categoria === "Arma" || it.categoria === "Armadura" || it.categoria === "Escudo");
          const atk = itemToAttack(it);
          patch({ equipment: [...sheet.equipment, eq], attacks: atk ? [...sheet.attacks, atk] : sheet.attacks });
          setEquipModal(false);
        }}
      />
    </div>
  );
};
