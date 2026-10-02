import React, { useState } from "react";
import { PageBanner } from "../layout/PageBanner";
import type { CharacterSheet } from "../../types/sheet";
import { useAuth } from "../../lib/auth/AuthContext";
import { READY_HEROES, type ReadyHero } from "../../data/readyHeroes";
import { T20CharacterSheet } from "../sheet/T20CharacterSheet";
import imgPersonagens from "../../assets/menu/personagens.jpg";
import imgOficina from "../../assets/menu/oficina.jpg";
import imgClasses from "../../assets/menu/classes.jpg";

/** "Criar personagem": escolher entre a ficha em branco (vai à Oficina) e os personagens prontos. */
export const CreateCharacterView: React.FC<{ onBlank: () => void; onReady: () => void }> = ({ onBlank, onReady }) => (
  <div className="mx-auto max-w-[1400px] p-3 text-[#2b261f] sm:p-5">
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

/** Galeria de personagens prontos: os heróis do playtest, com ficha de verdade (Clonar leva para Meus Personagens). */
export const ReadyCharactersView: React.FC<{ onClone: (sheet: CharacterSheet) => Promise<void> | void }> = ({ onClone }) => {
  const { requireLogin } = useAuth();
  const [notice, setNotice] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const preview = READY_HEROES.find((hero) => hero.id === previewId);

  const clone = async (hero: ReadyHero) => {
    setBusy(true);
    try { await onClone(hero.sheet); } catch (e) { setNotice(e instanceof Error ? e.message : "Não foi possível copiar a ficha."); } finally { setBusy(false); setConfirmId(null); }
  };

  return (
    <div className="mx-auto max-w-[1400px] p-3 text-[#2b261f] sm:p-5">
      <PageBanner image={imgClasses} position="50% 35%" title="Personagens Prontos" crumb="Personagens Prontos" />
      {notice && <div role="status" className="mb-3 rounded border border-[#c2892c]/60 bg-[#fff6dc] px-3 py-2 text-xs font-semibold text-[#6b4a12]">{notice}</div>}
      <h2 className="font-serif text-2xl font-black text-[#b92b3a] underline">Heróis do Playtest</h2>
      <p className="mb-3 mt-1 text-sm text-[#2b261f]">Os três heróis do playtest, com a ficha pronta. Pré-visualize ou clone para a sua conta e edite como quiser.</p>
      <div className="grid gap-0 border-t border-[#ddd5bb] md:grid-cols-3">
        {READY_HEROES.map((hero) => {
          const c = hero.sheet;
          return (
            <div key={hero.id} className="border-b border-[#ddd5bb] bg-[#ece7d3] p-3 md:border-r md:last:border-r-0">
              <div className="flex gap-3">
                <img src={hero.portrait} alt="" style={{ objectPosition: hero.pos }} className="h-[84px] w-[84px] shrink-0 rounded border border-[#2b261f] bg-white object-cover" />
                <div className="min-w-0">
                  <h3 className="font-serif text-xl font-black">{c.name}</h3>
                  <div className="text-sm">{c.race} · {c.class}{c.path ? ` (${c.path})` : ""}</div>
                  <div className="mt-1 text-xs font-bold text-[#7a705d]">Nível {c.level}</div>
                </div>
              </div>
              <p className="mt-2 text-[13px] leading-5 text-[#7a705d]">{c.origin ? `Origem: ${c.origin}. ` : ""}PV {c.hp.max} · PM {c.mp.max}.</p>
              <div className="mt-3 flex justify-center gap-2">
                <button onClick={() => setPreviewId(hero.id)} className="rounded border border-[#b92b3a] bg-white px-3 py-1 text-xs font-bold text-[#b92b3a] hover:bg-[#fbebee]">📄 Pré-visualizar Ficha</button>
                <button onClick={() => { if (requireLogin("Para copiar um personagem para a sua conta você precisa estar logado.")) setConfirmId(hero.id); }} className="rounded bg-[#b92b3a] px-3 py-1 text-xs font-bold text-white hover:bg-[#9c1f2d]">⧉ Clonar</button>
              </div>
            </div>
          );
        })}
      </div>

      {confirmId && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Clonar personagem">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-2xl">
            <p className="text-sm font-semibold">Tem certeza que você quer copiar essa ficha de personagem para a sua conta?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirmId(null)} className="rounded border border-[#ded7c6] px-4 py-1.5 text-xs font-bold text-[#726859]">Cancelar</button>
              <button disabled={busy} onClick={() => { const hero = READY_HEROES.find((h) => h.id === confirmId); if (hero) void clone(hero); }} className="rounded bg-[#b92b3a] px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50">OK</button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-[90] overflow-y-auto bg-black/60 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`Ficha de ${preview.sheet.name}`} onMouseDown={(e) => { if (e.target === e.currentTarget) setPreviewId(null); }}>
          <div className="mx-auto max-w-[1300px] rounded-lg bg-[#f5f2eb] p-3 shadow-2xl">
            <div className="mb-2 flex items-center justify-between"><b className="font-serif text-lg">Pré-visualização: {preview.sheet.name}</b><button onClick={() => setPreviewId(null)} className="rounded border border-[#ded7c6] bg-white px-3 py-1 text-xs font-bold">Fechar</button></div>
            <div className="pointer-events-none select-text"><T20CharacterSheet sheet={preview.sheet} onUpdate={() => undefined} onRoll={() => undefined} onEdit={() => undefined} onQuickEdit={() => undefined} onClone={() => undefined} onLevelUp={() => undefined} /></div>
          </div>
        </div>
      )}
    </div>
  );
};
