import { AnimatePresence, motion } from "framer-motion";
import {
  Backpack, BookOpen, BrickWall, CloudFog, Dices, DoorOpen, Footprints, Grid3X3, Hand, Lightbulb,
  MousePointer2, PackageOpen, Ruler, ScrollText, Settings2, Shapes, Sparkles, Swords, Target, UserRound, type LucideIcon,
} from "lucide-react";
import { type CSSProperties, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { BoardLight, BoardObject, RuntimeSnapshot, TacticalUnitView } from "../game/types";
import { canControlToken } from "../game/permissions";
import { activeGrid, distanceBetween, formatDistance } from "../game/distance";
import { fogSettings, tokenVisible, visionForTokens } from "../game/vision";
import { conditionBadges, hiddenConditionCount } from "../game/conditionBadges";
import { sensoryLabel, sensoryStateFor } from "../game/senses";
import { activeFloor, floorOf } from "../game/floors";
import { setVolume as setJukeboxVolume } from "../game/jukebox";
import { canRedo, canUndo, subscribeHistory } from "../game/history";
import { BRUSH_TOOLS, MAP_TOOLS, type MapToolId, PLAYER_TOOLS, applyMapTool, barrierAt, toolHint, useMapTools } from "../game/mapTools";
import {
  appendChat, removeWall, selectToken, setFog, setObjects,
  setShapes, updateToken, upsertLight, markExplored, upsertWall, undoBoard, redoBoard,
} from "../game/vttBridge";
import { createBoardBarrier, toggleBarrier } from "../tactics/engine/boardTools";
import { reachableCells } from "../tactics/engine/movement";
import { executeExplorationMove } from "../tactics/engine/runtimeCommands";
import CombatModeTransition from "./mesa/CombatModeTransition";
import ContextPlaceholder from "./mesa/ContextPlaceholder";
import LeftToolRail, { type MesaRailItem } from "./mesa/LeftToolRail";
import MapToolbar from "./mesa/MapToolbar";
import MesaGlobalPanel, { MESA_PANELS, type MesaPanelId } from "./mesa/MesaGlobalPanel";
import InitiativeRail from "./mesa/InitiativeRail";
import MesaTopBar from "./mesa/MesaTopBar";
import RecentRollsBar from "./mesa/RecentRollsBar";
import TokenContextPanel from "./mesa/TokenContextPanel";


interface Props {
  snapshot: RuntimeSnapshot;
  units: TacticalUnitView[];
  onOpenCharacters: () => void;
  onOpenCharacter: (id: string) => void;
  onOpenThreats: () => void;
  onStartCombat: () => void;
  onExit: () => void;
}


const defaultLight = (x: number, y: number): BoardLight => ({
  id: `light-${crypto.randomUUID()}`, x, y, type: "torch", name: "Tocha", radius: 5,
  color: "#ffad55", intensity: .82, enabled: true,
});

export default function ArmadaNextTable(props: Props) {
  const { snapshot, units } = props;
  const board = snapshot.board;
  const map = board.map;
  const fogCfg = useMemo(() => fogSettings(board.fogSettings), [board.fogSettings]);
  // CADEIA LUZ -> VISAO -> FOG (game/vision.ts). O jogador so enxerga o que sua
  // visao alcanca; o Mestre ve o fog manual, ou a previa do jogador se pedir.
  const vision = useMemo(() => {
    const owned = board.tokens.filter((token) => token.controlledBy && token.controlledBy === snapshot.multiplayer.peerId);
    const eyes = owned.length ? owned : board.tokens.filter((token) => token.side === "heroes");
    if (!fogCfg.playerFogEnabled) return { visible: new Set<string>() } as ReturnType<typeof visionForTokens>; // neblina desligada: não calcula
    return visionForTokens(board, eyes, fogCfg);
  }, [board, fogCfg, snapshot.multiplayer.peerId]);
  const fog = useMemo(() => {
    const manual = new Set(board.fog);
    const player = snapshot.multiplayer.role === "player";
    if (!fogCfg.playerFogEnabled) return manual;
    if (!player && !fogCfg.masterSeesPreview) return manual;
    const covered = new Set(manual);
    const explored = new Set(board.explored || []);
    for (let x = 0; x < board.map.cols; x += 1) for (let y = 0; y < board.map.rows; y += 1) {
      const key = `${x},${y}`;
      if (vision.visible.has(key)) { covered.delete(key); continue; }
      if (fogCfg.keepExploredDim && explored.has(key)) continue;
      covered.add(key);
    }
    return covered;
  }, [board, fogCfg, snapshot.multiplayer.role, vision]);
  const mapTools = useMapTools("select");
  const { tool, setTool, brushMode, setBrushMode, measureStart, measureTip, ping } = mapTools;
  // Painel esquerdo e CONTEXTUAL: nasce fechado para o mapa dominar (ref. V3).
  const [panel, setPanel] = useState<MesaPanelId | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [doorId, setDoorId] = useState("");
  // Cego esconde a cena; Surdo corta o audio (Vtt: aplicarCegoVisual/_aplicarSurdo).
  const andar = activeFloor(board);
  const sentidos = sensoryStateFor(board, snapshot.multiplayer);
  useEffect(() => { if (sentidos.deaf) setJukeboxVolume(0); }, [sentidos.deaf]);
  const historico = useSyncExternalStore(subscribeHistory, () => `${canUndo()}|${canRedo()}`, () => "false|false");
  const podeDesfazer = historico.startsWith("true");
  const podeRefazer = historico.endsWith("true");
  const [selectedObjectId, setSelectedObjectId] = useState("");
  const [camera, setCamera] = useState({ scale: 1, x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const boardZoneRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef<{ pointerId: number; x: number; y: number; cameraX: number; cameraY: number } | null>(null);
  const isPlayer = snapshot.multiplayer.role === "player";
  const selectedId = board.selectedTokenIds[0] || "";
  const selected = units.find((unit) => unit.id === selectedId);
  const selectedToken = board.tokens.find((token) => token.id === selectedId);
  const selectedCanControl = canControlToken(snapshot.multiplayer, selectedToken);
  // A exploração do Jogador é ancorada na própria ficha, não no último token
  // clicado. Se ele controla mais de um token, o selecionado vence; se clicar
  // numa entidade alheia, a sua ficha continua à direita.
  // A lâmina de referência sempre possui uma ficha contínua à direita. No
  // modo local/Mestre ela abre no primeiro herói da cena até que um token seja
  // clicado; no modo Jogador ela continua presa ao personagem controlado.
  const controlledUnit = isPlayer
    ? (selected && selectedCanControl ? selected : units.find((unit) => unit.controlledBy === snapshot.multiplayer.peerId) || units.find((unit) => unit.side === "heroes"))
    : (selected || units.find((unit) => unit.side === "heroes") || units[0]);
  const controlledToken = controlledUnit ? board.tokens.find((token) => token.id === controlledUnit.id) : undefined;
  const controlledCanControl = canControlToken(snapshot.multiplayer, controlledToken);
  const selectedObject = board.objects.find((object) => object.id === selectedObjectId);
  const selectedDoor = doorId ? board.walls.find((wall) => wall.id === doorId) : undefined;
  const gridCells = useMemo(() => Array.from({ length: map.cols * map.rows }, (_, index) => ({ x: index % map.cols, y: Math.floor(index / map.cols) })), [map.cols, map.rows]);
  const boardSize = useMemo(() => ({ width: Math.max(760, map.cols * 52), height: Math.max(520, map.rows * 52) }), [map.cols, map.rows]);
  // Regua e movimento usam a MESMA regra (game/distance.ts).
  const measured = measureStart && measureTip ? distanceBetween(measureStart, measureTip, activeGrid()) : 0;
  // A navegação visual é a mesma para Mestre e Jogador. O papel muda somente
  // a permissão do botão: nunca removemos itens do rail e evitamos criar uma
  // "mesa reduzida" que o jogador não reconhece em relação à referência V3.
  // Cenas, elenco, diário, áudio, compêndio e ajustes continuam consultáveis;
  // preparação ambiental, automação e gestão da sala ficam explicitamente
  // inativos para quem não criou a sala.
  const playerRestrictedPanels: MesaPanelId[] = ["environment", "automation", "online"];
  // A ordem e os oito destinos visíveis seguem a referência V3. Funções que
  // não têm botão próprio (fog, sala e preparação) vivem nos submenus certos.
  const railItems: MesaRailItem[] = [
    { id: "scenes", label: "Cenas e mapas", icon: BookOpen },
    { id: "roster", label: "Personagem", icon: UserRound },
    { id: "combat", label: "Combate", icon: Swords, badge: snapshot.combat.active ? snapshot.combat.round : undefined },
    { id: "compendium", label: "Inventário", icon: Backpack },
    { id: "sheets", label: "Fichas", icon: ScrollText },
    { id: "history", label: "Diário", ariaLabel: "Diário e histórico", icon: BookOpen },
    { id: "automation", label: "Macros / Jukebox", ariaLabel: "Macros", icon: Dices, disabled: isPlayer && playerRestrictedPanels.includes("automation") },
    { id: "settings", label: "Configurações", icon: Settings2 },
  ];
  // Mesma estrutura de ferramentas para todos os papéis. As de preparação da
  // cena permanecem no submenu de ferramentas, mas recebem estado desativado
  // para o Jogador — elas não desaparecem nem são duplicadas em outra barra.
  const toolItems = MAP_TOOLS.map((entry) => ({
    ...entry,
    disabled: isPlayer && !PLAYER_TOOLS.includes(entry.id),
  }));
  const [toolMenuOpen, setToolMenuOpen] = useState(false);

  // Sem seleção, a referência não mostra um espaço morto ou placeholder: ela
  // destaca o primeiro participante utilizável e mantém a ficha à direita.
  useEffect(() => {
    if (board.selectedTokenIds.length || !units.length) return;
    const initial = units.find((unit) => unit.side === "heroes" && !unit.defeated) || units.find((unit) => !unit.defeated);
    if (initial) selectToken(initial.id);
  }, [board.selectedTokenIds.length, units]);

  function fitCamera() {
    const rect = boardZoneRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Margens curtas + teto alto: nas referências o tabuleiro encosta nas
    // bordas do palco. Com 90/70px de folga e teto 1.4 o mapa ficava pequeno
    // no meio de um vazio preto.
    // Na exploração do Jogador o mapa ocupa toda a lâmina central da
    // referência V3. Preferimos a largura e recortamos somente a sobra
    // vertical, em vez de deixar duas faixas pretas laterais como uma foto
    // encaixada dentro do palco.
    const fitByWidth = isPlayer && !snapshot.combat.active;
    const scale = fitByWidth
      ? (rect.width - 12) / boardSize.width
      : Math.min((rect.width - 26) / boardSize.width, (rect.height - 22) / boardSize.height, 2.6);
    setCamera({ scale: Math.max(.25, Math.min(scale, 2.6)), x: 0, y: 0 });
  }

  // Sem isto o mapa abria com zoom 100% e ficava cortado na viewport; as
  // referências mostram a cena inteira enquadrada ao entrar na mesa.
  useEffect(() => {
    const frame = window.requestAnimationFrame(fitCamera);
    return () => window.cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map.id, boardSize.width, boardSize.height]);

  // Abrir a gaveta da esquerda ou o painel contextual encolhe o palco; sem
  // reenquadrar, parte da cena ficava escondida atrás dos painéis.
  useEffect(() => {
    const zone = boardZoneRef.current;
    if (!zone || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(fitCamera);
    });
    observer.observe(zone);
    return () => { window.cancelAnimationFrame(frame); observer.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardSize.width, boardSize.height]);


  function clickCell(x: number, y: number) {
    const key = `${x},${y}`;
    if (tool === "select") { selectToken(null); setSelectedObjectId(""); return; }
    if (tool === "pan") return;
    if (tool === "door") {
      // Contrato §11: porta existente abre submenu (Abrir/Fechar/Trancar/Destrancar);
      // celula vazia cria a porta. Nada de alternar as cegas.
      const existente = barrierAt(board, x, y);
      if (existente && existente.type === "door") { setDoorId(existente.id); return; }
    }
    if (tool === "measure") { mapTools.handleMeasureClick(x, y); return; }
    if (tool === "ping") { mapTools.firePing(x, y); return; }
    // fog, luz, paredes, portas, areas, gatilhos e objetos: camada compartilhada
    if (applyMapTool({ board, tool, brushMode, x, y, terrainBrush: mapTools.terrainBrush, triggerConfig: mapTools.triggerConfig, shapeKind: mapTools.shapeKind, shapeAnchor: mapTools.shapeAnchor, onShapeAnchor: mapTools.setShapeAnchor, onObjectCreated: setSelectedObjectId, onDone: () => setTool("select") })) return;
    if (tool === "move") {
      if (!selectedToken) { appendChat({ author: "Movimento", text: "Selecione um token antes de mover.", kind: "system" }); return; }
      if (!selectedCanControl) { appendChat({ author: "Movimento", text: "Você não controla este personagem.", kind: "system" }); return; }
      if (selectedToken.locked) { appendChat({ author: "Movimento", text: `${selectedToken.name} está travado pelo Mestre.`, kind: "system" }); return; }
      const reachable = reachableCells(board, selectedToken);
      if (!reachable.has(key)) { appendChat({ author: "Movimento", text: "Destino fora do deslocamento ou bloqueado.", kind: "system" }); return; }
      executeExplorationMove(selectedToken.id, x, y); setTool("select");
      if (fogCfg.exploreOnMove) markExplored(visionForTokens(board, [{ ...selectedToken, gx: x, gy: y }], fogCfg).visible);
    }
  }


  // Ctrl+Z / Ctrl+Shift+Z para as edicoes de cena do Mestre (VTT antigo).
  useEffect(() => {
    if (isPlayer) return;
    function onKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
      const alvo = event.target as HTMLElement | null;
      if (alvo && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)) return;
      event.preventDefault();
      if (event.shiftKey) redoBoard(); else undoBoard();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPlayer]);

  useEffect(() => { if (tool !== "door") setDoorId(""); }, [tool]);


  function selectRail(id: string) {
    // Fichas reaproveita o Elenco como ponto de entrada para a ficha oficial.
    const next = (id === "sheets" ? "roster" : id) as MesaPanelId;
    if (isPlayer && playerRestrictedPanels.includes(next)) return;
    setPanel((current) => current === next ? null : next);
  }

  /** Centraliza a câmera no token sem alterar o zoom escolhido pelo jogador. */
  function focusUnit(unit: TacticalUnitView) {
    const scale = camera.scale;
    const x =
      ((unit.x + 0.5) / map.cols) * boardSize.width - boardSize.width / 2;
    const y =
      ((unit.y + 0.5) / map.rows) * boardSize.height - boardSize.height / 2;
    selectToken(unit.id);
    setSelectedObjectId("");
    setPanel(null);
    setTool("select");
    setCamera((current) => ({ ...current, x: -x * scale, y: -y * scale }));
  }

  function beginPan(event: React.PointerEvent<HTMLDivElement>) {
    // A mão continua disponível no menu, mas botão direito arrasta a cena em
    // qualquer ferramenta — comportamento esperado de um VTT físico.
    if (tool !== "pan" && event.button !== 2) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      cameraX: camera.x,
      cameraY: camera.y,
    };
  }
  function panCamera(event: React.PointerEvent<HTMLDivElement>) {
    const start = panRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    setCamera((value) => ({
      ...value,
      x: start.cameraX + event.clientX - start.x,
      y: start.cameraY + event.clientY - start.y,
    }));
  }
  function endPan(event: React.PointerEvent<HTMLDivElement>) {
    if (panRef.current?.pointerId === event.pointerId) panRef.current = null;
  }
  function zoomMap(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.1 : -0.1;
    setCamera((value) => ({
      ...value,
      scale: Math.max(0.25, Math.min(3, value.scale + delta)),
    }));
  }

  return (
    <main className={`mesa-table-shell exploration-mode mesa-player-view mesa-reference-layout ${isPlayer ? "mesa-player-session" : "mesa-master-view"} ${historyOpen ? "history-expanded" : ""}`}>
      <MesaTopBar mode="exploration" combatActive={snapshot.combat.active} canManageCombat={snapshot.multiplayer.role !== "player"} sceneName={map.name} sceneLocation={map.location} multiplayer={snapshot.multiplayer} activePanel={panel} onQuickPanel={selectRail} onExit={props.onExit} onToggleCombat={props.onStartCombat}/>
      <section className="mesa-workspace">
        <LeftToolRail items={railItems} activeId={panel} onSelect={selectRail}/>
        {/* Submenu abre ao lado do rail e só então ocupa área. Ao fechar, o
            mapa recupera imediatamente essa largura. */}
        {panel && <MesaGlobalPanel key={panel} panel={panel} snapshot={snapshot} units={units} selectedUnit={selected} onClose={() => setPanel(null)} onOpenCharacter={props.onOpenCharacter} onOpenCharacters={props.onOpenCharacters} onOpenThreats={props.onOpenThreats}/>}
        <section className={`mesa-map-stage ${tool === "pan" ? "is-panning" : ""} ${tool === "measure" ? "is-measuring" : ""}`} style={{ "--mesa-fog-opacity": fogCfg.opacity } as CSSProperties}>
          <MapToolbar
            tools={toolItems}
            activeTool={tool}
            onSelectTool={(id) => { setTool(id as MapToolId); setToolMenuOpen(false); }}
            toolsOpen={toolMenuOpen}
            onToggleTools={() => setToolMenuOpen((open) => !open)}
            hint={toolHint(tool)}
            showGrid={showGrid}
            onToggleGrid={() => setShowGrid((value) => !value)}
            brush={BRUSH_TOOLS.includes(tool) ? { mode: brushMode, onChange: setBrushMode } : undefined}
            terrain={tool === "terrain" ? { value: mapTools.terrainBrush, onChange: mapTools.setTerrainBrush } : undefined}
            trigger={tool === "trigger" ? { ...mapTools.triggerConfig, onChange: mapTools.setTriggerConfig } : undefined}
            shape={tool === "shape" ? { kind: mapTools.shapeKind, onChange: mapTools.setShapeKind, armed: Boolean(mapTools.shapeAnchor) } : undefined}
            history={!isPlayer ? { canUndo: podeDesfazer, canRedo: podeRefazer, onUndo: () => undoBoard(), onRedo: () => redoBoard() } : undefined}
            door={selectedDoor ? {
              name: selectedDoor.name || "Porta",
              open: Boolean(selectedDoor.open),
              locked: Boolean(selectedDoor.locked),
              onAction: (action) => {
                if (action === "dismiss") { setDoorId(""); return; }
                if (action === "open" || action === "close") upsertWall({ ...selectedDoor, open: action === "open" });
                if (action === "lock" || action === "unlock") upsertWall({ ...selectedDoor, locked: action === "lock" });
              },
            } : undefined}
            zoom={camera.scale}
            onZoomIn={() => setCamera((value) => ({ ...value, scale: Math.min(3, value.scale + .1) }))}
            onZoomOut={() => setCamera((value) => ({ ...value, scale: Math.max(.25, value.scale - .1) }))}
            onFit={fitCamera}
          />
          {isPlayer && !snapshot.combat.active && <div className="mesa-exploration-compass" aria-hidden="true"><b>N</b><i/><span>O</span><span>L</span><em>S</em></div>}
          {isPlayer && !snapshot.combat.active && <div className="mesa-exploration-scale" aria-hidden="true"><span>0</span><i/><span>10</span><i/><span>20</span><i/><span>30 m</span></div>}
          <div className="mesa-board-viewport" ref={boardZoneRef} onPointerDown={beginPan} onPointerMove={panCamera} onPointerUp={endPan} onPointerCancel={endPan} onWheel={zoomMap} onContextMenu={(event) => event.preventDefault()} onClick={(event) => { if (event.target === event.currentTarget && tool === "select") selectToken(null); }}>
            <div className="next-camera" style={{ width: boardSize.width, height: boardSize.height, transform: `translate(calc(-50% + ${camera.x}px),calc(-50% + ${camera.y}px)) scale(${camera.scale})` }}>
              <div className="next-board mesa-exploration-board" style={{ width: boardSize.width, height: boardSize.height } as CSSProperties}>
                {map.image ? <img src={map.image} alt={map.name}/> : <div className="empty-map">Importe um mapa para começar</div>}
                <WeatherLayer weather={board.weather}/>
                <div className={`next-grid ${showGrid ? "" : "grid-hidden"}`} style={{ gridTemplateColumns: `repeat(${map.cols},1fr)`, gridTemplateRows: `repeat(${map.rows},1fr)` }}>
                  {gridCells.map(({ x, y }) => { const key = `${x},${y}`; const barrier = barrierAt(board, x, y); const cellTerrain = board.map.terrain[key]; const light = board.lights.find((entry) => entry.x === x && entry.y === y); return <button key={key} className={[fog.has(key) ? "fog" : "", barrier ? `barrier-${barrier.type} ${barrier.open ? "is-open" : "is-closed"} ${barrier.locked ? "is-locked" : ""}` : "", light ? "light" : "", board.shapes.some((shape) => shape.cells.includes(key)) ? "shape" : "", cellTerrain && cellTerrain.type !== "normal" ? `terrain-${cellTerrain.type}` : "", (cellTerrain?.elevation || 0) > 0 ? "has-elevation" : ""].filter(Boolean).join(" ")} data-elev={cellTerrain?.elevation || undefined} title={barrier ? `${barrier.name || (barrier.type === "door" ? "Porta" : barrier.type === "window" ? "Janela" : "Parede")}${barrier.type === "door" ? (barrier.locked ? " · trancada" : barrier.open ? " · aberta" : " · fechada") : ""}` : undefined} onMouseEnter={() => { if (tool === "measure" && measureStart) mapTools.setMeasureHover({ x, y }); }} onClick={() => clickCell(x, y)}/>; })}
                </div>
                <div className="next-light-layer">{board.lights.filter((light) => light.enabled).map((light) => <span key={light.id} className={`next-light-source ${light.type}`} style={{ left: `${((light.x + .5) / map.cols) * 100}%`, top: `${((light.y + .5) / map.rows) * 100}%`, "--light-color": light.color, "--light-size": `${light.radius * 90}px`, "--light-opacity": light.intensity } as CSSProperties}><i/><span><Lightbulb/></span></span>)}</div>
                <AnimatePresence>{units.filter((unit) => !board.tokens.find((token) => token.id === unit.id)?.hidden).filter((unit) => floorOf(board.tokens.find((t) => t.id === unit.id)) === andar)
                  .filter((unit) => tokenVisible(unit, { visible: vision.visible, isMaster: snapshot.multiplayer.role !== "player", masterSeesPreview: fogCfg.masterSeesPreview, fogEnabled: fogCfg.playerFogEnabled })).map((unit) => <motion.button key={unit.id} className={`next-token ${unit.side} ${selectedId === unit.id ? "selected" : ""}`} animate={{ left: `${((unit.x + .5) / map.cols) * 100}%`, top: `${((unit.y + .5) / map.rows) * 100}%` }} onClick={(event) => { event.stopPropagation(); setSelectedObjectId(""); selectToken(unit.id); setTool("select"); setPanel(null); }}><span>{unit.portrait ? <img src={unit.portrait} alt=""/> : unit.symbol}</span><small>{unit.name.split(" ")[0]}</small><i><b style={{ width: `${Math.max(0, unit.pv / Math.max(1, unit.pvMax)) * 100}%` }}/></i>{board.tokens.find((token) => token.id === unit.id)?.locked && <em className="token-lock" title="Token travado">⌧</em>}<u className="token-conditions">{conditionBadges(unit.conditions).map((badge) => <b key={badge.key} className={badge.tone} title={badge.label}>{badge.glyph}</b>)}{hiddenConditionCount(unit.conditions) > 0 && <b className="more">+{hiddenConditionCount(unit.conditions)}</b>}</u></motion.button>)}</AnimatePresence>
                {board.objects.filter((object) => tokenVisible({ x: object.x, y: object.y, side: "threats" }, { visible: vision.visible, isMaster: snapshot.multiplayer.role !== "player", masterSeesPreview: fogCfg.masterSeesPreview, fogEnabled: fogCfg.playerFogEnabled })).map((object) => <button key={object.id} className={`next-object ${object.kind} ${selectedObjectId === object.id ? "selected" : ""}`} style={{ left: `${((object.x + .5) / map.cols) * 100}%`, top: `${((object.y + .5) / map.rows) * 100}%` }} onClick={(event) => { event.stopPropagation(); selectToken(null); setSelectedObjectId(object.id); }}><PackageOpen/><small>{object.name}</small></button>)}
                {measureStart && measureTip && <svg className="mesa-measure-layer" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <line x1={((measureStart.x + .5) / map.cols) * 100} y1={((measureStart.y + .5) / map.rows) * 100} x2={((measureTip.x + .5) / map.cols) * 100} y2={((measureTip.y + .5) / map.rows) * 100} vectorEffect="non-scaling-stroke"/>
                  <circle cx={((measureStart.x + .5) / map.cols) * 100} cy={((measureStart.y + .5) / map.rows) * 100} r=".7" vectorEffect="non-scaling-stroke"/>
                  <circle cx={((measureTip.x + .5) / map.cols) * 100} cy={((measureTip.y + .5) / map.rows) * 100} r=".7" vectorEffect="non-scaling-stroke"/>
                </svg>}
                {measureStart && measureTip && <div className="mesa-measure-tag" style={{ left: `${((measureTip.x + .5) / map.cols) * 100}%`, top: `${((measureTip.y + .5) / map.rows) * 100}%` }}>{formatDistance(measured, activeGrid())}</div>}
                {ping && <motion.div key={ping.id} className="next-ping" style={{ left: `${((ping.x + .5) / map.cols) * 100}%`, top: `${((ping.y + .5) / map.rows) * 100}%` }} initial={{ scale:.2,opacity:1 }} animate={{ scale:2.4,opacity:0 }} transition={{ duration:1.5 }}/>}
              </div>
            </div>
            {measured > 0 && <div className="next-measure"><Ruler/>{formatDistance(measured, activeGrid())}</div>}
            {sentidos.blind && <div className="mesa-sense-veil" role="status">
              <strong>{sensoryLabel(sentidos)}</strong>
              <span>{sentidos.source} não enxerga a cena. Você ainda pode falar e agir às cegas.</span>
            </div>}
            {!sentidos.blind && sentidos.deaf && <div className="mesa-sense-tag" role="status">Surdo — áudio mudo</div>}
          </div>
          <div className="mesa-map-status"><span><Grid3X3/>1 quadrado = {formatDistance(activeGrid().scale, activeGrid())}</span><i/><span>{(isPlayer ? controlledUnit : selected)?.name || selectedObject?.name || "Nenhum token selecionado"}</span></div>
        </section>
        {/* Exploração usa o índice Grupo para todos os papéis. A iniciativa só
            pertence ao combate; no modo local ela não pode roubar esta coluna. */}
        <ExplorationContextRail units={units} focusedUnitId={controlledUnit?.id} onFocus={focusUnit}/>
        {/* A última coluna é exclusivamente o contexto/ficha do personagem.
            Ela nunca se empilha com a gaveta do rail: abrir uma função troca
            espaço do mapa, não cria uma terceira superfície simultânea. */}
        {!panel && !controlledUnit && <ContextPlaceholder snapshot={snapshot} units={units} mode="exploration"/>}
        {/* Para Mestre, controlledUnit é o token selecionado. Para Jogador, é
            sempre um token sob seu controle: a coluna da direita permanece a
            ficha do próprio personagem mesmo ao inspecionar outro token. */}
        <AnimatePresence>{!panel && controlledUnit && <TokenContextPanel
          unit={controlledUnit}
          canControl={controlledCanControl}
          persistent={true}
          locked={Boolean(controlledToken?.locked)}
          onToggleLock={!isPlayer && controlledToken ? () => updateToken(controlledToken.id, { locked: !controlledToken.locked }) : undefined}
          onClose={() => selectToken(null)}
          onMove={() => { selectToken(controlledUnit.id); setTool("move"); }}
          onOpenSheet={controlledUnit.modernRpgCharacterId && controlledCanControl ? () => props.onOpenCharacter(controlledUnit.modernRpgCharacterId!) : undefined}
          onRemoveCondition={controlledCanControl ? (condition) => updateToken(controlledUnit.id, { conditions: (controlledUnit.conditions || []).filter((entry) => entry !== condition) }) : undefined}
          onEditVitals={controlledCanControl ? (patch) => updateToken(controlledUnit.id, patch) : undefined}
          onAddCondition={controlledCanControl ? (condition) => updateToken(controlledUnit.id, { conditions: Array.from(new Set([...(controlledUnit.conditions || []), condition])) }) : undefined}
        />}</AnimatePresence>
      </section>
      {!isPlayer && <RecentRollsBar snapshot={snapshot} expanded={historyOpen} onToggleExpanded={() => setHistoryOpen((value) => !value)} onOpenHistory={() => setPanel("history")}/>}
      <div className="mesa-table-dice" aria-hidden="true"><i>5</i><i>3</i><i>6</i></div>
      <CombatModeTransition mode="exploration"/>
    </main>
  );
}

/**
 * Exploração não usa a ordem de iniciativa. Em vez de deixar um vazio entre
 * mapa e ficha, a referência recebe uma coluna de contexto muito estreita:
 * apenas estado da cena, sem ações de combate nem painéis concorrentes.
 */
function ExplorationContextRail({
  units,
  focusedUnitId,
  onFocus,
}: {
  units: TacticalUnitView[];
  focusedUnitId?: string;
  onFocus: (unit: TacticalUnitView) => void;
}) {
  const focused = units.find((unit) => unit.id === focusedUnitId);
  return (
    <aside className="mesa-exploration-context-rail" aria-label="Grupo na cena">
      <header>
        <UserRound />
        <span>
          <small>Na cena</small>
          <strong>Grupo</strong>
        </span>
        {focused && (
          <button
            className="mesa-group-focus"
            onClick={() => onFocus(focused)}
            title={`Centralizar em ${focused.name}`}
            aria-label={`Centralizar em ${focused.name}`}
          >
            <Target />
          </button>
        )}
      </header>
      <div className="mesa-exploration-group-list">
        {units
          .filter((unit) => !unit.defeated)
          .map((unit) => (
            <button
              type="button"
              key={unit.id}
              className={`mesa-group-member ${unit.side} ${unit.id === focusedUnitId ? "is-focused" : ""}`}
              onClick={() => onFocus(unit)}
              title={`Centralizar em ${unit.name}`}
            >
              <span className="mesa-group-portrait">
                {unit.portrait ? (
                  <img src={unit.portrait} alt="" />
                ) : (
                  unit.symbol
                )}
              </span>
              <span>
                <strong>{unit.name}</strong>
                <span className="mesa-group-vital-line hp">
                  <i>
                    <b
                      style={{
                        width: `${Math.max(0, Math.min(100, (unit.pv / Math.max(1, unit.pvMax)) * 100))}%`,
                      }}
                    />
                  </i>
                  <em>{unit.pv}/{unit.pvMax}</em>
                </span>
                <span className="mesa-group-vital-line pm">
                  <i>
                    <b
                      style={{
                        width: `${Math.max(0, Math.min(100, (unit.pm / Math.max(1, unit.pmMax)) * 100))}%`,
                      }}
                    />
                  </i>
                  <em>{unit.pm}/{unit.pmMax}</em>
                </span>
              </span>
            </button>
          ))}
      </div>
    </aside>
  );
}

function WeatherLayer({ weather }: { weather: RuntimeSnapshot["board"]["weather"] }) { return weather === "clear" ? <div className="next-weather clear"/> : <div className={`next-weather ${weather}`}>{Array.from({ length: weather === "fog" ? 9 : 48 }, (_, index) => <i key={index} style={{ "--i": index, "--x": ((index * 37) % 101), "--delay": -((index * 19) % 30) / 10 } as CSSProperties}/>)}</div>; }
