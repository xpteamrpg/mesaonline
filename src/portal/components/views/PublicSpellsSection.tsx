import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../lib/auth/AuthContext";
import { listPublicSpells, parseSpellKey, spellLink, unpublishSpell, type PublicSpell } from "../../lib/homebrew/publicSpells";
import { calcular } from "../../lib/homebrew/spellCost";
import { textoPlano } from "../../lib/homebrew/spellText";
import { CopyButton } from "../common/CopyButton";
import { MagiaCard } from "./MagiaCard";

const inp = "rounded border border-[#ded7c6] bg-[#fbf9f4] p-2 text-sm outline-none focus:border-[#b92b3a]";
const keyOf = (s: PublicSpell) => `${s.ownerId}~${s.magia.id}`;

const AuthorChip: React.FC<{ s: PublicSpell }> = ({ s }) => {
  const [open, setOpen] = useState(false);
  const a = s.author;
  return (
    <div className="mt-3 border-t border-[#ded7c6] pt-3" data-spell-author>
      <div className="flex items-center gap-3">
        {a.avatar ? <img src={a.avatar} alt="" className="h-11 w-11 rounded-full border-2 border-[#b92b3a]/60 object-cover" /> : <span className="grid h-11 w-11 place-items-center rounded-full border-2 border-[#b92b3a]/60 bg-[#ece7d3] text-base font-black text-[#7a705d]">{(a.name || "?")[0]?.toUpperCase()}</span>}
        <div className="min-w-0 flex-1"><div className="text-[9px] font-black uppercase text-[#9c9180]">Criada por</div><div className="truncate font-serif text-base font-black text-[#2b261f]">{a.name}</div>{a.handle && <div className="text-xs text-[#726859]">@{a.handle}</div>}</div>
        {a.contact && <button type="button" onClick={() => setOpen((v) => !v)} className="rounded border border-[#1c5fb5] px-2.5 py-1 text-[11px] font-black uppercase text-[#1c5fb5]" data-author-contact>Entrar em contato</button>}
      </div>
      {a.bio && <p className="mt-2 text-xs text-[#5c5446]">{a.bio}</p>}
      {open && a.contact && <p className="mt-2 rounded border border-[#1c5fb5]/40 bg-[#eef4fc] p-2 text-xs text-[#12315f]" data-author-contact-text>{a.contact}</p>}
    </div>
  );
};

/** Magias que as pessoas publicaram no Homebrew, com o perfil de quem criou e como falar com a pessoa. */
export const PublicSpellsSection: React.FC = () => {
  const { user } = useAuth();
  const [list, setList] = useState<PublicSpell[] | null>(null);
  const [q, setQ] = useState("");
  const focus = useMemo(() => parseSpellKey(new URLSearchParams(window.location.hash.split("?")[1] || "").get("magia") || ""), []);
  useEffect(() => { void listPublicSpells().then(setList); }, []);
  if (list === null || (list.length === 0 && !focus)) return null;
  const needle = q.trim().toLowerCase();
  const shown = list.filter((s) => (!focus || (s.ownerId === focus.ownerId && s.magia.id === focus.id)) && (!needle || `${s.magia.nome} ${s.magia.escola} ${s.magia.tipo} ${s.author.name} ${s.author.handle ?? ""}`.toLowerCase().includes(needle)));
  return (
    <section id="magias-da-comunidade" className="mb-4 rounded-lg border border-[#b92b3a]/40 bg-white p-4 shadow-sm" data-public-spells>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-xl font-black text-[#b92b3a]">✨ Magias da comunidade ({list.length})</h2>
        {focus ? <a href="#/homebrew" onClick={() => window.location.reload()} className="text-xs font-bold text-[#1c5fb5] underline">ver todas</a> : <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar magia ou autor…" className={`${inp} w-56`} aria-label="Buscar magia publicada" />}
      </div>
      <p className="mb-3 text-[11px] text-[#9c9180]">Criadas por jogadores no Criador de magias. É criação livre, não é regra oficial de Tormenta 20.</p>
      {shown.length === 0 ? <p className="text-xs text-[#726859]">Nenhuma magia encontrada.</p> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {shown.map((s) => (
            <MagiaCard key={keyOf(s)} m={s.magia} r={calcular(s.magia)}>
              <AuthorChip s={s} />
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyButton text={textoPlano(s.magia, calcular(s.magia))} label="📋 Copiar texto" className="rounded border border-[#ded7c6] bg-white px-3 py-1.5 text-[11px] font-bold text-[#726859] hover:bg-[#eae4d5]" />
                <CopyButton text={spellLink(s.ownerId, s.magia.id)} label="🔗 Copiar link" className="rounded border border-[#ded7c6] bg-white px-3 py-1.5 text-[11px] font-bold text-[#726859] hover:bg-[#eae4d5]" />
                {user?.id === s.ownerId && <button type="button" onClick={() => { if (confirm(`Despublicar "${s.magia.nome}"? Ela continua nas suas magias.`)) void unpublishSpell(s.ownerId, s.magia.id).then((ok) => { if (ok) setList((l) => (l ?? []).filter((x) => keyOf(x) !== keyOf(s))); }); }} className="rounded border border-[#ded7c6] px-3 py-1.5 text-[11px] font-black uppercase text-[#b92b3a]">Despublicar</button>}
              </div>
            </MagiaCard>
          ))}
        </div>
      )}
    </section>
  );
};
