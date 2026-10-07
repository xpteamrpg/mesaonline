import React from "react";
import type { View } from "../../types/view";
import type { CharacterSheet } from "../../types/sheet";
import { PageBanner } from "../layout/PageBanner";
import imgLivros from "../../assets/menu/livros.jpg";
import imgOficina from "../../assets/menu/oficina.jpg";
import imgCompendio from "../../assets/menu/compendio.jpg";
import imgHomebrew from "../../assets/menu/homebrew.jpg";
import imgRacas from "../../assets/menu/racas-novo.jpg";
import { HomeBanner } from "./HomeBanner";
import { EXTERNAL_CARDS, HOME_CARDS } from "../layout/menuCards";
import { useAuth } from "../../lib/auth/AuthContext";
import { REQUIRE_LOGIN_FOR_PERSONAL_DATA } from "../../lib/accountConfig";
import imgCampanhas from "../../assets/menu/campanhas.jpg";

export const HomeView: React.FC<{ onNavigate: (view: View) => void; characters: CharacterSheet[] }> = ({ onNavigate, characters }) => {
  const { user, openAuthModal } = useAuth();
  const needsLogin = REQUIRE_LOGIN_FOR_PERSONAL_DATA && !user;
  return (
    <div className="mx-auto max-w-[1400px] p-3 sm:p-5">
      <HomeBanner onNavigate={onNavigate} />
      <section className="relative overflow-hidden rounded-xl border border-[#b92b3a]/30 bg-[#2b261f] text-white shadow-xl">
        <img src={imgCampanhas} alt="Paisagem de Arton" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        <div className="relative grid min-h-[360px] items-end gap-6 p-6 sm:p-10 lg:grid-cols-[1.2fr_.8fr]">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.3em] text-[#f2c572]">Um espaço feito por fãs para fãs</p>
            <h1 className="font-serif text-4xl font-black leading-tight sm:text-6xl">Suas aventuras de Tormenta20, reunidas em um só lugar.</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/80">Crie personagens, organize campanhas, consulte o compêndio, guarde seus livros e prepare sua mesa em Arton.</p>
            <div className="mt-6 flex flex-wrap gap-2"><button onClick={() => onNavigate(characters.length ? "characters" : "createChar")} className="rounded bg-[#b92b3a] px-5 py-2.5 text-xs font-black uppercase text-white">{characters.length ? "Meus personagens" : "Crie seu personagem agora"}</button><button onClick={() => onNavigate("campaigns")} className="rounded border border-white/50 bg-white/10 px-5 py-2.5 text-xs font-black uppercase text-white">Minhas campanhas</button></div>
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
          {EXTERNAL_CARDS.map((c) => (
            <a key={c.label} href={c.href} target="_blank" rel="noreferrer" title={c.credit} className="group rounded-lg border border-[#ded7c6] bg-white p-1.5 text-left shadow-sm transition-shadow hover:shadow-md" data-external-card>
              <div className="relative aspect-[16/10] overflow-hidden rounded">
                <img src={c.img} alt="" className="h-full w-full object-cover object-[50%_30%] transition-transform duration-500 group-hover:scale-110" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 pb-1.5 pt-8 text-center font-serif text-[13px] font-black uppercase leading-tight text-white">{c.label} ↗</span>
              </div>
            </a>
          ))}
        </div>
      </section>

      <p className="mt-5 text-center text-[10px] text-[#9c9180]">Conteúdo oficial pertence aos seus respectivos autores. Este é um projeto de fãs, sem fins comerciais.</p>
    </div>
  );
};

/** Bloco da página "O que é": imagem de um lado, texto do outro, alternando esquerda e direita. */
const Row: React.FC<{ icon: string; title: string; img: string; pos?: string; flip?: boolean; children: React.ReactNode }> = ({ icon, title, img, pos = "50% 40%", flip, children }) => (
  <section className="grid overflow-hidden rounded-lg border border-[#ded7c6] bg-white shadow-sm md:grid-cols-2">
    <div className={`relative min-h-[240px] border-b-4 border-[#b92b3a] md:min-h-[300px] md:border-b-0 ${flip ? "md:order-2 md:border-l-4" : "md:border-r-4"} md:border-[#b92b3a]`}>
      <img src={img} alt="" style={{ objectPosition: pos }} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
    </div>
    <div className="p-6 sm:p-8">
      <h2 className="flex items-center gap-2 font-serif text-2xl font-black text-[#b92b3a]"><span aria-hidden>{icon}</span>{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-7 text-[#5c5446]">{children}</div>
    </div>
  </section>
);

export const AboutView: React.FC<{ onNavigate: (view: View) => void }> = ({ onNavigate }) => (
  <div className="mx-auto max-w-[1400px] p-3 sm:p-5">
    <PageBanner image={imgLivros} position="50% 40%" title="O que é o ModernRPG?" crumb="O que é o ModernRPG?" />
    <div className="space-y-4">
      <article className="rounded-lg border border-[#b92b3a]/30 bg-[#2b261f] p-6 text-white shadow-md sm:p-8">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#f2c572]">Por que o ModernRPG existe</p>
        <h2 className="mt-2 font-serif text-3xl font-black leading-tight sm:text-4xl">Um lugar para a comunidade de Tormenta20 criar, jogar e se encontrar.</h2>
        <p className="mt-4 max-w-4xl text-[15px] leading-7 text-white/85">Jogo RPG há 30 anos e crio conteúdo para Tormenta20. Em algum ponto da estrada senti que faltava um espaço onde a comunidade pudesse criar mais, compartilhar o que faz e interagir de verdade. O ModernRPG nasceu para ser esse espaço: do herói à mesa de jogo, tudo reunido num só site.</p>
        <p className="mt-3 text-sm font-bold text-[#f2c572]">— Samararash</p>
      </article>

      <Row icon="⚒️" title="Oficina de Heróis e Meus Personagens" img={imgOficina} pos="50% 60%">
        <ul className="list-disc space-y-1 pl-5">
          <li>Criação de personagem guiada, passo a passo, do zero ou a partir de um personagem pronto.</li>
          <li>Ficha completa que se recalcula sozinha, com rolagens de dados.</li>
          <li>Importação e exportação de fichas em PDF e JSON, e importação de VTT.</li>
          <li>Cada personagem mostra as campanhas e one-shots em que está.</li>
        </ul>
      </Row>

      <Row icon="📚" title="Compêndio e Livros" img={imgCompendio} flip>
        <ul className="list-disc space-y-1 pl-5">
          <li>Raças, classes e distinções, equipamentos, magias (grimório) e monstros, todos consultáveis num só lugar.</li>
          <li>Parceiros e ajudantes ligados à ficha.</li>
          <li>Uma biblioteca para guardar os seus próprios livros e PDFs.</li>
        </ul>
      </Row>

      <Row icon="🧪" title="Homebrew" img={imgHomebrew} pos="50% 35%">
        <p>Tormenta20 tem muito mais para jogar do que o material oficial. A área de Homebrew foi pensada para ter <b>mais de uma opção além do oficial</b>: raças, classes, poderes, magias, itens, monstros e parceiros criados por jogadores e mestres, organizados e fáceis de achar.</p>
        <p>A ideia é ser um espaço para as pessoas <b>compartilharem</b> e, se quiserem, <b>venderem</b> os seus materiais. Esse lugar eu não encontrei na internet, e por isso achei que valia a pena criar.</p>
      </Row>

      <Row icon="🗺️" title="Campanhas e Mesa online" img={imgCampanhas} pos="50% 40%" flip>
        <p>Crie campanhas e one-shots, convide os jogadores pelo código da mesa e ligue os personagens de cada um à campanha. A Mesa online reúne mapa, fichas, combate tático com as regras de Tormenta20 e jogo em grupo, tudo no navegador.</p>
        <p>A Mesa online foi construída <b>do zero</b>, com base em material do GitLab, em autorizações de amigos e em material encontrado em comunidades como o Discord e o GitHub. Também é de fãs, para fãs.</p>
      </Row>

      <Row icon="🏰" title="O cenário" img={imgRacas} pos="50% 30%">
        <p>Este é um espaço reservado para apresentar o cenário de Tormenta20 criado por <b>Samararash</b>: o mundo, os lugares e as histórias que as mesas do ModernRPG vão explorar.</p>
        <p className="text-sm italic text-[#9c9180]">Texto provisório: a apresentação completa do cenário entra aqui em breve.</p>
      </Row>

      <article className="rounded-lg border border-[#ded7c6] bg-[#efe9d6] p-6 text-sm leading-7 text-[#5c5446] shadow-sm sm:p-8">
        <h2 className="font-serif text-xl font-black text-[#2b261f]">Créditos e avisos</h2>
        <p className="mt-1">Idealizado e criado por <b className="text-[#b92b3a]">Samararash</b>, com a ajuda de amigos e da comunidade de RPG.</p>
        <p className="mt-1 text-xs">Tormenta20 e o seu conteúdo oficial pertencem aos seus respectivos autores. Este é um projeto de fãs, sem fins comerciais, ainda em fase piloto (protótipo).</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => onNavigate("workshop")} className="rounded bg-[#b92b3a] px-4 py-2 text-xs font-black uppercase text-white hover:bg-[#9c1f2d]">Criar um herói</button>
          <button onClick={() => onNavigate("online")} className="rounded border border-[#b92b3a] bg-white px-4 py-2 text-xs font-black uppercase text-[#b92b3a] hover:bg-[#fbebee]">Ir para a Mesa online</button>
        </div>
      </article>
    </div>
  </div>
);
