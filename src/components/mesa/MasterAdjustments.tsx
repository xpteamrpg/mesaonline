import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { getCharacterSheetById, upsertCharacterSheet } from "../../../ficha-modernrpg/characterRoute";
import { T20_SKILLS } from "../../../ficha-modernrpg/t20/compendium";
import type { EquipmentItem } from "../../../ficha-modernrpg/sheet";
import type { BoardToken, TacticalEffect } from "../../game/types";
import { updateToken } from "../../game/vttBridge";

/**
 * Ajustes manuais do Mestre sobre um personagem, na hora, sem esperar o jogador: bônus e penalidades (deslocamento, Defesa, ataque, dano,
 * resistência, perícia), dano extra numa arma (ex.: +1d6 de fogo) e itens da mochila. Os ajustes ficam no token (efeitos "mestre:", que
 * atravessam os combates) e podem ser removidos um a um; os itens mudam a ficha. Só o Mestre vê esta seção.
 */
type Kind = "speed" | "defense" | "attack" | "damage" | "saves" | "skills";
const KIND_LABEL: Record<Kind, string> = {
  speed: "Deslocamento (m)", defense: "Defesa", attack: "Ataque", damage: "Dano", saves: "Resistências (Fort, Refl, Vont)", skills: "Perícia",
};
const MASTER_PREFIX = "mestre:";
const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

export function isMasterEffect(effect: TacticalEffect): boolean {
  return (effect.sourceId || "").startsWith(MASTER_PREFIX);
}

/** Texto curto de um ajuste, para a lista. */
export function describeAdjustment(effect: TacticalEffect, weaponName?: (id: string) => string): string {
  if (effect.extraDamage) return `Dano extra ${effect.extraDamage.formula} de ${effect.extraDamage.type}${effect.weaponId ? ` (${weaponName?.(effect.weaponId) ?? "arma"})` : ""}`;
  const [stat, value] = Object.entries(effect.mods || {})[0] ?? ["", 0];
  const label = KIND_LABEL[stat as Kind] ?? stat;
  const scope = effect.skillId ? ` · ${T20_SKILLS.find((skill) => skill.id === effect.skillId)?.nome ?? effect.skillId}` : effect.weaponId ? ` · ${weaponName?.(effect.weaponId) ?? "arma"}` : "";
  return `${label} ${sign(Number(value))}${scope}`;
}

export function addAdjustment(token: BoardToken, effect: Omit<TacticalEffect, "id" | "kind" | "sourceId" | "name">, name: string): void {
  const id = `${MASTER_PREFIX}${crypto.randomUUID()}`;
  updateToken(token.id, { effects: [...(token.effects || []), { ...effect, id, name, sourceId: id, kind: "long" }] });
}

export default function MasterAdjustments({ token }: { token: BoardToken }) {
  const [kind, setKind] = useState<Kind>("speed");
  const [value, setValue] = useState("1");
  const [scope, setScope] = useState("");
  const [formula, setFormula] = useState("1d6");
  const [element, setElement] = useState("Fogo");
  const [weapon, setWeapon] = useState("");
  const [itemName, setItemName] = useState("");
  const sheet = token.modernRpgCharacterId ? getCharacterSheetById(token.modernRpgCharacterId) : null;
  const weapons = (token.tacticalActions || []).filter((action) => action.category === "weapon");
  const weaponName = (id: string) => weapons.find((entry) => entry.id === id)?.name ?? "arma";
  const mine = (token.effects || []).filter(isMasterEffect);

  function add() {
    const amount = Math.trunc(Number(value));
    if (!Number.isFinite(amount) || amount === 0) return;
    const effect: Omit<TacticalEffect, "id" | "kind" | "sourceId" | "name"> = { mods: { [kind]: amount } };
    if (kind === "skills" && scope) effect.skillId = scope;
    if ((kind === "attack" || kind === "damage") && scope) effect.weaponId = scope;
    addAdjustment(token, effect, `Ajuste do Mestre: ${KIND_LABEL[kind]} ${sign(amount)}`);
  }
  function addExtraDamage() {
    if (!weapon || !/^\d*d\d+([+-]\d+)?$/i.test(formula.trim())) return;
    addAdjustment(token, { weaponId: weapon, extraDamage: { formula: formula.trim(), type: element } }, `Ajuste do Mestre: dano extra ${formula.trim()} ${element}`);
  }
  function remove(id: string) {
    updateToken(token.id, { effects: (token.effects || []).filter((effect) => effect.id !== id) });
  }
  function changeItems(change: (items: EquipmentItem[]) => EquipmentItem[]) {
    if (!sheet) return;
    upsertCharacterSheet({ ...sheet, equipment: change(sheet.equipment) });
    window.dispatchEvent(new Event("modernrpg-characters-changed"));
  }
  function addItem() {
    const name = itemName.trim();
    if (!name) return;
    changeItems((items) => [...items, { id: `eq-${crypto.randomUUID()}`, equipped: false, name, quantity: 1, slots: 1, price: null, description: "", category: "Item Geral" } as EquipmentItem]);
    setItemName("");
  }

  return <div className="mesa-panel-section" data-master-adjustments><h4>AJUSTES DO MESTRE</h4>
    <p className="mesa-module-note">Bônus e penalidades na hora, só neste personagem. Valem até você remover.</p>
    {mine.length > 0 && <div className="mesa-condition-chips">{mine.map((effect) => <button key={effect.id} title="Remover este ajuste" onClick={() => remove(effect.id)}>{describeAdjustment(effect, weaponName)} ×</button>)}</div>}
    <label>Ajustar
      <select value={kind} onChange={(event) => { setKind(event.target.value as Kind); setScope(""); }}>
        {(Object.keys(KIND_LABEL) as Kind[]).map((key) => <option key={key} value={key}>{KIND_LABEL[key]}</option>)}
      </select>
    </label>
    {kind === "skills" && <label>Qual perícia
      <select value={scope} onChange={(event) => setScope(event.target.value)}>
        <option value="">Todas</option>
        {T20_SKILLS.map((skill) => <option key={skill.id} value={skill.id}>{skill.nome}</option>)}
      </select>
    </label>}
    {(kind === "attack" || kind === "damage") && weapons.length > 0 && <label>Qual arma
      <select value={scope} onChange={(event) => setScope(event.target.value)}>
        <option value="">Todas</option>
        {weapons.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
      </select>
    </label>}
    <label>Valor (use − para penalidade)<input type="number" value={value} onChange={(event) => setValue(event.target.value)}/></label>
    <button onClick={add}><Plus/>Aplicar ajuste</button>
    {weapons.length > 0 && <>
      <label>Dano extra na arma
        <select value={weapon} onChange={(event) => setWeapon(event.target.value)}>
          <option value="">Escolha a arma…</option>
          {weapons.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        </select>
      </label>
      <div className="mesa-grid-settings-row">
        <label>Dado<input value={formula} onChange={(event) => setFormula(event.target.value)}/></label>
        <label>Energia<select value={element} onChange={(event) => setElement(event.target.value)}>{["Ácido", "Eletricidade", "Fogo", "Frio", "Luz", "Trevas", "Essência"].map((name) => <option key={name}>{name}</option>)}</select></label>
      </div>
      <button onClick={addExtraDamage} disabled={!weapon}><Plus/>Dar dano extra</button>
    </>}
    {sheet ? <>
      <h4>MOCHILA</h4>
      <div className="mesa-roster-list">{sheet.equipment.map((item) => <div key={item.id} className="mesa-master-item">
        <span>{item.quantity > 1 ? `${item.name} (${item.quantity})` : item.name}</span>
        <button title={`Tirar ${item.name} da ficha`} aria-label={`Tirar ${item.name} da ficha`} onClick={() => changeItems((items) => items.filter((entry) => entry.id !== item.id))}><Trash2/></button>
      </div>)}{sheet.equipment.length === 0 && <p className="mesa-block-empty">Mochila vazia.</p>}</div>
      <div className="mesa-grid-settings-row">
        <label>Dar item<input value={itemName} placeholder="Nome do item" onChange={(event) => setItemName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addItem(); }}/></label>
        <button onClick={addItem} disabled={!itemName.trim()}><Plus/>Dar</button>
      </div>
    </> : <p className="mesa-module-note">Sem ficha ligada: só os ajustes acima valem.</p>}
  </div>;
}
