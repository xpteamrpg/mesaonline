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
  6: withBase("/ui/expandido/dado-d6.webp"), 4: withBase("/ui/expandido/dado-d4.webp"), 3: withBase("/ui/expandido/dado-d3.webp"),
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

export default function DicePanel({ rolls, actor, onClose }: { rolls: DiceResolution[]; actor: string; onClose: () => void }) {
  const [faces, setFaces] = useState(20);
  const [modifier, setModifier] = useState("0");
  const [last, setLast] = useState<{ total: number; label: string; faces: number } | null>(null);
  const [spin, setSpin] = useState(0);
  const [rolling, setRolling] = useState(false);
  /** Inclinação final de cada rolagem: o dado nunca para na mesma posição. */
  const [tilt, setTilt] = useState({ x: 0, y: 0, z: 0 });
  const [flicker, setFlicker] = useState(1);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // Durante o giro o número troca depressa, como dado rolando.
  useEffect(() => {
    if (!rolling) return;
    const id = window.setInterval(() => setFlicker(1 + Math.floor(Math.random() * Math.max(2, faces === 100 ? 100 : faces))), 70);
    return () => window.clearInterval(id);
  }, [rolling, faces]);

  const mod = parseModifier(modifier);
  const faceName = faces === 100 ? "D%" : `D${faces}`;

  function roll() {
    const formula = `1d${faces}${mod ? `${mod > 0 ? "+" : ""}${mod}` : ""}`;
    const result = rollFormula(formula);
    if (!result) return;
    const natural = result.rolls[0];
    appendRoll({
      id: `mesa-dice-${crypto.randomUUID()}`,
      actor,
      target: "—",
      action: `Rolagem ${faceName}`,
      kind: "system",
      natural: faces === 20 ? natural : undefined,
      modifier: mod,
      total: result.total,
      formula,
      rolls: result.rolls,
      outcome: faces === 20 && natural === 20 ? "Crítico" : faces === 20 && natural === 1 ? "Falha crítica" : "Rolagem",
      success: !(faces === 20 && natural === 1),
      timestamp: Date.now(),
    });
    setLast({ total: result.total, faces, label: `Rolagem de ${faceName}${mod ? ` ${mod > 0 ? "+" : ""}${mod}` : ""}` });
    setSpin((value) => value + 1);
    setTilt({ x: Math.round(Math.random() * 50 - 25), y: Math.round(Math.random() * 50 - 25), z: Math.round(Math.random() * 90 - 45) });
    // O dado gira e só depois o número aparece.
    setRolling(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setRolling(false), ROLL_MS);
  }

  return (
    <div className="shrink-0 p-2.5 pr-0 lg:w-[clamp(290px,19vw,370px)]" data-dice-panel>
      <Tray className="flex h-full min-h-[360px] flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#7a5227]/50 px-3 py-2.5">
          <h2 className="dice-title font-display text-[17px] font-bold tracking-[0.08em]">ROLAGEM DE DADOS</h2>
          <button type="button" onClick={onClose} aria-label="Fechar rolagem de dados" className="grid h-7 w-7 place-items-center rounded-[7px] text-[color:var(--mx-c9b295)] transition-colors hover:bg-[color:var(--mx-2a1a12)] hover:text-[color:var(--mx-f0d9a5)]">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto scroll-tray p-3">
          {/* dado animado com o último resultado */}
          <div className="grid place-items-center rounded-[10px] border border-[#7a5227]/45 bg-[color:var(--mx-120c09)] py-3">
            {DIE_IMAGE[faces] && (
              <motion.img
                key={`img-${spin}-${faces}`}
                className="mx-exp mx-die"
                src={DIE_IMAGE[faces]}
                alt=""
                draggable={false}
                style={{ transformPerspective: 520 }}
                initial={false}
                animate={spin
                  ? { rotateX: [0, 540, 1080 + tilt.x], rotateY: [0, 720, 1440 + tilt.y], rotateZ: [0, 200, 360 + tilt.z], scale: [0.85, 1.18, 1] }
                  : { rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1 }}
                transition={{ duration: ROLL_MS / 1000, ease: [0.2, 0.7, 0.3, 1] }}
              />
            )}
            <motion.svg
              key={spin}
              className={DIE_IMAGE[faces] ? "mx-min" : undefined}
              viewBox="0 0 64 64"
              width="92"
              height="92"
              initial={spin ? { rotate: -200, scale: 0.7 } : false}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              style={{ filter: "drop-shadow(0 0 12px rgba(232,44,54,0.75))" }}
              aria-hidden="true"
            >
              <DieShape faces={faces} label={last && last.faces === faces ? last.total : faces === 100 ? "%" : faces} />
            </motion.svg>
            <div className="dice-result num mt-1 font-display text-[34px] font-bold" data-dice-result>{rolling ? flicker : last ? last.total : "—"}</div>
            <div className="text-[12px] text-[#a6947c]">{rolling ? "Rolando…" : last ? last.label : "Escolha o dado e role"}</div>
          </div>

          <div>
            <div className="micro mb-1.5 text-[#c9a25e]">DADOS DISPONÍVEIS</div>
            <div className="grid grid-cols-4 gap-1.5">
              {DICE.map((die) => (
                <button
                  key={die.label}
                  type="button"
                  onClick={() => setFaces(die.faces)}
                  aria-pressed={faces === die.faces}
                  className={cx(
                    "dice-pick font-display h-11 rounded-[9px] border text-[14px] font-bold transition-colors",
                    faces === die.faces
                      ? "border-[#e0574f]/80 bg-[#5a1418]/70 text-[color:var(--mx-ffe9d6)] shadow-[0_0_12px_rgba(224,87,79,0.3)]"
                      : "border-[#7a5227]/55 bg-[color:var(--mx-150e0a)] text-[color:var(--mx-e3d3b6)] hover:border-[#d9a94c]/80 hover:bg-[color:var(--mx-221609)]",
                  )}
                >
                  {die.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="micro mb-1.5 text-[#c9a25e]">MODIFICADOR</div>
            <div className="flex items-center gap-1.5">
              {DELTAS.map((delta) => (
                <button
                  key={delta}
                  type="button"
                  onClick={() => setModifier(String(mod + delta))}
                  className="h-9 min-w-0 flex-1 rounded-[8px] border border-[#7a5227]/55 bg-[color:var(--mx-150e0a)] text-[12.5px] font-semibold text-[color:var(--mx-e3d3b6)] transition-colors hover:border-[#d9a94c]/80 hover:bg-[color:var(--mx-221609)]"
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
                className="num h-9 w-[58px] shrink-0 rounded-[8px] border border-[#7a5227]/55 bg-[color:var(--mx-100b09)] text-center text-[14px] font-semibold text-[color:var(--mx-f4e8ce)] outline-none focus:border-[#d9a94c]"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={roll}
            className="dice-roll font-display flex h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-[#e0574f]/80 text-[15px] font-bold tracking-[0.1em] text-[color:var(--mx-ffe9d6)] transition-transform hover:-translate-y-0.5"
            style={{ background: "linear-gradient(180deg,rgba(194,32,43,0.9),rgba(120,16,22,0.85))", boxShadow: "0 0 16px rgba(224,87,79,0.28), inset 0 1px 0 rgba(255,180,160,0.22)" }}
          >
            ROLAR {faceName}{mod ? ` ${mod > 0 ? "+" : ""}${mod}` : ""}
          </button>

          <div>
            <div className="micro mb-1.5 text-[#c9a25e]">HISTÓRICO RECENTE</div>
            <div className="rounded-[10px] border border-[#7a5227]/45 bg-[color:var(--mx-120c09)] px-2 py-1">
              {rolls.length === 0 && <div className="px-1 py-3 text-center text-[12px] text-[#a6947c]">Nenhuma rolagem ainda.</div>}
              {rolls.slice(0, 7).map((entry) => (
                <div key={entry.id} className="flex items-center gap-2 border-b border-[#7a5227]/25 px-1 py-1.5 text-[12.5px] last:border-b-0">
                  <span className="min-w-0 flex-1 truncate text-[color:var(--mx-ddd0b6)]" title={`${entry.action} · ${entry.formula}`}>{entry.kind === "system" || entry.kind === "save" ? `${entry.action} · ` : ""}{entry.formula}</span>
                  <span className="dice-total num w-9 shrink-0 text-right text-[15px] font-bold">{entry.total}</span>
                  <span className="num w-[78px] shrink-0 text-right text-[10.5px] text-[#a6947c]">{formatRollTime(entry.timestamp)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Tray>
    </div>
  );
}
