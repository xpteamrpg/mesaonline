import React, { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth/AuthContext";
import { SPELL_SCHOOLS } from "../../lib/t20/compendium";
import { CopyButton } from "../common/CopyButton";
import {
  SPELL_COST_BY_CIRCLE, SPELL_DURATIONS, SPELL_EXECUTIONS, SPELL_RANGES, SPELL_RESISTANCES, SPELL_TYPES,
  deleteMySpell, loadMySpells, newSpellId, saveMySpell, spellAsText, type MySpell, type SaveWhere,
} from "../../lib/homebrew/mySpells";

const inp = "w-full rounded border border-[#ded7c6] bg-[#fbf9f4] p-2 text-sm outline-none focus:border-[#b92b3a]";
const lbl = "mb-1 block text-[10px] font-bold uppercase text-[#726859]";

const blank = (): MySpell => ({
  id: newSpellId(), name: "", circulo: 1, tipo: "Arcana", escola: SPELL_SCHOOLS[0], execucao: "Padrão", alcance: "Curto", alvo: "", duracao: "Instantânea",
  resistencia: "Nenhuma", descricao: "", aprimoramentos: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
});

const Card: React.FC<{ s: MySpell }> = ({ s }) => (
  <div className="rounded-lg border-2 border-[#b92b3a] bg-white p-4 shadow-sm" data-spell-card>
    <div className="font-serif text-2xl font-black text-[#b92b3a]">{s.name || "Sem nome"}</div>
    <div className="text-[11px] font-black uppercase tracking-wide text-[#9c9180]">{s.tipo} {s.circulo} ({s.escola}) · {SPELL_COST_BY_CIRCLE[s.circulo]} PM</div>
    <p className="mt-2 text-xs leading-5 text-[#2b261f]"><b>Execução:</b> {s.execucao}; <b>Alcance:</b> {s.alcance}; <b>Alvo:</b> {s.alvo || "—"}; <b>Duração:</b> {s.duracao}; <b>Resistência:</b> {s.resistencia}.</p>
    {s.descricao && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#5c5446]">{s.descricao}</p>}
    {s.aprimoramentos.length > 0 && <ul className="mt-2 space-y-1 text-sm text-[#5c5446]">{s.aprimoramentos.map((a, i) => <li key={i}><b className="text-[#b92b3a]">+{a.custo} PM:</b> {a.desc}</li>)}</ul>}
  </div>
);

/**
 * Criador de magias. Cada pessoa cria e guarda as próprias magias, e só ela vê (logada na conta). Criação livre da mesa: não é regra oficial
 * e não passa por nenhum balanceamento.
 */
export const SpellCreator: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [spell, setSpell] = useState<MySpell>(blank);
  const [mine, setMine] = useState<MySpell[]>([]);
  const [where, setWhere] = useState<SaveWhere>("navegador");
  const [msg, setMsg] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [newCost, setNewCost] = useState("1");
  const [newDesc, setNewDesc] = useState("");

  useEffect(() => {
    if (!userId) return;
    void loadMySpells(userId).then((r) => { setMine(r.spells); setWhere(r.where); });
  }, [userId]);

  const set = (patch: Partial<MySpell>) => setSpell((s) => ({ ...s, ...patch }));

  const save = async () => {
    const errs: string[] = [];
    if (!spell.name.trim()) errs.push("Dê um nome para a magia.");
    if (!spell.descricao.trim()) errs.push("Escreva a descrição da magia.");
    setErrors(errs); setMsg("");
    if (errs.length || !userId) return;
    const saved = await saveMySpell(userId, { ...spell, name: spell.name.trim() });
    setWhere(saved);
    setMine((list) => [{ ...spell, name: spell.name.trim() }, ...list.filter((s) => s.id !== spell.id)]);
    setMsg(saved === "conta" ? "Magia guardada na sua conta." : "Magia guardada neste navegador, na sua conta local (a guarda na nuvem ainda não está ligada).");
  };

  const addEnhancement = () => {
    if (!newDesc.trim()) return;
    set({ aprimoramentos: [...spell.aprimoramentos, { custo: Math.max(0, Number(newCost) || 0), desc: newDesc.trim() }] });
    setNewDesc("");
  };

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-[#f5f2eb]" role="dialog" aria-modal="true" aria-label="Criador de magias" data-spell-creator>
      <div className="mx-auto max-w-[1200px] p-3 sm:p-6">
        <button onClick={onClose} className="mb-3 rounded border border-[#ded7c6] bg-white px-3 py-1.5 text-xs font-bold text-[#726859] hover:bg-[#eae4d5]">← Voltar ao Homebrew</button>
        <div className="mb-4 border-b-4 border-[#b92b3a] pb-2">
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#9c9180]">Homebrew</div>
          <h1 className="font-serif text-3xl font-black text-[#2b261f]">Criador de magias</h1>
          <p className="mt-1 text-xs text-[#726859]">As magias que você criar aqui são <b>só suas</b>: ficam guardadas na sua conta e ninguém mais vê, nem aparecem no grimório ou no compêndio. É criação livre da mesa, não é regra oficial e não há balanceamento automático.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <section className="space-y-3 rounded-lg border border-[#ded7c6] bg-white p-4 shadow-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><label className={lbl}>Nome da magia *</label><input value={spell.name} onChange={(e) => set({ name: e.target.value })} className={`${inp} font-bold`} placeholder="Ex.: Lança de Cinzas" /></div>
              <div><label className={lbl}>Círculo (custo base {SPELL_COST_BY_CIRCLE[spell.circulo]} PM)</label>
                <select value={spell.circulo} onChange={(e) => set({ circulo: Number(e.target.value) as MySpell["circulo"] })} className={inp}>{[1, 2, 3, 4, 5].map((c) => <option key={c} value={c}>{c}º círculo — {SPELL_COST_BY_CIRCLE[c]} PM</option>)}</select></div>
              <div><label className={lbl}>Tipo</label><select value={spell.tipo} onChange={(e) => set({ tipo: e.target.value as MySpell["tipo"] })} className={inp}>{SPELL_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
              <div><label className={lbl}>Escola</label><select value={spell.escola} onChange={(e) => set({ escola: e.target.value })} className={inp}>{SPELL_SCHOOLS.map((s) => <option key={s}>{s}</option>)}</select></div>
              <div><label className={lbl}>Execução</label><select value={spell.execucao} onChange={(e) => set({ execucao: e.target.value })} className={inp}>{SPELL_EXECUTIONS.map((s) => <option key={s}>{s}</option>)}</select></div>
              <div><label className={lbl}>Alcance</label><select value={spell.alcance} onChange={(e) => set({ alcance: e.target.value })} className={inp}>{SPELL_RANGES.map((s) => <option key={s}>{s}</option>)}</select></div>
              <div><label className={lbl}>Duração</label><select value={spell.duracao} onChange={(e) => set({ duracao: e.target.value })} className={inp}>{SPELL_DURATIONS.map((s) => <option key={s}>{s}</option>)}</select></div>
              <div><label className={lbl}>Resistência</label><select value={spell.resistencia} onChange={(e) => set({ resistencia: e.target.value })} className={inp}>{SPELL_RESISTANCES.map((s) => <option key={s}>{s}</option>)}</select></div>
              <div><label className={lbl}>Alvo / área / efeito</label><input value={spell.alvo} onChange={(e) => set({ alvo: e.target.value })} className={inp} placeholder="Ex.: 1 criatura; esfera com 6m de raio" /></div>
              <div className="sm:col-span-2"><label className={lbl}>Descrição *</label><textarea value={spell.descricao} onChange={(e) => set({ descricao: e.target.value })} rows={5} className={inp} placeholder="O que a magia faz, com os valores (dano, bônus, condição...)." /></div>
            </div>

            <div className="rounded border border-[#ded7c6] bg-[#fbf9f4] p-3">
              <div className={lbl}>Aprimoramentos</div>
              {spell.aprimoramentos.map((a, i) => (
                <div key={i} className="mb-1 flex items-start gap-2 text-sm"><b className="shrink-0 text-[#b92b3a]">+{a.custo} PM</b><span className="flex-1 text-[#5c5446]">{a.desc}</span><button type="button" onClick={() => set({ aprimoramentos: spell.aprimoramentos.filter((_, j) => j !== i) })} className="text-xs font-bold text-[#b92b3a]" aria-label="Remover aprimoramento">✕</button></div>
              ))}
              <div className="mt-2 flex flex-wrap gap-2">
                <input type="number" min="0" value={newCost} onChange={(e) => setNewCost(e.target.value)} className={`${inp} max-w-[90px]`} aria-label="Custo em PM do aprimoramento" />
                <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addEnhancement(); }} className={`${inp} flex-1`} placeholder="O que muda (ex.: aumenta o dano em +1d6)" />
                <button type="button" onClick={addEnhancement} className="rounded border border-[#1c5fb5] px-3 py-2 text-xs font-black uppercase text-[#1c5fb5]">+ Aprimoramento</button>
              </div>
            </div>

            {errors.length > 0 && <ul className="list-disc rounded border border-[#b92b3a] bg-[#fbebee] p-3 pl-6 text-xs font-semibold text-[#b92b3a]">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
            {msg && <p role="status" className="rounded border border-[#2b8a3e] bg-[#ebfbee] p-3 text-xs font-bold text-[#2b8a3e]">{msg}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void save()} className="rounded bg-[#b92b3a] px-6 py-2.5 text-xs font-black uppercase text-white shadow hover:bg-[#9c1f2d]" data-save-spell>Guardar magia</button>
              <button type="button" onClick={() => { setSpell(blank()); setErrors([]); setMsg(""); }} className="rounded border border-[#ded7c6] px-4 py-2.5 text-xs font-black uppercase text-[#726859]">Nova magia</button>
            </div>
          </section>

          <aside className="space-y-3">
            <Card s={spell} />
            <CopyButton text={spellAsText(spell)} label="📋 Copiar texto da magia" className="w-full rounded border border-[#ded7c6] bg-white py-2 text-xs font-bold text-[#726859] hover:bg-[#eae4d5]" />
          </aside>
        </div>

        <section className="mt-6 rounded-lg border border-[#ded7c6] bg-white p-4 shadow-sm" data-my-spells>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-serif text-xl font-black text-[#2b261f]">Minhas magias ({mine.length})</h2>
            <span className="text-[11px] text-[#9c9180]">{where === "conta" ? "Guardadas na sua conta" : "Guardadas neste navegador, na sua conta local"} · só você vê</span>
          </div>
          {mine.length === 0 ? <p className="text-xs text-[#726859]">Nenhuma magia ainda.</p> : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {mine.map((s) => (
                <li key={s.id} className="rounded border border-[#ded7c6] bg-[#fbf9f4] p-3">
                  <div className="font-serif text-base font-black text-[#b92b3a]">{s.name}</div>
                  <div className="text-[10px] font-bold uppercase text-[#9c9180]">{s.tipo} {s.circulo} ({s.escola})</div>
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => { setSpell(s); setMsg(""); setErrors([]); window.scrollTo({ top: 0 }); }} className="rounded border border-[#ded7c6] px-2.5 py-1 text-[11px] font-black uppercase text-[#726859]">Editar</button>
                    <button type="button" onClick={() => { if (confirm(`Apagar "${s.name}"?`)) { void deleteMySpell(userId, s.id); setMine((l) => l.filter((x) => x.id !== s.id)); } }} className="rounded border border-[#ded7c6] px-2.5 py-1 text-[11px] font-black uppercase text-[#b92b3a]">Apagar</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};
