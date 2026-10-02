import React, { useState } from "react";
import { PageBanner } from "../layout/PageBanner";
import imgPersonagens from "../../assets/menu/personagens.jpg";
import imgOficina from "../../assets/menu/oficina.jpg";
import imgClasses from "../../assets/menu/classes.jpg";
import imgRacas from "../../assets/menu/racas-novo.jpg";
import imgParceiros from "../../assets/menu/parceiros.jpg";

/** "Criar personagem": escolher entre a ficha em branco (vai à Oficina) e os personagens prontos. */
export const CreateCharacterView: React.FC<{ onBlank: () => void; onReady: () => void }> = ({ onBlank, onReady }) => (
  <div className="mx-auto max-w-[1100px] p-3 text-[#2b261f] sm:p-5">
    <PageBanner image={imgPersonagens} position="50% 25%" title="Criar Personagem" crumb="Meus Personagens › Criar Personagem" />
    <p className="mb-3 text-sm text-[#5c5446]">Escolha como você gostaria de criar seu novo personagem:</p>
    <div className="grid gap-4 md:grid-cols-2">
      {[
        { img: imgOficina, pos: "50% 60%", title: "Ficha de Personagem em Branco", text: "Crie um novo personagem do zero, e personalize-o como quiser na nossa oficina de personagem seguindo um passo-a-passo. Ideal para criar do seu jeito.", go: onBlank },
        { img: imgClasses, pos: "50% 40%", title: "Personagens Prontos", text: "Escolha um pronto da nossa galeria de personagens. Você pode utilizar imediatamente, ou personalizar como quiser. Ideal se você está com pressa.", go: onReady },
      ].map((c) => (
        <button key={c.title} onClick={c.go} className="group overflow-hidden rounded-lg border border-[#ded7c6] bg-[#22292f] text-left shadow-sm hover:shadow-lg">
          <div className="aspect-[16/9] overflow-hidden"><img src={c.img} alt="" style={{ objectPosition: c.pos }} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /></div>
          <div className="p-4 text-white">
            <h2 className="font-serif text-xl font-black">{c.title}</h2>
            <p className="mt-1 text-[13px] leading-5 text-white/80">{c.text}</p>
          </div>
        </button>
      ))}
    </div>
  </div>
);

interface ReadyExample { id: string; name: string; subtitle: string; text: string; img: string; pos: string }

/** Exemplos de vitrine: ainda não levam a ficha nenhuma (as fichas reais entram no lugar deles depois). */
const EXAMPLES: ReadyExample[] = [
  { id: "ex1", name: "Herói de Exemplo 1", subtitle: "Humano · Guerreiro", text: "Espaço reservado para um personagem pronto. A ficha, a história e o retrato reais entram aqui depois.", img: imgClasses, pos: "30% 40%" },
  { id: "ex2", name: "Herói de Exemplo 2", subtitle: "Elfo · Arcanista", text: "Espaço reservado para um personagem pronto. A ficha, a história e o retrato reais entram aqui depois.", img: imgRacas, pos: "50% 30%" },
  { id: "ex3", name: "Herói de Exemplo 3", subtitle: "Anão · Clérigo", text: "Espaço reservado para um personagem pronto. A ficha, a história e o retrato reais entram aqui depois.", img: imgParceiros, pos: "50% 40%" },
];

const LEVELS = [1, 3, 5];

/** Galeria de personagens prontos (por enquanto só a vitrine, com 3 exemplos). */
export const ReadyCharactersView: React.FC = () => {
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-[1100px] p-3 text-[#2b261f] sm:p-5">
      <PageBanner image={imgClasses} position="50% 35%" title="Personagens Prontos" crumb="Personagens Prontos" />
      {notice && <div role="status" className="mb-3 rounded border border-[#c2892c]/60 bg-[#fff6dc] px-3 py-2 text-xs font-semibold text-[#6b4a12]">{notice}</div>}
      <h2 className="font-serif text-2xl font-black text-[#b92b3a] underline">Bando de Exemplo</h2>
      <p className="mb-3 mt-1 text-sm text-[#2b261f]">Estes são personagens de exemplo, só para a vitrine não ficar vazia. As fichas prontas de verdade entram no lugar deles em breve.</p>
      <div className="grid gap-0 border-t border-[#ddd5bb] md:grid-cols-3">
        {EXAMPLES.map((c) => (
          <div key={c.id} className="border-b border-[#ddd5bb] bg-[#ece7d3] p-3 md:border-r md:last:border-r-0">
            <div className="flex gap-3">
              <img src={c.img} alt="" style={{ objectPosition: c.pos }} className="h-[84px] w-[84px] shrink-0 rounded border border-[#2b261f] bg-white object-cover" />
              <div className="min-w-0">
                <h3 className="font-serif text-xl font-black">{c.name}</h3>
                <div className="text-sm">{c.subtitle}</div>
                <select value={levels[c.id] ?? 1} onChange={(e) => setLevels({ ...levels, [c.id]: Number(e.target.value) })} aria-label={`Nível de ${c.name}`} className="mt-1 rounded border border-[#ccc3a6] bg-white px-2 py-1 text-xs font-semibold">
                  {LEVELS.map((n) => <option key={n} value={n}>{n}º nível</option>)}
                </select>
              </div>
            </div>
            <p className="mt-2 text-[13px] leading-5 text-[#7a705d]">{c.text}</p>
            <div className="mt-3 flex justify-center gap-2">
              <button onClick={() => setNotice("Este é um personagem de exemplo, ainda sem ficha para visualizar.")} className="rounded border border-[#b92b3a] bg-white px-3 py-1 text-xs font-bold text-[#b92b3a] hover:bg-[#fbebee]">📄 Pré-visualizar Ficha</button>
              <button onClick={() => setConfirmId(c.id)} className="rounded bg-[#b92b3a] px-3 py-1 text-xs font-bold text-white hover:bg-[#9c1f2d]">⧉ Clonar</button>
            </div>
          </div>
        ))}
      </div>

      {confirmId && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Clonar personagem">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-2xl">
            <p className="text-sm font-semibold">Tem certeza que você quer copiar essa ficha de personagem para a sua conta?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirmId(null)} className="rounded border border-[#ded7c6] px-4 py-1.5 text-xs font-bold text-[#726859]">Cancelar</button>
              <button onClick={() => { setConfirmId(null); setNotice("Este é um personagem de exemplo, ainda sem ficha para copiar. Quando as fichas prontas entrarem, o Clonar leva a cópia para Meus Personagens."); }} className="rounded bg-[#b92b3a] px-4 py-1.5 text-xs font-bold text-white">OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
