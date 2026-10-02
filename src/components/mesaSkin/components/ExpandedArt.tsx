import { withBase } from "../../../utils/assetUrl";
/**
 * Arte do modo EXPANDIDO (aparece só quando <html data-table-mode="expanded">): marca da tormenta e o d20 dentro de um orbe de tempestade
 * preso por garras de dragão. O Minimalista continua com a estrela e o d20 simples.
 */
export function TormentaMark({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true" style={{ filter: "drop-shadow(0 0 5px rgba(196,22,30,0.55))" }}>
      <defs>
        <radialGradient id="tmGlow" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#ff5a45" stopOpacity="0.5" />
          <stop offset="70%" stopColor="#7a5227" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#7a5227" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="tmGem" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff8a76" />
          <stop offset="100%" stopColor="#8d0f16" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#tmGlow)" />
      <circle cx="32" cy="32" r="27" fill="none" stroke="#d9a94c" strokeOpacity="0.8" strokeWidth="1.6" />
      <g className="tormenta-swirl" fill="none" stroke="#e0302c" strokeWidth="2.2" strokeLinecap="round">
        <path d="M32 6 C50 8 58 24 52 38" />
        <path d="M32 6 C50 8 58 24 52 38" transform="rotate(120 32 32)" />
        <path d="M32 6 C50 8 58 24 52 38" transform="rotate(240 32 32)" />
        <path d="M32 15 C43 16 49 25 46 34" strokeWidth="1.5" strokeOpacity="0.85" />
        <path d="M32 15 C43 16 49 25 46 34" strokeWidth="1.5" strokeOpacity="0.85" transform="rotate(120 32 32)" />
        <path d="M32 15 C43 16 49 25 46 34" strokeWidth="1.5" strokeOpacity="0.85" transform="rotate(240 32 32)" />
      </g>
      <path className="tormenta-bolt" d="M37 7 L27 31 L34 31 L26 57" fill="none" stroke="#ffd9d0" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M32 23 L40 32 L32 41 L24 32 Z" fill="url(#tmGem)" stroke="#f2d68f" strokeWidth="0.9" />
      <path d="M32 23 L40 32 L32 32 Z" fill="#ffc4b8" opacity="0.35" />
    </svg>
  );
}

export function OrbD20({ diceOpen, className }: { diceOpen?: boolean; className?: string }) {
  return (
    <span className={`mx-orbd20 ${className ?? ""}`} style={{ filter: `drop-shadow(0 0 ${diceOpen ? 12 : 8}px rgba(232,64,44,${diceOpen ? 0.95 : 0.65}))` }} aria-hidden="true">
      {/* o interior do anel: orbe de vidro escuro com a tempestade, o relâmpago e o d20 de cristal girando */}
      <svg viewBox="0 0 100 100" className="mx-orb-core">
        <defs>
          <radialGradient id="orbGlass" cx="38%" cy="30%" r="80%">
            <stop offset="0" stopColor="#5e1318" />
            <stop offset="0.55" stopColor="#2a0a0d" />
            <stop offset="1" stopColor="#0d0505" />
          </radialGradient>
          <radialGradient id="orbStorm" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#ff5a45" stopOpacity="0.5" />
            <stop offset="1" stopColor="#ff5a45" stopOpacity="0" />
          </radialGradient>
          <clipPath id="orbClip"><circle cx="50" cy="50" r="49" /></clipPath>
        </defs>
        <circle cx="50" cy="50" r="49" fill="url(#orbGlass)" />
        <g clipPath="url(#orbClip)">
          <circle cx="50" cy="50" r="49" fill="url(#orbStorm)" className="orb-pulse" />
          <g className="tormenta-orb-swirl" fill="none" stroke="#e0302c" strokeLinecap="round" strokeOpacity="0.6" strokeWidth="1.8" style={{ transformOrigin: "50px 50px" }}>
            <path d="M50 3 C75 5 90 24 85 50" />
            <path d="M50 3 C75 5 90 24 85 50" transform="rotate(120 50 50)" />
            <path d="M50 3 C75 5 90 24 85 50" transform="rotate(240 50 50)" />
          </g>
          <path className="tormenta-bolt" d="M60 4 L42 46 L55 46 L38 96" fill="none" stroke="#ffd9d0" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <g className="d20-die">
            <image href={withBase("/ui/expandido/d20-cristal.webp")} x="9" y="9" width="82" height="82" />
          </g>
          <ellipse cx="34" cy="26" rx="15" ry="8" fill="#ffffff" opacity="0.1" transform="rotate(-28 34 26)" />
        </g>
      </svg>
      {/* as garras de dragão seguram o orbe (arte gerada, fundo transparente) */}
      <img className="mx-orb-claws" src={withBase("/ui/expandido/garras-orbe.webp")} alt="" draggable={false} />
    </span>
  );
}
