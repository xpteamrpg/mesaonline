import React from "react";
import { CONTENT_WARNINGS, EXPERIENCE_LEVELS, RECURRENCES, SAFETY_TOOLS, TECH_REQUIREMENTS, WEEKDAYS, type TableDetails, type TableSession } from "../../lib/tables/details";

const inp = "w-full rounded border border-[#ded7c6] bg-[#fbf9f4] p-2 text-xs";
const chip = (on: boolean) => `rounded-full border px-2.5 py-1 text-[11px] font-bold ${on ? "border-[#b92b3a] bg-[#b92b3a] text-white" : "border-[#ded7c6] bg-white text-[#726859] hover:bg-[#eae4d5]"}`;

const toggle = (list: string[] | undefined, value: string) => (list ?? []).includes(value) ? (list ?? []).filter((x) => x !== value) : [...(list ?? []), value];

/** Campos da página de detalhe da mesa (criar e editar usam os mesmos). */
export const TableDetailsFields: React.FC<{ value: TableDetails; onChange: (next: TableDetails) => void }> = ({ value, onChange }) => {
  const set = (patch: Partial<TableDetails>) => onChange({ ...value, ...patch });
  const sessions = value.sessions ?? [];
  const setSession = (index: number, patch: Partial<TableSession>) => set({ sessions: sessions.map((s, i) => (i === index ? { ...s, ...patch } : s)) });
  return (
    <fieldset className="mt-1 space-y-3 rounded border border-[#ded7c6] p-3 sm:col-span-2" data-table-details-fields>
      <legend className="px-1 text-[11px] font-black uppercase tracking-wide text-[#726859]">Página da mesa (detalhes)</legend>

      <div>
        <div className="mb-1 text-[11px] font-bold text-[#726859]">Horários das sessões</div>
        {sessions.map((s, i) => (
          <div key={i} className="mb-1 flex flex-wrap items-center gap-1.5">
            <select value={s.day} onChange={(e) => setSession(i, { day: e.target.value })} className={`${inp} max-w-[120px]`}>{WEEKDAYS.map((d) => <option key={d}>{d}</option>)}</select>
            <input type="time" value={s.start} onChange={(e) => setSession(i, { start: e.target.value })} className={`${inp} max-w-[110px]`} aria-label="Início" />
            <input type="time" value={s.end} onChange={(e) => setSession(i, { end: e.target.value })} className={`${inp} max-w-[110px]`} aria-label="Fim" />
            <select value={s.recurrence} onChange={(e) => setSession(i, { recurrence: e.target.value as TableSession["recurrence"] })} className={`${inp} max-w-[110px]`}>{RECURRENCES.map((r) => <option key={r}>{r}</option>)}</select>
            <button type="button" onClick={() => set({ sessions: sessions.filter((_, j) => j !== i) })} className="rounded border border-[#ded7c6] px-2 py-1 text-[11px] font-bold text-[#b92b3a]" aria-label="Remover horário">✕</button>
          </div>
        ))}
        <button type="button" onClick={() => set({ sessions: [...sessions, { day: "Sábado", start: "20:00", end: "", recurrence: "semanal" }] })} className="rounded border border-[#1c5fb5] px-2.5 py-1 text-[11px] font-black uppercase text-[#1c5fb5]">+ Horário</button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <select value={value.experience ?? "todos"} onChange={(e) => set({ experience: e.target.value })} className={inp} aria-label="Experiência">{EXPERIENCE_LEVELS.map((x) => <option key={x} value={x}>Experiência: {x}</option>)}</select>
        <input value={value.language ?? ""} onChange={(e) => set({ language: e.target.value })} placeholder="Idioma (pt-BR)" className={inp} />
        <input value={value.communication ?? ""} onChange={(e) => set({ communication: e.target.value })} placeholder="Onde o grupo conversa (Discord, WhatsApp...)" className={inp} />
        <input value={value.whatsapp ?? ""} onChange={(e) => set({ whatsapp: e.target.value })} placeholder="WhatsApp do mestre (com DDD)" inputMode="tel" className={inp} />
      </div>
      <label className="flex items-center gap-2 text-[11px] text-[#726859]"><input type="checkbox" checked={Boolean(value.acceptsDonations)} onChange={(e) => set({ acceptsDonations: e.target.checked })} /> Aceita doações (combinadas direto com o mestre)</label>

      <textarea value={value.rules ?? ""} onChange={(e) => set({ rules: e.target.value })} rows={3} placeholder="Regras da mesa (possíveis gatilhos, requisitos, observações, regras adicionais...)" className={inp} />
      <input value={value.scenario ?? ""} onChange={(e) => set({ scenario: e.target.value })} placeholder="Cenário (ex.: Arton, Valkaria)" className={inp} />
      <input value={(value.scenarioTags ?? []).join(", ")} onChange={(e) => set({ scenarioTags: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} placeholder="Etiquetas do cenário, separadas por vírgula (Fantasia, Horror...)" className={inp} />

      <div>
        <div className="mb-1 text-[11px] font-bold text-[#726859]">Avisos de conteúdo</div>
        <div className="flex flex-wrap gap-1.5">{Object.keys(CONTENT_WARNINGS).map((w) => <button key={w} type="button" aria-pressed={(value.contentWarnings ?? []).includes(w)} onClick={() => set({ contentWarnings: toggle(value.contentWarnings, w) })} className={chip((value.contentWarnings ?? []).includes(w))}>{w}</button>)}</div>
      </div>
      <div>
        <div className="mb-1 text-[11px] font-bold text-[#726859]">Ferramentas de segurança</div>
        <div className="flex flex-wrap gap-1.5">{Object.keys(SAFETY_TOOLS).map((w) => <button key={w} type="button" aria-pressed={(value.safetyTools ?? []).includes(w)} onClick={() => set({ safetyTools: toggle(value.safetyTools, w) })} className={chip((value.safetyTools ?? []).includes(w))}>{w}</button>)}</div>
      </div>
      <div>
        <div className="mb-1 text-[11px] font-bold text-[#726859]">Requisitos técnicos</div>
        <div className="flex flex-wrap gap-1.5">{TECH_REQUIREMENTS.map((w) => <button key={w} type="button" aria-pressed={(value.techRequirements ?? []).includes(w)} onClick={() => set({ techRequirements: toggle(value.techRequirements, w) })} className={chip((value.techRequirements ?? []).includes(w))}>{w}</button>)}</div>
      </div>
    </fieldset>
  );
};
