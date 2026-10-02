import { Lightbulb, PackageOpen, Ruler } from "lucide-react";
import { type CSSProperties, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Token } from "../mesaSkin/components/MapArea";
import type { SkinMapToken } from "../mesaSkin/runtime";
import type { BoardToken, RuntimeSnapshot } from "../../game/types";
import { canControlToken } from "../../game/permissions";
import { activeGrid, distanceBetween, formatDistance } from "../../game/distance";
import { conditionBadges, hiddenConditionCount } from "../../game/conditionBadges";
import { activeFloor, floorOf } from "../../game/floors";
import { fogSettings, tokenVisible, visionForTokens } from "../../game/vision";
import { applyMapTool, barrierAt, previewAreaCells, useMapTools } from "../../game/mapTools";
import type { ShapeKind } from "../../game/shapes";
import { footprintOccupied } from "../../tactics/engine/movement";
import { blockCenter, footprintOf, sideOf, sizeOf } from "../../game/tokenSize";
import { appendChat, closeStageMedia, closeTravelEvent, markExplored, selectToken, sendSignal, switchScene, updateMap, upsertLight } from "../../game/vttBridge";
import StageMediaOverlay from "./StageMediaOverlay";
import TravelEventOverlay from "./TravelEventOverlay";
import { onSignals } from "../../game/signals";
import { auraCells } from "../../game/shapes";
import { ISO_STAGE_SIZE, isoFocus } from "../../game/isoView";
import IsoStage from "./IsoStage";
import { pathDistance } from "../../game/ruler";
import { CELL_PX, boardPixelSize, clampZoom, fitScale, focusCamera, imagePlacement, imageStyle, snapOffset } from "../../game/mapView";
import { toggleBarrier } from "../../tactics/engine/boardTools";
import { reachableWithPaths, moverOf } from "../../tactics/engine/movement";
import { executeExplorationMove, executeTacticalMove } from "../../tactics/engine/runtimeCommands";
import { onCameraCommand, openDoorDialog, openObjectDialog, setStageTool, useStageControl } from "./mapStageControl";
import { isShaking } from "../../game/chest";
import { effectiveMoveMode } from "../../game/movementMode";

interface Props {
  snapshot: RuntimeSnapshot;
  view: "explore" | "combat";
  /** Uma ferramenta armada pelo App (porta, área, gatilho, objeto, mover em combate) recebe o clique. */
  intentActive: boolean;
  /** área de efeito sendo posicionada pelo Mestre: forma, ponto de origem (se já escolhido) e tamanho */
  areaPreview?: { kind: ShapeKind; anchor: { x: number; y: number } | null; sizeM?: number } | null;
  onIntentPoint: (point: { x: number; y: number }) => void;
  /** Token que está para se mover (Mover do combate): o palco mostra as casas alcançáveis e pede confirmação. */
  moveFor?: string;
  /** Item da mochila solto sobre o mapa (arrastar do equipamento): `itemId` da ficha e a casa sob o ponteiro. */
  onDropItem?: (itemId: string, cell: { x: number; y: number }) => void;
}

const HERO_RING = "#4fa83c";
const THREAT_RING = "#c2202b";

/**
 * Palco real do VTT dentro da máscara: mostra o mapa que o Mestre carregou, com
 * grade, câmera (roda = zoom, botão direito/mão = arrastar), fog por visão,
 * luzes, paredes/portas, terreno, áreas, objetos, clima, régua e ping.
 * Não cria controles: as ferramentas vêm da gaveta Macros → Mapa e objetos.
 */
export default function MapStage({ snapshot, view, intentActive, areaPreview, onIntentPoint, moveFor, onDropItem }: Props) {
  const board = snapshot.board;
  const map = board.map;
  const isPlayer = snapshot.multiplayer.role === "player";
  const stageControl = useStageControl();
  const mapTools = useMapTools("select");
  const { measureStart, measureTip, ping } = mapTools;
  const [camera, setCamera] = useState({ scale: 1, x: 0, y: 0 });
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef<{ pointerId: number; x: number; y: number; cameraX: number; cameraY: number } | null>(null);
  // Guardada: um objeto novo a cada renderização refazia a visão (a parte mais cara do mapa) a cada casa que o mouse cruzava.
  const fogCfg = useMemo(() => fogSettings(board.fogSettings), [board.fogSettings]);
  const andar = activeFloor(board);
  const selectedId = board.selectedTokenIds[0] || "";
  const selectedToken = board.tokens.find((token) => token.id === selectedId);
  // Baú que treme (trancado ou teste falho): o carimbo shakeAt vem do Mestre e vale para todos.
  const [shaking, setShaking] = useState<Record<string, number>>({});
  useEffect(() => {
    const now = Date.now();
    const fresh = [...board.objects, ...board.walls].filter((object) => isShaking(object, now) && shaking[object.id] !== object.shakeAt);
    if (!fresh.length) return;
    setShaking((current) => ({ ...current, ...Object.fromEntries(fresh.map((object) => [object.id, object.shakeAt as number])) }));
    const timer = window.setTimeout(() => setShaking((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !fresh.some((object) => object.id === id)))), 750);
    return () => window.clearTimeout(timer);
  }, [board.objects, board.walls]); // eslint-disable-line react-hooks/exhaustive-deps
  // Casas cobertas por auras ativas (aura do token, legado: adicionarCelulasAuraLight).
  const auraSet = useMemo(() => new Set(board.tokens.filter((token) => !token.hidden && floorOf(token) === andar).flatMap((token) => auraCells(token))), [board.tokens, andar]);
  const gridCells = useMemo(() => Array.from({ length: map.cols * map.rows }, (_, index) => ({ x: index % map.cols, y: Math.floor(index / map.cols) })), [map.cols, map.rows]);
  // Tabuleiro com células quadradas: colunas × linhas, seja qual for o tamanho do mapa.
  const flatSize = useMemo(() => boardPixelSize(map.cols, map.rows), [map.cols, map.rows]);
  // Visão isométrica (V3 religado): o espaço de desenho é o do canvas isométrico.
  const iso = stageControl.view === "iso";
  const rotation = stageControl.rotation;
  const boardSize = iso ? ISO_STAGE_SIZE : flatSize;
  // Alinhamento do mapa (só Mestre): posição da imagem enquanto arrasta, gravada ao soltar.
  const [alignPreview, setAlignPreview] = useState<{ offsetX: number; offsetY: number } | null>(null);
  const alignRef = useRef<{ pointerId: number; x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const shownMap = alignPreview ? { ...map, ...alignPreview } : map;
  // Valores atuais para os ouvintes nativos (roda do mouse, comandos de câmera).
  const live = useRef({ camera: { scale: 1, x: 0, y: 0 }, selectedToken: undefined as typeof selectedToken, map, tool: stageControl.tool, isPlayer, boardSize, iso, rotation });
  // Prévia de movimento (V3): casas alcançáveis + destino pendente, confirmado no segundo clique.
  const [pendingMove, setPendingMove] = useState<string | null>(null);
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);
  const areaCells = useMemo(() => (areaPreview && hoverCell ? new Set(previewAreaCells(areaPreview.kind, areaPreview.anchor, hoverCell, areaPreview.sizeM)) : null), [areaPreview, hoverCell]);
  // Arrastar o próprio token (botão esquerdo): mostra as casas alcançáveis e move ao soltar.
  const [dragToken, setDragToken] = useState<string | null>(null);
  const dragRef = useRef<{ pointerId: number; tokenId: string; x: number; y: number; moved: boolean } | null>(null);
  // Exploração: o token selecionado já mostra aonde pode ir; passar o mouse traça o caminho e clicar leva até lá.
  const explorationMover = !snapshot.combat.active && !moveFor && !intentActive && stageControl.tool === "select" && selectedToken
    && canControlToken(snapshot.multiplayer, selectedToken) && !selectedToken.locked ? selectedToken : undefined;
  const previewToken = moveFor
    ? board.tokens.find((token) => token.id === moveFor)
    : dragToken && snapshot.combat.active ? board.tokens.find((token) => token.id === dragToken)
      : stageControl.tool === "move" && !intentActive ? selectedToken : undefined;
  // Andar, voar ou escavar: o modo escolhido na gaveta vale para o token que tem esse deslocamento.
  const moveMode = effectiveMoveMode(previewToken, stageControl.moveMode);
  // O par anda pelo bloco da montaria: alcance, ocupação e deslocamento são os dela.
  const moverToken = previewToken ? moverOf(board, previewToken) : undefined;
  const reach = useMemo(() => (moverToken ? reachableWithPaths(board, moverToken, { mode: moveMode }) : null), [board, moverToken, moveMode]);
  // O token anda devagar até o destino: a duração do deslize cresce com a distância (de ~1 a ~2,4 s).
  const lastPositions = useRef(new Map<string, [number, number]>());
  const slideFrom = useRef(new Map<string, [number, number]>());
  useLayoutEffect(() => {
    let farthest = 0;
    for (const token of board.tokens) {
      const before = lastPositions.current.get(token.id);
      if (before) farthest = Math.max(farthest, Math.hypot(token.gx - before[0], token.gy - before[1]));
      lastPositions.current.set(token.id, [token.gx, token.gy]);
    }
    if (farthest > 0) zoneRef.current?.style.setProperty("--walk-ms", `${Math.min(2400, Math.max(1000, Math.round(farthest * 280)))}ms`);
    // Deslize (mapa 2D): o token já foi para a casa nova; aqui ele "volta" visualmente para a casa antiga e desliza até a nova só com translate.
    if (!iso && farthest > 0) {
      for (const token of board.tokens) {
        const before = slideFrom.current.get(token.id);
        if (!before || (before[0] === token.gx && before[1] === token.gy)) continue;
        const el = zoneRef.current?.querySelector<HTMLElement>(`[data-token-id="${CSS.escape(token.id)}"]`);
        const parent = el?.offsetParent as HTMLElement | null;
        if (!el || !parent) continue;
        const dx = (before[0] - token.gx) * (parent.clientWidth / map.cols);
        const dy = (before[1] - token.gy) * (parent.clientHeight / map.rows);
        el.style.transition = "none";
        el.style.translate = `${dx}px ${dy}px`;
        void el.offsetWidth; // fixa o ponto de partida antes de animar
        el.style.transition = "";
        el.style.translate = "0px 0px";
      }
    }
    slideFrom.current = new Map(board.tokens.map((token) => [token.id, [token.gx, token.gy] as [number, number]]));
  }, [board.tokens]);
  // Na exploração não há alcance desenhado: o destino é conferido só na hora de clicar ou soltar o token.
  const landableFor = (token: BoardToken, x: number, y: number) => {
    const mover = moverOf(board, token);
    return Boolean(reachableWithPaths(board, mover, { mode: effectiveMoveMode(token, stageControl.moveMode) }).has(`${x},${y}`)) && !footprintOccupied(board, mover, { x, y });
  };
  // Casa de destino válida: alcançável e com o bloco inteiro livre (Grande 2x2, Enorme 3x3, Colossal 6x6).
  const landable = (x: number, y: number) => Boolean(reach?.has(`${x},${y}`)) && !(moverToken && footprintOccupied(board, moverToken, { x, y }));
  useEffect(() => { setPendingMove(null); }, [moveFor, stageControl.tool, previewToken?.id, previewToken?.gx, previewToken?.gy]);
  live.current = { camera, selectedToken, map, tool: stageControl.tool, isPlayer, boardSize, iso, rotation };
  // Régua: clique esquerdo no ponto A e depois no ponto B; a medição fica travada entre os dois.
  // Um novo clique começa outra medição; o botão direito (ou Esc, ou trocar de ferramenta) limpa.
  const [rulerPoints, setRulerPoints] = useState<Array<{ x: number; y: number }>>([]);
  useEffect(() => { if (stageControl.tool !== "measure") setRulerPoints([]); }, [stageControl.tool]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setRulerPoints([]); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // Ping: chega da rede (ou daqui mesmo) e aparece para todos.
  useEffect(() => onSignals((signal) => { if (signal.kind === "ping") mapTools.firePing(signal.x, signal.y); }), [mapTools.firePing]);
  const hover = measureTip;
  // Só acompanha o mouse enquanto falta o ponto B; com A e B marcados a medida não muda mais.
  const rulerWithHover = stageControl.tool === "measure" && rulerPoints.length === 1 && hover ? [...rulerPoints, hover] : rulerPoints;
  const measured = pathDistance(rulerWithHover, activeGrid());

  // Ferramenta escolhida na gaveta ↔ hook de ferramentas (régua, pincel, ping, ESC).
  useEffect(() => { mapTools.setTool(stageControl.tool); }, [stageControl.tool]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (mapTools.tool !== stageControl.tool) setStageTool(mapTools.tool); }, [mapTools.tool]); // eslint-disable-line react-hooks/exhaustive-deps

  // CADEIA LUZ → VISÃO → FOG (game/vision.ts).
  const vision = useMemo(() => {
    const owned = board.tokens.filter((token) => token.controlledBy && token.controlledBy === snapshot.multiplayer.peerId);
    const eyes = owned.length ? owned : board.tokens.filter((token) => token.side === "heroes");
    // Sem neblina ligada ninguém usa a visão: nem calcula (era o gargalo, mesmo com a neblina desligada).
    if (!fogCfg.playerFogEnabled) return { visible: new Set<string>() } as ReturnType<typeof visionForTokens>;
    return visionForTokens(board, eyes, fogCfg);
  }, [board, fogCfg, snapshot.multiplayer.peerId]);
  const fog = useMemo(() => {
    const manual = new Set(board.fog);
    if (!fogCfg.playerFogEnabled) return manual;
    if (!isPlayer && !fogCfg.masterSeesPreview) return manual;
    const covered = new Set(manual);
    const explored = new Set(board.explored || []);
    for (let x = 0; x < map.cols; x += 1) for (let y = 0; y < map.rows; y += 1) {
      const key = `${x},${y}`;
      if (vision.visible.has(key)) { covered.delete(key); continue; }
      if (fogCfg.keepExploredDim && explored.has(key)) continue;
      covered.add(key);
    }
    return covered;
  }, [board, fogCfg, isPlayer, vision, map.cols, map.rows]);

  const fitCamera = useCallback(() => {
    const rect = zoneRef.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return;
    // Enquadra o mapa inteiro, por maior que ele seja (zoom mínimo bem baixo).
    setCamera({ scale: fitScale(rect, boardSize), x: 0, y: 0 });
  }, [boardSize.width, boardSize.height]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(fitCamera);
    return () => window.cancelAnimationFrame(frame);
  }, [map.id, iso, fitCamera]);

  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const observer = new ResizeObserver(() => { window.cancelAnimationFrame(frame); frame = window.requestAnimationFrame(fitCamera); });
    observer.observe(zone);
    return () => { window.cancelAnimationFrame(frame); observer.disconnect(); };
  }, [fitCamera]);

  // Botões de zoom/enquadrar da máscara.
  useEffect(() => onCameraCommand((command) => {
    if (command === "fit") { fitCamera(); return; }
    if (command === "focus") {
      // Focar: leva o token selecionado ao centro da tela, onde quer que ele esteja no mapa.
      // Sem token (ou se a câmera já está nele), enquadra o mapa inteiro.
      const { camera: current, selectedToken: token, map: currentMap, boardSize: size, iso: isoNow, rotation: rotationNow } = live.current;
      if (!token) { fitCamera(); return; }
      const target = isoNow ? isoFocus(currentMap, { x: token.gx, y: token.gy }, rotationNow, current.scale) : focusCamera({ x: token.gx, y: token.gy }, currentMap, size, current.scale);
      if (Math.hypot(current.x - target.x, current.y - target.y) < 4) { fitCamera(); return; }
      setCamera((value) => ({ ...value, ...target }));
      return;
    }
    const factor = command === "zoomIn" ? 1.18 : 1 / 1.18;
    setCamera((value) => ({ ...value, scale: clampZoom(value.scale * factor) }));
  }), [fitCamera]);

  // Roda do mouse = zoom (listener nativo para poder cancelar o scroll da página).
  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const { tool, isPlayer: player, map: currentMap } = live.current;
      // Alinhando o mapa: Shift + roda muda a escala da imagem (só o Mestre).
      if (event.shiftKey && tool === "align" && !player) {
        const current = imagePlacement(currentMap).scale;
        const next = Math.max(0.1, Math.min(5, Math.round((current + (event.deltaY < 0 ? 0.01 : -0.01)) * 100) / 100));
        updateMap({ ...currentMap, imageScale: next });
        return;
      }
      const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      setCamera((value) => ({ ...value, scale: clampZoom(value.scale * factor) }));
    };
    zone.addEventListener("wheel", onWheel, { passive: false });
    return () => zone.removeEventListener("wheel", onWheel);
  }, []);

  /** Solta o token arrastado numa célula: mesmas regras e permissões de Mover. */
  function dropToken(tokenId: string, x: number, y: number) {
    const token = board.tokens.find((entry) => entry.id === tokenId);
    if (!token) return;
    if (!canControlToken(snapshot.multiplayer, token)) { say("Você não controla este personagem."); return; }
    if (token.locked) { say(`${token.name} está travado pelo Mestre.`); return; }
    if (token.gx === x && token.gy === y) return;
    if (!(previewToken?.id === token.id ? landable(x, y) : landableFor(token, x, y))) { say("Destino fora do deslocamento ou bloqueado."); return; }
    try {
      if (snapshot.combat.active) {
        if (snapshot.combat.activeTokenId !== token.id) { say("Aguarde o turno do seu personagem."); return; }
        executeTacticalMove(token.id, x, y, effectiveMoveMode(token, stageControl.moveMode));
      } else {
        executeExplorationMove(token.id, x, y, effectiveMoveMode(token, stageControl.moveMode));
        if (fogCfg.exploreOnMove) markExplored(visionForTokens(board, [{ ...token, gx: x, gy: y }], fogCfg).visible);
      }
    } catch (error) { say((error as Error).message); }
  }

  function beginPan(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button === 0 && !intentActive && stageControl.tool === "select") {
      const id = (event.target as HTMLElement).closest("[data-token-id]")?.getAttribute("data-token-id");
      const token = id ? board.tokens.find((entry) => entry.id === id) : undefined;
      if (token && canControlToken(snapshot.multiplayer, token) && !token.locked) {
        dragRef.current = { pointerId: event.pointerId, tokenId: token.id, x: event.clientX, y: event.clientY, moved: false };
      }
    }
    // Alinhar o mapa: só o Mestre, com a ferramenta armada; ao soltar a posição fica fixa.
    if (stageControl.tool === "align" && !isPlayer && event.button === 0 && iso) {
      say("Alinhar o mapa só funciona na visão 2D.");
      return;
    }
    if (stageControl.tool === "align" && !isPlayer && event.button === 0) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const placement = imagePlacement(map);
      alignRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, offsetX: placement.offsetX, offsetY: placement.offsetY };
      setAlignPreview({ offsetX: placement.offsetX, offsetY: placement.offsetY });
      return;
    }
    if (stageControl.tool !== "pan" && event.button !== 2) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, cameraX: camera.x, cameraY: camera.y };
  }
  function panCamera(event: React.PointerEvent<HTMLDivElement>) {
    const dragging = dragRef.current;
    if (dragging && dragging.pointerId === event.pointerId && !dragging.moved && Math.hypot(event.clientX - dragging.x, event.clientY - dragging.y) > 6) {
      dragging.moved = true;
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* ponteiro sintético */ }
      selectToken(dragging.tokenId);
      setDragToken(dragging.tokenId);
    }
    const aligning = alignRef.current;
    if (aligning && aligning.pointerId === event.pointerId) {
      const cell = camera.scale * CELL_PX;
      setAlignPreview({
        offsetX: snapOffset(aligning.offsetX + (event.clientX - aligning.x) / cell),
        offsetY: snapOffset(aligning.offsetY + (event.clientY - aligning.y) / cell),
      });
      return;
    }
    const start = panRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    setCamera((value) => ({ ...value, x: start.cameraX + event.clientX - start.x, y: start.cameraY + event.clientY - start.y }));
  }
  function endPan(event: React.PointerEvent<HTMLDivElement>) {
    const dragging = dragRef.current;
    if (dragging && dragging.pointerId === event.pointerId) {
      dragRef.current = null;
      if (dragging.moved) {
        setDragToken(null);
        if (iso) {
          const cell = document.elementsFromPoint(event.clientX, event.clientY).find((element) => element.hasAttribute("data-cell"));
          if (cell) dropToken(dragging.tokenId, Number(cell.getAttribute("data-cell-x")), Number(cell.getAttribute("data-cell-y")));
          return;
        }
        const button = document.elementFromPoint(event.clientX, event.clientY)?.closest(".next-grid > button");
        const grid = button?.parentElement;
        if (button && grid) {
          const index = Array.from(grid.children).indexOf(button);
          dropToken(dragging.tokenId, index % map.cols, Math.floor(index / map.cols));
        }
        return;
      }
    }
    if (alignRef.current?.pointerId === event.pointerId) {
      const preview = alignPreview;
      alignRef.current = null;
      setAlignPreview(null);
      if (preview) updateMap({ ...map, offsetX: preview.offsetX, offsetY: preview.offsetY });
      setStageTool("select"); // uma passada só: ao soltar, o mapa fica fixo
      return;
    }
    if (panRef.current?.pointerId === event.pointerId) panRef.current = null;
  }

  function say(text: string) { appendChat({ author: "Mapa", text, kind: "system" }); }

  function clickCell(x: number, y: number) {
    const tool = stageControl.tool;
    if (moveFor) {
      if (!landable(x, y)) { say("Destino fora do deslocamento ou bloqueado."); return; }
      if (pendingMove === `${x},${y}`) { setPendingMove(null); onIntentPoint({ x: (x + .5) / map.cols, y: (y + .5) / map.rows }); return; }
      setPendingMove(`${x},${y}`);
      return;
    }
    if (intentActive) { onIntentPoint({ x: (x + .5) / map.cols, y: (y + .5) / map.rows }); return; }
    if (tool === "select") {
      if (explorationMover && !(explorationMover.gx === x && explorationMover.gy === y)) {
        if (!landableFor(explorationMover, x, y)) { say("Destino fora do deslocamento ou bloqueado."); return; }
        try {
          executeExplorationMove(explorationMover.id, x, y, effectiveMoveMode(explorationMover, stageControl.moveMode));
          if (fogCfg.exploreOnMove) markExplored(visionForTokens(board, [{ ...explorationMover, gx: x, gy: y }], fogCfg).visible);
        } catch (error) { say((error as Error).message); }
        return;
      }
      selectToken(null);
      const door = barrierAt(board, x, y);
      if (door && (door.type === "door" || door.type === "window")) openDoorDialog(door.id);
      return;
    }
    if (tool === "pan") return;
    if (tool === "measure") { setRulerPoints((points) => (points.length >= 2 ? [{ x, y }] : [...points, { x, y }])); return; }
    if (tool === "ping") { sendSignal({ kind: "ping", x, y }); return; }
    if (tool === "door") {
      const existing = barrierAt(board, x, y);
      if (existing && existing.type === "door") {
        try { toggleBarrier(existing.id); } catch (error) { say((error as Error).message); }
        return;
      }
    }
    if (tool === "move") {
      if (!selectedToken) { say("Selecione um token antes de mover."); return; }
      if (!canControlToken(snapshot.multiplayer, selectedToken)) { say("Você não controla este personagem."); return; }
      if (selectedToken.locked) { say(`${selectedToken.name} está travado pelo Mestre.`); return; }
      if (snapshot.combat.active) { say("Em combate, use Mover no menu de ações."); return; }
      if (!landable(x, y)) { say("Destino fora do deslocamento ou bloqueado."); return; }
      if (pendingMove !== `${x},${y}`) { setPendingMove(`${x},${y}`); return; }
      setPendingMove(null);
      executeExplorationMove(selectedToken.id, x, y, effectiveMoveMode(selectedToken, stageControl.moveMode));
      if (fogCfg.exploreOnMove) markExplored(visionForTokens(board, [{ ...selectedToken, gx: x, gy: y }], fogCfg).visible);
      return;
    }
    if (isPlayer) return;
    applyMapTool({
      board, tool, brushMode: stageControl.brush, x, y, terrainBrush: stageControl.terrain, lightPreset: stageControl.lightPreset,
      triggerConfig: mapTools.triggerConfig, shapeKind: mapTools.shapeKind, shapeAnchor: mapTools.shapeAnchor,
      onShapeAnchor: mapTools.setShapeAnchor, onDone: () => setStageTool("select"),
    });
  }

  const visibleOptions = { visible: vision.visible, isMaster: !isPlayer, masterSeesPreview: fogCfg.masterSeesPreview, fogEnabled: fogCfg.playerFogEnabled };
  // Montaria: o cavaleiro vira um selo sobre a montaria (um token só no mapa); clicar nele seleciona o cavaleiro, que comanda o par.
  const ridersByMount = new Map(board.tokens.filter((token) => token.mountId && board.tokens.some((mount) => mount.id === token.mountId)).map((rider) => [rider.mountId as string, rider]));
  const tokenEntries = board.tokens
    .filter((token) => !(token.mountId && ridersByMount.get(token.mountId)?.id === token.id))
    .filter((token) => !token.hidden && floorOf(token) === andar)
    .filter((token) => tokenVisible({ x: token.gx, y: token.gy, side: token.side }, visibleOptions))
    .map((token) => ({ gx: token.gx, gy: token.gy, skin: {
      id: token.id,
      name: token.name,
      portrait: token.side === "threats" ? "foe" : "kael",
      portraitUrl: token.imageUrl,
      ring: token.side === "threats" ? THREAT_RING : HERO_RING,
      x: (blockCenter(token).x / map.cols) * 100,
      y: (blockCenter(token).y / map.rows) * 100,
      hp: token.hp,
      hpMax: token.hpMax,
      badges: conditionBadges(token.conditions),
      hiddenBadges: hiddenConditionCount(token.conditions),
      active: view === "combat" && snapshot.combat.active && snapshot.combat.activeTokenId === token.id,
      footprint: footprintOf(sizeOf(token)),
      ...(ridersByMount.has(token.id) ? { rider: { id: ridersByMount.get(token.id)!.id, name: ridersByMount.get(token.id)!.name, portrait: ridersByMount.get(token.id)!.side === "threats" ? "foe" as const : "kael" as const, portraitUrl: ridersByMount.get(token.id)!.imageUrl } } : {}),
    } as SkinMapToken }));
  const tokens: SkinMapToken[] = tokenEntries.map((entry) => entry.skin);
  // Destino mostrado no caminho: o confirmado pelo primeiro clique ou, sem ele, a casa sob o mouse (se alcançável).
  const hoverKey = hoverCell ? `${hoverCell.x},${hoverCell.y}` : null;
  const pathTarget = pendingMove ?? (previewToken && hoverKey && hoverCell && landable(hoverCell.x, hoverCell.y) && !(hoverCell?.x === previewToken.gx && hoverCell?.y === previewToken.gy) ? hoverKey : null);
  const pct = (cell: { x: number; y: number }) => ({ left: `${((cell.x + .5) / map.cols) * 100}%`, top: `${((cell.y + .5) / map.rows) * 100}%` });

  return (
    <div
      ref={zoneRef}
      data-map-stage
      data-tool={stageControl.tool}
      className="absolute inset-0 overflow-hidden"
      style={{ touchAction: "none", cursor: dragToken ? "grabbing" : stageControl.tool === "pan" ? "grab" : stageControl.tool === "align" && !isPlayer ? "move" : "default", "--fog-opacity": fogCfg.opacity } as CSSProperties}
      onPointerDown={beginPan}
      onPointerMove={panCamera}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      onContextMenu={(event) => { event.preventDefault(); if (stageControl.tool === "measure") setRulerPoints([]); }}
      onDragOver={(event) => { if (onDropItem && event.dataTransfer.types.includes("application/x-mesa-item")) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }}
      onDrop={(event) => {
        const itemId = event.dataTransfer.getData("application/x-mesa-item");
        if (!itemId || !onDropItem) return;
        event.preventDefault();
        const cell = document.elementsFromPoint(event.clientX, event.clientY).find((element) => element.hasAttribute("data-cell"));
        if (cell) onDropItem(itemId, { x: Number(cell.getAttribute("data-cell-x")), y: Number(cell.getAttribute("data-cell-y")) });
      }}
    >
      {board.travelEvent && <TravelEventOverlay event={board.travelEvent} isMaster={!isPlayer} scenes={snapshot.scenes} preparedSceneId={board.travel?.sceneId} onGoToScene={(id) => { try { switchScene(id); } catch { /* só o Mestre */ } }} onClose={() => { try { closeTravelEvent(); } catch { /* só o Mestre */ } }}/>}
      {board.stageMedia && <StageMediaOverlay media={board.stageMedia} isMaster={!isPlayer} onClose={() => { try { closeStageMedia(); } catch { /* só o Mestre */ } }}/>}
      <div className="next-camera" style={{ width: boardSize.width, height: boardSize.height, transform: `translate(calc(-50% + ${camera.x}px),calc(-50% + ${camera.y}px)) scale(${camera.scale})` }}>
        {/* Sem moldura nem fundo próprio: o quadro do mapa é o da máscara V5; aqui só entra o mapa carregado. */}
        {iso ? <IsoStage map={map} rotation={rotation} tokens={tokenEntries.map((entry) => ({ token: entry.skin, gx: entry.gx, gy: entry.gy }))}
          objects={board.objects.filter((object) => tokenVisible({ x: object.x, y: object.y, side: "threats" }, visibleOptions))}
          fog={fog} reach={new Set(reach ? [...reach.keys()].filter((key) => !(previewToken && key === `${previewToken.gx},${previewToken.gy}`)) : [])} pendingMove={pendingMove} aura={auraSet} view={view}
          onCellClick={clickCell} onCellHover={(x, y) => { if (stageControl.tool === "measure") mapTools.setMeasureHover({ x, y }); }}
          onTokenSelect={(id) => { selectToken(id); if (stageControl.tool !== "select") setStageTool("select"); }}/> :
        <div className="next-board mesa-exploration-board" style={{ width: boardSize.width, height: boardSize.height, boxShadow: "none", background: "transparent" } as CSSProperties}>
          {map.image ? <img src={map.image} alt={map.name} draggable={false} style={{ ...imageStyle(shownMap), objectFit: "fill", filter: "none" }}/> : <div className="empty-map">Importe um mapa em Cenas e mapas</div>}
          <WeatherLayer weather={board.weather}/>
          <div className="next-grid" style={{ gridTemplateColumns: `repeat(${map.cols},1fr)`, gridTemplateRows: `repeat(${map.rows},1fr)` }}>
            {gridCells.map(({ x, y }) => {
              const key = `${x},${y}`;
              const barrier = barrierAt(board, x, y);
              const terrain = map.terrain[key];
              const light = board.lights.find((entry) => entry.x === x && entry.y === y);
              const className = [
                fog.has(key) ? "fog" : "",
                barrier ? `barrier-${barrier.type} ${barrier.open ? "is-open" : "is-closed"} ${barrier.locked ? "is-locked" : ""} ${shaking[barrier.id] ? "door-shake" : ""}` : "",
                light ? "light" : "",
                board.shapes.some((shape) => shape.cells.includes(key)) ? "shape" : "",
                terrain && terrain.type !== "normal" ? `terrain-${terrain.type}` : "",
                (terrain?.elevation || 0) > 0 ? "has-elevation" : "",
                measureStart && measureStart.x === x && measureStart.y === y ? "measure" : "",
                auraSet.has(key) ? "aura-cell" : "",
                landable(x, y) && !(previewToken && previewToken.gx === x && previewToken.gy === y) ? "move-reach" : "",
                pathTarget === key ? "move-pending" : "",
                areaCells?.has(key) ? "shape-preview" : "",
              ].filter(Boolean).join(" ");
              return (
                <button
                  key={key}
                  className={className}
                  data-elev={terrain?.elevation || undefined}
                  data-cell={key} data-cell-x={x} data-cell-y={y}
                  onClick={(event) => { event.stopPropagation(); clickCell(x, y); }}
                  onMouseEnter={() => { if (stageControl.tool === "measure") mapTools.setMeasureHover({ x, y }); if (areaPreview || previewToken) setHoverCell({ x, y }); }}
                />
              );
            })}
          </div>
          <div className="next-light-layer">
            {board.lights.filter((light) => light.enabled).map((light) => (
              <span key={light.id} className={`next-light-source ${light.type}`} title={isPlayer ? undefined : "Arraste para mover a luz"} data-light-id={light.id}
                style={{ ...pct(light), "--light-color": light.color, "--light-size": `${light.radius * 90}px`, "--light-opacity": light.intensity, ...(isPlayer ? {} : { cursor: "grab", touchAction: "none" }) } as CSSProperties}
                onPointerDown={(event) => {
                  // Mestre: a luz é um ícone que se arrasta; ela segue o ponteiro de casa em casa.
                  if (isPlayer || event.button !== 0) return;
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  if (isPlayer || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
                  const cell = document.elementsFromPoint(event.clientX, event.clientY).find((entry) => entry.hasAttribute("data-cell"));
                  const x = Number(cell?.getAttribute("data-cell-x")), y = Number(cell?.getAttribute("data-cell-y"));
                  if (cell && Number.isFinite(x) && Number.isFinite(y) && (x !== light.x || y !== light.y)) upsertLight({ ...light, x, y });
                }}
                onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
                onClick={(event) => event.stopPropagation()}>
                <i/><span><Lightbulb/></span>
              </span>
            ))}
          </div>
          {board.objects
            .filter((object) => tokenVisible({ x: object.x, y: object.y, side: "threats" }, visibleOptions))
            .map((object) => (
              <button key={object.id} className={`next-object ${object.kind} ${shaking[object.id] ? "object-shake" : ""} ${object.opened ? "is-open" : ""}`} style={{ ...pct(object), ...(board.tokens.some((token) => token.defeated && token.gx === object.x && token.gy === object.y) ? { zIndex: 10 } : {}) }} onClick={(event) => { event.stopPropagation(); selectToken(null); if (stageControl.tool === "select") openObjectDialog(object.id); }}>
                {object.image ? <img className="next-object-image" src={object.image} alt="" draggable={false}/> : <PackageOpen/>}<small>{object.name}</small>
              </button>
            ))}
          <div className="pointer-events-none absolute inset-0" style={{ zIndex: 9 }}>
            {tokens.map((token, index) => (
              <Token key={token.id} token={token} mode={view} index={index} onSelect={() => { selectToken(token.rider?.id ?? token.id); if (stageControl.tool !== "select") setStageTool("select"); }}/>
            ))}
          </div>
          {rulerWithHover.length > 1 && (
            <svg className="mesa-measure-layer" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polyline points={rulerWithHover.map((point) => `${((point.x + .5) / map.cols) * 100},${((point.y + .5) / map.rows) * 100}`).join(" ")} fill="none" vectorEffect="non-scaling-stroke"/>
            </svg>
          )}
          {rulerWithHover.length > 1 && <div className="mesa-measure-tag" style={pct(rulerWithHover[rulerWithHover.length - 1])}>{formatDistance(measured, activeGrid())}</div>}
          {pathTarget && moverToken && sideOf(moverToken) > 1 && (() => {
            const [gx, gy] = pathTarget.split(",").map(Number);
            return <div className="mesa-move-ghost" style={{ left: `${(gx / map.cols) * 100}%`, top: `${(gy / map.rows) * 100}%`, width: `${(sideOf(moverToken) / map.cols) * 100}%`, height: `${(sideOf(moverToken) / map.rows) * 100}%` }}/>;
          })()}
          {pathTarget && reach?.get(pathTarget) && (() => {
            // Caminho até o destino (linha amarela) com um X no ponto de chegada.
            const cells: string[] = [];
            for (let key: string | null = pathTarget; key && reach.get(key); key = reach.get(key)!.from) cells.unshift(key);
            const pt = (key: string) => { const [cx, cy] = key.split(",").map(Number); return { x: ((cx + .5) / map.cols) * 100, y: ((cy + .5) / map.rows) * 100 }; };
            const end = pt(pathTarget);
            const dx = (0.32 / map.cols) * 100, dy = (0.32 / map.rows) * 100;
            return <svg className="mesa-move-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polyline points={cells.map((key) => `${pt(key).x},${pt(key).y}`).join(" ")} fill="none" vectorEffect="non-scaling-stroke"/>
              <path d={`M${end.x - dx} ${end.y - dy} L${end.x + dx} ${end.y + dy} M${end.x + dx} ${end.y - dy} L${end.x - dx} ${end.y + dy}`} fill="none" vectorEffect="non-scaling-stroke"/>
            </svg>;
          })()}
          {pathTarget && reach?.get(pathTarget) && (() => {
            const [px, py] = pathTarget.split(",").map(Number);
            return <div className="mesa-measure-tag" style={pct({ x: px, y: py })}>{formatDistance(reach.get(pathTarget)!.cost * activeGrid().scale, activeGrid())} {pendingMove ? " · clique de novo para confirmar" : ""}</div>;
          })()}
          {ping && <div key={ping.id} className="next-ping" style={pct(ping)}/>}
        </div>}
      </div>
      {measured > 0 && <div className="next-measure" style={{ position: "absolute", left: 12, top: 12, zIndex: 12 }}><Ruler/>{formatDistance(measured, activeGrid())}</div>}
    </div>
  );
}

function WeatherLayer({ weather }: { weather: RuntimeSnapshot["board"]["weather"] }) {
  if (weather === "clear") return <div className="next-weather clear"/>;
  // Tormenta (relâmpagos vermelhos) e Tempestade (relâmpagos brancos, com chuva): o clarão é uma camada à parte.
  const flash = weather === "tormenta" || weather === "storm";
  return (
    <div className={`next-weather ${weather}`}>
      {flash && <div className={`next-weather-flash ${weather}`}/>}
      {Array.from({ length: weather === "fog" ? 9 : weather === "tormenta" ? 0 : 48 }, (_, index) => (
        <i key={index} style={{
          "--i": index, "--x": ((index * 37) % 101), "--delay": -((index * 19) % 30) / 10,
          // Duração e posição por partícula calculadas aqui: o CSS não aceita "%" (módulo) dentro de calc().
          "--dur": `${weather === "snow" ? 4 + (index % 5) * 0.6 : weather === "embers" ? 3 + (index % 6) * 0.5 : 1.05}s`,
          "--top": (index * 13) % 90,
        } as CSSProperties}/>
      ))}
    </div>
  );
}
