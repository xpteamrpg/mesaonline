import React, { useState } from "react";
import { useAuth } from "../../lib/auth/AuthContext";
import { GUILDS, type Guild } from "../../lib/guilds/data";

const card = "rounded-lg border border-[#ded7c6] bg-white p-4 shadow-sm";

/** Retrato do dono da guilda: enquanto não há imagem, a inicial num círculo. */
const OwnerPortrait: React.FC<{ name: string }> = ({ name }) => (
  <span className="grid h-24 w-24 shrink-0 place-items-center rounded-full border-4 border-[#d7ad5d] bg-[#2b261f] font-serif text-4xl font-black text-[#f2c572]" aria-hidden="true">{name[0]}</span>
);

const GuildPage: React.FC<{ guild: Guild; onBack: () => void }> = ({ guild, onBack }) => {
  const [note, setNote] = useState("");
  return (
    <div className="mx-auto max-w-[1100px] p-3 sm:p-5" data-guild-page>
      <button onClick={onBack} className="mb-3 rounded border border-[#ded7c6] bg-white px-3 py-1.5 text-xs font-bold text-[#726859] hover:bg-[#eae4d5]">← Guildas</button>
      <section className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-[#d7ad5d]/60 bg-[#2b261f] p-4 text-white shadow-sm">
        <img src={guild.logo} alt={guild.name} className="h-28 w-28 object-contain" />
        <div><div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#f2c572]">Guilda</div><h1 className="font-serif text-3xl font-black">{guild.name}</h1><p className="text-sm text-white/75">{guild.tagline}</p><p className="mt-1 text-xs font-bold text-[#f2c572]">{guild.characters} {guild.characters === 1 ? "personagem" : "personagens"} na guilda</p></div>
      </section>

      <section className={`${card} mb-4 flex flex-wrap items-start gap-4`} data-guild-owner>
        <OwnerPortrait name={guild.owner.name} />
        <div className="min-w-0 flex-1">
          <div className="font-serif text-xl font-black text-[#2b261f]">{guild.owner.name}</div>
          <div className="text-[11px] font-bold uppercase text-[#9c9180]">{guild.owner.title}</div>
          <p className="mt-2 rounded-lg border border-[#ded7c6] bg-[#fbf9f4] p-3 text-sm leading-6 text-[#5c5446]">“{guild.welcome}”</p>
        </div>
      </section>

      <section className={card}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-xl font-black text-[#b92b3a]">Lojas disponíveis</h2>
          <button onClick={() => setNote("Em breve: você cria a loja ligada a um personagem seu, com o nome da loja, o que ela oferece e os preços em T$. A loja usa o dinheiro do personagem, o mestre aprova, e só quem está logado e dentro da guilda pode comprar.")} className="rounded bg-[#b92b3a] px-3 py-1.5 text-xs font-black uppercase text-white hover:bg-[#9c1f2d]" data-create-shop>Criar sua loja</button>
        </div>
        {note && <p role="status" className="mb-3 rounded border border-[#c2892c]/60 bg-[#fff6dc] px-3 py-2 text-xs text-[#6b4a12]">{note}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {guild.shops.map((s) => (
            <div key={s.id} className="rounded-lg border border-[#ded7c6] bg-[#fbf9f4] p-3" data-shop>
              <div className="flex items-center justify-between gap-2"><b className="font-serif text-base text-[#2b261f]">{s.name}</b><span className="rounded bg-[#eae4d5] px-1.5 py-0.5 text-[9px] font-black uppercase text-[#726859]">exemplo</span></div>
              <div className="text-[11px] font-bold uppercase text-[#9c9180]">{s.kind}</div>
              <p className="mt-1 text-xs leading-5 text-[#5c5446]">{s.description}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-[#9c9180]">Estas lojas são de exemplo. As lojas de verdade serão dos personagens dos membros.</p>
      </section>
    </div>
  );
};

/** Guildas: lista e, ao entrar, a página da guilda com o dono recebendo e as lojas. */
export const GuildsView: React.FC = () => {
  const { requireLogin } = useAuth();
  const [open, setOpen] = useState<string | null>(null);
  const guild = GUILDS.find((g) => g.id === open);
  if (guild) return <GuildPage guild={guild} onBack={() => setOpen(null)} />;
  return (
    <div className="mx-auto max-w-[1100px] p-3 sm:p-5" data-guild-list>
      <h1 className="font-serif text-3xl font-black text-[#2b261f]">Guildas</h1>
      <p className="mb-4 text-sm text-[#726859]">Comunidades do site. Entre numa guilda para conhecer o dono, os membros e as lojas.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {GUILDS.map((g) => (
          <div key={g.id} className={`${card} flex flex-col`}>
            <div className="grid h-32 place-items-center rounded bg-[#2b261f]"><img src={g.logo} alt="" className="h-28 w-full object-contain" /></div>
            <div className="mt-2 font-serif text-xl font-black text-[#b92b3a]">{g.name}</div>
            <div className="text-[11px] text-[#726859]">{g.tagline}</div>
            <div className="mt-1 text-xs font-bold text-[#2b261f]">{g.characters} {g.characters === 1 ? "personagem" : "personagens"}</div>
            <button onClick={() => { if (requireLogin("Para entrar numa guilda você precisa estar logado.")) setOpen(g.id); }} className="mt-3 w-full rounded bg-[#b92b3a] py-2 text-xs font-black uppercase text-white hover:bg-[#9c1f2d]" data-enter-guild>Entrar na guilda</button>
          </div>
        ))}
      </div>
    </div>
  );
};
