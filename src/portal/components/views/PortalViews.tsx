import React from "react";
import type { View } from "../../types/view";
import type { CharacterSheet } from "../../types/sheet";
import { PageHead } from "./CompendiumView";
import { HomeBanner } from "./HomeBanner";
import { HOME_CARDS } from "../layout/menuCards";
import { useAuth } from "../../lib/auth/AuthContext";
import { REQUIRE_LOGIN_FOR_PERSONAL_DATA } from "../../lib/accountConfig";
import imgCampanhas from "../../assets/menu/campanhas.jpg";

export const HomeView: React.FC<{ onNavigate: (view: View) => void; characters: CharacterSheet[] }> = ({ onNavigate, characters }) => {
  const { user, openAuthModal } = useAuth();
  const needsLogin = REQUIRE_LOGIN_FOR_PERSONAL_DATA && !user;
  return (
    <div className="mx-auto max-w-[1400px] p-3 sm:p-5">
      <HomeBanner />
      <section className="relative overflow-hidden rounded-xl border border-[#b92b3a]/30 bg-[#2b261f] text-white shadow-xl">
        <img src={imgCampanhas} alt="Paisagem de Arton" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        <div className="relative grid min-h-[360px] items-end gap-6 p-6 sm:p-10 lg:grid-cols-[1.2fr_.8fr]">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.3em] text-[#f2c572]">Um espaço feito por fãs para fãs</p>
            <h1 className="font-serif text-4xl font-black leading-tight sm:text-6xl">Suas aventuras de Tormenta20, reunidas em um só lugar.</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/80">Crie personagens, organize campanhas, consulte o compêndio, guarde seus livros e prepare sua mesa em Arton.</p>
            <div className="mt-6 flex flex-wrap gap-2"><button onClick={() => onNavigate(characters.length ? "characters" : "workshop")} className="rounded bg-[#b92b3a] px-5 py-2.5 text-xs font-black uppercase text-white">{characters.length ? "Meus personagens" : "Crie seu personagem agora"}</button><button onClick={() => onNavigate("campaigns")} className="rounded border border-white/50 bg-white/10 px-5 py-2.5 text-xs font-black uppercase text-white">Minhas campanhas</button></div>
          </div>
          <div className="rounded-lg border border-white/20 bg-black/30 p-4 backdrop-blur-sm">
            <div className="text-[10px] font-black uppercase tracking-wider text-[#f2c572]">Seu espaço</div>
            {needsLogin ? (
              <>
                <div className="mt-2 font-serif text-xl font-black">Entre para ver o seu espaço</div>
                <div className="mt-1 text-xs text-white/70">Seus personagens e campanhas ficam guardados na sua conta, visíveis só para você.</div>
                <button onClick={() => openAuthModal()} className="mt-3 rounded bg-[#b92b3a] px-4 py-2 text-xs font-black uppercase text-white">Entrar ou criar conta</button>
              </>
            ) : (
              <>
                <div className="mt-2 font-serif text-2xl font-black">{characters.length} personagem(ns)</div>
                <div className="mt-1 text-xs text-white/70">A ficha aberta fica em Meus Personagens.</div>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="mt-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {HOME_CARDS.map((c) => (
            <button key={c.label} onClick={() => onNavigate(c.view)} className="group rounded-lg border border-[#ded7c6] bg-white p-1.5 text-left shadow-sm transition-shadow hover:shadow-md">
              <div className="relative aspect-[16/10] overflow-hidden rounded">
                <img src={c.img} alt="" className="h-full w-full object-cover object-[50%_30%] transition-transform duration-500 group-hover:scale-110" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 pb-1.5 pt-8 text-center font-serif text-[13px] font-black uppercase leading-tight text-white">{c.label}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <button onClick={() => onNavigate("homebrew")} className="group mt-5 flex w-full flex-col items-start gap-3 rounded-lg border border-[#c2892c]/60 bg-gradient-to-r from-[#2b261f] via-[#49332a] to-[#2b261f] p-5 text-left text-white shadow-md sm:flex-row sm:items-center sm:justify-between">
        <span>
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#f2c572]">Conteúdo da comunidade</span>
          <span className="mt-1 block font-serif text-2xl font-black">Homebrew</span>
          <span className="mt-1 block max-w-2xl text-xs leading-5 text-white/75">Raças, classes, poderes, magias, itens, monstros e parceiros criados por jogadores e mestres. Explore, use nas suas fichas e compartilhe o seu.</span>
        </span>
        <span className="rounded bg-[#c2892c] px-5 py-2.5 text-xs font-black uppercase text-white transition-colors group-hover:bg-[#a87421]">Explorar Homebrew →</span>
      </button>

      <p className="mt-5 text-center text-[10px] text-[#9c9180]">Conteúdo oficial pertence aos seus respectivos autores. Este é um projeto de fãs, sem fins comerciais.</p>
    </div>
  );
};

export const AboutView: React.FC<{ onNavigate: (view: View) => void }> = ({ onNavigate }) => (
  <div className="mx-auto max-w-[1100px] p-3 sm:p-5"><PageHead icon="🎲" title="O que é T20 Online?" subtitle="Um espaço comunitário para organizar suas aventuras de Tormenta20." />
    <div className="grid gap-4 md:grid-cols-2"><article className="rounded-lg border border-[#ded7c6] bg-white p-5 shadow-sm"><h2 className="font-serif text-2xl font-black text-[#b92b3a]">Feito por fãs, para fãs</h2><p className="mt-3 text-sm leading-7 text-[#5c5446]">T20 Online reúne ferramentas para criação de personagens, consulta de regras, preparação de campanhas e organização de materiais pessoais. A ideia é oferecer um lugar simples para compartilhar recursos e tornar a mesa mais fácil de preparar.</p><p className="mt-3 text-sm leading-7 text-[#5c5446]">Você pode usar a Oficina de Heróis, guardar seus livros, criar campanhas, importar dados de VTT e abrir uma mesa online.</p></article><div className="grid gap-3 sm:grid-cols-2"><button onClick={() => onNavigate("workshop")} className="rounded-lg bg-[#2b261f] p-5 text-left text-white"><b className="font-serif text-xl">Oficina de Heróis</b><span className="mt-2 block text-xs text-white/70">Criação guiada de fichas.</span></button><button onClick={() => onNavigate("compendium")} className="rounded-lg bg-[#b92b3a] p-5 text-left text-white"><b className="font-serif text-xl">Compêndio</b><span className="mt-2 block text-xs text-white/70">Raças, classes, poderes, magias e ameaças.</span></button><button onClick={() => onNavigate("books")} className="rounded-lg border border-[#ded7c6] bg-white p-5 text-left"><b className="font-serif text-xl">Biblioteca</b><span className="mt-2 block text-xs text-[#726859]">Seus PDFs e materiais.</span></button><button onClick={() => onNavigate("campaigns")} className="rounded-lg border border-[#ded7c6] bg-white p-5 text-left"><b className="font-serif text-xl">Campanhas</b><span className="mt-2 block text-xs text-[#726859]">Organize sua mesa.</span></button></div></div>
  </div>
);
