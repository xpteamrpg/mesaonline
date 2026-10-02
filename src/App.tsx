import { effectBonus } from "./tactics/engine/effectBonuses";
import { toggleEquipped } from "./game/carga";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { coveredCells, footprintOf, parseSize, sideOf, tokenCovers } from "./game/tokenSize";
import { freshTurnResources, turnPlan } from "./tactics/engine/actionEconomy";
import { getCharacterSheetById, loadCharacterSheets, loadReadyHeroSheets, setActiveCharacterId, upsertCharacterSheet } from "../ficha-modernrpg/characterRoute";
import type { CharacterSheet } from "../ficha-modernrpg/sheet";
import MesaSkinTable from "./components/mesaSkin/MesaSkinTable";
import MesaSkinActionDialog from "./components/mesaSkin/MesaSkinActionDialog";
import ReactionPrompt from "./components/mesa/ReactionPrompt";
import ObjectDialog from "./components/mesa/ObjectDialog";
import DoorDialog from "./components/mesa/DoorDialog";
import ChestReveal from "./components/mesa/ChestReveal";
import LootClaimer from "./components/mesa/LootClaimer";
import MesaLobby from "./components/mesa/MesaLobby";
import DicePanel from "./components/mesa/DicePanel";
import { usePreferences } from "./game/mesaPreferences";
import { type LoadoutKind, toggleLoadout } from "./game/combatLoadout";
import { buildSkinRuntime } from "./components/mesa/skinRuntime";
import MapStage from "./components/mesa/MapStage";
import { getStageControl, setStageTool, useStageControl } from "./components/mesa/mapStageControl";
import { effectiveMoveMode } from "./game/movementMode";
import type { MapToolId as StageToolId } from "./game/mapTools";
import { goToPortal, openPortalRoute, openPortalSheet, portalHref } from "./portalLink";
import { conditionSkillPenalty } from "./game/conditionEffects";
import { assignHotkey, clearHotkey, readHotkeys } from "./game/hotkeys";
import { installJukeboxSync } from "./game/jukeboxSync";
import { playSfx } from "./game/jukebox";
import { onSignals } from "./game/signals";
import { saveModifier } from "./tactics/engine/saves";
import MesaGlobalPanel, { type MapToolArmOptions, type MesaPanelId } from "./components/mesa/MesaGlobalPanel";
import { CharacterLibraryDialog, ThreatLibraryDialog } from "./components/Libraries";
import CharacterPickerDialog from "./components/mesa/CharacterPickerDialog";
import type { LibraryToken } from "./game/tokenLibrary";
import { freeObjectSpot, newBoardObject } from "./game/objectPlacement";
import { executeDropItem } from "./tactics/engine/objectCommands";
import {
  addToken, hostMultiplayer, joinMultiplayer, setObjects, appendChat, appendRoll, clearRollHistory, getRuntimeSnapshot, restoreMultiplayerSession, selectToken, sendSignal, setInitiativeRoll, shareAudioWithRoom, startCombat, endCombat,
  subscribeRuntime, updateToken,
} from "./game/vttBridge";
import type { AugmentChoice } from "./tactics/interpretation/spellCasting";
import { executeTacticalAction, executeTacticalEndTurn, executeTacticalMove } from "./tactics/engine/runtimeCommands";
import type { BoardToken, GameAction, ThreatTemplate } from "./game/types";
import { boardTokenFromCharacter, getModernRpgCharacter, sheetSkillTotal, tacticalViewForToken } from "./integration/modernRpgCharacterBridge";
import { listThreats, removeCustomThreat } from "./tactics/engine/customThreats";
import { canControlToken } from "./game/permissions";
import { rollFormula } from "./game/macros";
import { T20_SKILLS } from "../ficha-modernrpg/t20/compendium";
import { metersToCells } from "./game/distance";
import { applyMapTool, type MapToolId } from "./game/mapTools";
import { gridDistance } from "./game/rules";
import { TRIGGER_CONDITIONS } from "./game/triggers";
import type { ShapeKind } from "./game/shapes";

const CAMPAIGN_KEY = "tormenta20_online_campaigns_v1";
/** Gaveta aberta → botão da barra esquerda que fica aceso (vermelho). */
const PANEL_NAV: Partial<Record<MesaPanelId, string>> = {
  scenes: "scenes", roster: "group", tokens: "tokens", compendium: "inventory", jukebox: "music",
  "map-context": "objects", history: "journal", automation: "macros", master: "master", settings: "config",
};
type MesaStage = "lobby" | "exploration" | "combat";

/** O lobby antigo da Mesa só abre com ?local=1 (ou ?campanha=, e nos testes): a entrada normal é a página "Mesa online" do Portal. */
const LOBBY_ANTIGO = typeof window !== "undefined" && (() => {
  const params = new URLSearchParams(window.location.search);
  return params.get("local") === "1" || params.has("campanha") || import.meta.env?.MODE === "test";
})();

/** Volta para a página "Mesa online" do Portal. */
function goToMesaOnline(): void {
  window.location.href = portalHref("mesa-online");
}

/**
 * Este projeto é APENAS a Mesa Online. O Portal ModernRPG (Home, Ficha,
 * Oficina, Campanhas, Compêndio, Bestiário, Magias, Poderes e Itens) é um site
 * separado que já existe e continua sendo o dono dessas telas — a Mesa é
 * aberta a partir dele e só oferece um retorno via `openPortal()`.
 */
export default function App() {
  const snapshot = useSyncExternalStore(subscribeRuntime, getRuntimeSnapshot, getRuntimeSnapshot);
  const [mesaStage, setMesaStage] = useState<MesaStage>("lobby");
  const [profileOpen, setProfileOpen] = useState(false);
  const [charactersOpen, setCharactersOpen] = useState(false);
  const [threatsOpen, setThreatsOpen] = useState(false);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [characterRevision, setCharacterRevision] = useState(0);
  const [skinPanel, setSkinPanel] = useState<MesaPanelId | null>(null);
  const [diceOpen, setDiceOpen] = useState(false);
  const stageControl = useStageControl();
  const prefs = usePreferences();
  const [hotkeyAction, setHotkeyAction] = useState<string | null>(null);
  const [skinActionMode, setSkinActionMode] = useState<"actions" | "magic" | "items" | "conditions" | null>(null);
  const [mapIntent, setMapIntent] = useState<
    | { kind: "move" }
    | { kind: "place-token"; token: BoardToken }
    | { kind: "area-action"; action: GameAction; augment?: AugmentChoice }
    | {
      kind: "map-tool";
      tool: Extract<MapToolId, "door" | "shape" | "trigger" | "object">;
      shapeKind?: Exclude<ShapeKind, "polygon">;
      shapeSizeM?: number;
      triggerConfig?: { condition: string; mode: "once" | "continuous" };
      shapeAnchor?: { x: number; y: number } | null;
    }
    | null
  >(null);
  const importedPortalCharacters = useRef(false);
  const lastViewSwitchAt = useRef(0);
  const useEquipmentRef = useRef<(slot?: number, itemName?: string) => void>(() => undefined);
  const campaigns = useStoredCampaigns();
  // O catálogo de 855 ameaças só é montado quando alguém abre o bestiário (ou usa um token ligado a ameaça): montar no carregamento deixava a Mesa lenta, principalmente no celular.
  const threats = useMemo(() => (threatsOpen ? listThreats() : []), [catalogRevision, threatsOpen]);
  const units = useMemo(() => snapshot.board.tokens.filter((token) => !token.hidden).map(tacticalViewForToken), [snapshot.board.tokens]);
  const skinRuntime = useMemo(() => buildSkinRuntime(snapshot, campaigns), [snapshot, campaigns, characterRevision]);

  useEffect(() => {
    const onCharacters = () => setCharacterRevision((value) => value + 1);
    const onThreats = () => setCatalogRevision((value) => value + 1);
    window.addEventListener("modernrpg-characters-changed", onCharacters);
    window.addEventListener("modernrpg-threats-changed", onThreats);
    return () => {
      window.removeEventListener("modernrpg-characters-changed", onCharacters);
      window.removeEventListener("modernrpg-threats-changed", onThreats);
    };
  }, []);

  // Depois de um F5 a mesa volta sozinha para a sala anterior, com a mesma
  // identidade PeerJS — é isso que preserva o controlledBy dos tokens.
  const [entry, setEntry] = useState<"loading" | "error" | "done">(LOBBY_ANTIGO ? "done" : "loading");
  const [entryError, setEntryError] = useState("");
  useEffect(() => {
    let active = true;
    void restoreMultiplayerSession().then(async (restored) => {
      if (!active) return;
      if (restored) { setMesaStage("exploration"); setEntry("done"); return; }
      // A entrada é a página "Mesa online" do Portal: ela abre a Mesa já na sala (?host= para o Mestre, ?sala= para o jogador).
      // O lobby antigo (MesaLobby) fica guardado, sem uso; ?local=1 o abre só para testes.
      const params = new URLSearchParams(window.location.search);
      const host = params.get("host")?.trim().toUpperCase();
      const sala = params.get("sala")?.trim().toUpperCase();
      try {
        if (host) { await hostMultiplayer(host); }
        else if (sala) { await joinMultiplayer(sala); }
        else if (LOBBY_ANTIGO) return;
        else { goToMesaOnline(); return; }
        if (!active) return;
        window.history.replaceState(null, "", window.location.pathname); // F5 reentra pela sessão guardada, sem reabrir a sala
        setMesaStage("exploration");
        setEntry("done");
      } catch (error) {
        // Sala ocupada ou mestre ausente: mostra o motivo e leva de volta à Mesa online (o lobby antigo não aparece mais).
        if (active) { setEntryError((error as Error).message || "Não consegui abrir a sala."); setEntry("error"); }
      }
    });
    return () => { active = false; };
  }, []);

  // Ao entrar na Mesa, fichas oficiais já guardadas ganham seu token na cena,
  // uma única vez por abertura: não recria tokens que o Mestre removeu depois.
  useEffect(() => {
    if (mesaStage === "lobby" || importedPortalCharacters.current || snapshot.multiplayer.role === "player") return;
    importedPortalCharacters.current = true;
    const knownCharacterIds = new Set(snapshot.board.tokens.map((token) => token.modernRpgCharacterId).filter(Boolean));
    const occupied = [...snapshot.board.tokens];
    loadCharacterSheets().forEach((sheet) => {
      if (knownCharacterIds.has(sheet.id)) return;
      const token = boardTokenFromCharacter(sheet, freePosition(occupied, "heroes"));
      occupied.push(token);
      addToken(token);
    });
  }, [mesaStage, snapshot.multiplayer.role]);

  // Som do soundboard: chega do Mestre (ou daqui mesmo) e toca para todos.
  useEffect(() => onSignals((signal) => { if (signal.kind === "sfx") playSfx(signal.url); }), []);

  // A faixa do Jukebox segue o Mestre: ele publica, os jogadores aplicam.
  useEffect(() => installJukeboxSync(() => getRuntimeSnapshot().multiplayer.role, sendSignal, shareAudioWithRoom), []);

  // Esc desarma o que estiver esperando um clique no mapa (colocar token, mover, ferramenta).
  useEffect(() => {
    if (!mapIntent) return;
    const onEsc = (event: KeyboardEvent) => { if (event.key === "Escape") setMapIntent(null); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [mapIntent]);

  // Teclas 1 a 5 usam o item da hotkey do personagem em foco (fora de campos de texto).
  useEffect(() => {
    if (mesaStage === "lobby") return;
    function onKey(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const fKey = /^F([1-5])$/.exec(event.key);
      const slot = fKey ? Number(fKey[1]) : Number(event.key);
      if (Number.isInteger(slot) && slot >= 1 && slot <= 5) { event.preventDefault(); useEquipmentRef.current(slot); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mesaStage]);

  // O combate global é do Mestre; `mesaStage` é estado local de cada aba. Sem
  // este efeito o Jogador continuava preso na tela tática depois que o Mestre
  // encerrava o combate, vendo "COMBATE ATIVO · Rodada —" enquanto o
  // combatState já estava inativo. A entrada em combate segue manual.
  useEffect(() => {
    if (mesaStage !== "combat" || snapshot.combat.active) return;
    selectToken(null);
    setMesaStage("exploration");
  }, [mesaStage, snapshot.combat.active]);

  // O contrário: um combate que continua ativo (ficou salvo de antes, ou começou em outra aba) leva o Mestre para a tela de
  // combate. Sem isso a exploração ficava presa ("aguarde o turno") e o botão Combate mostrava a ordem velha.
  useEffect(() => {
    if (mesaStage === "exploration" && snapshot.combat.active && snapshot.multiplayer.role !== "player") setMesaStage("combat");
  }, [mesaStage, snapshot.combat.active, snapshot.multiplayer.role]);

  /** A ficha oficial é do Portal: abre a ficha do personagem lá, sem derrubar a sessão da Mesa. */
  function openCharacter(characterId: string) {
    setActiveCharacterId(characterId);
    const token = snapshot.board.tokens.find((entry) => entry.modernRpgCharacterId === characterId);
    if (token) selectToken(token.id);
    openPortalSheet(characterId);
  }

  /** Token novo: o Mestre escolhe a casa clicando no mapa (Esc cancela); sem ser o Mestre ou em lote, entra na primeira casa livre. */
  function placeOrAddToken(token: BoardToken, immediate = false) {
    if (immediate || snapshot.multiplayer.role === "player") { addToken(token); return; }
    setSkinPanel(null); setDiceOpen(false); setSkinActionMode(null);
    setMapIntent({ kind: "place-token", token });
    appendChat({ author: "Sistema", text: `Clique no mapa onde ${token.name} deve aparecer (Esc cancela).`, kind: "system" });
  }

  function addCharacterToBoard(sheet: CharacterSheet) {
    const existing = snapshot.board.tokens.find((token) => token.modernRpgCharacterId === sheet.id);
    if (existing) {
      const refreshed = boardTokenFromCharacter(sheet, { x: existing.gx, y: existing.gy }, existing);
      updateToken(existing.id, refreshed);
    } else {
      placeOrAddToken(boardTokenFromCharacter(sheet, freePosition(snapshot.board.tokens, "heroes")));
    }
    setCharactersOpen(false);
  }

  function enterTacticalMode() {
    try {
      // Para o Mestre, "Combate" sempre começa um combate novo, com todas as rolagens de iniciativa; o jogador só entra no que já existe.
      if (snapshot.multiplayer.role === "player") { if (!snapshot.combat.active) return; } else startCombat();
      // A iniciativa continua no combatState; a interface contextual só abre
      // depois que o usuário escolher explicitamente um token.
      selectToken(null);
      setMesaStage("combat");
    } catch (error) {
      appendChat({ author: "Sistema", text: (error as Error).message, kind: "system" });
    }
  }

  /** Token da biblioteca da pessoa: entra como aliado genérico, que o Mestre ajusta no Elenco. */
  function spawnLibraryToken(entry: LibraryToken) {
    const { name, image, link } = entry;
    // Token ligado a uma ameaça ou ficha: nasce com os dados dela e a imagem escolhida na biblioteca.
    if (link?.kind === "threat") {
      const template = listThreats().find((candidate) => candidate.id === link.id);
      // Só os dados vêm da ameaça: o token mostra o nome e o tipo (herói/aliado ou ameaça) que a pessoa escolheu.
      if (template) { spawnThreat(template, image, { name, side: entry.template?.side ?? "threats" }); return; }
    }
    if (link?.kind === "object" && (link.id === "item" || link.id === "chest" || link.id === "treasure")) {
      const current = getRuntimeSnapshot().board;
      const floor = Math.trunc(current.activeFloor ?? 0);
      const selected = current.tokens.find((token) => token.id === current.selectedTokenIds[0]);
      const origin = selected ? { x: selected.gx, y: selected.gy } : { x: Math.floor(current.map.cols / 2), y: Math.floor(current.map.rows / 2) };
      setObjects([...current.objects, newBoardObject(link.id, floor, freeObjectSpot(current, floor, origin), name, image || undefined)]);
      return;
    }
    if (link?.kind === "character") {
      // Ficha da conta ou herói pronto do playtest (o Mestre pode ligar token a qualquer um deles).
      const sheet = getCharacterSheetById(link.id) ?? undefined;
      if (sheet) {
        const existing = getRuntimeSnapshot().board.tokens.find((token) => token.modernRpgCharacterId === sheet.id);
        if (existing) { updateToken(existing.id, { imageUrl: image, sprite: image }); selectToken(existing.id); return; }
        addToken({ ...boardTokenFromCharacter(sheet, freePosition(getRuntimeSnapshot().board.tokens, "heroes")), name, imageUrl: image, sprite: image });
        return;
      }
    }
    const made = entry.template;
    const side = made?.side ?? "heroes";
    const position = freePosition(snapshot.board.tokens, side);
    addToken({
      id: `token-lib-${crypto.randomUUID().slice(0, 8)}`,
      name, title: "Token", side,
      ...(made?.aura ? { aura: { radiusM: made.aura.radiusM, light: true, active: true, color: made.aura.color } } : {}),
      ...(made?.loot?.length ? { loot: made.loot } : {}),
      gx: position.x, gy: position.y,
      symbol: name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "TK",
      imageUrl: image || undefined, sprite: image || undefined, accent: "#c99a45",
      hp: made?.hp ?? 10, hpMax: made?.hp ?? 10, pm: made?.pm ?? 0, pmMax: made?.pm ?? 0, defense: made?.defense ?? 10, initiative: 0, initiativeRoll: 0,
      luta: 0, pontaria: 0, damage: "1d4", crit: 20, critMultiplier: 2, attackType: "melee",
      rangeM: 1.5, movementM: 9, level: 1, spellDC: 10, actionIds: [], tacticalActions: [],
      fortitude: 0, reflexes: 0, will: 0, conditions: [],
    });
  }

  /**
   * Larga um item da mochila no chão (botão de seta para baixo, ou arrastar para o mapa): o item sai da ficha (1 unidade
   * se houver várias) e vira um objeto "item" na casa pedida (ou na do personagem), com o nome e a descrição do item.
   */
  /** Marca ou desmarca um item como em uso (empunhado ou vestido), respeitando 2 empunhados e 4 vestidos. */
  function toggleEquippedItem(itemId: string) {
    const token = focusedToken();
    const sheet = token?.modernRpgCharacterId ? getModernRpgCharacter(token.modernRpgCharacterId) : null;
    if (!token || !sheet || !canOperate(token)) {
      appendChat({ author: "Sistema", text: "Selecione um personagem seu, com ficha, para escolher os itens em uso.", kind: "system" });
      return;
    }
    const result = toggleEquipped(sheet, itemId);
    if (result.error) { appendChat({ author: "Sistema", text: result.error, kind: "system" }); return; }
    upsertCharacterSheet(result.sheet);
    window.dispatchEvent(new Event("modernrpg-characters-changed"));
  }

  function dropItemToGround(itemId: string, cell?: { x: number; y: number }) {
    const token = focusedToken();
    const sheet = token?.modernRpgCharacterId ? getModernRpgCharacter(token.modernRpgCharacterId) : null;
    const item = sheet?.equipment.find((entry) => entry.id === itemId);
    if (!token || !sheet || !item || !canOperate(token)) {
      appendChat({ author: "Sistema", text: "Selecione um personagem seu, com ficha, para largar um item.", kind: "system" });
      return;
    }
    try {
      executeDropItem(token.id, { name: item.name, description: item.description, quantity: 1 }, cell);
    } catch (error) {
      appendChat({ author: "Sistema", text: (error as Error).message, kind: "system" });
      return;
    }
    upsertCharacterSheet({
      ...sheet,
      equipment: item.quantity > 1
        ? sheet.equipment.map((entry) => (entry.id === item.id ? { ...entry, quantity: entry.quantity - 1 } : entry))
        : sheet.equipment.filter((entry) => entry.id !== item.id),
    });
    window.dispatchEvent(new Event("modernrpg-characters-changed"));
  }

  function spawnThreat(template: ThreatTemplate, image?: string, as?: { name: string; side: BoardToken["side"] }, immediate = false) {
    const side = as?.side ?? "threats";
    const position = freePosition(getRuntimeSnapshot().board.tokens, side, footprintOf(template.size ?? parseSize(template.title)));
    const token: BoardToken = {
      id: `token-${template.id}-${crypto.randomUUID().slice(0, 8)}`,
      bestiaryId: template.id,
      customThreatId: template.custom ? template.id : undefined,
      name: as?.name || template.name,
      // Token da biblioteca ligado a uma ameaça: nada do nome ou da descrição da ameaça aparece, só os dados.
      title: as ? (side === "heroes" ? "Aliado" : "Ameaça") : template.title,
      side,
      gx: position.x, gy: position.y,
      symbol: as?.name ? as.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || template.symbol : template.symbol,
      imageUrl: image || template.portrait,
      sprite: image || template.sprite,
      accent: side === "heroes" ? "#c99a45" : "#b64a4e",
      hp: template.pv, hpMax: template.pv, pm: template.pm, pmMax: template.pm,
      defense: template.defense, initiative: template.initiative, initiativeRoll: 0,
      luta: template.luta, pontaria: template.pontaria, damage: template.damage,
      crit: template.crit, critMultiplier: template.critMultiplier, attackType: template.attackType,
      rangeM: template.rangeM, movementM: template.movementM, flyM: template.flyM, burrowM: template.burrowM,
      level: template.level || 1, spellDC: template.spellDC || 10,
      actionIds: template.actions || [], tacticalActions: template.customActions || [],
      fortitude: template.fortitude, reflexes: template.reflexes, will: template.will,
      attrs: template.attrs, skillBonuses: template.skillBonuses, abilities: template.abilities, size: template.size,
      conditions: [], loot: template.loot,
    };
    placeOrAddToken(token, immediate);
    setThreatsOpen(false);
  }

  /** The supplied skin changes only presentation; this is the existing state transition. */
  function setSkinView(view: "explore" | "combat") {
    // Duplo clique (ou clique repetido enquanto a tela troca) entrava e já encerrava o combate: ignora o segundo toque.
    const now = Date.now();
    if (now - lastViewSwitchAt.current < 400) return;
    lastViewSwitchAt.current = now;
    setSkinPanel(null);
    setDiceOpen(false);
    setSkinActionMode(null);
    setMapIntent(null);
    if (view === "combat") {
      enterTacticalMode();
      return;
    }
    // O botão do cabeçalho diz "Encerrar combate": para o Mestre isso encerra de verdade (ordem, rolagens e efeitos saem de
    // cena e a exploração volta a ser livre). Antes ele só trocava a tela e deixava um combate ativo por baixo, que travava o
    // movimento e mostrava a ordem velha. O jogador não encerra o combate do Mestre: só sai da tela tática.
    if (snapshot.multiplayer.role !== "player" && snapshot.combat.active) {
      try { endCombat(); } catch (error) { appendChat({ author: "Sistema", text: (error as Error).message, kind: "system" }); return; }
    }
    selectToken(null);
    setMesaStage("exploration");
  }

  function focusedCharacter() {
    const selectedId = snapshot.board.selectedTokenIds[0];
    const selected = selectedId ? snapshot.board.tokens.find((token) => token.id === selectedId) : undefined;
    return selected?.modernRpgCharacterId
      || snapshot.board.tokens.find((token) => token.side === "heroes" && token.modernRpgCharacterId)?.modernRpgCharacterId;
  }

  /** Escolher o personagem que a pessoa vai usar: ele fica em uso, é selecionado no mapa (entra, se for o Mestre e ainda não estiver) e o painel mostra a ficha dele. */
  function pickCharacter(sheet: CharacterSheet) {
    setActiveCharacterId(sheet.id);
    const board = getRuntimeSnapshot().board;
    let token = board.tokens.find((entry) => entry.modernRpgCharacterId === sheet.id);
    if (!token && snapshot.multiplayer.role !== "player") {
      try { token = addToken(boardTokenFromCharacter(sheet, freePosition(board.tokens, "heroes"))); } catch (error) { appendChat({ author: "Sistema", text: (error as Error).message, kind: "system" }); }
    }
    if (token) selectToken(token.id);
    else appendChat({ author: "Sistema", text: `${sheet.name} ainda não está no mapa. Peça ao Mestre para colocá-lo.`, kind: "system" });
    setProfileOpen(false);
  }

  function openFocusedCharacter() {
    const characterId = focusedCharacter();
    if (characterId) openCharacter(characterId);
    // Sem ficha vinculada, o ponto de entrada oficial é a lista de personagens do Portal.
    else openPortalRoute("personagens");
  }

  /**
   * Token mostrado no painel direito: o que a pessoa clicou; sem seleção, o do turno (em combate); sem nenhum, o primeiro herói.
   * A seleção acompanha o turno (ver `endTurn`), então o painel segue o combate até alguém clicar em outro token.
   */
  function focusedToken() {
    const activeId = snapshot.combat.activeTokenId;
    const selectedId = snapshot.board.selectedTokenIds[0];
    return snapshot.board.tokens.find((token) => token.id === selectedId)
      || snapshot.board.tokens.find((token) => token.id === activeId)
      || snapshot.board.tokens.find((token) => token.side === "heroes");
  }

  // Outros pontos da Mesa (ex.: botão Configurar do diálogo de um objeto) pedem para abrir uma gaveta.
  useEffect(() => {
    const open = (event: Event) => { const panel = (event as CustomEvent<MesaPanelId>).detail; if (panel) { setDiceOpen(false); setSkinActionMode(null); setMapIntent(null); setSkinPanel(panel); } };
    window.addEventListener("mesa:open-panel", open);
    return () => window.removeEventListener("mesa:open-panel", open);
  }, []);

  function openSkinPanel(panel: MesaPanelId) {
    setDiceOpen(false);
    setSkinActionMode(null);
    setMapIntent(null);
    setSkinPanel(panel);
  }

  function canOperate(token: BoardToken | undefined) {
    return Boolean(token) && canControlToken(snapshot.multiplayer, token);
  }

  function recordCheck(label: string, modifier: number, kind: "save" | "system"): boolean {
    const token = focusedToken();
    if (!token || !canOperate(token)) {
      appendChat({ author: "Sistema", text: "Só o dono do personagem (ou o Mestre) rola testes por ele.", kind: "system" });
      return false;
    }
    const natural = 1 + Math.floor(Math.random() * 20);
    appendRoll({
      id: `mesa-skin-check-${crypto.randomUUID()}`,
      actor: token.name,
      target: "—",
      action: label,
      kind,
      natural,
      modifier,
      total: natural + modifier,
      formula: `1d20${modifier >= 0 ? "+" : ""}${modifier}`,
      rolls: [natural],
      outcome: natural === 20 ? "Crítico" : natural === 1 ? "Falha crítica" : "Rolagem",
      success: natural !== 1 && (natural === 20 || natural + modifier >= 10),
      timestamp: Date.now(),
    });
    return true;
  }

  /**
   * Na exploração não há Mesa de Rolagens à vista: o resultado de um teste aparece no histórico da mesinha de dados
   * (o mesmo botão d20); se o teste não pôde ser feito, abre o Diário, onde a explicação foi registrada.
   */
  function showCheckResult(rolled: boolean) {
    if (mesaStage === "combat") return;
    setSkinActionMode(null);
    if (rolled) { setSkinPanel(null); setDiceOpen(true); } else openSkinPanel("history");
  }

  /** Dano, cura, gasto e recuperação de PM/PV informados na linha de vitais do painel de combate. */
  function applyVital(kind: "damage" | "heal" | "spend" | "recover", amount: number) {
    const token = focusedToken();
    if (!token || amount <= 0 || !canOperate(token)) return;
    const life = kind === "damage" || kind === "heal";
    const current = life ? token.hp : token.pm;
    const max = life ? token.hpMax : token.pmMax;
    const next = kind === "damage" || kind === "spend" ? Math.max(0, current - amount) : Math.min(max, current + amount);
    updateToken(token.id, life ? { hp: next, defeated: next <= 0 } : { pm: next });
    const label = { damage: `sofreu ${amount} de dano`, heal: `recuperou ${amount} PV`, spend: `gastou ${amount} PM`, recover: `recuperou ${amount} PM` }[kind];
    appendChat({ author: token.name, text: `${label} (${life ? "PV" : "PM"} ${current} → ${next}).`, kind: "system" });
  }

  function rollSave(label: string): boolean {
    const token = focusedToken();
    if (!token) {
      appendChat({ author: "Sistema", text: "Não há personagem na cena para rolar o teste.", kind: "system" });
      return false;
    }
    const type = label === "Reflexos" ? "reflexes" : label === "Fortitude" ? "fortitude" : "will";
    return recordCheck(label, saveModifier(token, type), "save");
  }

  function rollSkill(label: string): boolean {
    const token = focusedToken();
    const sheet = token?.modernRpgCharacterId ? getModernRpgCharacter(token.modernRpgCharacterId) : null;
    const skill = T20_SKILLS.find((entry) => entry.nome.toLocaleLowerCase("pt-BR") === label.toLocaleLowerCase("pt-BR"));
    if (!token || !sheet || !skill) {
      appendChat({ author: "Sistema", text: "Esta perícia exige uma ficha oficial vinculada ao token selecionado.", kind: "system" });
      return false;
    }
    return recordCheck(label, sheetSkillTotal(sheet, skill.id, skill.atributo) + conditionSkillPenalty(token.conditions, skill.atributo, skill.id) + effectBonus(token, "skills", skill.id), "system");
  }

  function useEquipment(slot?: number, itemName?: string) {
    const token = focusedToken();
    const sheet = token?.modernRpgCharacterId ? getModernRpgCharacter(token.modernRpgCharacterId) : null;
    if (!token || !sheet || !canOperate(token)) {
      appendChat({ author: "Sistema", text: "Selecione um personagem controlado com ficha oficial para usar itens.", kind: "system" });
      return;
    }
    const hotkeyIds = readHotkeys(sheet.id);
    const slotEntry = slot ? hotkeyIds[slot - 1] || "" : "";
    if (slotEntry.startsWith("action:")) {
      // Ataque ou poder na hotkey: "carrega" a ação, escolhendo-a em Agir para o alvo ser indicado.
      setSkinPanel(null);
      setDiceOpen(false);
      setHotkeyAction(slotEntry.slice(7));
      setSkinActionMode("actions");
      return;
    }
    const item = slot
      ? sheet.equipment.find((entry) => entry.id === hotkeyIds[slot - 1])
      : sheet.equipment.find((entry) => entry.name === itemName)
        || sheet.equipment.find((entry) => entry.name.toLocaleLowerCase("pt-BR").includes(String(itemName || "").toLocaleLowerCase("pt-BR")));
    if (!item) {
      appendChat({ author: "Sistema", text: "A ficha não possui um item utilizável neste atalho.", kind: "system" });
      return;
    }
    const formula = item.description.match(/\b(?:\d*)d\d+(?:\s*[+-]\s*\d+)?\b/i)?.[0]?.replace(/\s+/g, "");
    const result = formula ? rollFormula(formula) : null;
    if (result) {
      appendRoll({
        id: `mesa-skin-item-${crypto.randomUUID()}`,
        actor: token.name,
        target: "—",
        action: item.name,
        kind: "system",
        modifier: result.modifier,
        total: result.total,
        formula: result.formula,
        rolls: result.rolls,
        outcome: `Item usado: [${result.rolls.join(", ")}]`,
        success: true,
        timestamp: Date.now(),
      });
    } else {
      appendChat({ author: token.name, text: `Usou ${item.name}.${item.description ? ` ${item.description}` : ""}`, kind: "system" });
    }
    if (item.category === "Consumível" && item.quantity > 0) {
      upsertCharacterSheet({ ...sheet, equipment: sheet.equipment.map((entry) => entry.id === item.id ? { ...entry, quantity: Math.max(0, entry.quantity - 1) } : entry) });
      setCharacterRevision((value) => value + 1);
    }
  }

  useEquipmentRef.current = useEquipment;

  function selectSourceToken(expected: string) {
    const direct = snapshot.board.tokens.find((entry) => entry.id === expected)
      || snapshot.board.tokens.find((entry) => entry.name.toLocaleLowerCase("pt-BR").split(" ").join("-") === expected);
    if (direct) { selectToken(direct.id); return; }
    const sourceIds = ["kael", "seraphine", "sombrio", "brom", "tormento", "brasa", "cultista"];
    const index = sourceIds.indexOf(expected);
    const visible = snapshot.board.tokens.filter((entry) => !entry.hidden && !entry.defeated);
    if (index >= 0 && visible[index]) selectToken(visible[index].id);
  }

  function armMove() {
    if (!snapshot.combat.active) return;
    // Uma ação de movimento por turno; sem ela, a ação padrão pode virar movimento (T20). Esgotadas as duas, não arma.
    const activeId = snapshot.combat.activeTokenId;
    const plan = turnPlan(snapshot.combat.resources[activeId || ""] || freshTurnResources(), "movement");
    if (!plan.allowed) { appendChat({ author: "Sistema", text: "Sem ação de movimento neste turno: a de movimento e a padrão já foram usadas.", kind: "system" }); return; }
    setSkinPanel(null);
    setStageTool("select");
    setMapIntent({ kind: "move" });
    appendChat({ author: "Sistema", text: plan.spend.standard ? "Movimento armado, usando a ação padrão (a de movimento já foi gasta): escolha o destino." : "Movimento armado (gasta a ação de movimento): escolha o destino no mapa.", kind: "system" });
  }

  function armMapTool(tool: Extract<MapToolId, "door" | "shape" | "trigger" | "object">, options: MapToolArmOptions = {}) {
    if (snapshot.multiplayer.role === "player") return;
    setSkinActionMode(null);
    setStageTool("select");
    setMapIntent({
      kind: "map-tool",
      tool,
      ...(options.shapeKind ? { shapeKind: options.shapeKind } : {}),
      ...(options.shapeSizeM ? { shapeSizeM: options.shapeSizeM } : {}),
      ...(options.triggerConfig ? { triggerConfig: options.triggerConfig } : {}),
    });
    const detail = tool === "shape" && options.shapeKind && options.shapeKind !== "cells"
      ? (options.shapeKind === "circle" && options.shapeSizeM ? "Círculo: clique no centro da área no mapa." : options.shapeKind === "cone" || options.shapeKind === "line" ? "Clique na origem; depois, na direção para onde a área aponta." : "Área: escolha o primeiro ponto no mapa.")
      : `Ferramenta ${tool} armada: escolha uma célula no mapa.`;
    appendChat({ author: "Sistema", text: detail, kind: "system" });
  }

  function actionTargetsForArea(actor: BoardToken, action: GameAction, cell: { x: number; y: number }) {
    const radius = Math.max(1, Math.floor(metersToCells(action.areaM || 1.5)));
    return snapshot.board.tokens.filter((target) => {
      if (target.hidden || target.defeated || target.hp <= 0) return false;
      if (gridDistance({ x: target.gx, y: target.gy }, cell) > radius) return false;
      if (action.target === "ally" || action.effect === "heal" || action.effect === "buff") return target.side === actor.side;
      return target.side !== actor.side;
    }).map((target) => target.id);
  }

  function handleMapPoint(point: { x: number; y: number }) {
    if (!mapIntent) return;
    const cell = { x: Math.floor(point.x * snapshot.board.map.cols), y: Math.floor(point.y * snapshot.board.map.rows) };
    if (mapIntent.kind === "place-token") {
      // O clique escolhe o centro do token; um bloco 2x2, 3x3 ou 6x6 se ajusta para caber dentro do mapa.
      const block = Math.max(1, sideOf(mapIntent.token));
      const ax = Math.max(0, Math.min(snapshot.board.map.cols - block, cell.x - Math.floor((block - 1) / 2)));
      const ay = Math.max(0, Math.min(snapshot.board.map.rows - block, cell.y - Math.floor((block - 1) / 2)));
      const placed = { ...mapIntent.token, gx: ax, gy: ay };
      const blocked = coveredCells(placed).some((spot) => snapshot.board.tokens.some((entry) => !entry.hidden && !entry.defeated && tokenCovers(entry, spot.x, spot.y)) || snapshot.board.map.terrain[`${spot.x},${spot.y}`]?.type === "blocked");
      if (blocked) { appendChat({ author: "Sistema", text: "Não cabe ali (casa ocupada ou bloqueada); escolha outro ponto.", kind: "system" }); return; }
      addToken(placed);
      setMapIntent(null);
      return;
    }
    if (mapIntent.kind === "map-tool") {
      if (snapshot.multiplayer.role === "player") { setMapIntent(null); return; }
      try {
        let nextShapeAnchor: { x: number; y: number } | null | undefined;
        applyMapTool({
          board: snapshot.board,
          tool: mapIntent.tool,
          brushMode: "add",
          x: cell.x,
          y: cell.y,
          shapeKind: mapIntent.shapeKind,
          shapeSizeM: mapIntent.shapeSizeM,
          shapeAnchor: mapIntent.shapeAnchor,
          onShapeAnchor: (anchor) => { nextShapeAnchor = anchor; },
          triggerConfig: mapIntent.triggerConfig || { condition: TRIGGER_CONDITIONS[0], mode: "once" },
        });
        if (nextShapeAnchor) {
          setMapIntent({ ...mapIntent, shapeAnchor: nextShapeAnchor });
          appendChat({ author: "Sistema", text: `Primeiro ponto definido em ${cell.x + 1}, ${cell.y + 1}; escolha o segundo ponto.`, kind: "system" });
        } else {
          setMapIntent(null);
          appendChat({ author: "Sistema", text: `Ferramenta ${mapIntent.tool} aplicada em ${cell.x + 1}, ${cell.y + 1}.`, kind: "system" });
        }
      } catch (error) {
        appendChat({ author: "Sistema", text: (error as Error).message, kind: "system" });
        setMapIntent(null);
      }
      return;
    }
    const actorId = snapshot.combat.activeTokenId || snapshot.board.selectedTokenIds[0];
    const actor = snapshot.board.tokens.find((token) => token.id === actorId);
    if (!actor || !actorId) { setMapIntent(null); return; }
    try {
      if (mapIntent.kind === "move") executeTacticalMove(actorId, cell.x, cell.y, effectiveMoveMode(snapshot.board.tokens.find((token) => token.id === actorId), getStageControl().moveMode));
      else {
        const action = mapIntent.action;
        const targets = action.target === "area" ? actionTargetsForArea(actor, action, cell) : [];
        executeTacticalAction(actorId, action.id, targets, cell, mapIntent.augment || null);
      }
      setMapIntent(null);
    } catch (error) {
      appendChat({ author: "Sistema", text: (error as Error).message, kind: "system" });
    }
  }

  /** All controls from the supplied source are routed only to existing Mesa actions. */
  function handleSkinAction(action: string) {
    if (action === "brand") { goToPortal(); return; }
    if (action === "home") { goToPortal(); return; } // a casinha volta ao site; as cenas ficam no botão de cenários
    if (["scenario", "scenes"].includes(action)) { openSkinPanel("scenes"); return; }
    // O ícone já existente é literalmente rotulado "Iluminação da mesa".
    // Ele abre o submenu de ambiente já disponível, sem alterar a máscara.
    if (action === "theme") { openSkinPanel("environment"); return; }
    if (action === "undo") { openSkinPanel("undo"); return; }
    // Grupo e Elenco são o mesmo botão: abre a lista da cena (jogador só vê).
    if (action === "group") { openSkinPanel("roster"); return; }
    if (action === "tokens") { openSkinPanel("tokens"); return; }
    if (action === "music") { openSkinPanel("jukebox"); return; }
    if (action === "objects") { openSkinPanel("map-context"); return; }
    if (action === "master") { openSkinPanel("master"); return; }
    // Régua: liga e desliga a medição no mapa (dois cliques medem a distância).
    if (action === "ruler") {
      setMapIntent(null);
      setSkinPanel(null);
      setSkinActionMode(null);
      setDiceOpen(false);
      setStageTool(getStageControl().tool === "measure" ? "select" : "measure");
      return;
    }
    // Ping: liga e desliga a ferramenta; o clique no mapa marca o ponto para todos.
    if (action === "ping") {
      setMapIntent(null);
      setSkinActionMode(null);
      setStageTool(getStageControl().tool === "ping" ? "select" : "ping");
      return;
    }
    if (action === "dice") {
      setSkinPanel(null);
      setSkinActionMode(null);
      setDiceOpen((open) => !open);
      return;
    }
    if (["settings", "config"].includes(action)) { openSkinPanel("settings"); return; }
    if (action === "journal") { openSkinPanel("history"); return; }
    if (action === "macros") { openSkinPanel("automation"); return; }
    if (action === "profile") { setProfileOpen(true); return; }
    if (action === "character") { openFocusedCharacter(); return; }
    // Decisão da matriz oficial: o ponto "Inventário" da máscara expõe o
    // Compêndio. Itens de combate continuam no botão "Itens" já existente.
    if (action === "inventory") { openSkinPanel("compendium"); return; }
    if (action === "actionMove") { armMove(); return; }
    if (action === "actionAct") { setSkinActionMode("actions"); return; }
    if (action === "actionMagic") { setSkinActionMode("magic"); return; }
    if (action === "actionItems") { setSkinActionMode("items"); return; }
    if (action === "actionCondition") { setSkinActionMode("conditions"); return; }
    if (action === "actionWait") {
      const actorId = snapshot.combat.activeTokenId || snapshot.board.selectedTokenIds[0];
      if (!actorId) return;
      try { executeTacticalEndTurn(actorId); } catch (error) { appendChat({ author: "Sistema", text: (error as Error).message, kind: "system" }); }
      return;
    }
    // As abas do combate trocam o conteúdo no próprio painel; só os botões "Abrir ficha/inventário completo" vão ao Portal.
    // O inventário completo mora na ficha oficial; o botão "Itens" do combate continua local (usa o equipamento do token).
    if (action === "openSheet" || action === "openInventory") { openFocusedCharacter(); return; }
    const loadoutMatch = /^loadout:(items|attacks|powers):(.+)$/.exec(action);
    if (loadoutMatch) {
      const token = focusedToken();
      if (token?.modernRpgCharacterId && canOperate(token)) toggleLoadout(token.modernRpgCharacterId, loadoutMatch[1] as LoadoutKind, loadoutMatch[2]);
      return;
    }
    const vitalMatch = /^vital:(damage|heal|spend|recover):(\d+)$/.exec(action);
    if (vitalMatch) { applyVital(vitalMatch[1] as "damage" | "heal" | "spend" | "recover", Number(vitalMatch[2])); return; }
    const initiativeMatch = /^initiativeSet:(.+):(-?\d+)$/.exec(action);
    if (initiativeMatch) {
      const target = snapshot.board.tokens.find((token) => token.id === initiativeMatch[1]);
      try {
        setInitiativeRoll(initiativeMatch[1], Number(initiativeMatch[2]));
        appendChat({ author: "Sistema", text: `Iniciativa de ${target?.name || "combatente"} ajustada para ${initiativeMatch[2]}.`, kind: "system" });
      } catch (error) { appendChat({ author: "Sistema", text: (error as Error).message, kind: "system" }); }
      return;
    }
    if (action === "saves") { openSkinPanel("automation"); return; }
    const saveMatch = /^save:(.+)$/.exec(action);
    if (saveMatch) { showCheckResult(rollSave(saveMatch[1])); return; }
    const skillMatch = /^skill:(.+)$/.exec(action);
    if (skillMatch) { showCheckResult(rollSkill(skillMatch[1])); return; }
    const equipMatch = /^equip:(.+)$/.exec(action);
    if (equipMatch) { toggleEquippedItem(equipMatch[1]); return; }
    const dropMatch = /^dropItem:(.+)$/.exec(action);
    if (dropMatch) { dropItemToGround(dropMatch[1]); return; }
    const itemMatch = /^item:(.+)$/.exec(action);
    if (itemMatch) { useEquipment(undefined, itemMatch[1]); return; }
    const hotkeyMatch = /^hotkey:(\d+)$/.exec(action);
    if (hotkeyMatch) { useEquipment(Number(hotkeyMatch[1])); return; }
    if (action === "rollClear") { clearRollHistory(); return; }
    if (["rollFilter", "rollSearch", "rollBookmark"].includes(action) || action.startsWith("roll:")) { openSkinPanel("history"); return; }
    const tokenMatch = /^(?:group|initiative|token):(.+)$/.exec(action);
    if (tokenMatch) selectSourceToken(tokenMatch[1]);
  }

  return <>
    {mesaStage === "lobby" && entry === "done" && <MesaLobby snapshot={snapshot} campaigns={campaigns} onEnter={() => setMesaStage("exploration")}/>}
    {mesaStage === "lobby" && entry !== "done" && (
      <main className="mesa-entrando" role="status">
        <strong>{entry === "error" ? "Não foi possível abrir a mesa" : "Abrindo a mesa…"}</strong>
        {entry === "error" && <p>{entryError}</p>}
        {entry === "error" && <div><button onClick={() => window.location.reload()}>Tentar de novo</button><button onClick={goToMesaOnline}>Voltar à Mesa online</button></div>}
      </main>
    )}
    {(mesaStage === "exploration" || mesaStage === "combat") && (
      <MesaSkinTable
        view={mesaStage === "combat" ? "combat" : "explore"}
        onViewChange={setSkinView}
        onAction={handleSkinAction}
        onMapPoint={handleMapPoint}
        runtime={{
          ...skinRuntime,
          diceOpen,
          showScale: prefs.showScale,
          activeNav: [
            ...(skinPanel && PANEL_NAV[skinPanel] ? [PANEL_NAV[skinPanel] as string] : []),
            ...(stageControl.tool === "measure" ? ["ruler"] : []),
          ],
          dicePanel: diceOpen ? <DicePanel rolls={snapshot.combat.rolls} actor={focusedToken()?.name || "Mesa"} onClose={() => setDiceOpen(false)}/> : undefined,
          hotkeyActions: {
            assign: (slot, itemId) => { const sheetId = focusedToken()?.modernRpgCharacterId; if (sheetId) assignHotkey(sheetId, slot, itemId); },
            clear: (slot) => { const sheetId = focusedToken()?.modernRpgCharacterId; if (sheetId) clearHotkey(sheetId, slot); },
          },
          stage: <MapStage snapshot={snapshot} view={mesaStage === "combat" ? "combat" : "explore"} intentActive={mapIntent !== null} areaPreview={mapIntent?.kind === "map-tool" && mapIntent.tool === "shape" && mapIntent.shapeKind && mapIntent.shapeKind !== "cells" ? { kind: mapIntent.shapeKind, anchor: mapIntent.shapeAnchor ?? null, sizeM: mapIntent.shapeSizeM } : null} onIntentPoint={handleMapPoint} onDropItem={dropItemToGround} moveFor={mapIntent?.kind === "move" ? (snapshot.combat.activeTokenId || snapshot.board.selectedTokenIds[0]) : undefined}/>,
        }}
      />
    )}
    {skinPanel && (mesaStage === "exploration" || mesaStage === "combat") && <div className="mesa-skin-drawer-host"><MesaGlobalPanel
      panel={skinPanel}
      snapshot={snapshot}
      units={units}
      selectedUnit={units.find((unit) => unit.id === snapshot.board.selectedTokenIds[0])}
      onClose={() => setSkinPanel(null)}
      onOpenCharacter={openCharacter}
      onOpenCharacters={() => setCharactersOpen(true)}
      onOpenThreats={() => setThreatsOpen(true)}
      onAddLibraryToken={spawnLibraryToken}
      onSpawnThreats={(template, count) => { for (let index = 0; index < count; index += 1) spawnThreat(template, undefined, undefined, count > 1); }}
      onSpawnNpc={(name) => spawnLibraryToken({ id: "npc", name, image: "", addedAt: Date.now() })}
      onOpenPanel={(panel) => openSkinPanel(panel)}
      onArmMapTool={armMapTool}
      onSelectStageTool={(tool: StageToolId) => {
        setMapIntent(null);
        setStageTool(tool);
        // Ferramentas que só precisam do mapa fecham a gaveta; as de pincel (névoa, luz, parede, terreno) mantêm as opções abertas.
        if (["move", "pan", "measure", "ping", "align"].includes(tool)) setSkinPanel(null);
      }}
      onEndTurn={() => {
        const actorId = snapshot.combat.activeTokenId;
        if (!actorId) return;
        try { executeTacticalEndTurn(actorId); } catch (error) { appendChat({ author: "Sistema", text: (error as Error).message, kind: "system" }); }
      }}
    /></div>}
    {skinActionMode && (mesaStage === "exploration" || mesaStage === "combat") && <MesaSkinActionDialog
      mode={skinActionMode}
      snapshot={snapshot}
      units={units}
      preselectActionId={hotkeyAction}
      onClose={() => { setSkinActionMode(null); setHotkeyAction(null); }}
      onArmMove={armMove}
      onArmAreaAction={(action, augment) => {
        setSkinPanel(null);
        setStageTool("select");
        setMapIntent({ kind: "area-action", action, augment });
        appendChat({ author: "Sistema", text: `Escolha o ponto de ${action.name} no mapa.`, kind: "system" });
      }}
    />}
    <ReactionPrompt snapshot={snapshot}/>
    <ObjectDialog snapshot={snapshot}/>
    <DoorDialog snapshot={snapshot}/>
    <ChestReveal snapshot={snapshot}/>
    <LootClaimer snapshot={snapshot}/>
    {profileOpen && <CharacterPickerDialog sheets={loadCharacterSheets()} readySheets={snapshot.multiplayer.role !== "player" ? loadReadyHeroSheets() : []} tokens={snapshot.board.tokens} isMaster={snapshot.multiplayer.role !== "player"} currentId={focusedToken()?.modernRpgCharacterId} onPick={pickCharacter} onOpenPortalSheet={(sheet) => openCharacter(sheet.id)} onOpenPortalList={() => openPortalRoute("personagens")} onClose={() => setProfileOpen(false)}/>}
    <CharacterLibraryDialog open={charactersOpen} onClose={() => setCharactersOpen(false)} onAdd={addCharacterToBoard}/>
    <ThreatLibraryDialog open={threatsOpen} templates={threats} onClose={() => setThreatsOpen(false)} onSpawn={spawnThreat} onCatalogChanged={() => setCatalogRevision((value) => value + 1)} onDelete={(id) => { removeCustomThreat(id); setCatalogRevision((value) => value + 1); }}/>
  </>;
}

function freePosition(tokens: BoardToken[], side: BoardToken["side"], blockSide = 1) {
  const board = getRuntimeSnapshot().board;
  const reverse = side === "threats";
  const fits = (x: number, y: number) => {
    if (x < 0 || y < 0 || x + blockSide > board.map.cols || y + blockSide > board.map.rows) return false;
    for (let dx = 0; dx < blockSide; dx += 1) for (let dy = 0; dy < blockSide; dy += 1) {
      if (board.map.terrain[`${x + dx},${y + dy}`]?.type === "blocked") return false;
      if (tokens.some((token) => tokenCovers(token, x + dx, y + dy))) return false;
    }
    return true;
  };
  for (let y = 1; y < board.map.rows - 1; y += 1) for (let offset = 1; offset < board.map.cols - 1; offset += 1) {
    const x = reverse ? board.map.cols - 1 - offset - (blockSide - 1) : offset;
    if (fits(x, y)) return { x, y };
  }
  return { x: 0, y: 0 };
}

/**
 * As campanhas continuam sendo criadas no Portal; a Mesa só lê a mesma chave
 * de storage para rotular a sala no lobby.
 */
function useStoredCampaigns(): string[] {
  return useMemo(() => {
    try {
      const value = JSON.parse(localStorage.getItem(CAMPAIGN_KEY) || "[]");
      return Array.isArray(value) ? value.map((entry) => typeof entry === "string" ? entry : String(entry?.name || "")).filter(Boolean) : [];
    } catch { return []; }
  }, []);
}

/** Mantido para quem ainda importa a lista de fichas a partir do App. */
export function characterSheets(): CharacterSheet[] { return loadCharacterSheets(); }
