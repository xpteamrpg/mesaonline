import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Tray, cx } from "../mesaSkin/components/ui";
import { withBase } from "../../utils/assetUrl";
import { rollFormula } from "../../game/macros";
import { appendRoll } from "../../game/vttBridge";
import type { DiceResolution } from "../../game/types";

/** Mesinha de rolagem aberta pelo d20 da barra esquerda: dado, modificador e histórico recente. */
const DICE: { label: string; faces: number }[] = [
  { label: "D20", faces: 20 }, { label: "D12", faces: 12 }, { label: "D10", faces: 10 }, { label: "D8", faces: 8 },
  { label: "D6", faces: 6 }, { label: "D4", faces: 4 }, { label: "D3", faces: 3 }, { label: "D%", faces: 100 },
];
const DELTAS = [-5, -2, -1, 1, 2, 5];
/** Duração do giro do dado antes de mostrar o número. */
const ROLL_MS = 900;
/** Imagem do dado no modo Expandido: o d20 é o mesmo cristal do orbe da barra; os outros seguem o mesmo estilo (d3 usa o cubo). Sem imagem no D%. */
const DIE_IMAGE: Record<number, string> = {
  20: withBase("/ui/expandido/d20-cristal.webp"), 12: withBase("/ui/expandido/dado-d12.webp"), 10: withBase("/ui/expandido/dado-d10.webp"), 8: withBase("/ui/expandido/dado-d8.webp"),
  6: withBase("/ui/expandido/dado-d6.webp"),
};

/** Contorno e facetas de cada dado (viewBox 64): d4 tetraedro, d6 cubo, d8 octaedro, d10 trapezoedro, d12 dodecaedro, d20 icosaedro. */
const DIE_SHAPES: Record<number, { body: string[]; core?: string; lines: string; textY: number }> = {
  4: { body: ["M32 5 L59 53 L5 53 Z"], lines: "M32 5 L32 53 M32 5 L15 40 L59 53 M32 5 L49 40 L5 53", textY: 44 },
  6: { body: ["M32 5 L57 19 V45 L32 59 L7 45 V19 Z"], lines: "M7 19 L32 33 L57 19 M32 33 V59", textY: 43 },
  8: { body: ["M32 4 L58 32 L32 60 L6 32 Z"], lines: "M6 32 H58 M32 4 L20 32 L32 60 M32 4 L44 32 L32 60", textY: 38 },
  10: { body: ["M32 4 L57 27 L32 60 L7 27 Z"], lines: "M7 27 L32 34 L57 27 M32 4 L32 34 M32 34 L32 60", textY: 37 },
  12: { body: ["M32 4 L59 24 L49 56 L15 56 L5 24 Z"], core: "M32 18 L47 29 L42 46 L22 46 L17 29 Z", lines: "M32 4 L32 18 M59 24 L47 29 M49 56 L42 46 M15 56 L22 46 M5 24 L17 29", textY: 37 },
  20: { body: ["M32 4 L58 19 V45 L32 60 L6 45 V19 Z"], core: "M32 4 L46 32 L32 60 L18 32 Z", lines: "M6 19 L32 32 L58 19 M32 32 V60", textY: 38 },
  3: { body: ["M32 5 L59 53 L5 53 Z"], lines: "M32 35 L32 5 M32 35 L59 53 M32 35 L5 53", textY: 47 },
  100: { body: ["M22 5 L40 21 L22 49 L4 21 Z", "M42 14 L60 30 L42 58 L24 30 Z"], lines: "M4 21 L22 27 L40 21 M24 30 L42 36 L60 30", textY: 44 },
};

/** Dado vivo em vermelho, com a forma do dado escolhido e o número no centro. */
function DieShape({ faces, label }: { faces: number; label: string | number }) {
  const shape = DIE_SHAPES[faces] ?? DIE_SHAPES[20];
  const text = String(label);
  return (
    <>
      <defs>
        <linearGradient id="dice-face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff4b4f" /><stop offset="1" stopColor="#8d0f16" /></linearGradient>
        <linearGradient id="dice-core" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e3262f" /><stop offset="1" stopColor="#5e0b10" /></linearGradient>
      </defs>
      {shape.body.map((d) => <path key={d} d={d} fill="url(#dice-face)" stroke="#f2b9a4" strokeWidth="1.3" strokeLinejoin="round" />)}
      {shape.core && <path d={shape.core} fill="url(#dice-core)" stroke="#f2b9a4" strokeWidth="0.9" strokeLinejoin="round" />}
      <path d={shape.lines} stroke="#f2b9a4" strokeWidth="0.8" fill="none" opacity="0.75" strokeLinejoin="round" />
      <text x="32" y={shape.textY} textAnchor="middle" fontSize={text.length > 2 ? 11 : text.length === 2 ? 14 : 16} fontWeight="700" fill="var(--mx-fff3d9)" fontFamily="Cinzel, serif">{text}</text>
    </>
  );
}

/** Lê o campo de modificador: aceita "+44", "-3", "7" e ignora o resto. */
export function parseModifier(text: string): number {
  const value = Number(String(text).replace(/\s/g, "").replace(/^\+/, ""));
  return Number.isFinite(value) ? Math.max(-999, Math.min(999, Math.trunc(value))) : 0;
}

export function formatRollTime(timestamp: number): string {
  const date = new Date(timestamp);
  const two = (value: number) => String(value).padStart(2, "0");
  return `${two(date.getDate())}/${two(date.getMonth() + 1)} ${two(date.getHours())}:${two(date.getMinutes())}`;
}

/** Miniatura do dado (contorno dourado sobre fundo escuro), usada nos botões e no histórico. */
function MiniDie({ faces, size = 22 }: { faces: number; size?: number }) {
  const shape = DIE_SHAPES[faces] ?? DIE_SHAPES[20];
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" className="shrink-0">
      {shape.body.map((d) => <path key={d} d={d} fill="#2b1d12" stroke="#f2d68f" strokeWidth="3" strokeLinejoin="round" />)}
      <path d={shape.lines} stroke="#f2d68f" strokeWidth="2.2" fill="none" opacity="0.7" strokeLinejoin="round" />
    </svg>
  );
}

/** Separa a fórmula em grupos de dados e distribui os números rolados na ordem; sem casar, devolve um grupo só, sem forma. */
export function rollGroups(formula: string, rolls: number[]): { faces: number | null; count: number; values: number[] }[] {
  const terms = [...formula.matchAll(/(\d+)d(\d+)/gi)].map((m) => ({ count: Number(m[1]), faces: Number(m[2]) }));
  if (!terms.length || terms.reduce((n, t) => n + t.count, 0) !== rolls.length) return rolls.length ? [{ faces: null, count: rolls.length, values: rolls }] : [];
  let at = 0;
  return terms.map((t) => { const values = rolls.slice(at, at + t.count); at += t.count; return { faces: t.faces, count: t.count, values }; });
}

function Brackets({ values }: { values: number[] }) {
  return <span className="num font-semibold text-[color:var(--mx-f4e8ce)]">{values.map((v, i) => <span key={i} className="mr-1">[{v}]</span>)}</span>;
}

/** Um dado grande: a imagem de cristal (Expandido) ou o desenho em SVG, com o número em cima quando já rolou. */
function DieFace({ faces, size, value, spinning, tilt, dim }: { faces: number; size: number; value?: number; spinning?: boolean; tilt?: { x: number; y: number; z: number }; dim?: boolean }) {
  const image = DIE_IMAGE[faces];
  const t = tilt ?? { x: 0, y: 0, z: 0 };
  return (
    <motion.div
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size, transformPerspective: 520, opacity: dim ? 0.45 : 1 }}
      initial={false}
      animate={spinning
        ? { rotateX: [0, 540, 1080 + t.x], rotateY: [0, 720, 1440 + t.y], rotateZ: [0, 200, 360 + t.z], scale: [0.85, 1.18, 1] }
        : { rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1 }}
      transition={{ duration: ROLL_MS / 1000, ease: [0.2, 0.7, 0.3, 1] }}
      data-die-face={faces}
    >
      {image && <img className="mx-exp" src={image} alt="" draggable={false} style={{ width: size, height: size, objectFit: "contain", filter: "drop-shadow(0 0 8px rgba(255,60,40,.6))" }} />}
      <svg className={image ? "mx-min" : undefined} viewBox="0 0 64 64" width={size} height={size} style={{ filter: "drop-shadow(0 0 8px rgba(232,44,54,0.7))" }} aria-hidden="true">
        <DieShape faces={faces} label={value ?? (faces === 100 ? "%" : faces)} />
      </svg>
      {image && value !== undefined && (
        <span className="mx-exp num font-display pointer-events-none absolute inset-0 place-items-center text-center font-bold text-[#fff0c4]" style={{ fontSize: Math.round(size * 0.36), textShadow: "0 1px 3px #000, 0 0 8px #000, 0 0 12px rgba(255,170,60,.8)", gridTemplateColumns: "1fr" }}>
          <span className="grid h-full w-full place-items-center">{value}</span>
        </span>
      )}
    </motion.div>
  );
}

/** Miniatura do botão de dado: o cristal no Expandido (d20 a d6); d4, d3 e D% levam só o número. */
function DieThumb({ faces }: { faces: number }) {
  const image = DIE_IMAGE[faces];
  return (
    <>
      <span className={image ? "mx-min grid place-items-center" : "hidden"}><MiniDie faces={faces} size={22} /></span>
      {image
        ? <img className="mx-exp" src={image} alt="" draggable={false} style={{ width: 28, height: 28, objectFit: "contain" }} />
        : null}
      {!image && <span className="num font-display text-[13px] font-bold text-[#f2d68f]">{faces === 100 ? "%" : faces}</span>}
    </>
  );
}

type LastRoll = { total: number; groups: { faces: number | null; count: number; values: number[] }[]; mod: number };
type ShownDie = { faces: number; value?: number };

export default function DicePanel({ rolls, actor, onClose }: { rolls: DiceResolution[]; actor: string; onClose: () => void }) {
  /** Quantos dados de cada tipo entram na rolagem (clique soma, botão direito tira). */
  const [pool, setPool] = useState<Record<number, number>>({ 20: 1 });
  const [modifier, setModifier] = useState("0");
  const [last, setLast] = useState<LastRoll | null>(null);
  const [spin, setSpin] = useState(0);
  const [rolling, setRolling] = useState(false);
  /** Inclinação final de cada rolagem: o dado nunca para na mesma posição. */
  const [tilt, setTilt] = useState({ x: 0, y: 0, z: 0 });
  const [flickers, setFlickers] = useState<number[]>([]);
  /** true logo depois de rolar (mostra os dados rolados); mexer nos dados volta a mostrar os escolhidos. */
  const [showLast, setShowLast] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const picked = DICE.filter((die) => (pool[die.faces] ?? 0) > 0);
  const poolDice: ShownDie[] = picked.flatMap((die) => Array.from({ length: pool[die.faces] ?? 0 }, () => ({ faces: die.faces })));
  const lastDice: ShownDie[] = last ? last.groups.flatMap((group) => group.values.map((value) => ({ faces: group.faces ?? 20, value }))) : [];
  const shownDice = showLast && last ? lastDice : poolDice;
  // Durante o giro cada número troca depressa, como dado rolando.
  useEffect(() => {
    if (!rolling) return;
    const id = window.setInterval(() => setFlickers(lastDice.map((die) => 1 + Math.floor(Math.random() * Math.max(2, die.faces)))), 70);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolling, spin]);

  const mod = parseModifier(modifier);
  const modText = mod ? `${mod > 0 ? "+" : ""}${mod}` : "";
  const poolText = picked.map((die) => `${pool[die.faces]}d${die.faces}`).join("+");

  function add(faces: number, delta: number) {
    setShowLast(false);
    setPool((current) => ({ ...current, [faces]: Math.max(0, Math.min(20, (current[faces] ?? 0) + delta)) }));
  }

  function roll() {
    if (!picked.length) return;
    const groups = picked.map((die) => {
      const part = rollFormula(`${pool[die.faces]}d${die.faces}`)!;
      return { faces: die.faces, count: part.count, values: part.rolls };
    });
    const all = groups.flatMap((group) => group.values);
    const total = all.reduce((sum, value) => sum + value, 0) + mod;
    const formula = `${poolText}${modText}`;
    const single20 = picked.length === 1 && picked[0].faces === 20 && pool[20] === 1;
    const natural = single20 ? all[0] : undefined;
    appendRoll({
      id: `mesa-dice-${crypto.randomUUID()}`,
      actor,
      target: "—",
      action: "Rolagem",
      kind: "system",
      natural,
      modifier: mod,
      total,
      formula,
      rolls: all,
      outcome: natural === 20 ? "Crítico" : natural === 1 ? "Falha crítica" : "Rolagem",
      success: natural !== 1,
      timestamp: Date.now(),
    });
    setLast({ total, groups, mod });
    setShowLast(true);
    setFlickers(all.map(() => 1));
    setSpin((value) => value + 1);
    setTilt({ x: Math.round(Math.random() * 50 - 25), y: Math.round(Math.random() * 50 - 25), z: Math.round(Math.random() * 90 - 45) });
    // O dado gira e só depois o número aparece.
    setRolling(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setRolling(false), ROLL_MS);
  }

  return (
    <div className="shrink-0 p-2.5 pr-0 lg:w-[clamp(230px,15vw,290px)]" data-dice-panel>
      <Tray className="flex h-full min-h-[320px] flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#7a5227]/50 px-3 py-1.5">
          <h2 className="dice-title font-display text-[14px] font-bold tracking-[0.08em]">ROLAGEM DE DADOS</h2>
          <button type="button" onClick={onClose} aria-label="Fechar rolagem de dados" className="grid h-6 w-6 place-items-center rounded-[7px] text-[color:var(--mx-c9b295)] transition-colors hover:bg-[color:var(--mx-2a1a12)] hover:text-[color:var(--mx-f0d9a5)]">
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto scroll-tray p-2">
          {/* dado animado com o último resultado */}
          <div className="grid place-items-center rounded-[10px] border border-[#7a5227]/45 bg-[color:var(--mx-120c09)] py-1.5">
            <div className="flex min-h-[76px] flex-wrap items-center justify-center gap-1.5 px-1" data-dice-stage>
              {!shownDice.length && <DieFace faces={20} size={72} dim />}
              {shownDice.slice(0, 8).map((die, index) => (
                <DieFace
                  key={`${spin}-${index}-${die.faces}`}
                  faces={die.faces}
                  size={shownDice.length <= 1 ? 72 : shownDice.length <= 3 ? 56 : shownDice.length <= 6 ? 44 : 36}
                  value={showLast ? (rolling ? flickers[index] ?? 1 : die.value) : undefined}
                  spinning={showLast && spin > 0}
                  tilt={tilt}
                />
              ))}
              {shownDice.length > 8 && <span className="num text-[12px] text-[#a6947c]">+{shownDice.length - 8}</span>}
            </div>
            <div className="dice-result num font-display text-[28px] font-bold leading-tight" data-dice-result>{rolling ? "…" : last ? last.total : "—"}</div>
            <div className="min-h-[16px] px-1 text-center text-[12px] text-[#a6947c]" data-dice-detail>
              {rolling ? "Rolando…" : last
                ? <>{last.groups.map((group, i) => <Brackets key={i} values={group.values} />)}{last.mod ? <span className="num">{last.mod > 0 ? "+" : ""}{last.mod}</span> : null}</>
                : "Escolha os dados e role"}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {DICE.map((die) => {
              const n = pool[die.faces] ?? 0;
              return (
                <button
                  key={die.label}
                  type="button"
                  onClick={() => add(die.faces, 1)}
                  onContextMenu={(event) => { event.preventDefault(); add(die.faces, -1); }}
                  aria-label={`${die.label}${n ? ` (${n})` : ""}`}
                  title="Clique soma um dado; botão direito tira"
                  data-die-button={die.faces}
                  className={cx(
                    "dice-pick relative mx-auto grid h-9 w-9 place-items-center rounded-full border transition-colors",
                    n ? "border-[#e0574f]/80 bg-[#5a1418]/70 shadow-[0_0_10px_rgba(224,87,79,0.3)]" : "border-[#7a5227]/55 bg-[color:var(--mx-150e0a)] hover:border-[#d9a94c]/80",
                  )}
                >
                  <DieThumb faces={die.faces} />
                  {n > 0 && <span className="num absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#c2202b] px-1 text-[10px] font-bold text-white" data-die-count>{n}</span>}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1">
            {DELTAS.map((delta) => (
              <button
                key={delta}
                type="button"
                onClick={() => setModifier(String(mod + delta))}
                className="h-7 min-w-0 flex-1 rounded-full border border-[#7a5227]/55 bg-[color:var(--mx-150e0a)] text-[11px] font-semibold text-[color:var(--mx-e3d3b6)] transition-colors hover:border-[#d9a94c]/80"
              >
                {delta > 0 ? `+${delta}` : delta}
              </button>
            ))}
            <input
              value={modifier}
              onChange={(event) => setModifier(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              inputMode="numeric"
              aria-label="Modificador"
              className="num h-7 w-[44px] shrink-0 rounded-full border border-[#7a5227]/55 bg-[color:var(--mx-100b09)] text-center text-[12px] font-semibold text-[color:var(--mx-f4e8ce)] outline-none focus:border-[#d9a94c]"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => { setPool({}); setModifier("0"); setShowLast(false); }}
              aria-label="Limpar dados e modificador"
              title="Limpar"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#7a5227]/55 bg-[color:var(--mx-150e0a)] text-[color:var(--mx-c9b295)] hover:border-[#d9a94c]/80"
            >
              <X size={14} />
            </button>
            <button
              type="button"
              onClick={roll}
              disabled={!picked.length}
              data-dice-roll
              className="dice-roll font-display flex h-8 min-w-0 flex-1 items-center justify-center rounded-full border border-[#e0574f]/80 px-2 text-[13px] font-bold tracking-[0.08em] text-[color:var(--mx-ffe9d6)] transition-transform hover:-translate-y-0.5 disabled:opacity-50"
              style={{ background: "linear-gradient(180deg,rgba(194,32,43,0.9),rgba(120,16,22,0.85))", boxShadow: "0 0 12px rgba(224,87,79,0.28), inset 0 1px 0 rgba(255,180,160,0.22)" }}
            >
              <span className="truncate">ROLAR{poolText ? ` ${poolText}${modText}` : ""}</span>
            </button>
          </div>

          <div>
            <div className="micro mb-1 text-[#c9a25e]">HISTÓRICO</div>
            <div className="rounded-[10px] border border-[#7a5227]/45 bg-[color:var(--mx-120c09)] px-1.5 py-0.5">
              {rolls.length === 0 && <div className="px-1 py-3 text-center text-[12px] text-[#a6947c]">Nenhuma rolagem ainda.</div>}
              {rolls.slice(0, 7).map((entry) => {
                const groups = rollGroups(entry.formula, entry.rolls);
                const extra = /^Rolagem/.test(entry.action) ? "" : entry.action;
                return (
                  <div key={entry.id} className="flex items-center gap-2 border-b border-[#7a5227]/25 px-1 py-1.5 text-[12px] last:border-b-0" data-dice-entry>
                    <div className="min-w-0 flex-1">
                      {extra && <div className="truncate text-[10.5px] text-[#a6947c]" title={extra}>{extra}</div>}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        {groups.map((group, i) => (
                          <span key={i} className="inline-flex items-center gap-1">
                            {group.faces && <MiniDie faces={group.faces} size={16} />}
                            <Brackets values={group.values} />
                          </span>
                        ))}
                        {entry.modifier ? <span className="num text-[color:var(--mx-ddd0b6)]">{entry.modifier > 0 ? "+" : ""}{entry.modifier}</span> : null}
                      </div>
                      <div className="num truncate text-[10px] text-[#a6947c]">{entry.formula} · {formatRollTime(entry.timestamp)}</div>
                    </div>
                    <span className="dice-total num shrink-0 text-right text-[20px] font-bold leading-none" data-dice-total>{entry.total}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Tray>
    </div>
  );
}
