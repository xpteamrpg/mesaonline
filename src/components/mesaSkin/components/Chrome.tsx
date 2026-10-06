import { ChevronDown, CloudRain, Swords } from "lucide-react";
import { motion } from "framer-motion";
import { CHROME_ICONS, NAV, type View } from "../data";
import { useSkinRuntime } from "../runtime";
import { IMG, imgFallback } from "../assets";
import { ArmadaTitleArt } from "./ArmadaTitle";
import { OrbD20, TormentaMark } from "./ExpandedArt";
import { Action, StarBurst, cx } from "./ui";

export function TopBar({ links, onAction, view, onCombat }: { links: Record<string, string>; onAction: (id: string) => void; view: View; onCombat: () => void }) {
  const runtime = useSkinRuntime();
  return (
    <header className="mx-topbar relative z-30 flex h-[62px] shrink-0 items-center gap-4 border-b border-[#7a5227]/60 bg-[linear-gradient(180deg,var(--mx-1c0e0c)_0%,var(--mx-120a08)_55%,var(--mx-0c0706)_100%)] px-3 sm:px-5">
      <div
        className="pointer-events-none absolute inset-x-0 -bottom-px h-px"
        style={{ background: "linear-gradient(90deg,transparent,rgba(217,169,76,0.55),transparent)" }}
      />

      {/* wordmark */}
      <Action
        href={links.brand}
        onClick={() => onAction("brand")}
        className="group flex shrink-0 items-center gap-2.5"
        ariaLabel="Armada Nexus RPG"
      >
        <StarBurst size={36} className="mx-min transition-transform duration-500 group-hover:rotate-45" />
        <TormentaMark size={36} className="mx-exp" />
        <span
          className="mx-min font-display text-[19px] leading-none font-bold tracking-[0.03em] sm:text-[23px]"
          style={{
            backgroundImage: "linear-gradient(180deg,var(--mx-f9e9bd) 0%,#d9a94c 52%,#a67a2b 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            textShadow: "0 2px 10px rgba(0,0,0,0.6)",
          }}
        >
          ARMADA NEXUS RPG
        </span>
        <ArmadaTitleArt className="mx-exp h-[30px] w-auto sm:h-[38px]" />
      </Action>

      {/* campaign selector */}
      <Action
        href={links.scenario}
        onClick={() => onAction("scenario")}
        className="ml-1 hidden items-center gap-2.5 rounded-[10px] border border-[#7a5227]/70 bg-[color:var(--mx-150e0b)] py-1.5 pr-2.5 pl-1.5 transition-colors duration-200 hover:border-[#d9a94c]/70 hover:bg-[color:var(--mx-1e1410)] lg:flex"
      >
        <img
          src={runtime.playerPortraitUrl || IMG[runtime.playerPortrait].src}
          onError={(e) => imgFallback(e, runtime.playerPortrait)}
          alt=""
          className="h-[30px] w-[30px] rounded-[7px] object-cover ring-1 ring-[#d9a94c]/60"
        />
        <span className="text-[14px] font-semibold text-[color:var(--mx-f0e4cd)]">{runtime.campaign}</span>
        <ChevronDown size={15} className="text-[#c9a25e]" />
      </Action>

      <div className="hidden h-9 w-px bg-[#7a5227]/45 xl:block" />

      {/* current scene */}
      <div className="hidden min-w-0 flex-1 xl:block">
        <div className="micro text-[#c9a25e]/80">Cenário atual</div>
        <div className="truncate text-[15px] font-semibold text-[color:var(--mx-f2e8d4)]">{runtime.scene}</div>
      </div>

      {/* tools */}
      <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
        {/* Combate: entra no modo combate; durante o combate vira "Encerrar combate" */}
        {runtime.weather && (
          <span
            data-weather-chip
            tabIndex={0}
            title={["Clima: " + runtime.weather.label, ...runtime.weather.rules].join("\n")}
            className="mr-1 hidden cursor-help items-center gap-1.5 rounded-[9px] border border-[#7a5227]/70 px-2.5 py-1.5 text-[12px] font-semibold text-[color:var(--mx-c9b295)] sm:flex"
          >
            <CloudRain size={15} strokeWidth={1.7} />
            <span>{runtime.weather.label}</span>
          </span>
        )}
        <Action
          href={links.combat}
          onClick={onCombat}
          ariaLabel={view === "combat" ? "Encerrar combate" : "Combate"}
          className="mr-1 flex h-9 items-center gap-2 rounded-[9px] border border-[#e0574f]/80 px-3.5 text-[13px] font-semibold text-[color:var(--mx-ffe9d6)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#f2a497]"
          style={{
            background: "linear-gradient(180deg,rgba(194,32,43,0.85),rgba(120,16,22,0.78))",
            boxShadow: "0 0 16px rgba(224,87,79,0.28), inset 0 1px 0 rgba(255,180,160,0.22)",
          }}
        >
          <Swords size={17} strokeWidth={1.8} />
          <span>{view === "combat" ? "Encerrar combate" : "Combate"}</span>
        </Action>
        {CHROME_ICONS.map((item, i) => (
          <Action
            key={item.id}
            href={links[item.id]}
            onClick={() => onAction(item.id)}
            title={item.title}
            ariaLabel={item.title}
            disabled={item.masterOnly && !runtime.isMaster}
            className={cx(
              "grid h-9 w-9 place-items-center rounded-[9px] text-[color:var(--mx-c9b295)] transition-all duration-200",
              "hover:-translate-y-0.5 hover:bg-[color:var(--mx-2a1a12)] hover:text-[color:var(--mx-f0d9a5)]",
              "disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0 disabled:hover:bg-transparent disabled:hover:text-[color:var(--mx-c9b295)]",
              item.id === "theme" && "text-[#f0c46c]",
              i >= 3 && "hidden sm:grid",
            )}
          >
            <item.icon size={19} strokeWidth={1.7} />
          </Action>
        ))}
        <Action
          onClick={() => onAction("profile")}
          title="Meus personagens"
          className="ml-1.5 grid h-[42px] w-[42px] place-items-center rounded-full p-[2px] transition-transform duration-200 hover:scale-105"
          style={{ background: runtime.isMaster ? "linear-gradient(180deg,#f6d27a,#a67a2b)" : "linear-gradient(180deg,#e0574f,#7c1c1c)" }}
          ariaLabel={runtime.isMaster ? "Meus personagens (Mestre)" : "Meus personagens"}
        >
          {runtime.isMaster
            ? <span className="grid h-full w-full place-items-center rounded-full bg-[color:var(--mx-1b0f0a)] font-display text-[22px] leading-none font-bold text-[#f6d27a] ring-1 ring-[#f2d68f]/70">M</span>
            : <img
              src={runtime.playerPortraitUrl || IMG[runtime.playerPortrait].src}
              onError={(e) => imgFallback(e, runtime.playerPortrait)}
              alt=""
              className="h-full w-full rounded-full object-cover ring-1 ring-[#f2d68f]/70"
            />}
        </Action>
      </div>
    </header>
  );
}

export function LeftRail({
  links,
  onNavigate,
}: {
  links: Record<string, string>;
  onNavigate: (id: string) => void;
}) {
  const { isMaster, diceOpen, activeNav } = useSkinRuntime();
  return (
    <nav className="relative z-20 flex w-[76px] shrink-0 flex-col border-r border-[#7a5227]/50 bg-[linear-gradient(180deg,var(--mx-150d0b)_0%,var(--mx-0d0706)_100%)] lg:w-[104px]">
      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto scroll-tray px-1.5 pt-2.5">
        {NAV.map((item) => {
          const active = Boolean(activeNav?.includes(item.id));
          const locked = Boolean(item.masterOnly) && !isMaster;
          return (
            <Action
              key={item.id}
              href={links[item.id]}
              onClick={() => onNavigate(item.id)}
              disabled={locked}
              title={locked ? `${item.label.replace("\n", " ")} — ferramenta do mestre` : undefined}
              className={cx(
                "group relative flex flex-col items-center gap-1 rounded-[10px] px-1 py-1.5 text-center transition-colors duration-200",
                locked
                  ? "cursor-not-allowed text-[#a08b71] opacity-35"
                  : "text-[#a08b71] hover:bg-white/[0.045] hover:text-[color:var(--mx-ecd9b6)]",
              )}
            >
              {active && (
                <>
                  <span
                    className="absolute inset-0 rounded-[10px] border border-[#e0574f]/80"
                    style={{
                      background: "linear-gradient(180deg,rgba(194,32,43,0.42),rgba(120,16,22,0.28))",
                      boxShadow: "0 0 18px rgba(224,87,79,0.35), inset 0 1px 0 rgba(255,180,160,0.18)",
                    }}
                  />
                  <span className="absolute top-1/2 left-0 h-8 w-[3px] -translate-y-1/2 rounded-r bg-[#f2d68f]" />
                </>
              )}
              <span
                className={cx(
                  "relative grid h-[27px] w-[27px] place-items-center rounded-[8px] border transition-colors duration-200",
                  active
                    ? "border-[#f0a090]/60 bg-[#5a1418] text-[color:var(--mx-ffe2c8)]"
                    : "border-[#7a5227]/45 bg-[color:var(--mx-1c120c)] text-[#c9a878] group-hover:border-[#d9a94c]/60 group-hover:text-[color:var(--mx-f0d9a5)]",
                )}
              >
                <item.icon size={17} strokeWidth={1.7} />
              </span>
              <span className="relative whitespace-pre-line text-[10px] leading-[1.12] font-medium">
                {item.label}
              </span>
            </Action>
          );
        })}
      </div>

      {/* d20 vermelho no pé da barra: abre a mesinha de rolagem */}
      <Action
        onClick={() => onNavigate("dice")}
        ariaLabel="Rolagem de dados"
        title="Rolagem de dados"
        active={diceOpen}
        className="relative grid h-[96px] shrink-0 place-items-center overflow-hidden mesa-d20-slot"
      >
        <div
          className={cx("absolute inset-0 transition-opacity duration-300", diceOpen ? "opacity-100" : "opacity-80")}
          style={{ background: "radial-gradient(60% 70% at 50% 100%,rgba(224,36,47,0.5),transparent 72%)" }}
        />
        <svg
          viewBox="0 0 64 64"
          width="56"
          height="56"
          className="mx-min animate-spinslow relative transition-transform duration-300 group-hover/act:scale-110"
          style={{ filter: `drop-shadow(0 0 ${diceOpen ? 12 : 8}px rgba(232,44,54,${diceOpen ? 0.95 : 0.7}))` }}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="d20-face" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ff4b4f" />
              <stop offset="1" stopColor="#8d0f16" />
            </linearGradient>
            <linearGradient id="d20-core" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e3262f" />
              <stop offset="1" stopColor="#5e0b10" />
            </linearGradient>
          </defs>
          <path d="M32 4 L58 19 V45 L32 60 L6 45 V19 Z" fill="url(#d20-face)" stroke="#f2b9a4" strokeWidth="1.3" />
          <path d="M32 4 L46 32 L32 60 L18 32 Z" fill="url(#d20-core)" stroke="#f2b9a4" strokeWidth="0.9" />
          <path d="M6 19 L32 32 L58 19 M32 32 V60" stroke="#f2b9a4" strokeWidth="0.8" fill="none" opacity="0.75" />
          <text x="32" y="38" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--mx-fff3d9)" fontFamily="Cinzel, serif">
            20
          </text>
        </svg>
        <OrbD20 diceOpen={diceOpen} className="mx-exp" />
        {diceOpen && <span className="absolute top-0 left-0 h-full w-[3px] bg-[#f2d68f]" />}
      </Action>
    </nav>
  );
}

export function ViewTogglePill({ view, onToggle }: { view: View; onToggle: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      whileTap={{ scale: 0.96 }}
      className="pointer-events-auto absolute top-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#d9a94c]/60 bg-[color:var(--mx-120b08)]/90 px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-[color:var(--mx-f0d9a5)] uppercase shadow-[0_10px_30px_-12px_rgba(0,0,0,0.9)] backdrop-blur transition-colors duration-200 hover:border-[#f2d68f] hover:bg-[color:var(--mx-241611)]/90"
    >
      <Swords size={14} className="text-[#e0574f]" />
      {view === "explore" ? "Entrar em combate" : "Voltar à exploração"}
    </motion.button>
  );
}
