import React, { useEffect, useRef, useState } from "react";
import type { CharacterSheet } from "../../types/sheet";
import type { View } from "../../types/view";
import { useAuth } from "../../lib/auth/AuthContext";
import { AuthModal } from "../auth/AuthModal";
import { MENU_CARDS } from "./menuCards";

interface Props {
  characters: CharacterSheet[];
  activeId: string;
  view: View;
  onNavigate: (v: View) => void;
  onSelectCharacter: (id: string) => void;
  onOpenJson: () => void;
  onOpenPdf: () => void;
  onOpenVtt: () => void;
}

/** Logo d20 vermelho (mesmo desenho do ícone do rolador). */
export const D20Logo: React.FC<{ className?: string }> = ({ className = "h-5 w-5" }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden>
    <circle cx="12" cy="12" r="12" fill="#b92b3a" />
    <path d="M12 3.5 4.5 8v8L12 20.5l7.5-4.5V8L12 3.5z" fill="none" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M12 3.5v5.2M4.5 8l7.5 .7 7.5-.7M12 8.7 6.3 16M12 8.7l5.7 7.3M6.3 16h11.4M12 20.5V16" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinejoin="round" strokeLinecap="round" />
  </svg>
);

export const T20Navbar: React.FC<Props> = ({ characters, activeId, view, onNavigate, onSelectCharacter, onOpenJson, onOpenPdf, onOpenVtt }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [charMenu, setCharMenu] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [acctMenu, setAcctMenu] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const active = characters.find((c) => c.id === activeId);
  const { user, logout, authModalOpen, openAuthModal, closeAuthModal } = useAuth();

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setCharMenu(false);
        setAcctMenu(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const go = (v: View) => {
    onNavigate(v);
    setMenuOpen(false);
    setMobile(false);
  };

  const link = (v: View, label: string) => (
    <button onClick={() => go(v)} className={`whitespace-nowrap font-bold uppercase tracking-wide hover:text-[#b92b3a] ${view === v ? "text-[#b92b3a]" : "text-[#2b261f]"}`}>
      {label}
    </button>
  );

  return (
    <>
    <header ref={wrap} className="no-print sticky top-0 z-40 border-b-2 border-[#b92b3a] bg-[#fbf9f4] text-[#2b261f] shadow-sm">
      {/* linha superior: marca + busca + conta */}
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-2">
        <button onClick={() => go("home")} className="flex items-center gap-2">
          <D20Logo className="h-9 w-9" />
          <span className="leading-none">
            <span className="block font-serif text-xl font-black tracking-wide">ModernRPG</span>
            <span className="block text-[9px] font-bold uppercase tracking-[0.3em] text-[#b92b3a]">Tormenta 20</span>
          </span>
        </button>
        <div className="hidden flex-1 items-center gap-2 md:flex">
          <div className="flex w-full max-w-xl items-center gap-2 rounded border border-[#ded7c6] bg-white px-3 py-1.5 text-xs text-[#9c9180]">
            <span>🔍</span>
            <input placeholder="Buscar por regras, magias, poderes, monstros…" className="w-full bg-transparent outline-none placeholder:text-[#9c9180]" onKeyDown={(e) => { if (e.key === "Enter") go("compendium"); }} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => { setCharMenu((v) => !v); setMenuOpen(false); }} className="flex items-center gap-2 rounded border border-[#b92b3a] bg-white px-3 py-1.5 text-xs font-bold text-[#b92b3a]">
              <D20Logo className="h-4 w-4" /> <span className="max-w-[120px] truncate">{active?.name ?? "Meus personagens"}</span> <span className="text-[9px]">▼</span>
            </button>
            {charMenu && (
              <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded border border-[#ded7c6] bg-white p-2 shadow-2xl">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#9c9180]">Alternar personagem</div>
                {characters.map((c) => (
                  <button key={c.id} onClick={() => { onSelectCharacter(c.id); setCharMenu(false); }} className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs font-semibold ${c.id === activeId ? "bg-[#fbebee] text-[#b92b3a]" : "hover:bg-[#faf8f3]"}`}>
                    <span className="truncate">{c.name}</span><span className="text-[10px] text-[#726859]">Nv {c.level}</span>
                  </button>
                ))}
                <div className="my-1 border-t border-[#eee]" />
                <button onClick={() => { go("workshop"); setCharMenu(false); }} className="flex w-full gap-1.5 rounded px-2 py-1.5 text-xs font-bold text-[#b92b3a] hover:bg-[#fbebee]">⚒️ Oficina de Heróis</button>
                <button onClick={() => { onOpenPdf(); setCharMenu(false); }} className="flex w-full gap-1.5 rounded px-2 py-1.5 text-xs font-bold text-[#2b8a3e] hover:bg-[#ebfbee]">📄 Importar ficha em PDF</button>
                <button onClick={() => { onOpenVtt(); setCharMenu(false); }} className="flex w-full gap-1.5 rounded px-2 py-1.5 text-xs font-bold text-[#7a3fe0] hover:bg-[#f3eeff]">🎲 Importar do VTT (Foundry/Roll20)</button>
                <button onClick={() => { onOpenJson(); setCharMenu(false); }} className="flex w-full gap-1.5 rounded px-2 py-1.5 text-xs font-bold text-[#1c7ed6] hover:bg-[#e7f5ff]">{`{ }`} Importar / exportar JSON</button>
              </div>
            )}
          </div>
          <div className="relative">
            {user ? (
              <button onClick={() => { setAcctMenu((v) => !v); setCharMenu(false); setMenuOpen(false); }} className="flex items-center gap-1.5 rounded border border-[#ded7c6] bg-white px-3 py-1.5 text-xs font-bold text-[#726859]">
                <span className="max-w-[110px] truncate">👤 {user.nickname || user.email}</span> <span className="text-[9px]">▼</span>
              </button>
            ) : (
              <button onClick={() => openAuthModal()} className="rounded border border-[#ded7c6] bg-white px-3 py-1.5 text-xs font-bold text-[#726859]">Entrar</button>
            )}
            {acctMenu && user && (
              <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded border border-[#ded7c6] bg-white p-2 shadow-2xl">
                <div className="truncate px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#9c9180]">{user.email}</div>
                <button onClick={() => { go("account"); setAcctMenu(false); }} className="w-full rounded px-2 py-1.5 text-left text-xs font-bold text-[#2b261f] hover:bg-[#faf8f3]">Minha conta</button>
                <button onClick={() => { logout(); setAcctMenu(false); }} className="w-full rounded px-2 py-1.5 text-left text-xs font-bold text-[#b92b3a] hover:bg-[#fbebee]">Sair</button>
              </div>
            )}
          </div>
          <button onClick={() => setMobile((v) => !v)} className="rounded border border-[#ded7c6] px-2 py-1.5 text-sm lg:hidden">☰</button>
        </div>
      </div>

      {/* linha de navegação (igual ao OD: INÍCIO · LOJA · LIVROS · … · OD ONLINE ▾) */}
      <nav className="mx-auto hidden max-w-[1400px] items-center gap-6 px-4 py-2 text-[13px] lg:flex">
        {link("home", "Início")}
        {link("about", "O que é o ModernRPG?")}
        {link("books", "Livros")}
        {link("workshop", "Oficina de Heróis")}
        <button onClick={() => { setMenuOpen((v) => !v); setCharMenu(false); }} className={`flex items-center gap-1.5 font-black uppercase tracking-wide ${menuOpen || ["books", "characters", "companions", "campaigns", "races", "classes", "equipment", "spells", "bestiary", "compendium", "homebrew"].includes(view) ? "text-[#b92b3a]" : "text-[#b92b3a]"}`}>
          <D20Logo className="h-4 w-4" /> T20 Online <span className={`text-[9px] transition-transform ${menuOpen ? "rotate-180" : ""}`}>▼</span>
        </button>
        {link("compendium", "Compêndio")}
        {link("online", "Mesa online")}
      </nav>

      {/* MEGA MENU — réplica do "OD ONLINE" com cards ilustrados */}
      {menuOpen && (
        <div className="absolute inset-x-0 top-full z-50 border-b-4 border-[#b92b3a] bg-[#f5f2eb] shadow-2xl">
          <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-3 p-4 md:grid-cols-3 lg:grid-cols-5">
            <div className="flex flex-col gap-3">
              <button onClick={() => go("about")} className="flex h-[88px] items-center justify-center gap-2 rounded-lg bg-[#2b261f] px-3 text-center text-sm font-black uppercase tracking-wide text-white hover:bg-[#3b3428]">
                <D20Logo className="h-5 w-5" /> O que é o ModernRPG?
              </button>
              <button onClick={() => go("workshop")} className="flex h-[88px] items-center justify-center rounded-lg bg-[#2b261f] px-3 text-center text-sm font-black uppercase tracking-wide text-white hover:bg-[#3b3428]">
                Oficina de Heróis
              </button>
            </div>
            {MENU_CARDS.map((c) => (
              <button key={c.view} onClick={() => go(c.view)} className="group relative h-[188px] overflow-hidden rounded-lg border border-[#ded7c6] bg-[#2b261f] text-left shadow">
                <img src={c.img} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-105" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pb-3 pt-8 text-center font-serif text-base font-black uppercase tracking-wide text-white drop-shadow">{c.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* menu mobile */}
      {mobile && (
        <div className="border-t border-[#ded7c6] bg-white p-3 lg:hidden">
          <div className="mb-2 grid grid-cols-3 gap-2 text-[10px] font-black uppercase">
            <button onClick={() => go("home")} className="rounded bg-[#2b261f] px-2 py-2 text-white">Início</button>
            <button onClick={() => go("characters")} className="rounded bg-[#b92b3a] px-2 py-2 text-white">Personagens</button>
            <button onClick={() => go("online")} className="rounded bg-[#9b6c21] px-2 py-2 text-white">Mesa online</button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-bold">
            {[["sheet", "Início"], ["workshop", "Forja de Heróis"], ["compendium", "Compêndio"], ...MENU_CARDS.map((c) => [c.view, c.label] as const)].map(([v, l]) => (
                    <button key={v} onClick={() => go(v as View)} className={`rounded border px-2 py-2 text-left ${view === v ? "border-[#b92b3a] bg-[#fbebee] text-[#b92b3a]" : "border-[#ded7c6]"}`}>{l}</button>
            ))}
          </div>
        </div>
      )}
    </header>
    <AuthModal isOpen={authModalOpen} onClose={closeAuthModal} />
    </>
  );
};
