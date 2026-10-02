import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Backpack,
  BookOpen,
  ChevronDown,
  ArrowDownToLine,
  ChevronRight,
  Footprints,
  Hourglass,
  Pin,
  Shield,
  Sparkles,
  Star,
  Swords,
} from "lucide-react";
import { ACTION_TABS, COMBAT_ACTIONS } from "../data";
import { useSkinRuntime } from "../runtime";
import { IMG, imgFallback, type ImgKey } from "../assets";
import { Action, Bar, Micro, Pentagram, SectionTitle, Tray, cx } from "./ui";

const rowIn = (i: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: i * 0.035, duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
});

function Portrait({ img, src, size, ring }: { img: ImgKey; src?: string; size: number; ring: string }) {
  return (
    <img
      src={src || IMG[img].src}
      onError={(e) => imgFallback(e, img)}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-[9px] object-cover"
      style={{ width: size, height: size, border: `1.5px solid ${ring}`, boxShadow: "0 6px 16px -8px rgba(0,0,0,0.9)" }}
    />
  );
}

/* ------------------------------- exploration ------------------------------ */

/** "9 m" (e os quadrados de 1,5 m). */
const speedLabel = (meters: number) => `${meters.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m`;
const speedTitle = (speed: { walkM: number; flyM?: number; burrowM?: number }) => [
  `${speedLabel(speed.walkM)} (${Math.round(speed.walkM / 1.5)} quadrados)`,
  speed.flyM ? `voo ${speedLabel(speed.flyM)}` : "",
  speed.burrowM ? `escavação ${speedLabel(speed.burrowM)}` : "",
].filter(Boolean).join(" · ");

export function GroupPanel({ links, onAction }: { links: Record<string, string>; onAction: (id: string) => void }) {
  const { group } = useSkinRuntime();
  return (
    <Tray className="flex w-full shrink-0 flex-col overflow-hidden lg:w-[186px]">
      <div className="border-b border-[#7a5227]/50 px-3 pt-2.5 pb-2">
        <h2 className="font-display text-[17px] font-semibold text-[color:var(--mx-f0e2c6)]">Grupo</h2>
      </div>
      <div className="flex-1 overflow-y-auto scroll-tray p-1.5">
        {group.map((m, i) => (
          <motion.div key={m.id} {...rowIn(i)}>
            <Action
              href={links.group}
              onClick={() => onAction(`group:${m.id}`)}
              className={cx(
                "mb-1.5 flex w-full gap-2 rounded-[9px] border px-1.5 py-1.5 text-left transition-colors duration-200",
                i === 0
                  ? "border-[#d9a94c]/70 bg-[color:var(--mx-241708)]/70 hover:bg-[color:var(--mx-2c1c0c)]"
                  : "border-transparent hover:border-[#7a5227]/50 hover:bg-white/[0.035]",
              )}
            >
              <Portrait img={m.portrait} src={m.portraitUrl} size={32} ring={m.side === "enemy" ? "#c2202b" : "#4fa83c"} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] leading-tight font-semibold text-[color:var(--mx-eee0c6)]">{m.name}</div>
                <div className="mt-1 flex items-center gap-1">
                  <Bar value={m.hp} max={m.hpMax} tone={m.side === "enemy" ? "foe" : "hp"} height={5} shine={false} />
                  <span className="num w-[36px] shrink-0 text-right text-[8.5px] text-[color:var(--mx-c9b89a)]">
                    {m.hp}/{m.hpMax}
                  </span>
                </div>
                <div className="mt-[3px] flex items-center gap-1">
                  <Bar value={m.mp} max={m.mpMax} tone="mp" height={5} shine={false} />
                  <span className="num w-[36px] shrink-0 text-right text-[8.5px] text-[color:var(--mx-c9b89a)]">
                    {m.mp}/{m.mpMax}
                  </span>
                </div>
              </div>
            </Action>
          </motion.div>
        ))}
      </div>
    </Tray>
  );
}

/** Hotkeys fixas no pé do painel do personagem (exploração e combate). */
function HotkeyBar({ links, onAction }: { links: Record<string, string>; onAction: (id: string) => void }) {
  const { hotkeys, hotkeyActions } = useSkinRuntime();
  return (
    <div className="shrink-0 border-t border-[#7a5227]/40 px-3 pt-1.5 pb-3">
      <div className="mb-1 flex items-center gap-1.5">
        <Swords size={12} color="#e0b25c" />
        <span className="micro text-[#c9a25e]">Hotkeys</span>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {hotkeys.map((h) => (
          <Action
            key={h.slot}
            href={links[h.link]}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData("text/plain"); if (id) hotkeyActions?.assign(h.slot, id); }}
            onContextMenu={(event) => { event.preventDefault(); hotkeyActions?.clear(h.slot); }}
            onClick={() => onAction(`hotkey:${h.slot}`)}
            title={h.label}
            className="group relative flex flex-col items-center gap-0.5 rounded-[8px] border border-[#7a5227]/50 bg-[color:var(--mx-150e0a)] py-1 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#d9a94c]/85 hover:bg-[color:var(--mx-241708)]"
          >
            <span className="num absolute top-0.5 left-1 text-[8.5px] text-[#8f7c62]">{h.slot}</span>
            <h.icon size={15} style={{ color: h.tone }} strokeWidth={1.6} />
            <span className="num text-[8.5px] text-[#a6947c]">{h.qty}</span>
          </Action>
        ))}
      </div>
    </div>
  );
}

/** Título de seção com seta: clicar recolhe ou abre a lista. */
function FoldTitle({ glyph, children, open, onToggle, count }: { glyph: React.ReactNode; children: React.ReactNode; open: boolean; onToggle: () => void; count?: number }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-2 px-3 pt-2 pb-1.5 text-left">
      <span className="grid h-5 w-5 place-items-center rounded-[5px] border border-[#7a5227]/70 bg-[color:var(--mx-241708)] text-[#e0b25c]">{glyph}</span>
      <h2 className="font-display text-[15px] font-semibold tracking-[0.04em] text-[color:var(--mx-f0e2c6)]">{children}</h2>
      {count !== undefined && <span className="num text-[11px] text-[#a6947c]">{count}</span>}
      <ChevronDown size={16} className={cx("ml-auto text-[#c9a25e] transition-transform duration-200", !open && "-rotate-90")} />
    </button>
  );
}

export function CharacterSheet({ links, onAction }: { links: Record<string, string>; onAction: (id: string) => void }) {
  const { focus, skills, equipment, spells, powers } = useSkinRuntime();
  const attributes = focus?.attributes;
  const [open, setOpen] = useState({ skills: true, powers: true, equipment: true, spells: true });
  const [openPower, setOpenPower] = useState<string | null>(null);
  const toggle = (key: keyof typeof open) => setOpen((current) => ({ ...current, [key]: !current[key] }));
  return (
    <Tray className="flex w-full shrink-0 flex-col overflow-hidden lg:w-[clamp(430px,25.5vw,520px)]">
      <div className="min-h-0 flex-1 overflow-y-auto scroll-tray">
        {/* header */}
        <div className="relative flex gap-3 px-3.5 pt-2.5 pb-2">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-24"
            style={{ background: "radial-gradient(80% 120% at 12% 0%,rgba(217,169,76,0.14),transparent 70%)" }}
          />
          <div className="relative">
            <Portrait img={focus?.portrait ?? "kael"} src={focus?.portraitUrl} size={68} ring="#4fa83c" />
            <div className="mt-1.5 flex items-center gap-1">
              <span className="num rounded-[5px] border border-[#c2202b]/60 bg-[color:var(--mx-2a0d0c)] px-1.5 py-[1px] text-[10px] font-semibold text-[#e8837a]">
                P {focus?.defense ?? "—"}
              </span>
              <span
                className="num rounded-[5px] border border-[#7a5227]/60 bg-[color:var(--mx-241708)] px-1.5 py-[1px] text-[10px] font-semibold text-[#e0b25c]"
                title={focus?.speed ? speedTitle(focus.speed) : "Deslocamento"}
                data-speed-chip
              >
                {focus?.speed ? `D ${speedLabel(focus.speed.walkM)}` : "D —"}
              </span>
              <span className="rounded-[5px] border border-[#7a5227]/60 bg-[color:var(--mx-241708)] px-1.5 py-[1px] text-[10px] font-semibold text-[#e0b25c]">
                M
              </span>
            </div>
          </div>
          <div className="relative min-w-0 flex-1">
            <h2 className="font-display text-[22px] leading-tight font-semibold text-[color:var(--mx-f6ead2)]">{focus?.name ?? "Nenhum personagem"}</h2>
            <p className="mt-0.5 text-[12px] text-[#a6947c]">{focus?.subtitle ?? "Adicione uma ficha ao mapa"}</p>
            <div className="mt-1.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="micro w-[22px] text-[#c9a25e]">PV</span>
                <Bar value={focus?.hp ?? 0} max={focus?.hpMax ?? 0} tone="hp" height={10} />
                <span className="num w-[52px] text-right text-[11px] font-semibold text-[color:var(--mx-e7d8bb)]">{focus?.hp ?? 0}/{focus?.hpMax ?? 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="micro w-[22px] text-[#c9a25e]">PM</span>
                <Bar value={focus?.pm ?? 0} max={focus?.pmMax ?? 0} tone="mp" height={10} />
                <span className="num w-[52px] text-right text-[11px] font-semibold text-[color:var(--mx-e7d8bb)]">{focus?.pm ?? 0}/{focus?.pmMax ?? 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* atributos */}
        <div className="grid grid-cols-6 gap-1.5 px-3 pb-1.5">
          {(attributes ?? ["FOR", "DES", "CON", "INT", "SAB", "CAR"].map((short) => ({ key: short, short, value: NaN }))).map((a) => (
            <div key={a.key} className="flex flex-col items-center rounded-[8px] border border-[#7a5227]/55 bg-[color:var(--mx-150e0a)] py-1">
              <span className="micro text-[#c9a25e]">{a.short}</span>
              <span className="num text-[15px] leading-tight font-bold text-[color:var(--mx-f4e8ce)]">{Number.isNaN(a.value) ? "—" : a.value >= 0 ? `+${a.value}` : a.value}</span>
            </div>
          ))}
        </div>

        {/* perícias */}
        <FoldTitle glyph={<Pentagram size={13} color="#e0b25c" />} open={open.skills} onToggle={() => toggle("skills")}>Perícias</FoldTitle>
        {open.skills && (
          <div className="mx-3 grid grid-cols-2 gap-x-2 rounded-[10px] border border-[#7a5227]/45 bg-[color:var(--mx-120c09)] px-2 py-1">
            {skills.map((s) => (
              <Action
                key={s.name}
                href={links.skills}
                onClick={() => onAction(`skill:${s.name}`)}
                title={`Rolar ${s.name}`}
                className="flex w-full items-center gap-2 rounded-[7px] px-1.5 py-[2px] text-left transition-colors duration-150 hover:bg-white/[0.05]"
              >
                <s.icon size={14} className="shrink-0 text-[#c9a878]" strokeWidth={1.7} />
                <span className="flex-1 truncate text-[12px] text-[color:var(--mx-ddd0b6)]">{s.name}</span>
                <span className="num text-[12px] font-semibold text-[color:var(--mx-f0e4cb)]">{s.value}</span>
              </Action>
            ))}
          </div>
        )}

        {/* poderes: os da ficha (herói) ou as habilidades da ameaça */}
        <FoldTitle glyph={<Star size={13} color="#e0b25c" />} open={open.powers} onToggle={() => toggle("powers")} count={powers.length}>Poderes</FoldTitle>
        {open.powers && (
          <div className="mx-3 rounded-[10px] border border-[#7a5227]/45 bg-[color:var(--mx-120c09)] px-2 py-1">
            {powers.length === 0 && <p className="px-1.5 py-2 text-[12px] text-[#a6947c]">Nenhum poder na ficha.</p>}
            {powers.map((power) => (
              <div key={power.id} className="border-b border-[#7a5227]/20 last:border-b-0">
                <button type="button" onClick={() => setOpenPower(openPower === power.id ? null : power.id)} aria-expanded={openPower === power.id} className="flex w-full items-center gap-2 rounded-[7px] px-1.5 py-[3px] text-left transition-colors duration-150 hover:bg-white/[0.05]">
                  <span className="flex-1 truncate text-[12px] text-[color:var(--mx-ddd0b6)]" title={power.name}>{power.name}</span>
                  <span className="text-[10.5px] text-[#a6947c]">{power.type}</span>
                  <span className="rounded-[4px] border border-[#7a5227]/50 px-1 text-[9.5px] text-[#c9a25e]">{power.passive ? "Passivo" : "Ativo"}</span>
                </button>
                {openPower === power.id && <p className="px-2 pb-2 text-[11.5px] leading-snug text-[#cdbd9f]">{power.requirement ? `Requisito: ${power.requirement}. ` : ""}{power.description || "Sem descrição."}</p>}
              </div>
            ))}
          </div>
        )}

        {/* equipamentos */}
        <FoldTitle glyph={<Backpack size={13} color="#e0b25c" />} open={open.equipment} onToggle={() => toggle("equipment")} count={equipment.length}>Equipamentos / Mochila</FoldTitle>
        {open.equipment && (
          <div className="mx-3 grid min-h-[60px] grid-cols-2 gap-x-2 rounded-[10px] border border-[#7a5227]/45 bg-[color:var(--mx-120c09)] px-2 py-1">
            {equipment.length === 0 && <p className="col-span-2 px-1.5 py-2 text-[12px] text-[#a6947c]">Mochila vazia.</p>}
            {equipment.map((e) => (
              <div key={e.id} className="flex items-center gap-0.5">
                <Action
                  href={links.equipment}
                  draggable
                  onDragStart={(event) => { event.dataTransfer.setData("text/plain", e.id); event.dataTransfer.setData("application/x-mesa-item", e.id); event.dataTransfer.effectAllowed = "copyMove"; }}
                  onClick={() => onAction(`item:${e.name}`)}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-[7px] px-1.5 py-[3px] text-left transition-colors duration-150 hover:bg-white/[0.05]"
                >
                  <e.icon size={14} className="shrink-0" style={{ color: e.tone }} strokeWidth={1.7} />
                  <span className="flex-1 truncate text-[12px] text-[color:var(--mx-ddd0b6)]" title={e.label}>{e.label}</span>
                </Action>
                <button type="button" onClick={() => onAction(`dropItem:${e.id}`)} title={`Soltar ${e.name} no chão`} aria-label={`Soltar ${e.name} no chão`} className="grid h-6 w-6 shrink-0 place-items-center rounded-[6px] text-[#c9a25e] transition-colors hover:bg-white/[0.08] hover:text-[color:var(--mx-f0d9a5)]"><ArrowDownToLine size={13} strokeWidth={1.8} /></button>
              </div>
            ))}
          </div>
        )}

        {/* magias */}
        <FoldTitle glyph={<Sparkles size={13} color="#e0b25c" />} open={open.spells} onToggle={() => toggle("spells")} count={spells.length}>Magias</FoldTitle>
        {open.spells && (
          <div className="mx-3 mb-2 grid grid-cols-2 gap-x-2 rounded-[10px] border border-[#7a5227]/45 bg-[color:var(--mx-120c09)] px-2 py-1">
            {spells.length === 0 && <p className="col-span-2 px-1.5 py-2 text-[12px] text-[#a6947c]">Nenhuma magia na ficha.</p>}
            {spells.map((spell) => (
              <div key={spell.name} className="flex items-center gap-2 px-1.5 py-[3px]">
                <span className="flex-1 truncate text-[12px] text-[color:var(--mx-ddd0b6)]" title={spell.name}>{spell.name}</span>
                <span className="num text-[11px] text-[#a6947c]">{spell.circle}º · {spell.cost} PM</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <HotkeyBar links={links} onAction={onAction} />
    </Tray>
  );
}

/* --------------------------------- combat -------------------------------- */

export function InitiativePanel({ links, onAction }: { links: Record<string, string>; onAction: (id: string) => void }) {
  const { initiative, isMaster } = useSkinRuntime();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  function commit(id: string) {
    const value = Number(draft);
    if (draft.trim() !== "" && Number.isFinite(value)) onAction(`initiativeSet:${id}:${Math.trunc(value)}`);
    setEditing(null);
  }
  return (
    <Tray className="flex w-full shrink-0 flex-col overflow-hidden lg:w-[206px]">
      <div className="border-b border-[#7a5227]/50 px-3 pt-2.5 pb-2">
        <h2 className="font-display text-[16px] leading-tight font-semibold text-[color:var(--mx-f0e2c6)]">Ordem de iniciativa</h2>
      </div>
      <div className="flex-1 overflow-y-auto scroll-tray p-1.5">
        {initiative.map((m, i) => (
          <motion.div key={m.id} {...rowIn(i)}>
            <div
              className={cx(
                "mb-1.5 flex w-full items-center gap-1.5 rounded-[9px] border px-1.5 py-1.5 transition-colors duration-200",
                m.active
                  ? "border-[#e0b25c] bg-[color:var(--mx-2a1c0b)] shadow-[0_0_18px_-4px_rgba(224,178,92,0.55)]"
                  : "border-transparent hover:border-[#7a5227]/55 hover:bg-white/[0.035]",
              )}
            >
              {/* à esquerda: o número que a pessoa tirou na iniciativa (o mestre clica para editar) */}
              {editing === m.id ? (
                <input
                  autoFocus
                  type="number"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={() => commit(m.id)}
                  onKeyDown={(event) => { if (event.key === "Enter") commit(m.id); if (event.key === "Escape") setEditing(null); }}
                  aria-label={`Iniciativa de ${m.name}`}
                  className="num h-8 w-[40px] shrink-0 rounded-[7px] border border-[#d9a94c] bg-[color:var(--mx-100b09)] text-center text-[14px] font-bold text-[color:var(--mx-f4e8ce)] outline-none"
                />
              ) : (
                <button
                  type="button"
                  disabled={!isMaster}
                  title={isMaster ? "Clique para editar a iniciativa" : "Iniciativa rolada"}
                  aria-label={`Iniciativa de ${m.name}: ${m.roll || 0}`}
                  onClick={() => { setDraft(String(m.roll || 0)); setEditing(m.id); }}
                  className={cx(
                    "num grid h-8 w-[40px] shrink-0 place-items-center rounded-[7px] border text-[14px] font-bold disabled:cursor-default",
                    m.active ? "border-[#e0b25c] bg-[color:var(--mx-241708)] text-[#f2d68f]" : "border-[#7a5227]/50 bg-[color:var(--mx-150e0a)] text-[color:var(--mx-e3d3b6)]",
                    isMaster && "cursor-text hover:border-[#d9a94c]",
                  )}
                >
                  {m.roll ? m.roll : "—"}
                </button>
              )}
              <Action href={links.initiative} onClick={() => onAction(`initiative:${m.id}`)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <Portrait img={m.portrait} src={m.portraitUrl} size={30} ring={m.active ? "#f2d68f" : m.side === "enemy" ? "#c2202b" : "#4fa83c"} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] leading-tight font-semibold text-[color:var(--mx-eee0c6)]">{m.name}</div>
                  <div className="mt-1">
                    <Bar value={m.hp} max={m.hpMax} tone={m.side === "enemy" ? "foe" : "hp"} height={5} shine={false} />
                  </div>
                </div>
              </Action>
            </div>
          </motion.div>
        ))}
      </div>
    </Tray>
  );
}

const ACTION_ICONS = {
  boot: Footprints,
  swords: Swords,
  bag: Backpack,
  shield: Shield,
  hourglass: Hourglass,
};

const SAVE_SHORT: Record<string, string> = { Reflexos: "REF", Fortitude: "FORT", Vontade: "VON" };

function SaveGlyph({ kind, tone }: { kind: "pentagram" | "shield" | "star"; tone: string }) {
  if (kind === "pentagram") return <Pentagram size={15} color={tone} />;
  if (kind === "shield") return <Shield size={15} color={tone} strokeWidth={1.6} />;
  return <Star size={15} color={tone} strokeWidth={1.6} />;
}

/** Botão pequeno da linha de vitais (Dano, Cura, Gastar, Recuperar). */
function VitalButton({ label, tone, disabled, onClick }: { label: string; tone: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-7 min-w-0 flex-1 truncate rounded-[7px] border px-1 text-[11px] font-semibold text-[color:var(--mx-fff3e2)] transition-all duration-150 hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:brightness-100"
      style={{ background: tone, borderColor: "rgba(255,255,255,0.18)" }}
    >
      {label}
    </button>
  );
}

export function CombatActions({ links, onAction }: { links: Record<string, string>; onAction: (id: string) => void }) {
  const [tab, setTab] = useState("tabActions");
  const { focus, saves, equipment, powers, attacks, canOperateFocus } = useSkinRuntime();
  const [hpAmount, setHpAmount] = useState("1");
  const [pmAmount, setPmAmount] = useState("1");
  const [openPower, setOpenPower] = useState<string | null>(null);
  const canAct = Boolean(canOperateFocus);
  const amountOf = (text: string) => Math.max(0, Math.trunc(Number(text) || 0));
  const vital = (kind: string, text: string) => onAction(`vital:${kind}:${amountOf(text)}`);
  const attributes = focus?.attributes;
  const amountInput = "num h-7 w-10 shrink-0 rounded-[7px] border border-[#7a5227]/55 bg-[color:var(--mx-100b09)] text-center text-[13px] font-semibold text-[color:var(--mx-f4e8ce)] outline-none focus:border-[#d9a94c]";

  return (
    <Tray className="flex w-full shrink-0 flex-col overflow-hidden lg:w-[clamp(400px,22vw,460px)]">
      <div className="min-h-0 flex-1 overflow-y-auto scroll-tray">
        {/* cabeçalho */}
        <div className="flex items-start gap-3 px-3.5 pt-3 pb-2">
          <Portrait img={focus?.portrait ?? "kael"} src={focus?.portraitUrl} size={58} ring="#4fa83c" />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[20px] leading-tight font-semibold text-[color:var(--mx-f6ead2)]">{focus?.name ?? "Nenhum personagem"}</h2>
            <p className="text-[11.5px] text-[#a6947c]">{focus?.combatSubtitle ?? "Adicione uma ficha ao mapa"}</p>
            {focus && <p className="num text-[11.5px] text-[#e0b25c]" data-speed-line>Defesa {focus.defense} · Deslocamento {focus.speed ? speedTitle(focus.speed) : "—"}</p>}
            <div className="mt-1.5 space-y-1">
              <div className="flex items-center gap-2">
                <span className="micro w-[22px] text-[#c9a25e]">PV</span>
                <Bar value={focus?.hp ?? 0} max={focus?.hpMax ?? 0} tone="hp" height={10} />
                <span className="num w-[52px] text-right text-[11px] font-semibold text-[color:var(--mx-e7d8bb)]">{focus?.hp ?? 0}/{focus?.hpMax ?? 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="micro w-[22px] text-[#c9a25e]">PM</span>
                <Bar value={focus?.pm ?? 0} max={focus?.pmMax ?? 0} tone="mp" height={10} />
                <span className="num w-[52px] text-right text-[11px] font-semibold text-[color:var(--mx-e7d8bb)]">{focus?.pm ?? 0}/{focus?.pmMax ?? 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* controles rápidos de PV e PM */}
        <div className="grid grid-cols-2 gap-2 px-3 pb-2">
          <div className="flex items-center gap-1 rounded-[9px] border border-[#7a5227]/45 bg-[color:var(--mx-150e0a)] p-1">
            <span className="micro px-1 text-[#c9a25e]">PV</span>
            <input value={hpAmount} onChange={(event) => setHpAmount(event.target.value)} onFocus={(event) => event.currentTarget.select()} inputMode="numeric" aria-label="Quantidade de PV" className={amountInput} />
            <VitalButton label="Dano" tone="#8f1a22" disabled={!canAct} onClick={() => vital("damage", hpAmount)} />
            <VitalButton label="Cura" tone="#2f7a34" disabled={!canAct} onClick={() => vital("heal", hpAmount)} />
          </div>
          <div className="flex items-center gap-1 rounded-[9px] border border-[#7a5227]/45 bg-[color:var(--mx-150e0a)] p-1">
            <span className="micro px-1 text-[#c9a25e]">PM</span>
            <input value={pmAmount} onChange={(event) => setPmAmount(event.target.value)} onFocus={(event) => event.currentTarget.select()} inputMode="numeric" aria-label="Quantidade de PM" className={amountInput} />
            <VitalButton label="Gastar" tone="#1f5a9e" disabled={!canAct} onClick={() => vital("spend", pmAmount)} />
            <VitalButton label="Recuperar" tone="#2f7a34" disabled={!canAct} onClick={() => vital("recover", pmAmount)} />
          </div>
        </div>

        {/* testes de resistência */}
        <div className="grid grid-cols-3 gap-1.5 px-3 pb-2.5">
          {saves.map((save) => (
            <Action
              key={save.name}
              href={links.saves}
              onClick={() => onAction(`save:${save.name}`)}
              title={`Teste de ${save.name}`}
              className="flex items-center justify-center gap-1.5 rounded-[9px] border border-[#7a5227]/55 bg-[color:var(--mx-150e0a)] py-1.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#d9a94c]/80 hover:bg-[color:var(--mx-221609)]"
            >
              <SaveGlyph kind={save.icon} tone={save.tone} />
              <span className="text-[11px] font-semibold tracking-[0.04em] text-[color:var(--mx-cbba9d)]">{SAVE_SHORT[save.name] ?? save.name}</span>
              <span className="num text-[13px] font-bold text-[color:var(--mx-f4e8ce)]">{save.value}</span>
            </Action>
          ))}
        </div>

        {/* abas */}
        <div className="grid grid-cols-4 gap-1.5 px-3 pb-2.5">
          {ACTION_TABS.map((t) => {
            const active = t.id === tab;
            return (
              <Action
                key={t.id}
                href={links[t.link]}
                onClick={() => setTab(t.id)}
                className={cx(
                  "flex flex-col items-center gap-1 rounded-[9px] border px-1 py-1.5 transition-all duration-200",
                  active
                    ? "border-[#e0574f] bg-[color:var(--mx-3a1010)] text-[#ffe0d2] shadow-[0_0_16px_-4px_rgba(224,87,79,0.6)]"
                    : "border-[#7a5227]/45 bg-[color:var(--mx-150e0a)] text-[#b7a184] hover:border-[#d9a94c]/70 hover:bg-[color:var(--mx-221609)] hover:text-[color:var(--mx-f0d9a5)]",
                )}
              >
                <t.icon size={16} strokeWidth={1.7} />
                <span className="text-[10.5px] font-medium">{t.label}</span>
              </Action>
            );
          })}
        </div>

        {/* conteúdo da aba: o espaço gira ao trocar */}
        <div className="px-3 pb-3" style={{ perspective: 900 }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={{ rotateY: -80, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={{ rotateY: 80, opacity: 0 }}
              transition={{ duration: 0.26, ease: "easeOut" }}
            >
              {tab === "tabActions" && (
                <div className="space-y-1">
                  {COMBAT_ACTIONS.map((a) => {
                    const Icon = a.icon === "pentagram" ? null : ACTION_ICONS[a.icon];
                    return (
                      <Action
                        key={a.id}
                        href={links[a.link]}
                        onClick={() => onAction(a.id)}
                        className={cx(
                          "group flex w-full items-center gap-2.5 rounded-[10px] border px-2.5 py-1.5 text-left transition-all duration-200",
                          a.featured
                            ? "border-[#4d9be6]/80 bg-[#0f2135] shadow-[0_0_20px_-6px_rgba(77,155,230,0.55)] hover:bg-[#152c46]"
                            : "border-[#7a5227]/50 bg-[color:var(--mx-150e0a)] hover:-translate-y-[1px] hover:border-[#d9a94c]/80 hover:bg-[color:var(--mx-221609)]",
                        )}
                      >
                        <span
                          className={cx(
                            "grid h-[32px] w-[32px] shrink-0 place-items-center rounded-[8px] border",
                            a.featured ? "border-[#4d9be6]/50 bg-[#122c47] text-[#8fc4f5]" : "border-[#7a5227]/45 bg-[color:var(--mx-241708)] text-[#e0b25c]",
                          )}
                        >
                          {Icon ? <Icon size={17} strokeWidth={1.7} /> : <Pentagram size={18} color="#c07be0" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] leading-tight font-semibold text-[color:var(--mx-f2e8d4)]">{a.name}</span>
                          <span className="block truncate text-[11px] text-[#a6947c]">{a.hint}</span>
                        </span>
                        <ChevronRight size={16} className={cx("shrink-0 transition-transform duration-200 group-hover:translate-x-1", a.featured ? "text-[#8fc4f5]" : "text-[#8f7c62]")} />
                      </Action>
                    );
                  })}
                </div>
              )}

              {tab === "tabSheet" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-6 gap-1.5">
                    {(attributes ?? ["FOR", "DES", "CON", "INT", "SAB", "CAR"].map((short) => ({ key: short, short, value: NaN }))).map((a) => (
                      <div key={a.key} className="flex flex-col items-center rounded-[8px] border border-[#7a5227]/55 bg-[color:var(--mx-150e0a)] py-1">
                        <span className="micro text-[#c9a25e]">{a.short}</span>
                        <span className="num text-[15px] leading-tight font-bold text-[color:var(--mx-f4e8ce)]">{Number.isNaN(a.value) ? "—" : a.value >= 0 ? `+${a.value}` : a.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between rounded-[9px] border border-[#7a5227]/45 bg-[color:var(--mx-120c09)] px-3 py-2">
                    <span className="text-[13px] text-[color:var(--mx-ddd0b6)]">Defesa</span>
                    <span className="num text-[16px] font-bold text-[color:var(--mx-f4e8ce)]">{focus?.defense ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-[9px] border border-[#7a5227]/45 bg-[color:var(--mx-120c09)] px-3 py-2" data-speed-row>
                    <span className="text-[13px] text-[color:var(--mx-ddd0b6)]">Deslocamento</span>
                    <span className="num text-[14px] font-bold text-[color:var(--mx-f4e8ce)]">{focus?.speed ? speedTitle(focus.speed) : "—"}</span>
                  </div>
                  <div className="px-1 pt-1">
                    <span className="micro text-[#c9a25e]">Ataques da ficha</span>
                    <p className="text-[12px] leading-snug text-[#a6947c]">Marque os que quer em Ações → Agir. Arraste para uma Hotkey.</p>
                  </div>
                  <div className="rounded-[10px] border border-[#7a5227]/45 bg-[color:var(--mx-120c09)] px-2 py-1">
                    {attacks.length === 0 && <p className="px-1.5 py-2 text-[12px] text-[#a6947c]">A ficha não tem ataques.</p>}
                    {attacks.map((attack) => (
                      <div
                        key={attack.id}
                        draggable
                        onDragStart={(event) => { event.dataTransfer.setData("text/plain", `action:${attack.actionId}`); event.dataTransfer.effectAllowed = "copy"; }}
                        className="flex items-center gap-2 rounded-[7px] px-1.5 py-[5px] transition-colors duration-150 hover:bg-white/[0.05]"
                      >
                        <input type="checkbox" checked={attack.marked} onChange={() => onAction(`loadout:attacks:${attack.id}`)} aria-label={`Mostrar ${attack.name} em Agir`} className="h-4 w-4 shrink-0 accent-[#d9a94c]" />
                        <Swords size={14} className="shrink-0 text-[#e0b25c]" strokeWidth={1.7} />
                        <span className="min-w-0 flex-1 truncate text-[13px] text-[color:var(--mx-ddd0b6)]">{attack.name}</span>
                        <span className="num shrink-0 text-[11px] text-[#a6947c]">{attack.detail}</span>
                      </div>
                    ))}
                  </div>
                  <Action
                    onClick={() => onAction("openSheet")}
                    className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-[#d9a94c]/70 bg-[color:var(--mx-241708)] py-2 text-[13px] font-semibold text-[#f2d68f] transition-colors hover:bg-[color:var(--mx-2c1c0c)]"
                  >
                    <BookOpen size={16} />
                    Abrir ficha completa
                  </Action>
                </div>
              )}

              {tab === "tabInventory" && (
                <div className="space-y-2">
                  <p className="px-1 text-[12px] leading-snug text-[#a6947c]">Marque os itens que quer usar em combate: eles aparecem em Ações → Itens. Arraste um item para uma Hotkey.</p>
                  <div className="rounded-[10px] border border-[#7a5227]/45 bg-[color:var(--mx-120c09)] px-2 py-1">
                    {equipment.length === 0 && <p className="px-1.5 py-2 text-[12px] text-[#a6947c]">Mochila vazia.</p>}
                    {equipment.map((e) => (
                      <div
                        key={e.id}
                        draggable
                        onDragStart={(event) => { event.dataTransfer.setData("text/plain", e.id); event.dataTransfer.setData("application/x-mesa-item", e.id); event.dataTransfer.effectAllowed = "copyMove"; }}
                        className="flex items-center gap-2 rounded-[7px] px-1.5 py-[5px] transition-colors duration-150 hover:bg-white/[0.05]"
                      >
                        <input type="checkbox" checked={e.marked} onChange={() => onAction(`loadout:items:${e.id}`)} aria-label={`Usar ${e.name} em combate`} className="h-4 w-4 shrink-0 accent-[#d9a94c]" />
                        <e.icon size={15} className="shrink-0" style={{ color: e.tone }} strokeWidth={1.7} />
                        <span className="min-w-0 flex-1 truncate text-[13px] text-[color:var(--mx-ddd0b6)]" title={e.label}>{e.label}</span>
                        <button type="button" onClick={() => onAction(`dropItem:${e.id}`)} title={`Soltar ${e.name} no chão`} aria-label={`Soltar ${e.name} no chão`} className="grid h-6 w-6 shrink-0 place-items-center rounded-[6px] text-[#c9a25e] transition-colors hover:bg-white/[0.08] hover:text-[color:var(--mx-f0d9a5)]"><ArrowDownToLine size={14} strokeWidth={1.8} /></button>
                      </div>
                    ))}
                  </div>
                  <Action
                    onClick={() => onAction("openInventory")}
                    className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-[#d9a94c]/70 bg-[color:var(--mx-241708)] py-2 text-[13px] font-semibold text-[#f2d68f] transition-colors hover:bg-[color:var(--mx-2c1c0c)]"
                  >
                    <Backpack size={16} />
                    Abrir inventário completo
                  </Action>
                </div>
              )}

              {tab === "tabPowers" && (
                <div className="space-y-2">
                  {powers.length === 0 && <p className="rounded-[10px] border border-[#7a5227]/45 bg-[color:var(--mx-120c09)] px-3 py-3 text-[12.5px] text-[#a6947c]">Nenhum poder na ficha. Importe a ficha ou abra a ficha completa.</p>}
                  {([["Poderes ativos", false], ["Poderes passivos", true]] as const).map(([title, passive]) => {
                    const group = powers.filter((power) => power.passive === passive);
                    if (!group.length) return null;
                    return (
                      <div key={title} className="space-y-1">
                        <div className="flex items-center gap-2 px-1">
                          <span className="micro text-[#c9a25e]">{title}</span>
                          <span className="num text-[11px] text-[#a6947c]">{group.length}</span>
                          {!passive && <span className="ml-auto text-[11px] text-[#a6947c]">marque para mostrar em Agir · arraste para uma Hotkey</span>}
                        </div>
                        {group.map((power) => {
                          const open = openPower === power.name;
                          return (
                            <div
                              key={power.name}
                              draggable={!passive}
                              onDragStart={(event) => { event.dataTransfer.setData("text/plain", `action:${power.actionId}`); event.dataTransfer.effectAllowed = "copy"; }}
                              className={cx("rounded-[10px] border bg-[color:var(--mx-150e0a)] transition-colors", open ? "border-[#d9a94c]/80" : "border-[#7a5227]/50")}
                            >
                              <div className="flex items-center gap-2 px-2.5 py-2">
                                {!passive && <input type="checkbox" checked={power.marked} onChange={() => onAction(`loadout:powers:${power.id}`)} aria-label={`Mostrar ${power.name} em Agir`} className="h-4 w-4 shrink-0 accent-[#d9a94c]" />}
                                <button type="button" onClick={() => setOpenPower(open ? null : power.name)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                                  <Star size={15} className="shrink-0 text-[#e0b25c]" strokeWidth={1.7} />
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[14px] font-semibold text-[color:var(--mx-f2e8d4)]">{power.name}</span>
                                    <span className="block truncate text-[11px] text-[#a6947c]">{power.type}</span>
                                  </span>
                                  <span className={cx("shrink-0 rounded-[5px] border px-1.5 py-[1px] text-[10px] font-semibold", power.passive ? "border-[#7a5227]/60 text-[color:var(--mx-c9b295)]" : "border-[#4d9be6]/60 text-[#8fc4f5]")}>
                                    {power.passive ? "Passivo" : "Ativo"}
                                  </span>
                                  <ChevronDown size={15} className={cx("shrink-0 text-[#c9a25e] transition-transform duration-200", !open && "-rotate-90")} />
                                </button>
                              </div>
                              {open && (
                                <div className="space-y-1 border-t border-[#7a5227]/35 px-3 py-2 text-[12.5px] leading-snug text-[color:var(--mx-ddd0b6)]">
                                  {power.requirement && <p><b className="text-[#e0b25c]">Requisito:</b> {power.requirement}</p>}
                                  {power.source && <p><b className="text-[#e0b25c]">Fonte:</b> {power.source}</p>}
                                  <p>{power.description || "Este poder não tem descrição no Compêndio."}</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <HotkeyBar links={links} onAction={onAction} />
    </Tray>
  );
}

/* ------------------------------- roll table ------------------------------ */

/** Texto do cartão fixo: o que acabou de acontecer na mesa. */
function lastEventOf(rolls: ReturnType<typeof useSkinRuntime>["rolls"]): string {
  const latest = rolls[0];
  if (!latest) return "Nenhuma rolagem ainda.";
  if ("narrativeText" in latest) return (latest as unknown as { narrativeText: string }).narrativeText;
  if (/iniciativa/i.test(latest.title)) return "As rolagens de iniciativa foram feitas.";
  return `${latest.author} rolou ${latest.title}: ${latest.result}.`;
}

export function RollTable({ links, onAction }: { links: Record<string, string>; onAction: (id: string) => void }) {
  const { rolls } = useSkinRuntime();
  const [pinned, setPinned] = useState<string[]>([]);
  const togglePin = (id: string) => setPinned((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));
  const ordered = [...rolls.filter((r) => pinned.includes(r.id)), ...rolls.filter((r) => !pinned.includes(r.id))];
  return (
    <Tray className="flex h-[138px] shrink-0 gap-2 overflow-hidden p-2">
      {/* cartão fixo: nome da mesa, atalho para o Diário e o último acontecimento */}
      <div className="flex h-full w-[190px] shrink-0 flex-col justify-between rounded-[12px] border border-[#d9a94c]/60 bg-[color:var(--mx-1b1209)] px-2.5 py-2">
        <Action
          href={links.journal}
          onClick={() => onAction("journal")}
          title="Abrir o Diário"
          className="flex items-center gap-2 text-left"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] border border-[#7a5227]/70 bg-[color:var(--mx-241708)] text-[#e0b25c]">
            <BookOpen size={17} strokeWidth={1.7} />
          </span>
          <h2 className="font-display text-[15px] leading-tight font-semibold text-[color:var(--mx-f0e2c6)]">Mesa de rolagens</h2>
        </Action>
        <p className="line-clamp-3 text-[12px] leading-snug text-[color:var(--mx-e0d2b4)]">{lastEventOf(rolls)}</p>
      </div>

      <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto scroll-tray">
        {ordered.map((r, i) => {
          const narrative = "narrativeText" in r;
          const isPinned = pinned.includes(r.id);
          return (
            <motion.div key={r.id} {...rowIn(i)} className="h-full shrink-0">
              <Action
                onClick={() => togglePin(r.id)}
                title={isPinned ? "Desafixar rolagem" : "Fixar rolagem"}
                className={cx(
                  "relative flex h-full w-[212px] flex-col justify-between rounded-[11px] border px-2.5 py-2 text-left transition-all duration-200 hover:-translate-y-[2px]",
                  narrative ? "border-[#a855c7]/55 bg-[#1b1020] hover:border-[#c07be0]" : isPinned ? "border-[#e0b25c] bg-[color:var(--mx-241708)]" : "border-[#7a5227]/50 bg-[color:var(--mx-150e0a)] hover:border-[#d9a94c]/80",
                )}
              >
                <Pin size={13} className={cx("absolute top-2 right-2", isPinned ? "text-[#f2d68f]" : "text-[#6f6050]")} strokeWidth={1.8} />
                <div className="flex items-center gap-2 pr-5">
                  {narrative ? (
                    <span className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[9px] border border-[#a855c7]/50 bg-[#2a1436]">
                      <Pentagram size={20} color="#c07be0" />
                    </span>
                  ) : (
                    <Portrait img={r.portrait as ImgKey} src={r.portraitUrl} size={36} ring="#7a5227" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] leading-tight font-semibold text-[color:var(--mx-eee0c6)]">{r.author}</div>
                    {r.time && <div className="num text-[10px] text-[#c9a25e]">{r.time}</div>}
                  </div>
                </div>

                {narrative ? (
                  <p className="text-[12.5px] leading-snug text-[#c7b0d8] italic">{(r as unknown as { narrativeText: string }).narrativeText}</p>
                ) : (
                  <>
                    <div className="line-clamp-2 text-[12.5px] leading-tight font-semibold text-[color:var(--mx-e7d8bb)]" title={r.title}>{r.title}</div>
                    <div className="flex items-center gap-2">
                      <span className="num text-[30px] leading-none font-bold text-[color:var(--mx-f6ead2)]">{r.result}</span>
                      <span className="num rounded-[6px] border border-[#7a5227]/50 bg-[color:var(--mx-0f0a07)] px-1.5 py-[2px] text-[10.5px] text-[color:var(--mx-c2ab8b)]">{r.formula}</span>
                      <span className="ml-auto truncate text-[11.5px] font-semibold" style={{ color: r.outcomeTone }}>{r.outcome}</span>
                    </div>
                  </>
                )}
              </Action>
            </motion.div>
          );
        })}
      </div>
    </Tray>
  );
}

export function PanelLabel({ children }: { children: React.ReactNode }) {
  return <Micro>{children}</Micro>;
}
