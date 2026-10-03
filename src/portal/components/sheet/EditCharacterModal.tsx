import { CampaignInvitesBox } from "../campaigns/CampaignInvitesBox";
import React, { useState } from "react";
import type { CharacterSheet } from "../../types/sheet";
import { ATTR_KEYS, T20_CLASSES, T20_DEITIES, T20_ORIGINS, T20_RACES } from "../../lib/t20/compendium";
import { classAbilitiesFor, racialAbilitiesFor, recalc } from "../../lib/t20/sheetRules";
import { ImagePicker } from "../common/ImagePicker";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  current: CharacterSheet;
  onSave: (s: CharacterSheet) => void;
  campaignNames?: string[];
}

export const EditCharacterModal: React.FC<Props> = ({ isOpen, onClose, current, onSave, campaignNames = [] }) => {
  const [f, setF] = useState<CharacterSheet>(() => JSON.parse(JSON.stringify(current)));
  const [autoHp, setAutoHp] = useState(true);
  if (!isOpen) return null;

  const set = (p: Partial<CharacterSheet>) => setF({ ...f, ...p });
  const inp = "w-full rounded border border-[#ded7c6] bg-white p-2 text-xs";
  const lbl = "mb-1 block text-[10px] font-bold uppercase text-[#726859]";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    let out = { ...f };
    if (out.raceId && out.raceId !== current.raceId) {
      out.race = T20_RACES.find((r) => r.id === out.raceId)?.nome ?? out.race;
      out.racialAbilities = racialAbilitiesFor(out.raceId);
      out.speed = T20_RACES.find((r) => r.id === out.raceId)?.deslocamento ?? out.speed;
    }
    if (out.classId && out.classId !== current.classId) {
      out.class = T20_CLASSES.find((c) => c.id === out.classId)?.nome ?? out.class;
      out.classAbilities = classAbilitiesFor(out.classId, undefined, out.level);
    }
    if (autoHp) out = recalc(out);
    else out = { ...out, classAbilities: out.classId ? classAbilitiesFor(out.classId, undefined, out.level) : out.classAbilities };
    onSave(out);
    onClose();
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg border border-[#ded7c6] bg-[#fbf9f4] p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between border-b border-[#ded7c6] pb-3">
          <h2 className="font-serif text-lg font-black text-[#2b261f]">✏️ Editar personagem</h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded text-sm font-bold text-[#726859] hover:bg-[#eae4d5] hover:text-[#b92b3a]">✕</button>
        </div>

        <form onSubmit={submit} className="flex-1 space-y-4 overflow-y-auto pr-1 text-xs text-[#2b261f]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className={lbl}>Nome</label><input value={f.name} onChange={(e) => set({ name: e.target.value })} className={`${inp} font-bold`} required /></div>
            <div><label className={lbl}>Mesa online</label><input list="edit-campaign-options" value={f.campaign} onChange={(e) => set({ campaign: e.target.value })} className={inp} /><datalist id="edit-campaign-options">{campaignNames.map((name) => <option key={name} value={name} />)}</datalist></div>
            <div className="sm:col-span-2"><CampaignInvitesBox /></div>
            <div>
              <label className={lbl}>Raça</label>
              <select value={f.raceId ?? ""} onChange={(e) => set({ raceId: e.target.value })} className={inp}>
                <option value="">{f.race}</option>
                {T20_RACES.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Classe & Nível</label>
              <div className="flex gap-2">
                <select value={f.classId ?? ""} onChange={(e) => set({ classId: e.target.value })} className={`${inp} w-3/4`}>
                  <option value="">{f.class}</option>
                  {T20_CLASSES.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <input type="number" min={1} max={20} value={f.level} onChange={(e) => set({ level: Math.max(1, Math.min(20, Number(e.target.value))) })} className={`${inp} w-1/4 text-center font-bold`} />
              </div>
            </div>
            <div><label className={lbl}>Caminho / especialização</label><input value={f.path ?? ""} onChange={(e) => set({ path: e.target.value })} className={inp} placeholder="Ex.: Mago, Bruxo, Feiticeiro" /></div>
            <div>
              <label className={lbl}>Origem</label>
              <select value={f.originId ?? ""} onChange={(e) => set({ originId: e.target.value, origin: T20_ORIGINS.find((o) => o.id === e.target.value)?.nome })} className={inp}>
                <option value="">{f.origin ?? "—"}</option>
                {T20_ORIGINS.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Divindade</label>
              <select value={f.deityId ?? ""} onChange={(e) => set({ deityId: e.target.value || undefined, deity: T20_DEITIES.find((d) => d.id === e.target.value)?.nome })} className={inp}>
                <option value="">Não devoto</option>
                {T20_DEITIES.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2"><ImagePicker label="Retrato do personagem" value={f.avatar ?? ""} pos={f.avatarPos} onChange={(v, p) => set({ avatar: v || undefined, avatarPos: v ? p ?? f.avatarPos : undefined })} /></div>
          </div>

          <div className="rounded border border-[#ded7c6] bg-white p-3">
            <span className={lbl}>Atributos (o valor já é o bônus)</span>
            <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
              {ATTR_KEYS.map((k) => (
                <div key={k}>
                  <label className="block font-bold uppercase text-[#b92b3a]">{k}</label>
                  <input type="number" value={f.attributes[k].value} onChange={(e) => set({ attributes: { ...f.attributes, [k]: { ...f.attributes[k], value: Number(e.target.value) } } })} className="w-full rounded border border-[#ded7c6] bg-[#fbf9f4] p-1 text-center font-serif text-lg font-bold" />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className={lbl}>PV atual / máx.</label>
              <div className="flex gap-1">
                <input type="number" value={f.hp.current} onChange={(e) => set({ hp: { ...f.hp, current: Number(e.target.value) } })} className={`${inp} text-center`} />
                <input type="number" value={f.hp.max} disabled={autoHp} onChange={(e) => set({ hp: { ...f.hp, max: Number(e.target.value) } })} className={`${inp} text-center disabled:opacity-50`} />
              </div>
            </div>
            <div>
              <label className={lbl}>PM atual / máx.</label>
              <div className="flex gap-1">
                <input type="number" value={f.mp.current} onChange={(e) => set({ mp: { ...f.mp, current: Number(e.target.value) } })} className={`${inp} text-center`} />
                <input type="number" value={f.mp.max} disabled={autoHp} onChange={(e) => set({ mp: { ...f.mp, max: Number(e.target.value) } })} className={`${inp} text-center disabled:opacity-50`} />
              </div>
            </div>
            <div><label className={lbl}>Defesa — outros bônus (permanentes)</label><input type="number" value={f.defenseOther} onChange={(e) => set({ defenseOther: Number(e.target.value) })} className={`${inp} text-center`} /></div>
            <div><label className={lbl}>Deslocamento (m)</label><input type="number" value={f.speed} onChange={(e) => set({ speed: Number(e.target.value) })} className={`${inp} text-center`} /></div>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-[#726859]">
            <input type="checkbox" checked={autoHp} onChange={(e) => setAutoHp(e.target.checked)} className="accent-[#b92b3a]" />
            Recalcular PV/PM máximos automaticamente pela classe, nível e Constituição
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className={lbl}>Idiomas</label><input value={f.languages} onChange={(e) => set({ languages: e.target.value })} className={inp} /></div>
            <div><label className={lbl}>Tibares (T$)</label><input type="number" value={f.money} onChange={(e) => set({ money: Number(e.target.value) })} className={inp} /></div>
            <div><label className={lbl}>Aparência</label><input value={f.appearance ?? ""} onChange={(e) => set({ appearance: e.target.value })} className={inp} /></div>
            <div><label className={lbl}>Personalidade</label><input value={f.personality ?? ""} onChange={(e) => set({ personality: e.target.value })} className={inp} /></div>
          </div>
          <div><label className={lbl}>História</label><textarea value={f.history ?? ""} onChange={(e) => set({ history: e.target.value })} rows={3} className={inp} /></div>

          <div className="flex justify-end gap-3 border-t border-[#ded7c6] pt-3">
            <button type="button" onClick={onClose} className="rounded border border-[#ded7c6] bg-white px-4 py-2 font-bold text-[#726859]">Cancelar</button>
            <button type="submit" className="rounded bg-[#b92b3a] px-5 py-2 font-bold uppercase text-white hover:bg-[#9c1f2d]">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
};
