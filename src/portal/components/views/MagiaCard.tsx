import React from "react";
import { PM_BASE_DO_CIRCULO, calcular } from "../../lib/homebrew/spellCost";
import { ROTULOS, resumoDosEfeitos, substituir, textoAlvo, textoResistencia, tipoDePocaoDosEixos, type MagiaCriada } from "../../lib/homebrew/spellText";

/** Cartão de uma magia criada no Criador de magias (o mesmo na criação, em "Minhas magias" e no Homebrew público). */
export const MagiaCard: React.FC<{ m: MagiaCriada; r?: ReturnType<typeof calcular>; children?: React.ReactNode }> = ({ m, r = calcular(m), children }) => {
  const desc = m.descricao.trim() ? substituir(m.descricao, m) : "";
  const pocao = tipoDePocaoDosEixos(m.eixos.alvo);
  const apr = m.aprimoramentos.filter((a) => a.texto);
  return (
    <div className="rounded-lg border-2 border-[#b92b3a] bg-white p-4 shadow-sm" data-spell-card>
      <div className="font-serif text-2xl font-black text-[#b92b3a]">{m.nome || "Sem Nome"}</div>
      <div className="text-[11px] font-black uppercase tracking-wide text-[#9c9180]">{m.escola} ({m.tipo}) — {m.circulo}º círculo · {PM_BASE_DO_CIRCULO[m.circulo]} PM</div>
      <p className="mt-2 text-xs leading-5 text-[#2b261f]">
        <b>Execução:</b> {ROTULOS.execucao[m.eixos.execucao as keyof typeof ROTULOS.execucao]}; <b>Alcance:</b> {ROTULOS.alcance[m.eixos.alcance as keyof typeof ROTULOS.alcance]?.replace(/ \(.+\)/, "")};
        {" "}<b>Alvo:</b> {textoAlvo(m)}; <b>Duração:</b> {ROTULOS.duracao[m.eixos.duracao as keyof typeof ROTULOS.duracao]}; <b>Resistência:</b> {textoResistencia(m)}
        {m.eixos.umaVezPorCena ? "; Limite: uma vez por cena no mesmo alvo" : ""}{m.eixos.componente ? "; Componente: material consumido" : ""}
      </p>
      {desc ? <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#5c5446]">{desc}</p> : resumoDosEfeitos(m) ? <p className="mt-2 text-sm leading-6 text-[#5c5446]">{resumoDosEfeitos(m)}</p> : null}
      {apr.length > 0 && <ul className="mt-2 space-y-1 text-sm text-[#5c5446]">{apr.map((a, i) => <li key={i}><b className="text-[#b92b3a]">{a.truque ? "Truque" : `+${a.pm} PM`}:</b> {a.texto}{a.requerCirculo ? <i> (requer {a.requerCirculo}º círculo)</i> : null}</li>)}</ul>}
      {pocao && <div className="mt-2 text-xs text-[#726859]">🧪 pode virar <b>{pocao} de {m.nome || "esta magia"}</b></div>}
      <div className={`mt-3 border-t border-[#ded7c6] pt-2 text-[11px] font-black uppercase ${r.valido ? "text-[#2f7d32]" : r.precisaAval ? "text-[#c2670a]" : "text-[#b92b3a]"}`} data-spell-points>
        {r.total}/{r.orcamento} pontos{r.valido ? "" : r.precisaAval ? " — aval do mestre" : " — estourou"}
      </div>
      {children}
    </div>
  );
};
