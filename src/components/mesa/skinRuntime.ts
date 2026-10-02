import { Backpack, FlaskConical, Shield, Swords, type LucideIcon } from "lucide-react";
import type { ImgKey } from "../mesaSkin/assets";
import { SAVES, SKILLS, type Combatant, type Roll } from "../mesaSkin/data";
import type { SkinFocus, SkinMapToken, SkinRuntime } from "../mesaSkin/runtime";
import type { BoardToken, DiceResolution, RuntimeSnapshot } from "../../game/types";
import { activeGrid } from "../../game/distance";
import { conditionSkillPenalty } from "../../game/conditionEffects";
import { saveModifier } from "../../tactics/engine/saves";
import { readHotkeys } from "../../game/hotkeys";
import { canControlToken } from "../../game/permissions";
import { isActivePower } from "../../tactics/interpretation/characterActionAdapter";
import { readLoadout } from "../../game/combatLoadout";
import { getModernRpgCharacter, sheetSkillTotal } from "../../integration/modernRpgCharacterBridge";
import { blockCenter } from "../../game/tokenSize";
import { T20_SKILLS, findPowerByName } from "../../../ficha-modernrpg/t20/compendium";
import type { CharacterSheet } from "../../../ficha-modernrpg/sheet";

const HERO_RING = "#4fa83c";
const THREAT_RING = "#c2202b";

const signed = (value: number) => (value >= 0 ? `+${value}` : `${value}`);
const portraitKey = (token: BoardToken): ImgKey => (token.side === "threats" ? "foe" : "kael");

/** Mesmo critério do App: token ativo no combate, senão o selecionado, senão o primeiro herói. */
export function focusedTokenOf(snapshot: RuntimeSnapshot): BoardToken | undefined {
  const { tokens, selectedTokenIds } = snapshot.board;
  return tokens.find((token) => token.id === snapshot.combat.activeTokenId)
    || tokens.find((token) => token.id === selectedTokenIds[0])
    || tokens.find((token) => token.side === "heroes");
}

function combatantOf(token: BoardToken): Combatant {
  return {
    id: token.id,
    name: token.name,
    portrait: portraitKey(token),
    portraitUrl: token.imageUrl,
    side: token.side === "threats" ? "enemy" : "ally",
    hp: token.hp,
    hpMax: token.hpMax,
    mp: token.pm,
    mpMax: token.pmMax,
  };
}

function itemStyle(category: string): { icon: LucideIcon; tone: string } {
  if (category === "Consumível") return { icon: FlaskConical, tone: "#e0574f" };
  if (category === "Arma") return { icon: Swords, tone: "#d9a94c" };
  if (category === "Armadura" || category === "Escudo") return { icon: Shield, tone: "#d9a94c" };
  return { icon: Backpack, tone: "#c8a677" };
}

function equipmentOf(sheet: CharacterSheet | null): SkinRuntime["equipment"] {
  const marked = readLoadout(sheet?.id).items;
  return (sheet?.equipment || []).map((item) => ({
    id: item.id,
    name: item.name,
    label: item.quantity > 1 ? `${item.name} (${item.quantity})` : item.name,
    marked: marked.includes(item.id),
    ...itemStyle(item.category),
  }));
}

function attacksOf(sheet: CharacterSheet | null): SkinRuntime["attacks"] {
  const marked = readLoadout(sheet?.id).attacks;
  return (sheet?.attacks || []).map((attack) => ({
    id: attack.id,
    actionId: `character:attack:${attack.id}`,
    name: attack.name,
    detail: [attack.damage, attack.damageType].filter(Boolean).join(" · "),
    marked: marked.includes(attack.id),
  }));
}

/** Nome de uma ação da ficha (ataque, poder, habilidade) a partir do id da ação guardado na hotkey. */
function actionLabelOf(sheet: CharacterSheet | null, actionId: string): string | null {
  const attack = sheet?.attacks.find((entry) => `character:attack:${entry.id}` === actionId);
  if (attack) return attack.name;
  const power = powersOf(sheet).find((entry) => entry.actionId === actionId);
  return power ? power.name : null;
}

function hotkeysOf(sheet: CharacterSheet | null): SkinRuntime["hotkeys"] {
  const ids = readHotkeys(sheet?.id);
  return [1, 2, 3, 4, 5].map((slot) => {
    const entry = ids[slot - 1];
    // Uma hotkey guarda um item da mochila (id do item) ou uma ação da ficha ("action:" + id da ação).
    if (entry.startsWith("action:")) {
      const label = actionLabelOf(sheet, entry.slice(7));
      if (label) return { slot, label, qty: "Poder", icon: Swords, tone: "#d9a94c", link: `hotkey${slot}` };
    }
    const item = sheet?.equipment.find((candidate) => candidate.id === entry);
    return item
      ? { slot, label: item.name, qty: String(item.quantity), ...itemStyle(item.category), link: `hotkey${slot}` }
      : { slot, label: "Vazio", qty: "—", icon: Backpack, tone: "#6f6050", link: `hotkey${slot}` };
  });
}

const ATTRIBUTE_ORDER = [["for", "FOR"], ["des", "DES"], ["con", "CON"], ["int", "INT"], ["sab", "SAB"], ["car", "CAR"]] as const;

function attributesOf(sheet: CharacterSheet | null, token?: BoardToken): SkinFocus["attributes"] {
  if (!sheet && token?.attrs) return ATTRIBUTE_ORDER.map(([key, short]) => ({ key, short, value: token.attrs?.[key] ?? 0 }));
  if (!sheet) return undefined;
  return ATTRIBUTE_ORDER.map(([key, short]) => ({ key, short, value: sheet.attributes[key]?.value ?? 0 }));
}

function focusOf(token: BoardToken | undefined, sheet: CharacterSheet | null): SkinFocus | null {
  if (!token) return null;
  // O título do token já termina com "· Nv N" (token de ficha sem a ficha à mão): não repetir o nível.
  const titleText = (token.title || "Ameaça").replace(/\s*·\s*Nv\s*\d+\s*$/i, "");
  const subtitle = sheet
    ? `${sheet.race} • ${sheet.class} • Nível ${sheet.level}`
    : `${titleText} • Nível ${token.level}`;
  const combatSubtitle = sheet
    ? `Nível ${sheet.level} • ${sheet.class} ${sheet.race}`
    : `Nível ${token.level} • ${titleText}`;
  return {
    name: token.name,
    subtitle,
    combatSubtitle,
    portrait: portraitKey(token),
    portraitUrl: token.imageUrl,
    hp: token.hp,
    hpMax: token.hpMax,
    pm: token.pm,
    pmMax: token.pmMax,
    defense: token.defense,
    speed: {
      walkM: sheet?.speed || token.movementM || 9,
      flyM: sheet?.flySpeed ?? token.flyM,
      burrowM: sheet?.burrowSpeed ?? token.burrowM,
    },
    attributes: attributesOf(sheet, token),
  };
}

/** Habilidades da ameaça do bestiário como lista de poderes (ativa = tem ação de execução no tipo ou no texto). */
function threatPowersOf(token: BoardToken): SkinRuntime["powers"] {
  return (token.abilities || []).map((ability, index) => ({
    id: `threat-ability-${index}`,
    actionId: `threat:${token.bestiaryId || token.id}:ability:${index}`,
    marked: false,
    name: ability.name,
    type: ability.type || "Habilidade",
    requirement: undefined,
    source: "Bestiário",
    description: ability.description || "",
    passive: !/(padr[aã]o|movimento|completa|rea[cç][aã]o|livre|PM)/i.test(`${ability.type || ""} ${ability.description || ""}`),
  }));
}

/** Poderes da ficha com requisito, fonte e descrição do Compêndio (quando o poder existe lá). */
export function powersOf(sheet: CharacterSheet | null): SkinRuntime["powers"] {
  // Poderes da ficha + habilidades raciais e de classe (as passivas sociais, raciais e de classe moram aqui).
  const marked = readLoadout(sheet?.id).powers;
  const entries = [
    ...(sheet?.powers || []).map((power) => ({ id: power.id, actionId: `character:power:${power.id}`, name: power.name, type: power.type, requirement: power.requirement, description: power.description, cost: power.cost })),
    ...(sheet?.racialAbilities || []).map((ability) => ({ id: ability.id, actionId: `character:racial:${ability.id}`, name: ability.name, type: "Racial", requirement: undefined, description: ability.description, cost: 0 })),
    ...(sheet?.classAbilities || []).map((ability) => ({ id: ability.id, actionId: `character:class:${ability.id}`, name: ability.name, type: "Classe", requirement: undefined, description: ability.description, cost: 0 })),
  ];
  const seen = new Set<string>();
  return entries.flatMap((entry) => {
    const key = entry.name.trim().toLowerCase();
    if (!key || seen.has(key)) return [];
    seen.add(key);
    const found = findPowerByName(entry.name);
    const description = found?.descricao || entry.description || "";
    return [{
      id: entry.id,
      actionId: entry.actionId,
      marked: marked.includes(entry.id),
      name: entry.name,
      type: entry.type,
      requirement: found?.requisito || entry.requirement || undefined,
      source: found?.fonte || undefined,
      description,
      passive: !isActivePower(entry.name, description, entry.cost),
    }];
  });
}

const SKILL_NAMES = new Set(T20_SKILLS.map((skill) => skill.nome.toLocaleLowerCase("pt-BR")));
const SAVE_NAMES = new Set(["reflexos", "fortitude", "vontade"]);

/** O que foi rolado, em palavras: perícia, ataque, dano, teste de resistência, iniciativa... */
export function describeRoll(roll: Pick<DiceResolution, "kind" | "action" | "target" | "actor">): string {
  const action = roll.action;
  const low = action.toLocaleLowerCase("pt-BR");
  if (roll.kind === "attack") return `Atacou com ${action}${roll.target && roll.target !== "—" ? ` em ${roll.target}` : ""}`;
  if (roll.kind === "damage") return `Dano de ${action}`;
  if (roll.kind === "heal") return `Cura: ${action}`;
  if (roll.actor === "Mesa" && roll.kind === "save") return `Macro: ${action}`;
  if (roll.kind === "save" || SAVE_NAMES.has(low)) return `Teste de resistência: ${action}`;
  if (/^rolagem d/i.test(action)) return `Rolagem livre (${action.replace(/^rolagem /i, "")})`;
  if (/iniciativa/i.test(action)) return "Iniciativa";
  if (SKILL_NAMES.has(low)) return `Teste de perícia: ${action}`;
  return action;
}

function relativeTime(timestamp: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 60) return "agora";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  return `há ${Math.round(minutes / 60)} h`;
}

/** Régua do canto do mapa: 0, 5, 10 e 15 quadrados na escala da grade da cena. */
function scaleOf(): NonNullable<SkinRuntime["scale"]> {
  const grid = activeGrid();
  const marks = [0, 5, 10, 15].map((squares) => Math.round(squares * grid.scale * 10) / 10);
  return { labels: marks.map(String), text: `${marks[3]} ${grid.unit}` };
}

export function buildSkinRuntime(snapshot: RuntimeSnapshot, campaigns: string[], now = Date.now()): SkinRuntime {
  const { board, combat } = snapshot;
  const visible = board.tokens.filter((token) => !token.hidden);
  const byId = new Map(visible.map((token) => [token.id, token]));
  const focusToken = focusedTokenOf(snapshot);
  const sheet = focusToken?.modernRpgCharacterId ? getModernRpgCharacter(focusToken.modernRpgCharacterId) : null;

  const mapTokens: SkinMapToken[] = visible.map((token) => ({
    id: token.id,
    name: token.name,
    portrait: portraitKey(token),
    portraitUrl: token.imageUrl,
    ring: token.side === "threats" ? THREAT_RING : HERO_RING,
    x: ((blockCenter(token).x) / board.map.cols) * 100,
    y: ((blockCenter(token).y) / board.map.rows) * 100,
    hp: token.hp,
    hpMax: token.hpMax,
    active: combat.active && combat.activeTokenId === token.id,
  }));

  // Fora de combate não há ordem: mostra os tokens pela iniciativa rolada.
  const ordered = (combat.order.length
    ? combat.order.map((id) => byId.get(id)).filter((token): token is BoardToken => Boolean(token))
    : [...visible].sort((a, b) => b.initiativeRoll - a.initiativeRoll));
  const initiative = ordered.map((token, index) => ({
    ...combatantOf(token),
    turn: index + 1,
    active: combat.active && combat.activeTokenId === token.id,
    roll: token.initiativeRoll,
  }));

  const saveValues: Record<string, number | undefined> = focusToken
    ? { Reflexos: saveModifier(focusToken, "reflexes"), Fortitude: saveModifier(focusToken, "fortitude"), Vontade: saveModifier(focusToken, "will") }
    : {};
  const saves = SAVES.map((save) => {
    const value = saveValues[save.name];
    return { ...save, value: value === undefined ? "—" : signed(value) };
  });

  const skills = SKILLS.map((skill) => {
    const def = T20_SKILLS.find((entry) => entry.nome.toLocaleLowerCase("pt-BR") === skill.name.toLocaleLowerCase("pt-BR"));
    if (!sheet && focusToken && def) {
      // Ameaça do bestiário: perícia treinada da ficha dela; as outras valem o modificador do atributo.
      const listed = focusToken.skillBonuses?.[skill.name.toLocaleLowerCase("pt-BR")];
      const base = listed ?? focusToken.attrs?.[def.atributo as "for"];
      if (base !== undefined) return { ...skill, value: signed(base + conditionSkillPenalty(focusToken.conditions, def.atributo, def.id)) };
    }
    return { ...skill, value: sheet && def ? signed(sheetSkillTotal(sheet, def.id, def.atributo) + conditionSkillPenalty(focusToken?.conditions, def.atributo, def.id)) : "—" };
  });

  const rolls: Roll[] = combat.rolls.slice(0, 30).map((roll) => {
    const actor = board.tokens.find((token) => token.name === roll.actor);
    return {
      id: roll.id,
      author: roll.actor,
      portrait: actor ? portraitKey(actor) : "foe",
      portraitUrl: actor?.imageUrl,
      time: relativeTime(roll.timestamp, now),
      title: describeRoll(roll),
      formula: roll.formula,
      result: String(roll.total),
      outcome: roll.outcome,
      outcomeTone: roll.success ? "#5ec46a" : "#e0574f",
    };
  });

  const scene = snapshot.scenes.find((entry) => entry.id === snapshot.activeSceneId);
  const player = focusToken;
  return {
    campaign: campaigns[0] || "Mesa Online",
    scene: scene?.name || board.map.name,
    brand: "Armada Nexus RPG",
    mapImage: board.map.image || null,
    mapName: board.map.name,
    mapTokens,
    group: visible.filter((token) => token.side === "heroes").map(combatantOf),
    initiative,
    focus: focusOf(focusToken, sheet),
    saves,
    skills,
    equipment: equipmentOf(sheet),
    attacks: attacksOf(sheet),
    powers: sheet || !focusToken?.abilities?.length ? powersOf(sheet) : threatPowersOf(focusToken),
    canOperateFocus: focusToken ? canControlToken(snapshot.multiplayer, focusToken) : false,
    spells: (sheet?.spells || []).map((spell) => ({ name: spell.name, circle: spell.circle, cost: spell.cost })),
    hotkeys: hotkeysOf(sheet),
    rolls,
    scale: scaleOf(),
    isMaster: snapshot.multiplayer.role !== "player",
    diceOpen: false,
    playerPortrait: player ? portraitKey(player) : "kael",
    playerPortraitUrl: player?.imageUrl,
  };
}
