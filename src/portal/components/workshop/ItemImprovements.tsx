import React, { useState } from "react";
import type { EquipmentItem } from "../../types/sheet";
import { MAX_IMPROVEMENTS, eligibleImprovements, improvementCost, improvementProblem, withImprovements } from "../../lib/t20/improvements";

/** Melhorias de um item da Oficina: escolhe até 4 (cada uma 1×); o preço sobe pela Tabela 3-7 (Tormenta20 p.164). */
export const ItemImprovements: React.FC<{ item: EquipmentItem; onChange: (next: EquipmentItem) => void }> = ({ item, onChange }) => {
  const [open, setOpen] = useState(false);
  const options = eligibleImprovements(item);
  if (!options.length) return null;
  const chosen = item.modifications ?? [];
  const cost = improvementCost(chosen.length);
  const toggle = (name: string) => {
    const next = chosen.includes(name) ? chosen.filter((entry) => entry !== name) : chosen.length < MAX_IMPROVEMENTS ? [...chosen, name] : chosen;
    onChange(withImprovements(item, next));
  };
  return (
    <div className="mt-1 w-full text-[10px]">
      <button type="button" onClick={() => setOpen((value) => !value)} className="font-bold text-[#1c5fb5] hover:underline" aria-expanded={open}>
        Melhorias ({chosen.length}/{MAX_IMPROVEMENTS}){chosen.length ? ` · +T$ ${cost.price} · fabricação CD +${cost.cd}` : ""} {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="mt-1 max-h-40 space-y-0.5 overflow-y-auto rounded border border-[#ded7c6] bg-white p-1.5" data-improvements>
          {options.map((mod) => {
            const on = chosen.includes(mod.nome);
            const problem = on ? undefined : improvementProblem(mod, chosen);
            const full = !on && chosen.length >= MAX_IMPROVEMENTS;
            return (
              <label key={mod.id} className={`flex items-start gap-1.5 ${problem || full ? "opacity-50" : ""}`} title={mod.descricao}>
                <input type="checkbox" checked={on} disabled={Boolean(problem) || full} onChange={() => toggle(mod.nome)} />
                <span><b>{mod.nome}</b>{problem ? <em className="text-[#b92b3a]"> ({problem})</em> : null}<span className="text-[#726859]"> — {mod.descricao.replace(/^(Melhoria para|Aplicável em:?)[^.]*?(que|\.)\s*/i, "").slice(0, 90)}</span></span>
              </label>
            );
          })}
          <p className="pt-1 text-[#9c9180]">Preço total das melhorias (não por melhoria): 1 = +T$ 300, 2 = +T$ 3.000, 3 = +T$ 9.000, 4 = +T$ 18.000. Material especial: o preço do material é à parte.</p>
        </div>
      )}
    </div>
  );
};
