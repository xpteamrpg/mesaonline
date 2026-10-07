import React, { useEffect, useState } from "react";
import imgMonstros from "../../assets/menu/monstros.jpg";
import imgLivros from "../../assets/menu/livros.jpg";
import imgRacas from "../../assets/menu/racas.jpg";

/* ---- Conteúdo configurável do banner (edite aqui) ---- */

const BLOG = "https://blog.jamboeditora.com.br/";

/** Carrossel: uma mensagem por vez; todos os slides levam ao blog da Jambô. */
const SLIDES = [
  { label: "Tormenta", title: "Lançamentos e novidades oficiais", text: "Veja as publicações e notícias públicas da Jambô Editora.", href: BLOG, img: imgMonstros },
  { label: "Iniciativa T20", title: "Conteúdo e comunidade", text: "Acompanhe materiais e iniciativas públicas do cenário.", href: BLOG, img: imgLivros },
  { label: "Tormenta 25 anos", title: "Uma celebração de Arton", text: "Confira a página pública especial da marca.", href: BLOG, img: imgRacas },
] as const;

/** Área fixa (não gira): destaques do projeto. Troque os textos e adicione `href` quando quiser. */
const FIXED_HIGHLIGHTS: { label: string; title: string; text: string; href?: string; logo?: string }[] = [
  { label: "Comunidade", title: "Guildas", text: "Este projeto faz parte do sistema de guildas. Em breve, mais detalhes aqui." },
  { label: "Guilda dos Aventureiros", title: "Armada de Vectora", text: "Entre na guilda do Discord.", href: "https://discord.gg/z3mNsfHfv", logo: "./images/armada-de-vectora-logo.png" },
];

const INTERVAL_MS = 6000;

export const HomeBanner: React.FC = () => {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [paused]);

  return (
    <section className="mb-5 grid gap-3 lg:grid-cols-[1fr_300px]">
      <div className="relative h-60 overflow-hidden rounded-lg bg-[#2b261f] shadow-sm sm:h-72 lg:h-[380px]" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        {SLIDES.map((s, i) => (
          <a key={s.title} href={s.href} target="_blank" rel="noreferrer" aria-hidden={i !== index} tabIndex={i === index ? 0 : -1} className={`absolute inset-0 transition-opacity duration-700 ${i === index ? "opacity-100" : "pointer-events-none opacity-0"}`}>
            <img src={s.img} alt="" className="absolute inset-0 h-full w-full object-cover object-[50%_30%]" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-transparent" />
            <div className="relative flex h-full max-w-lg flex-col justify-end p-5 text-white sm:p-6">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#f2c572]">{s.label}</span>
              <h2 className="mt-1 font-serif text-2xl font-black leading-tight sm:text-3xl">{s.title}</h2>
              <p className="mt-1 text-xs leading-5 text-white/80 sm:text-sm">{s.text}</p>
              <span className="mt-3 inline-block w-fit rounded bg-[#b92b3a] px-3 py-1.5 text-xs font-bold">Ler no blog ↗</span>
            </div>
          </a>
        ))}
        <div className="absolute inset-x-0 bottom-2 flex justify-center gap-2">
          {SLIDES.map((s, i) => (
            <button key={s.title} onClick={() => setIndex(i)} aria-label={`Ir para ${s.title}`} className={`h-1 w-10 rounded-full transition-colors ${i === index ? "bg-white" : "bg-white/40 hover:bg-white/70"}`} />
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 lg:grid-rows-2">
        {FIXED_HIGHLIGHTS.map((h) => {
          const inner = (
            <>
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#f2c572]">{h.label}</span>
              {h.logo ? <img src={h.logo} alt={h.title} className="mt-1 h-24 w-full object-contain object-left" /> : <h3 className="mt-1 font-serif text-xl font-black">{h.title}</h3>}
              <p className="mt-1 text-xs leading-5 text-white/70">{h.text}</p>
            </>
          );
          const cls = "flex flex-col items-start justify-center text-left rounded-lg border border-[#d7ad5d]/40 bg-[#2b261f] p-4 text-white shadow-sm";
          return h.href ? <a key={h.title} href={h.href} target="_blank" rel="noreferrer" className={`${cls} hover:bg-[#3b3428]`}>{inner}</a> : <div key={h.title} className={cls}>{inner}</div>;
        })}
      </div>
    </section>
  );
};
