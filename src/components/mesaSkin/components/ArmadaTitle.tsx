import { useState } from "react";
import { withBase } from "../../../utils/assetUrl";

/**
 * Título "ARMADA NEXUS RPG" em ouro polido em alto-relevo: letras com chanfro iluminado (luz vinda de cima à esquerda), degradê metálico,
 * filete claro no topo, contorno escuro grosso e uma sombra funda com um brilho avermelhado em volta (tema Tormenta).
 * É SVG: fica nítido em qualquer tamanho e o texto continua selecionável para leitores de tela.
 */
export function ArmadaTitle({ className }: { className?: string }) {
  const text = "ARMADA NEXUS RPG";
  const common = { x: 2, y: 30, fontFamily: "Cinzel, 'Times New Roman', serif", fontSize: 29, fontWeight: 800, letterSpacing: 1.4 } as const;
  return (
    <svg viewBox="0 0 346 44" className={className} role="img" aria-label="Armada Nexus RPG" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6c4" />
          <stop offset="0.28" stopColor="#f7cf62" />
          <stop offset="0.55" stopColor="#d79a2a" />
          <stop offset="0.8" stopColor="#9a5c14" />
          <stop offset="1" stopColor="#5a300a" />
        </linearGradient>
        <linearGradient id="goldRim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffbe6" />
          <stop offset="1" stopColor="#c98a24" />
        </linearGradient>
        <filter id="titleBevel" x="-3%" y="-30%" width="106%" height="170%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.1" result="soft" />
          <feSpecularLighting in="soft" surfaceScale="3.4" specularConstant="1.25" specularExponent="26" lightingColor="#fff4d0" result="spec">
            <feDistantLight azimuth="225" elevation="46" />
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn" />
          <feDiffuseLighting in="soft" surfaceScale="2.6" diffuseConstant="0.95" lightingColor="#ffe9b0" result="diff">
            <feDistantLight azimuth="225" elevation="58" />
          </feDiffuseLighting>
          <feComposite in="diff" in2="SourceAlpha" operator="in" result="diffIn" />
          <feBlend in="SourceGraphic" in2="diffIn" mode="multiply" result="shaded" />
          <feComposite in="shaded" in2="specIn" operator="arithmetic" k1="0" k2="1" k3="0.9" k4="0" />
        </filter>
        <filter id="titleGlow" x="-10%" y="-60%" width="120%" height="240%">
          <feGaussianBlur stdDeviation="2.6" />
        </filter>
        <filter id="titleDrop" x="-5%" y="-30%" width="110%" height="180%">
          <feGaussianBlur stdDeviation="1.3" />
        </filter>
      </defs>
      {/* brilho avermelhado em volta */}
      <text {...common} fill="none" stroke="#e0301f" strokeWidth="6" strokeOpacity="0.55" filter="url(#titleGlow)">{text}</text>
      {/* sombra funda */}
      <text {...common} y={33.5} fill="#000" fillOpacity="0.75" stroke="#000" strokeWidth="4" strokeOpacity="0.75" filter="url(#titleDrop)">{text}</text>
      {/* contorno escuro grosso (a "parede" do relevo) */}
      <text {...common} fill="#2a0707" stroke="#2a0707" strokeWidth="4.4" strokeLinejoin="round">{text}</text>
      {/* filete claro do alto-relevo */}
      <text {...common} fill="none" stroke="url(#goldRim)" strokeWidth="1.5" strokeLinejoin="round" strokeOpacity="0.95">{text}</text>
      {/* letras de ouro com chanfro iluminado */}
      <text {...common} fill="url(#goldFill)" filter="url(#titleBevel)">{text}</text>
    </svg>
  );
}

/** Título do modo Expandido: a arte em ouro em alto-relevo; se a imagem faltar, cai no SVG acima. */
export function ArmadaTitleArt({ className }: { className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <ArmadaTitle className={className} />;
  return <img src={withBase("/ui/expandido/titulo-armada.webp")} alt="Armada Nexus RPG" className={className} draggable={false} onError={() => setFailed(true)} />;
}
