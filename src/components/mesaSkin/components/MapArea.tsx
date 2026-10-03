import { useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { motion } from "framer-motion";
import { Crosshair, Maximize2, Minus, Plus } from "lucide-react";
import { IMG, imgFallback, type ImgKey } from "../assets";
import type { View } from "../data";
import { useSkinRuntime, type SkinMapToken } from "../runtime";
import { sendCameraCommand } from "../../mesa/mapStageControl";
import { Action, cx } from "./ui";

const BADGE_TONE = { danger: "#e3564c", warn: "#e0b25c", control: "#c07be0", buff: "#67c957" } as const;

export function Token({ token, mode, index, onSelect, onMenu }: { token: SkinMapToken; mode: View; index: number; onSelect: () => void; onMenu?: (x: number, y: number) => void }) {
  const [hover, setHover] = useState(false);
  const size = token.footprint && token.footprint > 1 ? token.footprint * 52 - 6 : mode === "combat" ? 52 : 46;
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      data-token-id={token.id}
      style={{ left: `${token.x}%`, top: `${token.y}%`, pointerEvents: "auto" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={(event) => { event.stopPropagation(); onSelect(); }}
      onContextMenu={onMenu ? (event) => { event.preventDefault(); event.stopPropagation(); onMenu(event.clientX, event.clientY); } : undefined}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(); } }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.55 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15 + index * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative"
      >
        {token.active && (
          <>
            <span
              className="animate-pulsering absolute -inset-2 rounded-full border-2 border-[#f2d68f]"
              aria-hidden="true"
            />
            <svg
              viewBox="0 0 24 20"
              width="26"
              height="22"
              className="animate-bob absolute -top-8 left-1/2 -translate-x-1/2 drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]"
              aria-hidden="true"
            >
              <path d="M12 20 L2 4 C2 1 20 1 20 4 Z" fill="#f2c75c" stroke="#8c6522" strokeWidth="1" />
              <path d="M12 16 L6 6 C6 4 16 4 16 6 Z" fill="var(--mx-fff0c2)" opacity="0.6" />
            </svg>
          </>
        )}

        <div
          className="relative rounded-full transition-transform duration-200"
          style={{ transform: hover ? "scale(1.08)" : "scale(1)" }}
        >
          <img
            src={token.portraitUrl || IMG[token.portrait].src}
            onError={(e) => imgFallback(e, token.portrait)}
            alt={token.name}
            draggable={false}
            width={size}
            height={size}
            className="rounded-full object-cover"
            style={{
              width: size,
              height: size,
              border: `2px solid ${token.active ? "#f2d68f" : token.ring}`,
              boxShadow: `0 0 0 1px rgba(0,0,0,0.75), 0 6px 18px -6px rgba(0,0,0,0.95), 0 0 ${
                token.active ? 22 : 12
              }px ${token.active ? "rgba(242,198,92,0.5)" : token.ring + "55"}`,
            }}
          />
          {mode === "combat" && (
            <div className="absolute -bottom-[7px] left-1/2 h-[5px] w-[42px] -translate-x-1/2 overflow-hidden rounded-full bg-[color:var(--mx-070404)] ring-1 ring-black/80">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(token.hp / token.hpMax) * 100}%`,
                  background:
                    token.ring === "#c2202b"
                      ? "linear-gradient(180deg,#e3564c,#9d1c1c)"
                      : "linear-gradient(180deg,#67c957,#3d8c2c)",
                }}
              />
            </div>
          )}
        </div>

        {token.pm !== undefined && token.pmMax !== undefined && (
          <div className="pointer-events-none absolute top-1/2 left-full ml-[3px] flex h-[70%] -translate-y-1/2 gap-[2px]" data-token-stats title={`PV ${token.hp}/${token.hpMax} · PM ${token.pm}/${token.pmMax}`}>
            {([[token.hp, token.hpMax, "#67c957"], [token.pm, token.pmMax, "#4aa3e0"]] as const).map(([value, max, color], i) => (
              <div key={i} className="relative h-full w-[4px] overflow-hidden rounded-full bg-[color:var(--mx-070404)] ring-1 ring-black/80">
                <div className="absolute inset-x-0 bottom-0 rounded-full" style={{ height: `${max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0}%`, background: color }} />
              </div>
            ))}
          </div>
        )}

        {token.rider && (
          <img
            src={token.rider.portraitUrl || IMG[token.rider.portrait].src}
            onError={(e) => imgFallback(e, token.rider!.portrait)}
            alt={`${token.rider.name} (montado)`}
            title={`${token.rider.name} (montado)`}
            draggable={false}
            className="pointer-events-none absolute -right-1 -bottom-1 rounded-full object-cover"
            style={{ width: size * 0.5, height: size * 0.5, border: "2px solid #f2d68f", boxShadow: "0 0 0 1px rgba(0,0,0,0.8), 0 3px 8px rgba(0,0,0,0.8)" }}
          />
        )}

        {!!token.badges?.length && (
          <div className="pointer-events-none absolute -top-1 -right-2 flex max-w-[64px] flex-wrap justify-end gap-[2px]">
            {token.badges.map((badge) => (
              <span
                key={badge.key}
                title={badge.label}
                className="grid h-[15px] w-[15px] place-items-center rounded-full bg-[color:var(--mx-100b09)] text-[9px] leading-none font-bold ring-1 ring-black/80"
                style={{ color: BADGE_TONE[badge.tone], boxShadow: `0 0 6px ${BADGE_TONE[badge.tone]}88` }}
              >
                {badge.glyph}
              </span>
            ))}
            {!!token.hiddenBadges && <span className="num text-[9px] font-bold text-[color:var(--mx-f2e8d4)]">+{token.hiddenBadges}</span>}
          </div>
        )}

        <div
          className={cx(
            "pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 transition-all duration-200",
            hover ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
          )}
        >
          <div className="rounded-[7px] border border-[#d9a94c]/60 bg-[color:var(--mx-100b09)]/95 px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap text-[color:var(--mx-f2e8d4)] shadow-[0_10px_24px_-10px_rgba(0,0,0,0.9)]">
            {token.name}
            {token.controller && <span className="ml-1.5 text-[9px] font-normal text-[#e0b25c]">· {token.controller}</span>}
          </div>
        </div>
        {token.controller && (
          <div className="pointer-events-none absolute -bottom-[19px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[5px] bg-[color:var(--mx-100b09)]/85 px-1.5 py-[1px] text-[9px] leading-tight font-semibold text-[#e0b25c] ring-1 ring-black/70" data-token-controller>
            {token.name}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function ZoomCluster({ mode, links, onAction }: { mode: View; links: Record<string, string>; onAction: (id: string) => void }) {
  const items = [
    { id: "zoomIn", icon: Plus, title: "Aproximar" },
    { id: "zoomOut", icon: Minus, title: "Afastar" },
    { id: mode === "combat" ? "centerMap" : "fullscreen", icon: mode === "combat" ? Crosshair : Maximize2, title: "Enquadrar" },
  ];
  return (
    <div
      className={cx(
        "absolute z-20 flex flex-col overflow-hidden rounded-[10px] border border-[#7a5227]/70 bg-[color:var(--mx-120c09)]/92 shadow-[0_16px_36px_-16px_rgba(0,0,0,0.95)] backdrop-blur-sm",
        mode === "combat" ? "top-4 right-4" : "right-4 bottom-4",
      )}
    >
      {items.map((it, i) => (
        <Action
          key={it.id}
          href={links[it.id]}
          onClick={() => onAction(it.id)}
          title={it.title}
          ariaLabel={it.title}
          className={cx(
            "grid h-10 w-10 place-items-center text-[color:var(--mx-e0cdb0)] transition-colors duration-200 hover:bg-[color:var(--mx-2b1a10)] hover:text-[#f2d68f]",
            i > 0 && "border-t border-[#7a5227]/50",
          )}
        >
          <it.icon size={18} strokeWidth={1.8} />
        </Action>
      ))}
    </div>
  );
}

function ScaleBar({ labels, width = 230 }: { labels: string[]; width?: number }) {
  return (
    <div className="relative" style={{ width }}>
      <div className="h-[7px] border-x border-t border-[color:var(--mx-e6d3ae)]/70" />
      <div className="flex justify-between">
        {labels.map((l) => (
          <div key={l} className="flex flex-col items-center">
            <div className="h-[6px] w-px bg-[color:var(--mx-e6d3ae)]/70" />
            <span className="num mt-0.5 text-[10px] font-semibold text-[color:var(--mx-e6d3ae)]">{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompassRose({ mode }: { mode: View }) {
  return (
    <svg viewBox="0 0 100 100" width={mode === "combat" ? 62 : 70} height={mode === "combat" ? 62 : 70} aria-hidden="true">
      <circle cx="50" cy="50" r="30" fill="rgba(var(--mxr-12-8-6),0.55)" stroke="#d9a94c" strokeWidth="1.2" opacity="0.85" />
      <circle cx="50" cy="50" r="38" fill="none" stroke="#d9a94c" strokeWidth="0.7" opacity="0.4" />
      <path d="M50 14 L56 50 L50 86 L44 50 Z" fill="var(--mx-e6d3ae)" opacity="0.9" />
      <path d="M50 14 L56 50 L50 50 Z" fill="#8c6522" />
      <path d="M14 50 L50 44 L86 50 L50 56 Z" fill="#d9a94c" opacity="0.55" />
      <text x="50" y="10" textAnchor="middle" fontSize="11" fill="#f2d68f" fontFamily="Cinzel, serif">
        N
      </text>
      {mode === "combat" && (
        <>
          <text x="92" y="54" textAnchor="middle" fontSize="10" fill="#d9a94c" fontFamily="Barlow, sans-serif">
            L
          </text>
          <text x="8" y="54" textAnchor="middle" fontSize="10" fill="#d9a94c" fontFamily="Barlow, sans-serif">
            O
          </text>
          <text x="50" y="98" textAnchor="middle" fontSize="10" fill="#d9a94c" fontFamily="Barlow, sans-serif">
            S
          </text>
        </>
      )}
    </svg>
  );
}

/** Isometric movement grid + marching destination path drawn by hand in SVG. */
function MovementGrid() {
  const cells = [
    { x: 380, y: 232 },
    { x: 452, y: 284 },
    { x: 524, y: 336 },
  ];
  const diamond = (x: number, y: number) => `${x - 76},${y} ${x},${y - 42} ${x + 76},${y} ${x},${y + 42}`;
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      viewBox="0 0 1000 620"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polygon points={diamond(cells[0].x, cells[0].y)} fill="rgba(96,176,244,0.26)" stroke="#7cc4ff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <polygon points={diamond(cells[1].x, cells[1].y)} fill="rgba(96,176,244,0.14)" stroke="#7cc4ff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <polygon points={diamond(cells[2].x, cells[2].y)} fill="rgba(96,176,244,0.2)" stroke="#7cc4ff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <path
        d={`M${cells[0].x} ${cells[0].y} L${cells[1].x} ${cells[1].y} L${cells[2].x} ${cells[2].y}`}
        fill="none"
        stroke="#bfe4ff"
        strokeWidth="3"
        strokeDasharray="12 9"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        className="animate-march"
      />
      <g stroke="#bfe4ff" strokeWidth="3.4" strokeLinecap="round" vectorEffect="non-scaling-stroke">
        <path d={`M${cells[2].x - 16} ${cells[2].y - 16} L${cells[2].x + 16} ${cells[2].y + 16}`} />
        <path d={`M${cells[2].x + 16} ${cells[2].y - 16} L${cells[2].x - 16} ${cells[2].y + 16}`} />
      </g>
    </svg>
  );
}

function Embers() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {Array.from({ length: 14 }).map((_, i) => {
        const style = {
          left: `${6 + ((i * 7.1) % 88)}%`,
          bottom: `${-4 + (i % 5) * 6}%`,
          width: 2 + (i % 3),
          height: 2 + (i % 3),
          background: "rgba(255,152,72,0.95)",
          boxShadow: "0 0 10px rgba(255,120,40,0.85)",
          animationDuration: `${7 + (i % 5) * 1.8}s`,
          animationDelay: `${i * 0.85}s`,
          "--dx": `${(i % 2 ? 1 : -1) * (14 + i * 3)}px`,
        } as CSSProperties;
        return <span key={i} className="animate-ember absolute rounded-full" style={style} />;
      })}
    </div>
  );
}

export function MapArea({
  mode,
  links,
  onAction,
  onMapPoint,
  children,
}: {
  mode: View;
  links: Record<string, string>;
  onAction: (id: string) => void;
  onMapPoint?: (point: { x: number; y: number }) => void;
  children?: React.ReactNode;
}) {
  const combat = mode === "combat";
  const runtime = useSkinRuntime();
  const tokens = combat ? runtime.mapTokens : runtime.mapTokens.map((token) => ({ ...token, active: false }));
  const mapKey: ImgKey = combat ? "mapBridge" : "mapHarbor";
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [mapScale, setMapScale] = useState(1.06);

  function handleMapAction(id: string) {
    // Com o palco real, a câmera (zoom/enquadrar) é do palco; a arte figurativa só escala sozinha.
    if (runtime.stage) {
      if (id === "zoomIn" || id === "zoomOut") sendCameraCommand(id);
      // Focar: no token selecionado (onde quer que esteja) ou, sem seleção, no mapa inteiro.
      if (id === "centerMap" || id === "fullscreen") sendCameraCommand("focus");
    } else {
      if (id === "zoomIn") setMapScale((value) => Math.min(1.46, value + .1));
      if (id === "zoomOut") setMapScale((value) => Math.max(1.06, value - .1));
      if (id === "centerMap") setMapScale(1.06);
      if (id === "fullscreen") void rootRef.current?.requestFullscreen?.().catch(() => undefined);
    }
    onAction(id);
  }

  function choosePoint(event: MouseEvent<HTMLDivElement>) {
    if (runtime.stage || !onMapPoint || (event.target as HTMLElement).closest("button,a,input")) return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    onMapPoint({
      x: Math.max(0, Math.min(.999, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(.999, (event.clientY - rect.top) / rect.height)),
    });
  }

  return (
    <div ref={rootRef} onClick={choosePoint} style={{ "--mesa-skin-map-zoom": mapScale } as CSSProperties} className="mx-stage-frame relative min-h-[320px] flex-1 overflow-hidden rounded-[14px] border border-[#7a5227]/75 shadow-[inset_0_0_0_1px_rgba(217,169,76,0.14),0_28px_60px_-28px_rgba(0,0,0,0.95)]">
      {runtime.stage ? (
        // Palco real do VTT: o mapa carregado pelo Mestre, com câmera, grade e camadas.
        <div className="absolute inset-0 overflow-hidden">{runtime.stage}</div>
      ) : (
        /* painted battle map */
        <img
          key={runtime.mapImage || mapKey}
          src={runtime.mapImage || IMG[mapKey].src}
          onError={(e) => imgFallback(e, mapKey)}
          alt={runtime.mapName}
          className="animate-drift absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* material overlays */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: combat
            ? "radial-gradient(120% 90% at 50% 20%,rgba(122,15,23,0.12),rgba(var(--mxr-8-4-4),0.72) 100%)"
            : "radial-gradient(120% 90% at 50% 30%,rgba(255,180,90,0.06),rgba(var(--mxr-8-6-5),0.62) 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: "inset 0 0 120px 30px rgba(0,0,0,0.65)" }}
      />

      {combat ? (
        <>
          <Embers />
        </>
      ) : runtime.stage ? null : (
        <>
          <div
            className="animate-torch pointer-events-none absolute top-[18%] left-[16%] h-52 w-52 rounded-full"
            style={{ background: "radial-gradient(circle,rgba(255,178,88,0.5),transparent 70%)", animationDelay: "0s" }}
          />
          <div
            className="animate-torch pointer-events-none absolute top-[52%] left-[42%] h-44 w-44 rounded-full"
            style={{ background: "radial-gradient(circle,rgba(255,178,88,0.42),transparent 70%)", animationDelay: "2.2s" }}
          />
          <div
            className="animate-torch pointer-events-none absolute top-[30%] left-[58%] h-40 w-40 rounded-full"
            style={{ background: "radial-gradient(circle,rgba(255,178,88,0.38),transparent 70%)", animationDelay: "4.1s" }}
          />
        </>
      )}

      {!runtime.stage && tokens.map((t, i) => (
        <Token key={t.id + mode} token={t} mode={mode} index={i} onSelect={() => onAction(`token:${t.id}`)} />
      ))}

      <ZoomCluster mode={mode} links={links} onAction={handleMapAction} />

      {/* compass + scale */}
      <div className="absolute bottom-4 left-4 z-20 flex items-end gap-4">
        <CompassRose mode={mode} />
        {runtime.showScale && (
          <div className="pb-1">
            <ScaleBar labels={runtime.scale?.labels ?? (combat ? ["0", "5"] : ["0", "10", "20", "30"])} width={combat ? 120 : 230} />
            <div className="micro mt-1 text-[color:var(--mx-e6d3ae)]/80">{runtime.scale?.text ?? (combat ? "5 m" : "30 m")}</div>
          </div>
        )}
      </div>

      {children}
    </div>
  );
}
