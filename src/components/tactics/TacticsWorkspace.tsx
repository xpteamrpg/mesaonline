import { AnimatePresence, motion } from "framer-motion";
import { activeGrid, distanceBetween, formatDistance, metersToCells } from "../../game/distance";
import { fogSettings, tokenVisible, visionForTokens } from "../../game/vision";
import { BRUSH_TOOLS, COMBAT_TOOLS, MAP_TOOLS, type MapToolId, PLAYER_TOOLS, applyMapTool, toolHint, useMapTools } from "../../game/mapTools";
import MapToolbar from "../mesa/MapToolbar";
import {
  Backpack, BookOpen, Box, Dices, Grid3X3, ListOrdered, RotateCw, ScanLine, ScrollText, Settings2, Swords, UserRound,
  ZoomIn, ZoomOut,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import BattleBoard, { type BoardEffect } from "../BattleBoard";
import CommandMenu, { type CommandPage } from "../CommandMenu";
import CastPanel from "./CastPanel";
import CombatModeTransition from "../mesa/CombatModeTransition";
import ContextPlaceholder from "../mesa/ContextPlaceholder";
import LeftToolRail, { type MesaRailItem } from "../mesa/LeftToolRail";
import MesaGlobalPanel, { type MesaPanelId } from "../mesa/MesaGlobalPanel";
import InitiativeRail from "../mesa/InitiativeRail";
import MesaTopBar from "../mesa/MesaTopBar";
import RecentRollsBar from "../mesa/RecentRollsBar";
import type { ActionMode, GameAction, RuntimeSnapshot, TacticalUnitView, ViewMode } from "../../game/types";
import {
  endCombat, endTurn, selectToken, setFog,
} from "../../game/vttBridge";
import { canControlToken } from "../../game/permissions";
import { cellKey, gridDistance } from "../../game/rules";
import { pathTo, reachableCells } from "../../tactics/engine/movement";
import { coverBetween, hasLineOfEffect, isFlanking, withinRange, withinRangeCells } from "../../tactics/engine/targeting";
import { resolveTacticalAction } from "../../tactics/engine/combat";
import { executeTacticalAction, executeTacticalEndTurn, executeTacticalMove } from "../../tactics/engine/runtimeCommands";
import { aiPlan, applyAiMovement } from "../../tactics/engine/ai";
import { buildCastInfo, computeCastPlan, findSpellEntry } from "../../tactics/interpretation/spellCasting";
import { withBase } from "../../utils/assetUrl";

interface Props {
  snapshot: RuntimeSnapshot;
  units: TacticalUnitView[];
  onExit: () => void;
  onOpenCharacters: () => void;
  onOpenThreats: () => void;
  onOpenCharacter: (id: string) => void;
}

type CombatRailTool = "select" | "view" | "rotate" | "grid" | "fog";

export default function TacticsWorkspace(props: Props) {
  const { snapshot, units } = props;
  const board = snapshot.board;
  // Exploração e combate têm cenas físicas diferentes na referência. O estado
  // tático mantém as mesmas células, tokens e regras do board corrente, mas a
  // camada visual usa a ponte-fortaleza rubra própria do encontro.
  const tacticalMap = useMemo(() => ({ ...board.map, image: withBase("/tactics/fortaleza-tempestade-rubra.jpg") }), [board.map]);
  const combat = snapshot.combat;
  const selectedUnitId = board.selectedTokenIds[0] || "";
  const selectedUnit = units.find((unit) => unit.id === selectedUnitId);
  const selectedToken = board.tokens.find((token) => token.id === selectedUnit?.id);
  const [view, setView] = useState<ViewMode>("2d");
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [mode, setMode] = useState<ActionMode>("select");
  // A referência de combate entra com a ficha/comandos do participante em
  // foco. O painel global de Combate só abre quando o rail é acionado; ele não
  // pode substituir a coluna direita no estado-base.
  const [panel, setPanel] = useState<MesaPanelId | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [moveMode, setMoveMode] = useState<"walk" | "fly" | "burrow">("walk");
  // Mesma regra de visibilidade da exploracao — o combate nao inventa a sua.
  const fogCfg = useMemo(() => fogSettings(board.fogSettings), [board.fogSettings]);
  const vision = useMemo(() => {
    const owned = board.tokens.filter((token) => token.controlledBy && token.controlledBy === snapshot.multiplayer.peerId);
    const eyes = owned.length ? owned : board.tokens.filter((token) => token.side === "heroes");
    if (!fogCfg.playerFogEnabled) return { visible: new Set<string>() } as ReturnType<typeof visionForTokens>; // neblina desligada: não calcula
    return visionForTokens(board, eyes, fogCfg);
  }, [board, fogCfg, snapshot.multiplayer.peerId]);
  const unitHidden = (unit: { x: number; y: number; side?: string }) => !tokenVisible(unit, {
    visible: vision.visible, isMaster: snapshot.multiplayer.role !== "player",
    masterSeesPreview: fogCfg.masterSeesPreview, fogEnabled: fogCfg.playerFogEnabled,
  });
  const [commandPage, setCommandPage] = useState<CommandPage>("root");
  const [selectedAction, setSelectedAction] = useState<GameAction | null>(null);
  const [pendingMove, setPendingMove] = useState<{ x: number; y: number; cost: number } | null>(null);
  const [pendingTargetId, setPendingTargetId] = useState<string | null>(null);
  // Previa do caminho: destino -> rota valida, respeitando obstaculos, terreno
  // e elevacao (a mesma regra do custo). Recuperado de _wayCells do VTT antigo.
  const pathCells = useMemo(() => {
    if (!selectedToken || !pendingMove) return new Set<string>();
    return new Set(pathTo(board, selectedToken, pendingMove, { mode: moveMode }));
  }, [board, selectedToken, pendingMove, moveMode]);
  const [pendingTargetCell, setPendingTargetCell] = useState<{ x: number; y: number } | null>(null);
  const [effect, setEffect] = useState<BoardEffect | null>(null);
  const [fogMenu, setFogMenu] = useState(false);
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  // MESMA camada de ferramentas da exploracao (game/mapTools.ts).
  // Entrar em combate nao pode reduzir a capacidade de manipular a cena.
  const mapTools = useMapTools("select");
  const { tool, setTool, brushMode, setBrushMode, measureStart, measureTip } = mapTools;
  const measured = measureStart && measureTip ? distanceBetween(measureStart, measureTip, activeGrid()) : 0;
  const isPlayer = snapshot.multiplayer.role === "player";
  const combatToolItems = MAP_TOOLS.filter((entry) => COMBAT_TOOLS.includes(entry.id)).map((entry) => ({
    ...entry,
    disabled: isPlayer && !PLAYER_TOOLS.includes(entry.id),
  }));
  const [notice, setNotice] = useState("");
  // Conjuração com aprimoramentos. Vive fora do CommandPage porque o CastPanel
  // substitui a janela de comandos inteira enquanto está aberto.
  const [castAction, setCastAction] = useState<GameAction | null>(null);
  const [castCounts, setCastCounts] = useState<Record<number, number>>({});
  const [castRacial, setCastRacial] = useState(false);
  const [castTargets, setCastTargets] = useState<string[]>([]);

  useEffect(() => {
    if (snapshot.multiplayer.error) setNotice(snapshot.multiplayer.error);
  }, [snapshot.multiplayer.error]);

  // Seleção de combate não vaza para exploração ao desmontar o workspace.
  useEffect(() => () => selectToken(null), []);

  // Estado-base do combate: nunca deixar a coluna da direita cair no
  // placeholder genérico. Mestre foca o turno atual (ou o primeiro herói),
  // enquanto Jogador foca obrigatoriamente o próprio token.
  useEffect(() => {
    if (board.selectedTokenIds.length || !units.length) return;
    const mine = units.find((unit) => unit.controlledBy === snapshot.multiplayer.peerId && !unit.defeated);
    const active = units.find((unit) => unit.id === combat.activeTokenId && !unit.defeated);
    const hero = units.find((unit) => unit.side === "heroes" && !unit.defeated);
    const fallback = units.find((unit) => !unit.defeated);
    const initial = isPlayer ? mine || active || hero || fallback : active || hero || fallback;
    if (initial) selectToken(initial.id);
  }, [board.selectedTokenIds.length, combat.activeTokenId, isPlayer, snapshot.multiplayer.peerId, units]);

  const playerCanControl = canControlToken(snapshot.multiplayer, selectedToken);
  const canAct = Boolean(combat.active && selectedUnit && selectedUnit.id === combat.activeTokenId && !selectedUnit.defeated && playerCanControl);
  const reachableMap = useMemo(() => selectedToken && mode === "move" ? reachableCells(board, selectedToken, { mode: moveMode }) : new Map<string, number>(), [board, mode, selectedToken, moveMode]);
  const reachable = useMemo(() => new Set(reachableMap.keys()), [reachableMap]);
  const targetable = useMemo(() => {
    const result = new Set<string>();
    if (!selectedToken || !selectedAction || mode !== "target") return result;
    // Alcance NÃO basta: o motor resolve parede como cobertura total (Defesa
    // +99), então destacar um alvo sem linha de efeito era prometer um ataque
    // que já nasce perdido. O destaque agora usa o mesmo critério do motor.
    for (const token of board.tokens) {
      if (!withinRange(selectedToken, token, selectedAction.rangeM)) continue;
      if (!hasLineOfEffect(board, selectedToken, token)) continue;
      result.add(cellKey(token.gx, token.gy));
    }
    if (selectedAction.target === "area") for (let y = 0; y < board.map.rows; y += 1) for (let x = 0; x < board.map.cols; x += 1) {
      if (!withinRangeCells({ x: selectedToken.gx, y: selectedToken.gy }, { x, y }, selectedAction.rangeM)) continue;
      if (!hasLineOfEffect(board, selectedToken, { ...selectedToken, gx: x, gy: y })) continue;
      result.add(cellKey(x, y));
    }
    return result;
  }, [board.map.cols, board.map.rows, board.tokens, mode, selectedAction, selectedToken]);
  const areaCells = useMemo(() => {
    const result = new Set<string>();
    if (!selectedAction?.areaM || !pendingTargetCell) return result;
    const radius = Math.max(1, Math.floor(metersToCells(selectedAction.areaM)));
    for (let y = 0; y < board.map.rows; y += 1) for (let x = 0; x < board.map.cols; x += 1) if (gridDistance({ x, y }, pendingTargetCell) <= radius) result.add(cellKey(x, y));
    return result;
  }, [board.map.cols, board.map.rows, pendingTargetCell, selectedAction]);
  const affectedUnits = useMemo(() => {
    if (!selectedUnit || !selectedAction) return [];
    if (selectedAction.target === "self") return [selectedUnit];
    if (selectedAction.target === "area" && pendingTargetCell) {
      const radius = Math.max(1, Math.floor(metersToCells(selectedAction.areaM || activeGrid().scale)));
      return units.filter((unit) => !unit.defeated && gridDistance(unit, pendingTargetCell) <= radius && validSide(selectedAction, selectedUnit, unit));
    }
    const target = units.find((unit) => unit.id === pendingTargetId);
    return target && validSide(selectedAction, selectedUnit, target) ? [target] : [];
  }, [pendingTargetCell, pendingTargetId, selectedAction, selectedUnit, units]);

  const castEntry = useMemo(() => castAction ? findSpellEntry(castAction) : null, [castAction]);
  const castInfo = useMemo(() => {
    if (!castAction || !castEntry || !selectedUnit || !selectedToken) return null;
    // Candidatos usam o MESMO critério do motor: lado válido, alcance e linha
    // de efeito. Nada de oferecer alvo que a resolução vai recusar.
    const candidates = units
      .filter((unit) => !unit.defeated && validSide(castAction, selectedUnit, unit))
      .filter((unit) => {
        const token = board.tokens.find((entry) => entry.id === unit.id);
        return token ? withinRange(selectedToken, token, castAction.rangeM) && hasLineOfEffect(board, selectedToken, token) : false;
      })
      .map((unit) => ({ id: unit.id, name: unit.name }));
    return buildCastInfo({ action: castAction, entry: castEntry, level: selectedUnit.level || 1, currentPm: selectedUnit.pm, candidates });
  }, [board, castAction, castEntry, selectedToken, selectedUnit, units]);
  const castPlan = useMemo(() => castInfo ? computeCastPlan(castInfo, { counts: castCounts, racial: castRacial }) : null, [castCounts, castInfo, castRacial]);

  // Igual à exploração: a coluna da esquerda só lista painéis. Selecionar,
  // 2D/ISO, girar, grade e fog moram na barra horizontal sobre o mapa.
  const railItems: MesaRailItem[] = [
    { id: "scenes", label: "Cenas e mapas", icon: BookOpen },
    { id: "roster", label: "Personagem", icon: UserRound },
    { id: "combat", label: "Combate", icon: Swords, badge: combat.round },
    { id: "compendium", label: "Inventário", icon: Backpack },
    { id: "sheets", label: "Fichas", icon: ScrollText },
    { id: "history", label: "Diário", ariaLabel: "Diário e histórico", icon: BookOpen },
    { id: "automation", label: "Macros / Jukebox", ariaLabel: "Macros", icon: Dices, disabled: isPlayer },
    { id: "settings", label: "Configurações", icon: Settings2 },
  ];

  function clearCommand() {
    setMode("select"); setCommandPage("root"); setSelectedAction(null); setPendingMove(null); setPendingTargetId(null); setPendingTargetCell(null); setTool("select");
    setCastAction(null); setCastCounts({}); setCastRacial(false); setCastTargets([]);
  }
  function chooseAction(action: GameAction) {
    if (!selectedUnit) return;
    setSelectedAction(action);
    // Magia do catálogo oficial passa pelo painel de conjuração: círculo,
    // aprimoramentos, custo final e alvos múltiplos.
    if (findSpellEntry(action)) {
      setCastAction(action); setCastCounts({}); setCastRacial(false);
      setCastTargets(action.target === "self" ? [selectedUnit.id] : []);
      setMode("target"); setCommandPage("targeting");
      return;
    }
    if (action.target === "self") { setPendingTargetId(selectedUnit.id); setPendingTargetCell({ x: selectedUnit.x, y: selectedUnit.y }); setCommandPage("confirm-action"); }
    else { setMode("target"); setCommandPage("targeting"); }
  }
  function chooseTarget(unit: TacticalUnitView) {
    if (castInfo) {
      // Com o painel aberto o mapa só marca/desmarca alvo; quem confirma é o painel.
      if (!castInfo.candidates.some((candidate) => candidate.id === unit.id)) return;
      setCastTargets((current) => current.includes(unit.id) ? current.filter((id) => id !== unit.id) : [...current, unit.id]);
      return;
    }
    if (!selectedUnit || !selectedAction || !targetable.has(cellKey(unit.x, unit.y))) return;
    if (!validSide(selectedAction, selectedUnit, unit) && selectedAction.target !== "area") return;
    setPendingTargetId(unit.id); setPendingTargetCell({ x: unit.x, y: unit.y }); setCommandPage("confirm-action");
  }
  function clickCell(x: number, y: number) {
    const key = cellKey(x, y);
    // Ferramentas de mapa tem precedencia quando ativas (regua, fog, luz, ...).
    if (tool === "measure") { mapTools.handleMeasureClick(x, y); return; }
    if (tool === "ping") { mapTools.firePing(x, y); return; }
    if (tool !== "select" && tool !== "pan" && tool !== "move"
        && applyMapTool({ board, tool, brushMode, x, y, terrainBrush: mapTools.terrainBrush, triggerConfig: mapTools.triggerConfig, shapeKind: mapTools.shapeKind, shapeAnchor: mapTools.shapeAnchor, onShapeAnchor: mapTools.setShapeAnchor, onDone: () => setTool("select") })) return;
    if (mode === "select") { selectToken(null); clearCommand(); return; }
    if (mode === "fog-cover") { setFog(new Set([...board.fog, key])); return; }
    if (mode === "fog-reveal") { setFog(board.fog.filter((entry) => entry !== key)); return; }
    if (mode === "move" && reachableMap.has(key)) { setPendingMove({ x, y, cost: reachableMap.get(key)! }); setCommandPage("confirm-move"); return; }
    if (mode === "target" && selectedAction?.target === "area" && targetable.has(key)) { setPendingTargetCell({ x, y }); setCommandPage("confirm-action"); }
  }
  function confirmMove() {
    if (!selectedToken || !pendingMove) return;
    try { executeTacticalMove(selectedToken.id, pendingMove.x, pendingMove.y); clearCommand(); }
    catch (error) { setNotice((error as Error).message); }
  }
  function confirmAction() {
    if (!selectedToken || !selectedAction || !affectedUnits.length) return;
    try {
      executeTacticalAction(selectedToken.id, selectedAction.id, affectedUnits.map((unit) => unit.id), pendingTargetCell);
      const center = pendingTargetCell || { x: selectedToken.gx, y: selectedToken.gy };
      const effectType: BoardEffect["type"] = selectedAction.effect === "heal" ? "heal" : selectedAction.color === "fire" ? "fire" : selectedAction.category === "spell" ? "arcane" : selectedAction.category === "weapon" ? "slash" : "impact";
      setEffect({ id: crypto.randomUUID(), x: center.x, y: center.y, type: effectType, label: selectedAction.name });
      window.setTimeout(() => setEffect(null), 900); clearCommand();
    } catch (error) { setNotice((error as Error).message); }
  }
  function confirmCast() {
    if (!selectedToken || !castAction || !castInfo || !castPlan || castPlan.error) return;
    const targets = castAction.target === "self" ? [selectedToken.id] : castTargets.slice(0, castPlan.maxTargets);
    try {
      executeTacticalAction(selectedToken.id, castAction.id, targets, null, { counts: castCounts, racial: castRacial });
      const anchor = board.tokens.find((token) => token.id === targets[0]) || selectedToken;
      setEffect({ id: crypto.randomUUID(), x: anchor.gx, y: anchor.gy, type: castAction.effect === "heal" ? "heal" : castAction.color === "fire" ? "fire" : "arcane", label: castAction.name });
      window.setTimeout(() => setEffect(null), 900);
      if (castPlan.manualNotes.length) setNotice(`Aplique à mão: ${castPlan.manualNotes.join(" · ")}`);
      clearCommand();
    } catch (error) { setNotice((error as Error).message); }
  }
  function runAi() {
    if (!selectedToken) return;
    try { const plan = aiPlan(selectedToken, board); applyAiMovement(plan); if (plan.action && plan.targetId) resolveTacticalAction(selectedToken.id, plan.action, [plan.targetId]); setNotice(plan.reason); }
    catch (error) { setNotice((error as Error).message); }
  }
  function leaveCombatView() { selectToken(null); clearCommand(); props.onExit(); }
  function finishCombat() { endCombat(); leaveCombatView(); }
  function selectRail(id: string) {
    const next = (id === "sheets" ? "roster" : id) as MesaPanelId;
    if (isPlayer && next === "automation") return;
    setPanel((current) => current === next ? null : next);
  }

  return <main className={`mesa-table-shell combat-mode mesa-player-view mesa-reference-layout ${isPlayer ? "mesa-player-session" : "mesa-master-view"} ${historyOpen ? "history-expanded" : ""}`}>
    <MesaTopBar mode="combat" combatActive={combat.active} canManageCombat={snapshot.multiplayer.role !== "player"} sceneName={board.map.name} sceneLocation={`${board.map.location} · Rodada ${combat.round || "—"}`} multiplayer={snapshot.multiplayer} activePanel={panel} onQuickPanel={selectRail} onToggleCombat={snapshot.multiplayer.role === "player" ? leaveCombatView : finishCombat}/>
    <section className="mesa-workspace">
      <LeftToolRail items={railItems} activeId={panel} onSelect={selectRail}/>
      <section className="mesa-map-stage tactical-map-stage">
        <div className="mesa-tactical-controls">
          <div className="mesa-mode-pill"><SwordsMark/><span><small>COMBATE ATIVO</small><strong>Rodada {combat.round || "—"}</strong></span></div>
          <div>
            <button className={view === "2d" ? "active" : ""} onClick={() => setView("2d")}><ScanLine/>2D</button>
            <button className={view === "isometric" ? "active" : ""} onClick={() => setView("isometric")}><Box/>ISO</button>
            <button disabled={view === "2d"} onClick={() => setRotation((value) => (value + 90) % 360)} title="Girar" aria-label="Girar"><RotateCw/></button>
          </div>
        </div>
        <AnimatePresence>{fogMenu && <motion.div className="mesa-fog-popover" initial={{ opacity:0, y:-5 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-5 }}><button onClick={() => setMode("fog-cover")}>Cobrir células</button><button onClick={() => setMode("fog-reveal")}>Revelar células</button></motion.div>}</AnimatePresence>
        <MapToolbar
          tools={combatToolItems}
          activeTool={tool}
          onSelectTool={(id) => { const next = id as MapToolId; if (next !== "select") { setMode("select"); setCommandPage("root"); setSelectedAction(null); } setTool(next); setToolMenuOpen(false); }}
          toolsOpen={toolMenuOpen}
          onToggleTools={() => setToolMenuOpen((open) => !open)}
          hint={toolHint(tool)}
          showGrid={showGrid}
          onToggleGrid={() => setShowGrid((value) => !value)}
          brush={BRUSH_TOOLS.includes(tool) ? { mode: brushMode, onChange: setBrushMode } : undefined}
          terrain={tool === "terrain" ? { value: mapTools.terrainBrush, onChange: mapTools.setTerrainBrush } : undefined}
          trigger={tool === "trigger" ? { ...mapTools.triggerConfig, onChange: mapTools.setTriggerConfig } : undefined}
          shape={tool === "shape" ? { kind: mapTools.shapeKind, onChange: mapTools.setShapeKind, armed: Boolean(mapTools.shapeAnchor) } : undefined}
          zoom={zoom}
          onZoomIn={() => setZoom((value) => Math.min(1.3, value + .1))}
          onZoomOut={() => setZoom((value) => Math.max(.7, value - .1))}
          onFit={() => setZoom(1)}
        />
        <div className={`mesa-battle-stage ${tool === "measure" ? "is-measuring" : ""}`}><BattleBoard map={tacticalMap} units={units} view={view} rotation={rotation} zoom={zoom} showGrid={showGrid} mode={tool === "terrain" ? "terrain" : mode} selectedUnitId={selectedUnitId} activeUnitId={combat.activeTokenId || ""} reachable={reachable} targetable={targetable} areaCells={areaCells} pendingMove={pendingMove ? cellKey(pendingMove.x, pendingMove.y) : null} fog={new Set(board.fog)} effect={effect} isUnitHidden={unitHidden} pathCells={pathCells} measureStart={measureStart} measureTip={measureTip} measureLabel={formatDistance(measured, activeGrid())} onCellHover={(x, y) => { if (tool === "measure" && measureStart) mapTools.setMeasureHover({ x, y }); }} onCellClick={clickCell} onUnitClick={(unit) => { if (mode === "target") chooseTarget(unit); else {
            // Coluna unica: clicar no token NO MAPA traz o menu de comandos para
            // a frente. Agir vence consultar; o painel volta pela rail.
            clearCommand(); selectToken(unit.id); setPanel(null); } }}/>{mode !== "select" && !castInfo && <div className={`tactical-prompt ${mode}`}><strong>{mode === "move" ? "MOVIMENTO" : mode === "target" ? selectedAction?.name : "FOG"}</strong><span>Escolha uma célula válida.</span><button onClick={clearCommand}>Cancelar</button></div>}{!units.length && <div className="mesa-empty-map-note"><SwordsMark/><strong>Nenhum token na cena</strong><span>Use Elenco para adicionar personagens ou ameaças.</span></div>}</div>
        <div className="mesa-map-status"><span><Grid3X3/>1 quadrado = {formatDistance(activeGrid().scale, activeGrid())}</span><i/><span>{selectedUnit?.name || "Nenhum token selecionado"}</span><i/><span>{units.find((unit) => unit.id === combat.activeTokenId)?.name || "—"} está agindo</span></div>
      </section>
      <InitiativeRail
        snapshot={snapshot}
        units={units}
        selectedUnitId={selectedUnitId}
        onSelect={(unitId) => { clearCommand(); selectToken(unitId); setPanel(null); }}
      />
      {/* Coluna unica tambem no combate (ref. V3). */}
      {/* Troca direta, mesma razao da exploracao. */}
      {panel && <MesaGlobalPanel key={panel} panel={panel} snapshot={snapshot} units={units} selectedUnit={selectedUnit} onClose={() => setPanel(null)} onOpenCharacter={props.onOpenCharacter} onOpenCharacters={props.onOpenCharacters} onOpenThreats={props.onOpenThreats}/>}
      {!panel && !selectedUnit && <ContextPlaceholder snapshot={snapshot} units={units} mode="combat"/>}
      <AnimatePresence>{!panel && selectedUnit && <motion.div className="mesa-token-context combat-context" initial={{ x:30,opacity:0 }} animate={{ x:0,opacity:1 }} exit={{ x:30,opacity:0 }} transition={{ duration:.21 }}>{castInfo ? <CastPanel info={castInfo} counts={castCounts} targets={castTargets} racial={castRacial} preview={castPlan ? { cost: castPlan.cost, mods: castPlan.mods, error: castPlan.error } : null} onRacial={setCastRacial} onCounts={setCastCounts} onTargets={setCastTargets} onCast={confirmCast} onCancel={clearCommand}/> : <CommandMenu unit={selectedUnit} target={units.find((unit) => unit.id === pendingTargetId)} page={commandPage} canAct={canAct} canControl={playerCanControl} canRunAi={snapshot.multiplayer.role !== "player"} resources={combat.resources[selectedUnit.id]} selectedAction={selectedAction} pendingMoveDistance={pendingMove?.cost ?? null} affectedUnits={affectedUnits} onPage={setCommandPage} moveMode={moveMode} onMoveMode={setMoveMode} onMove={() => { setMode("move"); setPendingMove(null); }} onChooseAction={chooseAction} onConfirmAction={confirmAction} onConfirmMove={confirmMove} onCancel={clearCommand} onWait={() => { if (selectedToken) executeTacticalEndTurn(selectedToken.id); clearCommand(); }} onRunAi={runAi} onOpenSheet={selectedUnit.modernRpgCharacterId && playerCanControl ? () => props.onOpenCharacter(selectedUnit.modernRpgCharacterId!) : undefined} onClose={() => { selectToken(null); clearCommand(); }}/>}</motion.div>}</AnimatePresence>
    </section>
    <RecentRollsBar snapshot={snapshot} expanded={historyOpen} onToggleExpanded={() => setHistoryOpen((value) => !value)} onOpenHistory={() => setPanel("history")}/>
    <div className="mesa-table-dice" aria-hidden="true"><i>5</i><i>3</i><i>6</i></div>
    <CombatModeTransition mode="combat"/>
    {notice && <button className="tactics-notice" onClick={() => setNotice("")}>{notice}</button>}
  </main>;
}

function SwordsMark() { return <ListOrdered/>; }
function validSide(action: GameAction, actor: TacticalUnitView, target: TacticalUnitView) {
  if (action.target === "self") return actor.id === target.id;
  if (action.target === "ally") return actor.side === target.side;
  if (action.target === "enemy") return actor.side !== target.side;
  if (action.effect === "heal") return actor.side === target.side;
  return actor.side !== target.side;
}
