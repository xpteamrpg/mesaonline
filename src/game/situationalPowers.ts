import { characterForToken } from "../integration/modernRpgCharacterBridge";
import { hasPower } from "./powerEffects";
import { activeConditions } from "./conditionEffects";
import type { BoardState, BoardToken, GameAction } from "./types";
import { isFlanking } from "../tactics/engine/targeting";

/**
 * Poderes de classe que valem só numa situação que o sistema já sabe reconhecer (condição do alvo, flanco, PV do alvo, arma usada).
 * Texto de cada poder no catálogo (`poderes.json`); aplicado em `resolveTacticalAction` (combat.ts) por ataque.
 * Fora: Primeiro Sangue (passos de dado em todos os dados) e os que dependem de gastar PM ou escolher na hora.
 */
export interface SituationalBonus { attack: number; damage: number; extraDice: string[]; notes: string[] }

const norm = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Dado do Executor: 1d6 e aumenta um passo a cada 4 níveis (d6 → d8 → d10 → d12), pelo texto "aumenta um passo a cada 4 níveis". */
const executorDie = (level: number) => ["1d6", "1d8", "1d10", "1d12"][Math.min(3, Math.floor((level - 1) / 4))];

export function situationalPowerBonus(actor: BoardToken, target: BoardToken, action: GameAction, board: BoardState): SituationalBonus {
  const out: SituationalBonus = { attack: 0, damage: 0, extraDice: [], notes: [] };
  if (!actor.modernRpgCharacterId || action.category !== "weapon") return out;
  const sheet = characterForToken(actor);
  if (!sheet) return out;
  const conditions = activeConditions(target.conditions);
  const weapon = norm(action.name);
  const add = (name: string, attack: number, damage: number) => { out.attack += attack; out.damage += damage; out.notes.push(`${name} +${attack || damage}`); };

  // Valentão: +2 em ataque e dano contra caídos, desprevenidos, flanqueados ou indefesos.
  if (hasPower(sheet, "Valentão")
    && (["caido", "desprevenido", "indefeso"].some((c) => conditions.has(c)) || isFlanking(board, actor, target))) add("Valentão", 2, 2);
  // Impiedoso: +2 em ataque e dano contra criaturas vulneráveis.
  if (hasPower(sheet, "Impiedoso") && conditions.has("vulneravel")) add("Impiedoso", 2, 2);
  // Executor: +1d6 de dano contra criaturas com menos da metade dos PV.
  if (hasPower(sheet, "Executor") && target.hpMax > 0 && target.hp < target.hpMax / 2) {
    out.extraDice.push(executorDie(sheet.level || 1));
    out.notes.push("Executor");
  }
  // Armas da Cavalaria: +2 com espadas longas e bastardas, escudos, lanças montadas e de justa, maças e alabardas.
  if (hasPower(sheet, "Armas da Cavalaria") && /espada longa|espada bastarda|escudo|lanca montada|lanca de justa|maca|alabarda/.test(weapon)) add("Armas da Cavalaria", 2, 2);
  // Lanceiro: +2 com lanças (exceto montada e de justa).
  if (hasPower(sheet, "Lanceiro") && /lanca/.test(weapon) && !/montada|justa/.test(weapon)) add("Lanceiro", 2, 2);
  // Arsenal do Deserto: +2 de dano com azagaias, cimitarras e lanças.
  if (hasPower(sheet, "Arsenal do Deserto") && /azagaia|cimitarra|lanca/.test(weapon)) { out.damage += 2; out.notes.push("Arsenal do Deserto +2 dano"); }
  // Machado de Pedra: +1 em ataque e dano com as armas simples da lista (e naturais).
  if (hasPower(sheet, "Machado de Pedra") && /adaga|azagaia|clava|funda|lanca|machadinha|tacape/.test(weapon)) add("Machado de Pedra", 1, 1);
  return out;
}
