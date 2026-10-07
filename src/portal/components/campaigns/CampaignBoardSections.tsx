import React, { useState } from "react";
import { newId, type BoardAlly, type BoardMission, type BoardPlace, type CampaignBoard } from "../../lib/campaigns/board";

const inp = "w-full rounded border border-[#ded7c6] bg-[#fbf9f4] p-2 text-xs";
const card = "rounded-lg border border-[#ded7c6] bg-white p-3 shadow-sm";
const small = "rounded border px-2.5 py-1 text-[11px] font-black uppercase";

export type BoardKind = "allies" | "missions" | "places";

/** Campo de texto que vira edição quando o cartão está em modo de edição. */
const Field: React.FC<{ label: string; value: string; editing: boolean; onChange: (v: string) => void; multiline?: boolean }> = ({ label, value, editing, onChange, multiline }) => (
  editing
    ? <label className="mt-1 block text-[10px] font-bold uppercase text-[#9c9180]">{label}{multiline ? <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className={`${inp} mt-0.5 normal-case`} /> : <input value={value} onChange={(e) => onChange(e.target.value)} className={`${inp} mt-0.5 normal-case`} />}</label>
    : value ? <p className="mt-1 text-xs leading-5 text-[#5c5446]"><span className="font-bold text-[#2b261f]">{label}: </span>{value}</p> : null
);

/** Um cartão do quadro: mostra, edita e remove; em modo só leitura (campanha oficial) oferece "Clonar". */
function ItemCard<T extends { id: string }>({ item, readOnly, onSave, onRemove, onClone, title, extra, children }: {
  item: T; readOnly?: boolean; onSave?: (next: T) => void; onRemove?: () => void; onClone?: () => void; title: (draft: T) => React.ReactNode; extra?: React.ReactNode;
  children: (draft: T, editing: boolean, set: (patch: Partial<T>) => void) => React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item);
  const set = (patch: Partial<T>) => setDraft((d) => ({ ...d, ...patch }));
  return (
    <div className={card}>
      <div className="flex items-start justify-between gap-2"><div className="min-w-0 flex-1 font-serif text-base font-black text-[#2b261f]">{title(editing ? draft : item)}</div>{extra}</div>
      {children(editing ? draft : item, editing, set)}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {readOnly
          ? onClone && <button onClick={onClone} className={`${small} border-[#1c5fb5] bg-[#1c5fb5] text-white`} data-clone>Clonar</button>
          : editing
            ? <><button onClick={() => { onSave?.(draft); setEditing(false); }} className={`${small} border-[#2f7d32] bg-[#2f7d32] text-white`}>Salvar</button><button onClick={() => { setDraft(item); setEditing(false); }} className={`${small} border-[#ded7c6] text-[#726859]`}>Cancelar</button></>
            : <><button onClick={() => { setDraft(item); setEditing(true); }} className={`${small} border-[#ded7c6] text-[#726859]`}>Editar</button><button onClick={() => { if (confirm("Remover este item?")) onRemove?.(); }} className={`${small} border-[#ded7c6] text-[#b92b3a]`}>Remover</button></>}
      </div>
    </div>
  );
}

const Section: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <section className="rounded-lg border border-[#ded7c6] bg-[#fbf9f4] p-4">
    <h2 className="font-serif text-xl font-black text-[#b92b3a]">{title}</h2>
    {hint && <p className="mb-3 text-[11px] text-[#9c9180]">{hint}</p>}
    {children}
  </section>
);

/** Formulário de uma linha para acrescentar um item. */
const AddRow: React.FC<{ fields: { key: string; placeholder: string; wide?: boolean }[]; button: string; onAdd: (values: Record<string, string>) => void }> = ({ fields, button, onAdd }) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const first = fields[0].key;
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {fields.map((f) => <input key={f.key} value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} placeholder={f.placeholder} className={`${inp} ${f.wide ? "flex-[2_1_220px]" : "flex-[1_1_150px]"}`} />)}
      <button onClick={() => { if (!(values[first] ?? "").trim()) return; onAdd(values); setValues({}); }} className="rounded bg-[#b92b3a] px-3 py-2 text-xs font-black uppercase text-white hover:bg-[#9c1f2d]">{button}</button>
    </div>
  );
};

/**
 * NPCs aliados, missões e estabelecimentos. Editável na área do mestre; na campanha oficial é só leitura e cada item tem "Clonar"
 * (leva o item para uma das suas campanhas, onde você edita do seu jeito).
 */
export const CampaignBoardSections: React.FC<{ board: CampaignBoard; onChange?: (next: CampaignBoard) => void; readOnly?: boolean; onClone?: (kind: BoardKind, id: string) => void }> = ({ board, onChange, readOnly, onClone }) => {
  const update = (patch: Partial<CampaignBoard>) => onChange?.({ ...board, ...patch });
  const clone = (kind: BoardKind, id: string) => (readOnly && onClone ? () => onClone(kind, id) : undefined);
  const empty = (text: string) => <p className="rounded border border-dashed border-[#ded7c6] p-4 text-center text-xs text-[#726859]">{text}</p>;
  return (
    <div className="space-y-4">
      <Section title="NPCs aliados" hint="Quem ajuda o grupo, o que cada um oferece e o bônus que dá.">
        {!readOnly && <AddRow fields={[{ key: "name", placeholder: "Nome do NPC aliado" }, { key: "desc", placeholder: "Quem é", wide: true }, { key: "bonus", placeholder: "Bônus que oferece" }]} button="Adicionar aliado" onAdd={(v) => update({ allies: [...board.allies, { id: newId(), name: v.name.trim(), desc: v.desc ?? "", bonus: v.bonus ?? "" }] })} />}
        {board.allies.length === 0 ? empty("Nenhum aliado ainda.") : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {board.allies.map((a) => (
              <ItemCard<BoardAlly> key={a.id} item={a} readOnly={readOnly} onClone={clone("allies", a.id)} onRemove={() => update({ allies: board.allies.filter((x) => x.id !== a.id) })} onSave={(next) => update({ allies: board.allies.map((x) => (x.id === a.id ? next : x)) })}
                title={(d) => d.name}>
                {(d, editing, set) => <><Field label="Nome" value={d.name} editing={editing} onChange={(v) => set({ name: v })} /><Field label="Quem é" value={d.desc} editing={editing} onChange={(v) => set({ desc: v })} multiline /><Field label="Bônus" value={d.bonus} editing={editing} onChange={(v) => set({ bonus: v })} /></>}
              </ItemCard>
            ))}
          </div>
        )}
      </Section>

      <Section title="Missões" hint="Marque como concluída quando o grupo terminar.">
        {!readOnly && <AddRow fields={[{ key: "nome", placeholder: "Nome da missão" }, { key: "descricao", placeholder: "Descrição / objetivo", wide: true }, { key: "recompensa", placeholder: "Recompensa" }]} button="Adicionar missão" onAdd={(v) => update({ missions: [...board.missions, { id: newId(), nome: v.nome.trim(), descricao: v.descricao ?? "", recompensa: v.recompensa ?? "", completa: false }] })} />}
        {board.missions.length === 0 ? empty("Nenhuma missão ainda.") : (
          <div className="space-y-2">
            {board.missions.map((m) => (
              <ItemCard<BoardMission> key={m.id} item={m} readOnly={readOnly} onClone={clone("missions", m.id)} onRemove={() => update({ missions: board.missions.filter((x) => x.id !== m.id) })} onSave={(next) => update({ missions: board.missions.map((x) => (x.id === m.id ? next : x)) })}
                title={(d) => <span className={d.completa ? "text-[#2f7d32] line-through" : ""}>{d.nome}</span>}
                extra={!readOnly ? <label className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-[#726859]"><input type="checkbox" checked={m.completa} onChange={(e) => update({ missions: board.missions.map((x) => (x.id === m.id ? { ...x, completa: e.target.checked } : x)) })} /> Concluída</label> : null}>
                {(d, editing, set) => <><Field label="Nome" value={d.nome} editing={editing} onChange={(v) => set({ nome: v })} /><Field label="Objetivo" value={d.descricao} editing={editing} onChange={(v) => set({ descricao: v })} multiline /><Field label="Recompensa" value={d.recompensa} editing={editing} onChange={(v) => set({ recompensa: v })} /></>}
              </ItemCard>
            ))}
          </div>
        )}
      </Section>

      <Section title="Estabelecimentos" hint="Locais da cidade, o que oferecem e as honrarias que o grupo pode ganhar.">
        {!readOnly && <AddRow fields={[{ key: "nome", placeholder: "Nome do estabelecimento" }, { key: "descricao", placeholder: "Descrição", wide: true }, { key: "servicos", placeholder: "Serviços" }, { key: "honrarias", placeholder: "Honrarias" }]} button="Adicionar local" onAdd={(v) => update({ places: [...board.places, { id: newId(), nome: v.nome.trim(), descricao: v.descricao ?? "", servicos: v.servicos ?? "", honrarias: v.honrarias ?? "" }] })} />}
        {board.places.length === 0 ? empty("Nenhum estabelecimento ainda.") : (
          <div className="grid gap-3 sm:grid-cols-2">
            {board.places.map((p) => (
              <ItemCard<BoardPlace> key={p.id} item={p} readOnly={readOnly} onClone={clone("places", p.id)} onRemove={() => update({ places: board.places.filter((x) => x.id !== p.id) })} onSave={(next) => update({ places: board.places.map((x) => (x.id === p.id ? next : x)) })}
                title={(d) => d.nome}>
                {(d, editing, set) => <>
                  {d.imagem && !editing && <img src={d.imagem} alt="" className="mt-1 aspect-video w-full rounded object-cover" />}
                  <Field label="Nome" value={d.nome} editing={editing} onChange={(v) => set({ nome: v })} /><Field label="Descrição" value={d.descricao} editing={editing} onChange={(v) => set({ descricao: v })} multiline />
                  <Field label="Serviços" value={d.servicos} editing={editing} onChange={(v) => set({ servicos: v })} /><Field label="Honrarias" value={d.honrarias} editing={editing} onChange={(v) => set({ honrarias: v })} />
                </>}
              </ItemCard>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
};
