import { CloudLightning, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { WeatherRoll } from "../../game/types";

/**
 * Janelinha do raio da tempestade, no início de cada rodada de combate: mostra o d10 rolado (raio só no 1 = 10%) e o resultado,
 * inclusive "nesta rodada não houve raios". Aparece para todos; o Mestre a fecha sozinha em alguns segundos, cada pessoa pode fechar a sua.
 */
export default function WeatherRollOverlay({ roll, isMaster, onClose }: { roll: WeatherRoll; isMaster: boolean; onClose: () => void }) {
  const [hidden, setHidden] = useState<string | null>(null);
  useEffect(() => {
    if (!isMaster) return;
    const timer = window.setTimeout(onClose, 9000);
    return () => window.clearTimeout(timer);
  }, [roll.id, isMaster]);
  if (hidden === roll.id) return null;
  return (
    <div className="mesa-weather-roll" role="status" aria-label="Raio da tempestade" data-weather-roll onPointerDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.stopPropagation()}>
      <button type="button" aria-label="Fechar" onClick={() => setHidden(roll.id)}><X size={14}/></button>
      <small>TEMPESTADE · RODADA {roll.round}</small>
      <strong><CloudLightning size={18}/>{roll.struck ? `Um raio atinge ${roll.struck}!` : "Nesta rodada não houve raios."}</strong>
      <span>1d10 = <b>{roll.d10}</b> — raio só com 1 (10%){roll.struck ? ` · 8d10 = ${roll.damage} de eletricidade` : ""}</span>
    </div>
  );
}
