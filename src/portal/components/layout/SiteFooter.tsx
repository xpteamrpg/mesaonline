import React, { useMemo } from "react";
import { withBase } from "../../../utils/assetUrl";

/** Orbe do d20 com as garras de dragão (mesma arte da Mesa e da janela de login). */
const FooterOrb: React.FC = () => (
  <div className="relative h-[64px] w-[82px] shrink-0 select-none" aria-hidden="true">
    <style>{`@keyframes footOrbSpin { to { transform: rotate(360deg); } }`}</style>
    <img src={withBase("/ui/expandido/d20-cristal.webp")} alt="" draggable={false} className="absolute left-[25.5%] top-[17.9%] w-[49%]" style={{ animation: "footOrbSpin 14s linear infinite", filter: "drop-shadow(0 0 6px rgba(255,60,40,.7))" }} />
    <img src={withBase("/ui/expandido/garras-orbe.webp")} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
  </div>
);

/** QR Code de exemplo (desenho fixo, não leva a lugar nenhum): o lugar do Pix do projeto. */
const FakeQr: React.FC = () => {
  const cells = useMemo(() => {
    const n = 25;
    const out: Array<[number, number]> = [];
    let seed = 7;
    const finder = (x: number, y: number) => (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (finder(x, y)) continue;
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      if ((seed >> 8) % 2 === 0) out.push([x, y]);
    }
    return out;
  }, []);
  const finderAt = (x: number, y: number) => (
    <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
      <rect width="7" height="7" fill="#000" /><rect x="1" y="1" width="5" height="5" fill="#fff" /><rect x="2" y="2" width="3" height="3" fill="#000" />
    </g>
  );
  return (
    <svg viewBox="-1 -1 27 27" className="h-[72px] w-[72px] rounded bg-white p-0.5" role="img" aria-label="QR Code de exemplo">
      {cells.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#000" />)}
      {finderAt(0, 0)}{finderAt(18, 0)}{finderAt(0, 18)}
    </svg>
  );
};

/** Logos das redes (desenhos próprios, simples, sem arquivo de fora). */
const ICONS: Record<string, React.ReactNode> = {
  Instagram: <><rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" /></>,
  Reddit: <><ellipse cx="12" cy="14" rx="7.5" ry="5" fill="currentColor" /><circle cx="4.8" cy="11.2" r="1.9" fill="currentColor" /><circle cx="19.2" cy="11.2" r="1.9" fill="currentColor" /><circle cx="17.6" cy="4.6" r="1.5" fill="currentColor" /><path d="M12 9.2 13.2 4l4.4.6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx="9.2" cy="13.4" r="1.2" fill="#000" /><circle cx="14.8" cy="13.4" r="1.2" fill="#000" /><path d="M9.4 16.2c1.5 1 3.7 1 5.2 0" fill="none" stroke="#000" strokeWidth="1.2" strokeLinecap="round" /></>,
  Discord: <><path d="M7 5.5c1.6-.7 3.2-1 5-1s3.4.3 5 1c2 2.7 3 6 3.4 10-1.4 1.3-3 2.2-4.8 2.8l-1-1.9c.6-.2 1.2-.5 1.7-.9-3-1.4-6.4-1.4-9.4 0 .5.4 1.1.7 1.700.9l-1 1.900C5.600 17.700 4 16.800 2.600 15.500 3 11.500 4.900 8.200 7 5.500z" fill="currentColor" /><circle cx="9" cy="12" r="1.5" fill="#000" /><circle cx="15" cy="12" r="1.5" fill="#000" /></>,
  WhatsApp: <><path d="M12 3a9 9 0 0 0-7.800 13.500L3 21l4.600-1.200A9 9 0 1 0 12 3z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M9 8.200c-.6.700-.8 1.700-.3 2.800.8 1.700 2.300 3.200 4.300 4 1 .4 2 .2 2.700-.5l.2-.7-1.800-1-.7.700c-1-.4-1.900-1.300-2.300-2.300l.7-.8-.9-1.900z" fill="currentColor" /></>,
  Telegram: <path d="M21.500 4.200 2.900 11.400c-.9.400-.9 1.100-.2 1.300l4.700 1.500 1.800 5.600c.2.600.4.800.9.800s.7-.2 1-.5l2.200-2.200 4.600 3.400c.8.500 1.500.2 1.700-.8l3-14.700c.3-1.200-.5-1.700-1.100-1.600zM8.700 13.800l10.200-6.400c.5-.3.900-.1.600.2l-8.300 7.600-.3 3.500z" fill="currentColor" />,
  Facebook: <path d="M13.800 21v-8h2.700l.4-3.200h-3.100V7.900c0-.9.300-1.500 1.600-1.500h1.600V3.500c-.3 0-1.300-.1-2.400-.1-2.400 0-4 1.500-4 4.100v2.300H7.900V13h2.700v8z" fill="currentColor" />,
  YouTube: <><rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="currentColor" /><path d="M10 9v6l5.200-3z" fill="#000" /></>,
  "E-mail": <><rect x="3" y="5.500" width="18" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m3.500 7 8.500 6.500L20.500 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></>,
};
const SOCIALS = Object.keys(ICONS);

/** Faixa preta no fim de todas as páginas do Portal. */
export const SiteFooter: React.FC = () => (
  <footer className="no-print mt-8 bg-black text-[#c9c2b0]">
    <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-x-8 gap-y-4 px-4 py-5">
      <div className="flex min-w-[260px] flex-1 items-center gap-4">
        <FooterOrb />
        <div className="text-[12px] leading-5">
          <div className="font-bold text-white">ModernRPG · projeto piloto (protótipo)</div>
          <div>Conteúdo oficial pertence aos seus respectivos autores. Este é um projeto de fãs, sem fins comerciais.</div>
          <div>Criado por <b className="text-[#f2c572]">Samararash</b> · © 2026 ModernRPG. Todos os direitos reservados.</div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right text-[11px] leading-4">
          <div className="font-bold text-white">Gostou do projeto? Apoie!</div>
          <div className="text-[#9c9180]">QR Code de exemplo (Pix em breve)</div>
        </div>
        <FakeQr />
      </div>
      <div className="flex flex-wrap justify-end gap-1.5" aria-label="Redes (em breve)">
        {SOCIALS.map((name) => (
          <button key={name} type="button" disabled title={`${name} (em breve)`} aria-label={`${name} (em breve)`} className="grid h-9 w-9 cursor-not-allowed place-items-center rounded-full border border-[#5b5546] text-[#e8e0cc] opacity-80">
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">{ICONS[name]}</svg>
          </button>
        ))}
      </div>
    </div>
  </footer>
);
