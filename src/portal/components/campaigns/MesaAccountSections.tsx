import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../lib/auth/AuthContext";
import type { CharacterSheet } from "../../types/sheet";
import { T20CharacterSheet } from "../sheet/T20CharacterSheet";
import type { TableEntry } from "../../lib/tables/client";
import {
  answerInvite, characterRequests, characterSheetOf, claimTable, tableParty, type PartyMember, decideCharacter, inviteToTable, kickMember, leaveTable, myCharacterLinks, myInvites, myTables, requestCharacter, tableMembers, unlinkCharacter,
  type LinkRequest, type MyCharacterLink, type MyTable, type TableInvite, type TableMember,
} from "../../lib/campaigns/client";

const btn = "rounded px-3 py-1.5 text-[11px] font-black uppercase";
const reason = (e: unknown) => (e instanceof Error ? e.message : "Algo deu errado.");

const Seal: React.FC<{ kind?: "campanha" | "oneshot" }> = ({ kind }) => (
  <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-white ${kind === "campanha" ? "bg-[#1c5fb5]" : "bg-[#b92b3a]"}`}>{kind === "campanha" ? "Campanha" : "One-shot"}</span>
);

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="my-auto w-full max-w-xl rounded-lg bg-white p-5 shadow-2xl">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-[#ded7c6] pb-2"><h2 className="font-serif text-lg font-black text-[#2b261f]">{title}</h2><button onClick={onClose} aria-label="Fechar" className="h-8 w-8 rounded text-[#726859] hover:bg-[#eae4d5]">✕</button></div>
      {children}
    </div>
  </div>
);

/** Convites do mestre que esperam resposta (aceitos aqui, no site, não dentro da mesa). */
export const ReceivedInvites: React.FC<{ onChanged: () => void }> = ({ onChanged }) => {
  const { user } = useAuth();
  const [list, setList] = useState<TableInvite[]>([]);
  const [msg, setMsg] = useState("");
  const load = useCallback(() => { if (user) myInvites().then(setList).catch(() => setList([])); else setList([]); }, [user?.id]);
  useEffect(load, [load]);
  if (list.length === 0 && !msg) return null;
  const answer = async (id: string, accept: boolean) => {
    try { await answerInvite(id, accept); setMsg(accept ? "Convite aceito. A campanha agora aparece na sua lista." : "Convite recusado."); load(); onChanged(); } catch (e) { setMsg(reason(e)); }
  };
  return (
    <div className="mb-6 rounded-lg border border-[#1c5fb5]/40 bg-[#eef4fc] p-4 shadow-sm">
      <h2 className="font-serif text-base font-black text-[#1c5fb5]">Convites recebidos</h2>
      {msg && <p role="status" className="mt-1 text-[11px] font-bold text-[#1c5fb5]">{msg}</p>}
      <div className="mt-2 space-y-2">
        {list.map((inv) => (
          <div key={inv.inviteId} className="flex flex-wrap items-center gap-2 rounded border border-[#ded7c6] bg-white p-2 text-xs">
            <Seal kind={inv.table.kind} /><b className="font-serif text-sm">{inv.table.name}</b><span className="text-[#9c9180]">convite de {inv.invitedBy}</span>
            <span className="ml-auto flex gap-2"><button onClick={() => answer(inv.inviteId, true)} className={`${btn} bg-[#2f7d32] text-white`}>Aceitar</button><button onClick={() => answer(inv.inviteId, false)} className={`${btn} border border-[#ded7c6] text-[#726859]`}>Recusar</button></span>
          </div>
        ))}
      </div>
    </div>
  );
};

/** "Importar personagem": o jogador escolhe uma ficha dele e pede entrada na campanha (o mestre aceita ou recusa). */
const ImportCharacterDialog: React.FC<{ table: TableEntry; characters: CharacterSheet[]; onClose: () => void }> = ({ table, characters, onClose }) => {
  const [links, setLinks] = useState<MyCharacterLink[]>([]);
  const [msg, setMsg] = useState("");
  const load = useCallback(() => { myCharacterLinks().then((all) => setLinks(all.filter((l) => l.tableId === table.id))).catch(() => setLinks([])); }, [table.id]);
  useEffect(load, [load]);
  const ask = async (c: CharacterSheet) => {
    try { const r = await requestCharacter(table.id, c); setMsg(r.status === "aceito" ? `${c.name} entrou na campanha.` : `Pedido enviado: o mestre precisa aceitar ${c.name}.`); load(); } catch (e) { setMsg(reason(e)); }
  };
  const remove = async (id: string) => { try { await unlinkCharacter(id); load(); } catch (e) { setMsg(reason(e)); } };
  return (
    <Modal title={`Importar personagem · ${table.name}`} onClose={onClose}>
      {msg && <p role="status" className="mb-2 rounded border border-[#c2892c]/60 bg-[#fff6dc] px-2 py-1 text-[11px] font-semibold text-[#6b4a12]">{msg}</p>}
      {characters.length === 0 ? <p className="text-xs text-[#726859]">Você ainda não tem personagens. Crie um em “Meus Personagens”.</p> : (
        <ul className="space-y-1.5">
          {characters.map((c) => {
            const link = links.find((l) => l.characterId === c.id);
            return (
              <li key={c.id} className="flex items-center gap-2 rounded border border-[#ded7c6] bg-[#fbf9f4] p-2 text-xs">
                <span className="min-w-0 flex-1 truncate"><b className="font-serif text-sm">{c.name}</b> <span className="text-[#9c9180]">{c.race} · {c.class} · {c.level}º nível</span></span>
                {link ? (
                  <span className="flex items-center gap-2"><span className="text-[11px] font-bold text-[#726859]">{link.status === "aceito" ? "Na campanha" : link.status === "solicitado" ? "Aguardando o mestre" : "Recusado"}</span><button onClick={() => remove(link.id)} className={`${btn} border border-[#ded7c6] text-[#b92b3a]`}>{link.status === "aceito" ? "Retirar" : "Cancelar"}</button></span>
                ) : <button onClick={() => ask(c)} className={`${btn} bg-[#1c5fb5] text-white`}>Solicitar entrada</button>}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
};

/** Campanhas e one-shots de que a pessoa participa como jogadora (ou como mestre em outro navegador). */
export const ParticipatingTables: React.FC<{ characters: CharacterSheet[]; skipIds: string[]; refreshKey: number; onEnter: (name: string, code: string, asGm: boolean) => void; onManage: (t: TableEntry) => void; onOpenCharacter: (characterId: string) => void }> = ({ characters, skipIds, refreshKey, onEnter, onManage, onOpenCharacter }) => {
  const { user } = useAuth();
  const [list, setList] = useState<MyTable[]>([]);
  const [importing, setImporting] = useState<TableEntry | null>(null);
  const [msg, setMsg] = useState("");
  const load = useCallback(() => { if (user) myTables().then(setList).catch(() => setList([])); else setList([]); }, [user?.id]);
  useEffect(load, [load, refreshKey]);
  const shown = list.filter((m) => m.role === "jogador" || !skipIds.includes(m.table.id));
  if (shown.length === 0) return null;
  const leave = async (m: MyTable) => {
    if (!confirm(`Sair de “${m.table.name}”? Os seus personagens saem só desta campanha e continuam em Meus Personagens.`)) return;
    try { await leaveTable(m.table.id); load(); } catch (e) { setMsg(reason(e)); }
  };
  return (
    <div className="mb-6 rounded-lg border border-[#ded7c6] bg-white p-4 shadow-sm">
      <h2 className="mb-3 font-serif text-base font-black text-[#2b261f]">Campanhas e one-shots em que participo</h2>
      {msg && <p className="mb-2 text-[11px] font-bold text-[#b92b3a]">{msg}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((m) => {
          const t = m.table; const code = t.liveRoomCode || t.code;
          return (
            <div key={t.id} className="flex flex-col rounded-lg border border-[#ded7c6] bg-[#fbf9f4] p-3">
              <div className="flex items-center gap-2"><Seal kind={t.kind} /><span className="text-[10px] font-bold uppercase text-[#9c9180]">{m.role === "mestre" ? "mestre" : "jogador"} · {m.members} na mesa</span></div>
              <div className="mt-1 font-serif text-lg font-black leading-tight text-[#b92b3a]">{t.name}</div>
              {t.gmName && <div className="text-[11px] text-[#9c9180]">Mestre: {t.gmName}</div>}
              <div className="mt-2 flex items-center gap-2 rounded border border-[#ded7c6] bg-white px-2 py-1 text-[11px]"><span className="text-[#9c9180]">Código</span><b className="font-mono tracking-widest">{code}</b></div>
              <PartyStrip tableId={t.id} characters={characters} refreshKey={refreshKey} onOpenOwn={onOpenCharacter} />
              <button onClick={() => onEnter(t.name, code, m.role === "mestre")} className="mt-3 w-full rounded bg-[#b92b3a] py-2 text-xs font-black uppercase text-white hover:bg-[#9c1f2d]">Entrar na mesa online</button>
              <div className="mt-2 flex gap-2">
                {m.role === "jogador"
                  ? <><button onClick={() => setImporting(t)} className={`${btn} flex-1 border border-[#1c5fb5] text-[#1c5fb5]`}>Importar personagem</button><button onClick={() => leave(m)} className={`${btn} border border-[#ded7c6] text-[#726859]`}>Sair</button></>
                  : <button onClick={() => onManage(t)} className={`${btn} flex-1 border border-[#1c5fb5] text-[#1c5fb5]`}>Gerenciar</button>}
              </div>
            </div>
          );
        })}
      </div>
      {importing && <ImportCharacterDialog table={importing} characters={characters} onClose={() => setImporting(null)} />}
    </div>
  );
};

/** Painel do mestre: jogadores (com expulsar), convites e personagens que pediram entrada. */
export const ManageTableDialog: React.FC<{ table: { id: string; name: string; code: string }; token?: string; onClose: () => void }> = ({ table, token, onClose }) => {
  const { user } = useAuth();
  const [members, setMembers] = useState<TableMember[]>([]);
  const [requests, setRequests] = useState<LinkRequest[]>([]);
  const [by, setBy] = useState<"email" | "nickname">("email");
  const [who, setWho] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      if (token && token !== "local") { try { await claimTable(table.id, token); } catch { /* já é o mestre */ } }
      setMembers(await tableMembers(table.id));
      setRequests(await characterRequests(table.id));
    } catch (e) { setMsg(reason(e)); }
  }, [table.id, token]);
  useEffect(() => { void load(); }, [load]);

  const run = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); setMsg(ok); await load(); } catch (e) { setMsg(reason(e)); } };
  const invite = () => run(async () => {
    const r = await inviteToTable(table.id, by === "email" ? { email: who } : { nickname: who });
    setWho("");
    if (!r.hasAccount) setMsg("Convite registrado. O site não envia e-mail: avise a pessoa (WhatsApp, link ou código da mesa). Ela vê o convite ao criar conta e entrar com esse e-mail.");
  }, "Convite registrado. O site não envia e-mail: avise a pessoa; ela vê o convite em Convites recebidos ao entrar na conta.");

  const pending = requests.filter((r) => r.status === "solicitado");
  const accepted = requests.filter((r) => r.status === "aceito");
  return (
    <Modal title={`Gerenciar · ${table.name}`} onClose={onClose}>
      {msg && <p role="status" className="mb-3 rounded border border-[#c2892c]/60 bg-[#fff6dc] px-2 py-1 text-[11px] font-semibold text-[#6b4a12]">{msg}</p>}
      <section>
        <h3 className="text-[11px] font-black uppercase tracking-wide text-[#726859]">Jogadores</h3>
        <ul className="mt-1 space-y-1">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center gap-2 rounded border border-[#ded7c6] bg-[#fbf9f4] px-2 py-1.5 text-xs">
              <b>{m.name}</b><span className="text-[#9c9180]">{m.role === "mestre" ? "mestre" : "jogador"}</span>
              {m.role !== "mestre" && m.userId !== user?.id && <button onClick={() => { if (confirm(`Expulsar ${m.name}? Ele sai desta mesa e só volta com um novo convite. Os personagens dele saem só desta campanha: continuam na conta dele, em Meus Personagens (nada é apagado).`)) void run(() => kickMember(table.id, m.userId), `${m.name} foi expulso.`); }} className={`${btn} ml-auto border border-[#b92b3a] text-[#b92b3a]`}>Expulsar</button>}
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-4">
        <h3 className="text-[11px] font-black uppercase tracking-wide text-[#726859]">Convidar</h3>
        <p className="mt-1 text-[11px] text-[#9c9180]">O jeito mais simples: mande o código <b className="font-mono tracking-widest text-[#2b261f]">{table.code}</b>. Também dá para convidar por e-mail ou apelido; a pessoa aceita no site.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <select value={by} onChange={(e) => setBy(e.target.value as "email" | "nickname")} className="rounded border border-[#ded7c6] bg-white p-2 text-xs"><option value="email">E-mail</option><option value="nickname">Apelido</option></select>
          <input value={who} onChange={(e) => setWho(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void invite(); }} placeholder={by === "email" ? "email@exemplo.com" : "apelido ou @identificador"} className="min-w-0 flex-1 rounded border border-[#ded7c6] bg-white p-2 text-xs" />
          <button onClick={() => void invite()} disabled={!who.trim()} className={`${btn} bg-[#1c5fb5] text-white disabled:opacity-50`}>Convidar</button>
        </div>
      </section>
      <section className="mt-4">
        <h3 className="text-[11px] font-black uppercase tracking-wide text-[#726859]">Personagens pedindo entrada ({pending.length})</h3>
        {pending.length === 0 ? <p className="mt-1 text-xs text-[#9c9180]">Nenhum pedido no momento.</p> : (
          <ul className="mt-1 space-y-1">{pending.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 rounded border border-[#ded7c6] bg-[#fbf9f4] px-2 py-1.5 text-xs">
              <span className="min-w-0 flex-1"><b className="font-serif text-sm">{r.summary.name}</b> <span className="text-[#9c9180]">{[r.summary.race, r.summary.class, r.summary.level ? `${r.summary.level}º nível` : ""].filter(Boolean).join(" · ")} · de {r.ownerName}</span></span>
              <button onClick={() => void run(() => decideCharacter(r.id, true), `${r.summary.name} entrou na campanha.`)} className={`${btn} bg-[#2f7d32] text-white`}>Aceitar</button>
              <button onClick={() => void run(() => decideCharacter(r.id, false), `${r.summary.name} foi recusado.`)} className={`${btn} border border-[#ded7c6] text-[#726859]`}>Recusar</button>
            </li>
          ))}</ul>
        )}
      </section>
      <section className="mt-4">
        <h3 className="text-[11px] font-black uppercase tracking-wide text-[#726859]">Personagens na campanha ({accepted.length})</h3>
        {accepted.length === 0 ? <p className="mt-1 text-xs text-[#9c9180]">Nenhum personagem ligado ainda.</p> : (
          <ul className="mt-1 space-y-1">{accepted.map((r) => (
            <li key={r.id} className="flex items-center gap-2 rounded border border-[#ded7c6] bg-white px-2 py-1.5 text-xs">
              <span className="min-w-0 flex-1 truncate"><b className="font-serif text-sm">{r.summary.name}</b> <span className="text-[#9c9180]">{[r.summary.race, r.summary.class, r.summary.level ? `${r.summary.level}º nível` : ""].filter(Boolean).join(" · ")} · de {r.ownerName}</span></span>
              <button onClick={() => void run(() => unlinkCharacter(r.id), "Personagem removido da campanha.")} className={`${btn} border border-[#ded7c6] text-[#b92b3a]`}>Remover</button>
            </li>
          ))}</ul>
        )}
      </section>
    </Modal>
  );
};

/**
 * Personagens que estão na mesa: só a cabeça (miniatura do retrato) e o nome. Clicar abre a ficha:
 * o personagem é seu → vai para a ficha no site; é de outra pessoa da mesa → abre a cópia da ficha (só leitura: não rola nem edita).
 */
export const PartyStrip: React.FC<{ tableId: string; characters: CharacterSheet[]; refreshKey?: number; onOpenOwn: (characterId: string) => void }> = ({ tableId, characters, refreshKey = 0, onOpenOwn }) => {
  const { user } = useAuth();
  const [party, setParty] = useState<PartyMember[] | null>(null);
  const [shown, setShown] = useState<{ name: string; sheet: CharacterSheet } | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (!user) { setParty(null); return; }
    tableParty(tableId).then(setParty).catch(() => setParty([]));
  }, [tableId, user?.id, refreshKey]);
  if (!user || party === null) return null;

  const open = async (m: PartyMember) => {
    setMsg("");
    if (m.ownerId === user.id && characters.some((c) => c.id === m.characterId)) { onOpenOwn(m.characterId); return; }
    try {
      const sheet = await characterSheetOf(m.id);
      if (sheet) setShown({ name: m.summary.name, sheet: { ...sheet, avatar: m.summary.avatar } });
      else setMsg("Esta ficha ainda não foi compartilhada na mesa. Peça para o jogador ligar o personagem de novo.");
    } catch (e) { setMsg(reason(e)); }
  };

  return (
    <div className="mt-2 rounded border border-[#ded7c6] bg-white px-2 py-1.5">
      <div className="text-[9px] font-black uppercase tracking-wide text-[#9c9180]">Personagens na mesa</div>
      {party.length === 0 ? <p className="text-[11px] text-[#9c9180]">Nenhum personagem ainda.</p> : (
        <div className="mt-1 flex flex-wrap gap-2">
          {party.map((m) => (
            <button key={m.id} type="button" onClick={() => void open(m)} title={`${m.summary.name} · ${[m.summary.race, m.summary.class, m.summary.level ? `${m.summary.level}º nível` : ""].filter(Boolean).join(" · ")} · de ${m.ownerName}`} className="flex w-[58px] flex-col items-center gap-0.5 text-center">
              {m.summary.avatar
                ? <img src={m.summary.avatar} alt="" className="h-10 w-10 rounded-full border-2 border-[#b92b3a]/60 object-cover" />
                : <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-[#b92b3a]/60 bg-[#ece7d3] text-sm font-black text-[#7a705d]">{(m.summary.name || "?")[0]?.toUpperCase()}</span>}
              <span className="w-full truncate text-[10px] font-bold leading-tight text-[#2b261f]">{m.summary.name}</span>
            </button>
          ))}
        </div>
      )}
      {msg && <p className="mt-1 text-[10px] font-bold text-[#b92b3a]">{msg}</p>}
      {shown && (
        <div className="fixed inset-0 z-[90] overflow-y-auto bg-black/60 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`Ficha de ${shown.name}`} onMouseDown={(e) => { if (e.target === e.currentTarget) setShown(null); }}>
          <div className="mx-auto max-w-[1300px] rounded-lg bg-[#f5f2eb] p-3 shadow-2xl">
            <div className="mb-2 flex items-center justify-between"><b className="font-serif text-lg">Ficha de {shown.name} (só leitura)</b><button onClick={() => setShown(null)} className="rounded border border-[#ded7c6] bg-white px-3 py-1 text-xs font-bold">Fechar</button></div>
            <div className="pointer-events-none select-text"><T20CharacterSheet sheet={shown.sheet} onUpdate={() => undefined} onRoll={() => undefined} onEdit={() => undefined} onQuickEdit={() => undefined} onClone={() => undefined} onLevelUp={() => undefined} /></div>
          </div>
        </div>
      )}
    </div>
  );
};
