import MasterAdjustments from "./MasterAdjustments";
import { LIGHTING_LABEL, boardLighting, fogForVision, fogSettings, visionForTokens } from "../../game/vision";
import { type AutoWallMode, MAX_AUTO_WALLS, detectWalls, loadRaster } from "../../game/autoWalls";
import { DISTANCE_MODE_LABEL, type GridSettings, gridSettings } from "../../game/distance";
import { type TravelState, encounterChance, travelState } from "../../game/travel";
import { activeFloor, floorsOf } from "../../game/floors";
import { LIGHT_PRESETS as MAP_LIGHT_PRESETS, defaultLight, type LightPreset, type MapToolId, TERRAIN_LABEL } from "../../game/mapTools";
import { SITE_ROOT } from "../../utils/assetUrl";
import { SIZE_LABEL, sizeOf } from "../../game/tokenSize";
import { isMountToken, ownedMountTokens } from "../../game/companions";
import { getModernRpgCharacter } from "../../integration/modernRpgCharacterBridge";
import { clearObjectEditRequest, openDoorDialog, openObjectDialog, rotateStage, sendCameraCommand, setLightPreset, setMoveMode, setStageBrush, setStageTerrain, setStageView, useStageControl } from "./mapStageControl";
import { MOVE_MODE_LABEL, availableMoveModes, effectiveMoveMode, speedFor } from "../../game/movementMode";
import { gridFromImage, imagePlacement } from "../../game/mapView";
import { SHAPE_LABEL, type ShapeKind } from "../../game/shapes";
import { TRIGGER_CONDITIONS, type TriggerConfig, type TriggerEffect, type TriggerMode } from "../../game/triggers";
import { canRedo, canUndo, redoLabel, undoLabel } from "../../game/history";
import { isUvtt, parseUvtt } from "../../game/uvtt";
import { exportUvtt } from "../../game/uvttExport";
import CompendiumPanel from "./CompendiumPanel";
import { type GlobalMacro, loadMacros, parseFormula, removeMacro, rollFormula, upsertMacro } from "../../game/macros";
import {
  SOUNDBOARD, jukeboxState, loadTrack, pauseTrack, playSfx, playTrack,
  setLoop, setVolume, stopTrack, subscribeJukebox,
} from "../../game/jukebox";
import {
  BookOpen, BrickWall, Bot, Crosshair, Move, ChevronRight, CloudFog, CloudRain, Footprints, Hand, Ruler, Target, Dices, DoorOpen, Download, Flame, Grid3X3,
  Headphones, History, Lightbulb, ListOrdered, Map, MessageSquare, Music2,
  PackageOpen, Pause, Play, Plus, Radio, Redo2, Eye, ScrollText, Send, Settings2, Shapes,
  ClipboardPaste, Film, Image as ImageIcon, Repeat, Shield, ShieldAlert, Sparkles, Square, Swords, Trash2, Undo2, Upload, Users, Volume2, WandSparkles, Wind, X, type LucideIcon, Zap,
} from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, useSyncExternalStore } from "react";
import type { BattleMap, BoardObject, RuntimeSnapshot, SceneState, TacticalUnitView, ThreatTemplate, WeatherType } from "../../game/types";
import { canControlToken, shortPeerId } from "../../game/permissions";
import {
  appendChat, appendRoll, createScene, getRuntimeSnapshot, renameSceneGroup, sendSignal, hostMultiplayer, kickPlayer, interactBoardObject, joinMultiplayer, redoBoard, removeScene, removeToken, renameScene,
  selectToken, setFog, setWeather, switchScene, undoBoard, updateBoardObject, updateMap, updateToken, setFogSettings, setLighting, upsertWall, upsertLight, setGridSettings, advanceTravelDay, resetTravelEncounter, setActiveFloor, moveTokenToFloor, setObjects, setShapes, clearTable, removeLight, removeWall, setAutoWalls, setExplored, showStageMedia, closeStageMedia, shareAudioWithRoom, startTravel, setTravelScene, showTravelEvent,
} from "../../game/vttBridge";
import { DEFAULT_MAPS } from "../../game/data";
import { downloadGamePackage, downloadJson } from "../../game/download";
import { saveAudio, deleteAudio } from "../../game/audioStore";
import { MAX_SHARED_AUDIO_BYTES, SHARED_PREFIX, registerSharedAudio } from "../../game/sharedAudio";
import { type MediaItem, checkMediaFile, deleteMedia, listMedia, mediaNameFromFile, saveMedia } from "../../game/stageMedia";
import { PRESET_COUNT, cachedPresetUrl, forgetPresetUrl, loadPresets, presetAudioKey, presetFileUrl, updatePreset } from "../../game/jukeboxPresets";
import { addSound, getFreesoundKey, isPlayableUrl, loadSoundboard, removeSound, searchFreesound, setFreesoundKey, type SoundHit } from "../../game/soundboard";
import { importMap } from "../../game/importers";
import { DEFAULT_SCENE_GROUP, groupScenes, nextSceneGroupName, sceneGroupOf } from "../../game/sceneGroups";
import { CONDITION_NAMES } from "../../game/conditionInfo";
import { type AmeacaDoEncontro, type EncontroSorteado, GRUPOS_DE_AMBIENTE, PATAMARES, type PatamarId, ameacasNaDescricao, sortearEncontro, testarSorteDaViagem } from "../../game/encontros";
import { listThreats } from "../../tactics/engine/customThreats";
import { setPreferences, usePreferences } from "../../game/mesaPreferences";
import { fileToDataUrl } from "../../game/imageEditor";
import { toggleBarrier } from "../../tactics/engine/boardTools";
import { executeDismount, executeMount } from "../../tactics/engine/mountCommands";
import ObjectEditor from "./ObjectEditor";
import DoorEditor from "./DoorEditor";
import { dropLootChest, hasThreatLoot } from "../../game/espolio/threatLoot";
import { isMounted, mountError, mountPartner } from "../../game/mount";
import { type LibraryToken, deleteLibraryToken, hasAccount, listLibraryTokens, saveLibraryToken, setLibraryTokenLink, syncLibraryToAccount, tokenNameFromFile } from "../../game/tokenLibrary";
import LeftDrawer from "./LeftDrawer";
import TriggerList from "./TriggerList";
import TokenEditorDialog from "./TokenEditorDialog";
import { OBJECT_KIND_LABEL, freeObjectSpot, newBoardObject } from "../../game/objectPlacement";
import { linkFromJson } from "../../game/tokenJson";
import { loadCharacterSheets, loadReadyHeroSheets } from "../../../ficha-modernrpg/characterRoute";

export type MesaPanelId = "scenes" | "roster" | "combat" | "environment" | "history" | "jukebox" | "automation" | "map-context" | "compendium" | "undo" | "online" | "settings" | "tokens" | "master";

export const MESA_PANELS: Array<{ id: MesaPanelId; label: string; subtitle: string; icon: LucideIcon }> = [
  { id: "scenes", label: "Cenas e mapas", subtitle: "Mapa atual e biblioteca", icon: Map },
  { id: "roster", label: "Elenco", subtitle: "Personagens, ameaças, itens e tesouros", icon: Users },
  { id: "combat", label: "Combate e iniciativa", subtitle: "Rodada, ordem e recursos", icon: ListOrdered },
  { id: "environment", label: "Fog, luz e clima", subtitle: "Ambiente da cena", icon: Lightbulb },
  { id: "history", label: "Diário e histórico", subtitle: "Registro completo da sessão", icon: History },
  { id: "jukebox", label: "Jukebox", subtitle: "Áudio e ambientação", icon: Music2 },
  { id: "automation", label: "Automação", subtitle: "Atalhos e ações rápidas", icon: WandSparkles },
  { id: "map-context", label: "Ambientação", subtitle: "Áreas, objetos, itens, armadilhas, luzes e mídia", icon: Map },
  { id: "compendium", label: "Compêndio", subtitle: "Magias, poderes e itens", icon: BookOpen },
  { id: "undo", label: "Desfazer e refazer", subtitle: "Histórico de edição da cena", icon: Undo2 },
  { id: "online", label: "Mesa online", subtitle: "Sala e conexões PeerJS", icon: Radio },
  { id: "settings", label: "Configurações", subtitle: "Sistema e backup", icon: Settings2 },
  { id: "tokens", label: "Tokens", subtitle: "Sua biblioteca de tokens", icon: Shapes },
  { id: "master", label: "Ferramenta de mestre", subtitle: "Sala online, viagem e encontros", icon: WandSparkles },
];

export interface MapToolArmOptions {
  shapeKind?: Exclude<ShapeKind, "polygon">;
  shapeSizeM?: number;
  triggerConfig?: { condition: string; mode: TriggerMode };
}

interface Props {
  panel: MesaPanelId;
  snapshot: RuntimeSnapshot;
  units: TacticalUnitView[];
  selectedUnit?: TacticalUnitView;
  onClose: () => void;
  onOpenCharacter: (id: string) => void;
  onOpenCharacters: () => void;
  onOpenThreats: () => void;
  /** Troca somente o conteúdo da gaveta contextual já aberta. */
  onOpenPanel?: (panel: MesaPanelId) => void;
  /** Arma uma ferramenta existente para o próximo clique no mapa. */
  onArmMapTool?: (tool: Extract<MapToolId, "door" | "shape" | "trigger" | "object">, options?: MapToolArmOptions) => void;
  /** Escolhe a ferramenta do palco do mapa (mover, mão, régua, ping, névoa, luz, parede, terreno). */
  onSelectStageTool?: (tool: MapToolId) => void;
  onEndTurn?: () => void;
  /** Coloca no mapa um token da biblioteca (imagem importada pela pessoa). */
  onAddLibraryToken?: (token: LibraryToken) => void;
  /** Encontro aleatório: coloca no mapa N tokens da ameaça sorteada. */
  onSpawnThreats?: (template: ThreatTemplate, count: number) => void;
  /** Encontro aleatório sem criatura (viajante etc.): cria um token genérico com o nome. */
  onSpawnNpc?: (name: string) => void;
}

export default function MesaGlobalPanel(props: Props) {
  const meta = MESA_PANELS.find((entry) => entry.id === props.panel)!;
  return <LeftDrawer title={meta.label} subtitle={meta.subtitle} icon={meta.icon} onClose={props.onClose}>
    {props.panel === "scenes" && <ScenesPanel snapshot={props.snapshot}/>}
    {props.panel === "roster" && <RosterPanel {...props}/>}
    {props.panel === "combat" && <CombatPanel {...props}/>}
    {props.panel === "environment" && <EnvironmentPanel snapshot={props.snapshot} onSelectStageTool={props.onSelectStageTool} onArmMapTool={props.onArmMapTool}/>}
    {props.panel === "history" && <HistoryPanel snapshot={props.snapshot}/>}
    {props.panel === "jukebox" && <JukeboxPanel/>}
    {props.panel === "automation" && <AutomationPanel {...props}/>}
    {props.panel === "map-context" && <MapContextPanel {...props}/>}
    {props.panel === "compendium" && <CompendiumPanel onOpenBestiary={props.onOpenThreats} canEdit={props.snapshot.multiplayer.role !== "player"}/>}
    {props.panel === "undo" && <UndoRedoPanel snapshot={props.snapshot}/>}
    {props.panel === "online" && <OnlinePanel snapshot={props.snapshot}/>}
    {props.panel === "settings" && <SettingsPanel {...props}/>}
    {props.panel === "tokens" && <TokensPanel {...props}/>}
    {props.panel === "master" && <MasterPanel snapshot={props.snapshot} onSpawnThreats={props.onSpawnThreats} onSpawnNpc={props.onSpawnNpc}/>}
  </LeftDrawer>;
}

function ScenesPanel({ snapshot }: { snapshot: RuntimeSnapshot }) {
  const isPlayer = snapshot.multiplayer.role === "player";
  const activeScene = snapshot.scenes.find((scene) => scene.id === snapshot.activeSceneId);
  const activeGroup = activeScene ? sceneGroupOf(activeScene) : DEFAULT_SCENE_GROUP;
  const [draft, setDraft] = useState(activeScene?.name || snapshot.board.map.name);
  const [groupDraft, setGroupDraft] = useState(activeGroup);
  useEffect(() => { setGroupDraft(activeGroup); }, [activeGroup]);
  // Adicionar: "Nova cena" pede o nome; "Importar mapa" pergunta em qual cena o mapa entra.
  const [adding, setAdding] = useState<null | "scene" | "map">(null);
  const [targetGroup, setTargetGroup] = useState(activeGroup);
  const [newSceneName, setNewSceneName] = useState("");
  useEffect(() => { setTargetGroup(activeGroup); }, [activeGroup]);
  function importMapFile(event: ChangeEvent<HTMLInputElement>, group: string) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const nome = file.name.replace(/\.[^.]+$/, "");
    const reader = new FileReader();

    // UVTT (.dd2vtt/.uvtt/.json) traz mapa + paredes + portas + luzes juntos.
    if (/\.(dd2vtt|uvtt|json)$/i.test(file.name)) {
      reader.onload = () => {
        try {
          const dados = JSON.parse(String(reader.result));
          if (!isUvtt(dados)) { appendChat({ author: "Cenas", text: "JSON não reconhecido como UVTT.", kind: "system" }); return; }
          const { map, walls, lights, aviso } = parseUvtt(dados, nome);
          createScene(map, map.name, group);
          walls.forEach(upsertWall);
          lights.forEach(upsertLight);
          appendChat({
            author: "Cenas",
            text: `UVTT importado: ${walls.filter((w) => w.type === "wall").length} paredes, ${walls.filter((w) => w.type !== "wall").length} portas/janelas, ${lights.length} luzes.${aviso ? ` ${aviso}` : ""}`,
            kind: "system",
          });
        } catch {
          appendChat({ author: "Cenas", text: "Não consegui ler esse arquivo UVTT.", kind: "system" });
        }
      };
      reader.readAsText(file);
      return;
    }

    reader.onload = () => {
      const image = String(reader.result);
      // Grade sugerida pelo tamanho da imagem (o Mestre ajusta em "Tamanho e posição do mapa").
      const probe = new Image();
      probe.onload = () => {
        const { cols, rows } = gridFromImage(probe.naturalWidth, probe.naturalHeight);
        createScene(importMap({ name: nome, image, cols, rows }), nome, group);
      };
      probe.onerror = () => createScene(importMap({ name: nome, image, cols: 20, rows: 20 }), nome, group);
      probe.src = image;
    };
    reader.readAsDataURL(file);
  }
  async function exportMapUvtt() {
    try {
      const file = await exportUvtt(snapshot.board);
      downloadJson(`${snapshot.board.map.name.replace(/[^\w.-]+/g, "-") || "mapa"}.dd2vtt`, file);
    } catch {
      appendChat({ author: "Cenas", text: "Não consegui exportar o mapa (imagem inacessível).", kind: "system" });
    }
  }
  function blankMap(group: string, name: string) {
    const map: BattleMap = { id: `map-${crypto.randomUUID()}`, name, location: "Arton", image: "", cols: 20, rows: 20, terrain: {}, custom: true };
    createScene(map, map.name, group);
  }
  return <div className="mesa-panel-stack">
    <div className="mesa-current-scene"><span>{snapshot.board.map.image ? <img src={snapshot.board.map.image} alt=""/> : <Map/>}</span><div><small>CENA ATIVA</small><strong>{snapshot.board.map.name}</strong><em>{snapshot.board.map.cols} × {snapshot.board.map.rows} · {snapshot.board.tokens.length} tokens</em></div></div>
    <MapViewSection map={snapshot.board.map} isPlayer={isPlayer}/>
    {groupScenes(snapshot.scenes).map((group) => <div key={group.name} className="mesa-panel-section"><h4>{group.name.toUpperCase()} · {group.scenes.length} {group.scenes.length === 1 ? "MAPA" : "MAPAS"}</h4>
    <div className="mesa-scene-list">{group.scenes.map((scene) => <button key={scene.id} className={scene.id === snapshot.activeSceneId ? "active" : ""} disabled={isPlayer} onClick={() => switchScene(scene.id)}>{scene.board.map.image ? <img src={scene.board.map.image} alt=""/> : <Map/>}<span><strong>{scene.name}</strong><small>{scene.board.map.location || "Sem localização"}</small></span><ChevronRight/></button>)}</div>
    </div>)}
    {!isPlayer && <>
      <div className="mesa-panel-section"><h4>ADICIONAR</h4>
        <div className="mesa-panel-actions">
          <button className={adding === "scene" ? "active" : ""} onClick={() => { setNewSceneName(nextSceneGroupName(snapshot.scenes)); setAdding(adding === "scene" ? null : "scene"); }}><Plus/>Nova cena</button>
          <button className={adding === "map" ? "active" : ""} onClick={() => { setTargetGroup(activeGroup); setAdding(adding === "map" ? null : "map"); }}><Upload/>Importar mapa</button>
        </div>
        {adding && (() => {
          const group = adding === "scene" ? (newSceneName.trim() || nextSceneGroupName(snapshot.scenes)) : targetGroup;
          const count = groupScenes(snapshot.scenes).find((entry) => entry.name === group)?.scenes.length ?? 0;
          return <div className="mesa-add-map">
            {adding === "scene"
              ? <label className="mesa-grid-select">Nome da nova cena<input value={newSceneName} maxLength={60} onChange={(event) => setNewSceneName(event.target.value)}/></label>
              : <label className="mesa-grid-select">Em qual cena o mapa entra?
                <select value={targetGroup} onChange={(event) => setTargetGroup(event.target.value)}>
                  {groupScenes(snapshot.scenes).map((entry) => <option key={entry.name} value={entry.name}>{entry.name} · {entry.scenes.length} {entry.scenes.length === 1 ? "mapa" : "mapas"}</option>)}
                </select>
              </label>}
            <div className="mesa-panel-actions">
              <label><Upload/>Escolher imagem ou UVTT<input type="file" accept="image/*,.dd2vtt,.uvtt,.json" onChange={(event) => { importMapFile(event, group); setAdding(null); }}/></label>
              <button onClick={() => { blankMap(group, `Mapa ${count + 1}`); setAdding(null); }}><Plus/>Mapa em branco</button>
            </div>
            <button className="mesa-add-cancel" onClick={() => setAdding(null)}>Cancelar</button>
          </div>;
        })()}
        <div className="mesa-panel-actions"><button onClick={() => void exportMapUvtt()}><Download/>Exportar UVTT do mapa atual</button></div>
      </div>
      <div className="mesa-map-library"><small>BIBLIOTECA</small>
        <label className="mesa-grid-select">Adicionar na cena
          <select value={targetGroup} onChange={(event) => setTargetGroup(event.target.value)}>
            {groupScenes(snapshot.scenes).map((entry) => <option key={entry.name} value={entry.name}>{entry.name}</option>)}
          </select>
        </label>
        {DEFAULT_MAPS.map((map) => <button key={map.id} onClick={() => createScene({ ...map, id: `${map.id}-${crypto.randomUUID()}` }, map.name, targetGroup)}>{map.image ? <img src={map.image} alt=""/> : <Grid3X3/>}<span><strong>{map.name}</strong><em>{map.location}</em></span><Plus/></button>)}
      </div>
      <MapGeometrySection map={snapshot.board.map}/>
      <FloorSection board={snapshot.board} isPlayer={isPlayer}/>
      <label className="mesa-panel-field"><span>Nome da cena ({activeGroup})</span><div><input value={groupDraft} onChange={(event) => setGroupDraft(event.target.value)}/><button onClick={() => groupDraft.trim() && renameSceneGroup(activeGroup, groupDraft.trim())}>Salvar</button></div></label>
      <label className="mesa-panel-field"><span>Renomear mapa ativo</span><div><input value={draft} onChange={(event) => setDraft(event.target.value)}/><button onClick={() => draft.trim() && renameScene(snapshot.activeSceneId, draft.trim())}>Salvar</button></div></label>
      <button className="mesa-danger-button" disabled={snapshot.scenes.length <= 1} onClick={() => removeScene(snapshot.activeSceneId)}><Trash2/>Remover mapa atual</button>
    </>}
  </div>;
}

/** Elenco: heróis e ameaças da cena. Clicar seleciona (e centraliza); clicar de novo tira a seleção. O mestre edita o token e cria itens, baús e tesouros. */
function RosterPanel({ snapshot, units, selectedUnit, onOpenCharacters, onOpenThreats }: Props) {
  const isMaster = snapshot.multiplayer.role !== "player";
  const heroes = units.filter((unit) => unit.side === "heroes");
  const threats = units.filter((unit) => unit.side === "threats");
  function pick(id: string) {
    if (selectedUnit?.id === id) { selectToken(null); return; }
    selectToken(id);
    window.setTimeout(() => sendCameraCommand("focus"), 0);
  }
  const row = (unit: TacticalUnitView) => {
    const active = snapshot.combat.activeTokenId === unit.id;
    const mine = snapshot.multiplayer.role === "player" && unit.controlledBy === snapshot.multiplayer.peerId;
    const ownership = snapshot.multiplayer.role === "player"
      ? mine ? "Meu personagem" : unit.controlledBy ? "Outro jogador" : "Sem controlador"
      : unit.controlledBy ? `Jogador ${shortPeerId(unit.controlledBy)}` : "Mestre";
    return <button key={unit.id} className={`${selectedUnit?.id === unit.id ? "selected" : ""} ${active ? "is-turn" : ""}`} onClick={() => pick(unit.id)}>
      <span className="mesa-mini-portrait">{unit.portrait ? <img src={unit.portrait} alt=""/> : unit.symbol}{active && <i/>}</span>
      <div><strong>{unit.name}</strong><small>PV {unit.pv}/{unit.pvMax} · PM {unit.pm}/{unit.pmMax} · DEF {unit.defense}</small><em className={mine ? "is-mine" : unit.controlledBy ? "is-owned" : ""}>{ownership}</em></div><ChevronRight/>
    </button>;
  };
  return <div className="mesa-panel-stack mesa-roster-stack">
    {isMaster && <div className="mesa-roster-add">
      <button onClick={onOpenCharacters}><ScrollText/>Personagem ou ficha</button>
      <button onClick={onOpenThreats}><BookOpen/>Ameaça do bestiário</button>
    </div>}
    <div className="mesa-panel-section"><h4>HERÓIS · {heroes.length}</h4><div className="mesa-roster-list">{heroes.map(row)}{heroes.length === 0 && <p className="mesa-block-empty">Nenhum herói na cena.</p>}</div></div>
    <div className="mesa-panel-section"><h4>AMEAÇAS · {threats.length}</h4><div className="mesa-roster-list">{threats.map(row)}{threats.length === 0 && <p className="mesa-block-empty">Nenhuma ameaça na cena.</p>}</div></div>
    {selectedUnit && <div className="mesa-selected-bar">
      <strong>{selectedUnit.name}</strong>
      <button title="Centralizar no mapa" aria-label="Centralizar no mapa" onClick={() => sendCameraCommand("focus")}><Crosshair/></button>
      <button title="Tirar a seleção" aria-label="Tirar a seleção" onClick={() => selectToken(null)}><X/></button>
    </div>}
    {selectedUnit && isMaster && <RosterEditor snapshot={snapshot} unit={selectedUnit}/>}
  </div>;
}

/** Itens, baús e tesouros da cena (Mestre), na gaveta Ambientação: nascem ao lado do token selecionado (ou no centro) e são configurados aqui mesmo. */
function SceneObjectsSection({ snapshot, selectedUnit }: { snapshot: RuntimeSnapshot; selectedUnit?: TacticalUnitView }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const board = snapshot.board;
  const floor = Math.trunc(board.activeFloor ?? 0);
  const here = board.objects.filter((object) => Math.trunc(object.floor ?? 0) === floor);
  const editing = here.find((object) => object.id === editingId);
  const KINDS: Array<{ kind: BoardObject["kind"]; label: string; icon: LucideIcon; trap?: boolean }> = [
    { kind: "item", label: "Item", icon: PackageOpen }, { kind: "chest", label: "Baú", icon: Shield }, { kind: "treasure", label: "Tesouro", icon: Sparkles },
    { kind: "item", label: "Armadilha", icon: ShieldAlert, trap: true },
  ];
  function add(kind: BoardObject["kind"], label: string, trap = false) {
    const token = selectedUnit ? board.tokens.find((entry) => entry.id === selectedUnit.id) : undefined;
    const origin = token ? { x: token.gx, y: token.gy } : { x: Math.floor(board.map.cols / 2), y: Math.floor(board.map.rows / 2) };
    const made = newBoardObject(kind, floor, freeObjectSpot(board, floor, origin), kind === "item" && !trap ? undefined : label);
    // Armadilha nasce armada e escondida; o Mestre ajusta CDs, dano e condição logo abaixo (e ela entra na lista ARMADILHAS).
    const object: BoardObject = trap ? { ...made, trap: { name: "Armadilha", armed: true, revealed: false, detectDc: 15, disarmDc: 15 } } : made;
    setObjects([...board.objects, object]);
    setEditingId(object.id);
  }
  return <div className="mesa-panel-section mesa-scene-objects"><h4>ITENS, BAÚS E TESOUROS · {here.length}</h4>
    <div className="mesa-roster-add mesa-roster-add-4">{KINDS.map(({ kind, label, icon: Icon, trap }) => <button key={label} onClick={() => add(kind, label, trap)}><Icon/>{label}</button>)}</div>
    {here.length > 0 && <div className="mesa-roster-list">{here.map((object) => <button key={object.id} className={object.id === editingId ? "selected" : ""} onClick={() => setEditingId(object.id === editingId ? null : object.id)}>
      <span className="mesa-mini-portrait">{object.image ? <img src={object.image} alt=""/> : <PackageOpen/>}</span>
      <div><strong>{object.name}</strong><small>{object.locked ? "Trancado" : object.opened ? "Aberto" : "Fechado"} · {object.contents.length} {object.contents.length === 1 ? "item" : "itens"}</small></div><ChevronRight/>
    </button>)}</div>}
    {editing && <ObjectEditor object={editing}/>}
    {editing && <button className="mesa-remove-token" onClick={() => { if (confirm(`Remover ${editing.name} da cena?`)) { setObjects(board.objects.filter((object) => object.id !== editing.id)); setEditingId(null); } }}><Trash2/>Remover da cena</button>}
  </div>;
}

/** Edição do token selecionado: o essencial do Elenco (PV, PM, Defesa, Condições, Montaria, Espólio). O resto fica em "Mais opções". */
function RosterEditor({ snapshot, unit }: { snapshot: RuntimeSnapshot; unit: TacticalUnitView }) {
  const [more, setMore] = useState(false);
  const board = snapshot.board;
  const token = board.tokens.find((entry) => entry.id === unit.id);
  if (!token) return null;
  const conditions = token.conditions || [];
  const partner = isMounted(token) ? mountPartner(board, token) : undefined;
  const candidates = board.tokens.filter((entry) => entry.id !== token.id && entry.side === token.side && !entry.hidden && !mountError(board, token, entry));
  const run = (action: () => void) => {
    try { action(); } catch (error) { appendChat({ author: "Montaria", text: (error as Error).message, kind: "system" }); }
  };
  return <div className="mesa-roster-editor">
    <label>PV<input type="number" value={unit.pv} onChange={(event) => updateToken(unit.id, { hp: Number(event.target.value) })}/></label>
    <label>PM<input type="number" value={unit.pm} onChange={(event) => updateToken(unit.id, { pm: Number(event.target.value) })}/></label>
    <label>Defesa<input type="number" value={unit.defense} onChange={(event) => updateToken(unit.id, { defense: Number(event.target.value) })}/></label>
    <label>Condições
      <select value="" onChange={(event) => { const value = event.target.value; if (value) updateToken(token.id, { conditions: Array.from(new Set([...conditions, value])) }); }}>
        <option value="">Adicionar condição…</option>
        {[...CONDITION_NAMES].sort((a, b) => a.localeCompare(b, "pt-BR")).filter((name) => !conditions.includes(name)).map((name) => <option key={name} value={name}>{name}</option>)}
      </select>
    </label>
    {conditions.length > 0 && <div className="mesa-condition-chips">{conditions.map((condition) => <button key={condition} title={`Remover ${condition}`} onClick={() => updateToken(token.id, { conditions: conditions.filter((entry) => entry !== condition) })}>{condition} ×</button>)}</div>}
    <label>Montaria ou parceiro
      <select value={partner?.id || ""} onChange={(event) => {
        const value = event.target.value;
        if (!value) { if (isMounted(token)) run(() => executeDismount(token.id)); return; }
        if (value !== partner?.id) run(() => executeMount(token.id, value));
      }}>
        <option value="">Nenhum</option>
        {partner && <option value={partner.id}>{partner.name}</option>}
        {candidates.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
      </select>
    </label>
    {hasThreatLoot(token) && <button onClick={() => { const chest = dropLootChest(unit.id, { force: true }); appendChat({ author: "Espólio", text: chest ? `${chest.name}: ${chest.contents.length} item(ns) no chão.` : "Este monstro não tem espólio para soltar.", kind: "system" }); }}><PackageOpen/>Criar baú do espólio</button>}
    <button className="mesa-remove-token" onClick={() => { if (confirm(`Remover ${unit.name} da cena? O token sai do tabuleiro e da ordem de iniciativa.`)) removeToken(unit.id); }}><Trash2/>Remover da cena</button>
    <button className="mesa-more-toggle" aria-expanded={more} onClick={() => setMore((open) => !open)}>{more ? "Menos opções" : "Mais opções do mestre"}</button>
    {more && <>
      <label>Visão<select value={token.visionType || "normal"} onChange={(event) => updateToken(token.id, { visionType: event.target.value as "normal" | "penumbra" | "dark" })}><option value="normal">Normal</option><option value="penumbra">Penumbra (visão na penumbra)</option><option value="dark">Visão no escuro</option></select></label>
      <label>Alcance da visão (casas)<input type="number" min={0} max={60} placeholder="padrão da cena" value={token.visionCells ?? ""} onChange={(event) => updateToken(token.id, { visionCells: event.target.value === "" ? undefined : Math.max(0, Math.min(60, Math.round(Number(event.target.value)) || 0)) })}/></label>
      <label className="mesa-controller-field">Controle do token<select value={unit.controlledBy || ""} onChange={(event) => updateToken(unit.id, { controlledBy: event.target.value || undefined })}><option value="">Mestre / sem jogador</option>{snapshot.multiplayer.peers.map((peerId) => <option key={peerId} value={peerId}>Jogador {shortPeerId(peerId)}</option>)}{unit.controlledBy && !snapshot.multiplayer.peers.includes(unit.controlledBy) && <option value={unit.controlledBy}>Jogador {shortPeerId(unit.controlledBy)} (offline)</option>}</select></label>
      <label className="mesa-controller-field">Imagem do token<input type="file" accept="image/*" onChange={async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const imageUrl = await fileToDataUrl(file);
        if (imageUrl) updateToken(unit.id, { imageUrl, sprite: imageUrl });
      }}/></label>
      <MoveModeSection snapshot={snapshot} unitId={unit.id}/>
      <AuraSection snapshot={snapshot} unitId={unit.id}/>
    </>}
    <MasterAdjustments token={token}/>
  </div>;
}

/** Andar, voar ou escavar: só aparece para token que tem voo ou escavação. O modo vale para o Mover do palco. */
function MoveModeSection({ snapshot, unitId }: { snapshot: RuntimeSnapshot; unitId: string }) {
  const control = useStageControl();
  const token = snapshot.board.tokens.find((entry) => entry.id === unitId);
  if (!token || !canControlToken(snapshot.multiplayer, token)) return null;
  const modes = availableMoveModes(token);
  if (modes.length < 2) return null;
  const active = effectiveMoveMode(token, control.moveMode);
  return <div className="mesa-panel-section"><h4>MOVIMENTO</h4>
    <div className="mesa-panel-actions">{modes.map((mode) => <button key={mode} className={active === mode ? "active" : ""} aria-pressed={active === mode} onClick={() => setMoveMode(mode)}><Footprints/>{MOVE_MODE_LABEL[mode]} ({speedFor(token, mode)} m)</button>)}</div>
    <p className="mesa-module-note">O modo escolhido vale para Mover: voar ignora terreno difícil, elevação e baús; escavar ignora paredes.</p>
  </div>;
}

/** Luzes prontas do legado (`contextLuz`): tocha 6 m, lanterna 9 m, fogueira 12 m. */
const LIGHT_PRESETS = [{ label: "Tocha (6 m)", radiusM: 6 }, { label: "Lanterna (9 m)", radiusM: 9 }, { label: "Fogueira (12 m)", radiusM: 12 }];

/** Aura e luz do token selecionado (legado: `lerAurasForm`, `contextLuz`; motor: `auraCells` e `vision.ts`). */
function AuraSection({ snapshot, unitId }: { snapshot: RuntimeSnapshot; unitId: string }) {
  const token = snapshot.board.tokens.find((entry) => entry.id === unitId);
  if (!token || !canControlToken(snapshot.multiplayer, token)) return null;
  const aura = token.aura;
  const set = (patch: Partial<NonNullable<typeof aura>>) => updateToken(token.id, { aura: { radiusM: 0, ...aura, ...patch } });
  return <div className="mesa-panel-section"><h4>AURA E LUZ</h4>
    <div className="mesa-panel-actions">{LIGHT_PRESETS.map((preset) => <button key={preset.radiusM} onClick={() => updateToken(token.id, { aura: { radiusM: preset.radiusM, light: true, active: true, color: aura?.color } })}><Flame/>{preset.label}</button>)}
      <button onClick={() => set({ active: false })} disabled={!aura || aura.active === false}><Lightbulb/>Apagar</button></div>
    <div className="mesa-grid-settings-row">
      <label>Raio (m)<input type="number" min={0} max={90} step={1.5} value={aura?.radiusM ?? 0} onChange={(event) => set({ radiusM: Math.max(0, Math.min(90, Number(event.target.value) || 0)), active: true })}/></label>
      <label>Ativa<input type="checkbox" checked={aura ? aura.active !== false : false} onChange={(event) => set({ active: event.target.checked })}/></label>
      <label>Ilumina<input type="checkbox" checked={Boolean(aura?.light)} onChange={(event) => set({ light: event.target.checked })}/></label>
    </div>
  </div>;
}

/** Montar / desmontar o token selecionado (regras em game/mount.ts, comandos em tactics/engine/mountCommands.ts). */
function MountSection({ snapshot, unitId }: { snapshot: RuntimeSnapshot; unitId: string }) {
  const board = snapshot.board;
  const token = board.tokens.find((entry) => entry.id === unitId);
  if (!token || !canControlToken(snapshot.multiplayer, token)) return null;
  const run = (action: () => void) => {
    try { action(); } catch (error) { appendChat({ author: "Montaria", text: (error as Error).message, kind: "system" }); }
  };
  if (isMounted(token)) {
    const partner = mountPartner(board, token);
    return <div className="mesa-panel-actions"><button onClick={() => run(() => executeDismount(token.id))}><Footprints/>{token.mountId ? `Desmontar de ${partner?.name || "montaria"}` : `Desmontar ${partner?.name || "cavaleiro"}`}</button></div>;
  }
  // Mestre: qualquer token do mapa (o tamanho continua valendo). Aventureiro: só as montarias da ficha dele (parceiro Montaria ligado ou item da mochila).
  const isMaster = snapshot.multiplayer.role !== "player";
  const sheet = token.modernRpgCharacterId ? getModernRpgCharacter(token.modernRpgCharacterId) : null;
  const candidates = isMaster
    ? board.tokens.filter((entry) => entry.id !== token.id && !entry.hidden && !isMounted(entry))
    : ownedMountTokens(board, token, [...(sheet?.equipment || []).map((item) => item.name), ...(sheet?.powers || []).map((power) => power.name)]);
  if (!candidates.length) return isMaster ? null : <p className="mesa-block-empty">Nenhuma montaria na ficha. Adicione um parceiro do tipo Montaria ou o item no Portal.</p>;
  return <div className="mesa-panel-actions">{candidates.map((entry) => {
    const reason = mountError(board, token, entry);
    return <button key={entry.id} title={reason || undefined} className={reason ? "mesa-mount-blocked" : ""} onClick={() => run(() => executeMount(token.id, entry.id))}><Footprints/>Montar em {entry.name} ({SIZE_LABEL[sizeOf(entry)]}{isMountToken(entry) ? " · montaria" : ""})</button>;
  })}</div>;
}

/**
 * Macros rápidas do token em foco. Usa os modificadores REAIS da unidade e
 * publica no mesmo canal do motor (appendRoll). Sem token controlável as
 * macros ficam inertes — nenhum valor é inventado.
 *
 * Vive fora do AutomationPanel porque a referência mostra iniciativa e macros
 * lado a lado no MESMO painel; o painel de Combate reaproveita o bloco em vez
 * de deixar meia tela vazia abaixo da ordem de iniciativa.
 */
export function GlobalMacros() {
  const [macros, setMacros] = useState<GlobalMacro[]>(() => loadMacros());
  const [nome, setNome] = useState("");
  const [formula, setFormula] = useState("");
  const invalida = Boolean(formula) && !parseFormula(formula);

  function criar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nome.trim() || !parseFormula(formula)) return;
    setMacros(upsertMacro({ id: `macro-${crypto.randomUUID()}`, name: nome.trim(), formula: formula.trim() }));
    setNome(""); setFormula("");
  }

  function executar(macro: GlobalMacro) {
    const resultado = rollFormula(macro.formula);
    if (!resultado) return;
    appendRoll({
      id: `global-${crypto.randomUUID()}`, actor: "Mesa", target: "—", action: macro.name,
      kind: "save", natural: resultado.rolls[0], modifier: resultado.modifier,
      total: resultado.total, formula: macro.formula, rolls: resultado.rolls,
      outcome: `[${resultado.rolls.join(", ")}]`, success: true, timestamp: Date.now(),
    });
  }

  return <div className="mesa-panel-section"><h4>MACROS GLOBAIS</h4>
    <div className="mesa-macro-list">{macros.length
      ? macros.map((macro) => <div key={macro.id} className="mesa-macro-row">
          <button className="run" onClick={() => executar(macro)} title="Executar"><strong>{macro.name}</strong><small>{macro.formula}</small></button>
          <button className="del" onClick={() => setMacros(removeMacro(macro.id))} aria-label={`Excluir ${macro.name}`}>×</button>
        </div>)
      : <p className="mesa-module-note">Nenhuma macro global. Crie uma abaixo — ela vale para a mesa inteira.</p>}
    </div>
    <form className="mesa-macro-form" onSubmit={criar}>
      <input value={nome} onChange={(event) => setNome(event.target.value)} placeholder="Nome" aria-label="Nome da macro"/>
      <input className={invalida ? "invalid" : ""} value={formula} onChange={(event) => setFormula(event.target.value)} placeholder="1d20+5" aria-label="Fórmula"/>
      <button type="submit" disabled={!nome.trim() || !parseFormula(formula)} aria-label="Criar macro"><Plus/></button>
    </form>
  </div>;
}

export function QuickMacros({ snapshot, units, selectedUnit }: { snapshot: RuntimeSnapshot; units: TacticalUnitView[]; selectedUnit?: TacticalUnitView }) {
  const combat = snapshot.combat;
  const target = selectedUnit
    || units.find((unit) => unit.id === combat.activeTokenId)
    || units.find((unit) => unit.id === snapshot.board.selectedTokenIds[0]);
  const targetToken = target ? snapshot.board.tokens.find((token) => token.id === target.id) : undefined;
  const canRoll = Boolean(target) && canControlToken(snapshot.multiplayer, targetToken);
  const macros = target
    ? [
        { id: "attack", icon: Swords, label: target.attackType === "ranged" ? "Pontaria" : "Luta", mod: target.attackType === "ranged" ? target.pontaria : target.luta, kind: "attack" as const },
        { id: "fortitude", icon: Shield, label: "Fortitude", mod: target.fortitude, kind: "save" as const },
        { id: "reflexes", icon: Wind, label: "Reflexos", mod: target.reflexes, kind: "save" as const },
        { id: "will", icon: Sparkles, label: "Vontade", mod: target.will, kind: "save" as const },
      ]
    : [];

  function runMacro(label: string, modifier: number, kind: "attack" | "save") {
    if (!target || !canRoll) return;
    const natural = 1 + Math.floor(Math.random() * 20);
    appendRoll({
      id: `macro-${crypto.randomUUID()}`,
      actor: target.name,
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
  }

  return <section className="mesa-block">
    <h4><Dices/>Macros rápidas{target && <em>{target.name}</em>}</h4>
    {macros.length
      ? <div className="mesa-macro-grid">{macros.map((macro) => {
          const Icon = macro.icon;
          return <button key={macro.id} disabled={!canRoll} onClick={() => runMacro(macro.label, macro.mod, macro.kind)} title={canRoll ? `Rolar ${macro.label}` : "Você não controla este token"}>
            <i><Icon/></i>
            <span><strong>{macro.label}</strong><small>1d20{macro.mod >= 0 ? "+" : ""}{macro.mod}</small></span>
            <Play/>
          </button>;
        })}</div>
      : <p className="mesa-block-empty">Selecione um token para ver as macros dele.</p>}
    {target && !canRoll && <p className="mesa-block-empty">Somente quem controla {target.name} pode rolar.</p>}
  </section>;
}

function CombatPanel({ snapshot, units, selectedUnit, onEndTurn }: Props) {
  const combat = snapshot.combat;
  const ordered = combat.order.map((id) => units.find((unit) => unit.id === id)).filter((unit): unit is TacticalUnitView => Boolean(unit));
  return <div className="mesa-panel-stack"><div className={`mesa-combat-status ${combat.active ? "active" : ""}`}><Swords/><span><small>{combat.active ? `RODADA ${combat.round}` : "EXPLORAÇÃO"}</small><strong>{combat.active ? units.find((unit) => unit.id === combat.activeTokenId)?.name || "Turno atual" : "Combate inativo"}</strong><em>{combat.active ? "A iniciativa usa o combatState atual." : "Use Batalha Tática no topo para iniciar."}</em></span></div>{combat.active && <><div className="mesa-initiative-list">{ordered.map((unit, index) => { const resource = combat.resources[unit.id]; const acted = resource ? resource.standard === 0 : false; return <button key={unit.id} className={combat.activeTokenId === unit.id ? "active" : ""} onClick={() => selectToken(unit.id)}><b>{index + 1}</b><span className="mesa-mini-portrait">{unit.portrait ? <img src={unit.portrait} alt=""/> : unit.symbol}</span><span><strong>{unit.name}</strong><small>{acted ? "Ação padrão gasta" : "Pronto para agir"}</small></span><em>{unit.initiativeRoll}</em></button>})}</div>{onEndTurn && <button className="mesa-primary-button" onClick={onEndTurn}>Encerrar turno atual<ChevronRight/></button>}</>}
    {/* A referência mostra iniciativa E macros no mesmo painel; sem isto
        sobrava meia coluna vazia sob a ordem de iniciativa. */}
    <QuickMacros snapshot={snapshot} units={units} selectedUnit={selectedUnit}/>
    <section className="mesa-block">
      <h4><Sparkles/>Gatilhos de área</h4>
      <div className="mesa-trigger-row">
        <span><b>{snapshot.board.shapes.filter((shape) => shape.kind === "trigger").length}</b><small>gatilhos</small></span>
        <span><b>{snapshot.board.shapes.filter((shape) => shape.kind === "area").length}</b><small>áreas</small></span>
      </div>
      <p className="mesa-block-empty">Marque células com a ferramenta <b>Gatilhos</b> na barra do mapa. Elas ficam salvas na cena; a execução automática ainda não existe no runtime.</p>
    </section>
  </div>;
}

type EnvironmentSection = "clima" | "fog" | "luz" | "visao" | "paredes" | "portas";

/** Ambiente da cena: um menu com Clima, Fog, Luz, Visão, Paredes e Portas; cada um abre só a sua configuração. */
function EnvironmentPanel({ snapshot, onSelectStageTool, onArmMapTool }: { snapshot: RuntimeSnapshot; onSelectStageTool?: (tool: MapToolId) => void; onArmMapTool?: Props["onArmMapTool"] }) {
  const [section, setSection] = useState<EnvironmentSection | null>(null);
  const stage = useStageControl();
  const board = snapshot.board;
  const isPlayer = snapshot.multiplayer.role === "player";
  const fog = fogSettings(board.fogSettings);
  const lighting = boardLighting(board);
  const toggle = (key: keyof typeof fog) => () => setFogSettings({ [key]: !fog[key] } as Partial<typeof fog>);
  const floorNow = Math.trunc(board.activeFloor ?? 0);
  const onFloor = <T extends { floor?: number }>(entry: T) => Math.trunc(entry.floor ?? 0) === floorNow;
  const wallsHere = board.walls.filter((wall) => wall.type !== "door" && onFloor(wall));
  const doorsHere = board.walls.filter((wall) => wall.type === "door" && onFloor(wall));
  const lightsHere = board.lights.filter(onFloor);
  const [editingDoorId, setEditingDoorId] = useState<string | null>(null);
  const [autoMode, setAutoMode] = useState<AutoWallMode>("dark");
  const [autoSensitivity, setAutoSensitivity] = useState(50);
  const [autoBusy, setAutoBusy] = useState(false);
  const [autoMessage, setAutoMessage] = useState("");
  const autoWallsHere = wallsHere.filter((wall) => wall.auto).length;
  /** Lê a imagem do mapa e troca as paredes automáticas do andar pelas detectadas (desfazer volta ao estado anterior). */
  async function detectAutoWalls() {
    setAutoBusy(true);
    setAutoMessage("");
    try {
      if (!board.map.image) throw new Error("Este mapa não tem imagem para analisar.");
      const raster = await loadRaster(board.map.image, board.map.cols, board.map.rows);
      const segments = detectWalls(raster, board.map.cols, board.map.rows, { mode: autoMode, sensitivity: autoSensitivity / 100 });
      setAutoWalls(segments, floorNow);
      setAutoMessage(segments.length ? `${segments.length} segmentos de parede criados. Confira no mapa; apague ou refaça com outra sensibilidade.` : "Nenhuma parede encontrada com essa sensibilidade.");
    } catch (error) { setAutoMessage((error as Error).message); }
    setAutoBusy(false);
  }
  const heroEyes = board.tokens.filter((token) => token.side === "heroes" && !token.hidden && !token.defeated);
  const seenNow = useMemo(() => (heroEyes.length ? visionForTokens(board, heroEyes, fog).visible.size : 0), [board, fog]);
  const brushButtons = (tool: MapToolId, label: string) => <>
    <div className="mesa-panel-actions">
      <button className={stage.tool === tool ? "active" : ""} aria-pressed={stage.tool === tool} onClick={() => onSelectStageTool?.(stage.tool === tool ? "select" : tool)}>{label}</button>
    </div>
    {stage.tool === tool && <div className="mesa-panel-actions">
      <button className={stage.brush === "add" ? "active" : ""} onClick={() => setStageBrush("add")}>Adicionar</button>
      <button className={stage.brush === "erase" ? "active" : ""} onClick={() => setStageBrush("erase")}>Apagar</button>
    </div>}
  </>;

  if (!section) {
    return <div className="mesa-panel-stack">
      <div className="mesa-automation-list">
        <button onClick={() => setSection("clima")}><CloudRain/><span><strong>Clima</strong><small>{weatherLabel(board.weather)} · chuva, neve, cinzas, névoa, tormenta e tempestade</small></span><ChevronRight/></button>
        <button onClick={() => setSection("fog")}><CloudFog/><span><strong>Fog</strong><small>{board.fog.length} células cobertas · visão dos jogadores</small></span><ChevronRight/></button>
        <button onClick={() => setSection("luz")}><Lightbulb/><span><strong>Luz</strong><small>{LIGHTING_LABEL[lighting]} · {board.lights.filter((light) => light.enabled).length} luzes acesas</small></span><ChevronRight/></button>
        <button onClick={() => setSection("visao")}><Eye/><span><strong>Visão</strong><small>{fog.playerFogEnabled ? `Fog dos jogadores ligado · ${fog.ownVisionCells} casas` : "Fog dos jogadores desligado"}</small></span><ChevronRight/></button>
        <button onClick={() => setSection("paredes")}><BrickWall/><span><strong>Paredes</strong><small>{wallsHere.length} paredes · bloqueiam movimento e visão</small></span><ChevronRight/></button>
        <button onClick={() => setSection("portas")}><DoorOpen/><span><strong>Portas</strong><small>{doorsHere.length} portas · {doorsHere.filter((door) => door.open).length} abertas</small></span><ChevronRight/></button>
      </div>
    </div>;
  }
  return <div className="mesa-panel-stack">
    <div className="mesa-panel-actions"><button onClick={() => setSection(null)}><ChevronRight style={{ transform: "rotate(180deg)" }}/>Ambiente</button></div>

    {section === "clima" && <div className="mesa-panel-section"><h4>CLIMA</h4>
      <div className="mesa-weather-grid">{(["clear", "rain", "snow", "embers", "fog", "tormenta", "storm"] as WeatherType[]).map((weather) => <button key={weather} className={board.weather === weather ? "active" : ""} disabled={isPlayer} onClick={() => setWeather(weather)}>{weather === "rain" ? <CloudRain/> : weather === "embers" ? <Flame/> : weather === "fog" ? <Wind/> : weather === "tormenta" || weather === "storm" ? <Zap/> : <Sparkles/>}<span>{weatherLabel(weather)}</span></button>)}</div>
    </div>}

    {section === "fog" && !isPlayer && <>
      <div className="mesa-panel-section"><h4>NÉVOA (FOG)</h4>
        <p className="mesa-module-note">{board.fog.length} células cobertas. Cubra tudo, revele tudo ou pinte quadrado a quadrado.</p>
        <div className="mesa-panel-actions"><button onClick={() => setFog(Array.from({ length: board.map.cols * board.map.rows }, (_, index) => `${index % board.map.cols},${Math.floor(index / board.map.cols)}`))}>Cobrir mapa</button><button onClick={() => setFog([])}>Revelar mapa</button></div>
        {brushButtons("fog", "Pintar névoa à mão")}
      </div>
      <div className="mesa-panel-section"><h4>FOG AUTOMÁTICO</h4>
        <p className="mesa-module-note">O fog dos jogadores já é calculado sozinho: as paredes (e portas fechadas) bloqueiam a visão dos heróis e o resto fica coberto. {fog.playerFogEnabled ? "Está ligado." : "Está desligado (ligue em Visão)."} Agora: {heroEyes.length} {heroEyes.length === 1 ? "herói enxerga" : "heróis enxergam"} {seenNow} casas, com {wallsHere.filter((wall) => wall.type === "wall" || wall.type === "door").length} paredes e portas no andar.</p>
        <div className="mesa-panel-actions">
          <button disabled={heroEyes.length === 0} onClick={() => setFog([...fogForVision(board, visionForTokens(board, heroEyes, fog).visible, { ...fog, keepExploredDim: false })])}><CloudFog/>Cobrir o que os heróis não veem</button>
          <button disabled={(board.explored?.length ?? 0) === 0} onClick={() => setExplored([])}><Eye/>Esquecer áreas exploradas</button>
        </div>
      </div>
    </>}

    {section === "visao" && !isPlayer && <>
      <div className="mesa-panel-section"><h4>VISÃO DOS JOGADORES</h4>
        <label className="mesa-check"><input type="checkbox" checked={fog.playerFogEnabled} onChange={toggle("playerFogEnabled")}/><span>Fog dos jogadores ativo</span></label>
        <label className="mesa-check"><input type="checkbox" checked={fog.masterSeesPreview} onChange={toggle("masterSeesPreview")}/><span>Mestre vê a prévia dos jogadores</span></label>
        <label className="mesa-check"><input type="checkbox" checked={fog.darknessRevealedOnlyByLights} onChange={toggle("darknessRevealedOnlyByLights")}/><span>Escuridão revelada apenas por luzes</span></label>
        <label className="mesa-check"><input type="checkbox" checked={fog.exploreOnMove} onChange={toggle("exploreOnMove")}/><span>Explorar ao mover heróis</span></label>
        <label className="mesa-check"><input type="checkbox" checked={fog.keepExploredDim} onChange={toggle("keepExploredDim")}/><span>Manter áreas exploradas em penumbra</span></label>
        <label className="mesa-range"><span>Visão própria: {fog.ownVisionCells} casas</span><input type="range" min={1} max={20} value={fog.ownVisionCells} onChange={(event) => setFogSettings({ ownVisionCells: Number(event.target.value) })}/></label>
        <label className="mesa-range"><span>Opacidade: {Math.round(fog.opacity * 100)}%</span><input type="range" min={20} max={100} value={Math.round(fog.opacity * 100)} onChange={(event) => setFogSettings({ opacity: Number(event.target.value) / 100 })}/></label>
      </div>
    </>}

    {section === "paredes" && !isPlayer && <>
      <div className="mesa-panel-section"><h4>PAREDES DO MAPA</h4>
        <p className="mesa-module-note">{wallsHere.length} paredes neste andar. Com a ferramenta ligada, clique nas células do mapa para criar ou apagar uma parede.</p>
        {brushButtons("wall", "Desenhar paredes no mapa")}
      </div>
      <div className="mesa-panel-section"><h4>PAREDES AUTOMÁTICAS</h4>
        <p className="mesa-module-note">Lê a imagem do mapa e propõe as paredes sobre a grade. É uma estimativa (heurística nossa): funciona melhor em mapas de masmorra com paredes escuras ou traço grosso; em mapas ilustrados, o confiável é importar um arquivo UVTT (Cenas e mapas). {autoWallsHere} paredes automáticas neste andar.</p>
        <label className="mesa-grid-select">Como identificar
          <select value={autoMode} onChange={(event) => setAutoMode(event.target.value as AutoWallMode)}>
            <option value="dark">Áreas escuras viram parede (masmorras com rocha preta)</option>
            <option value="edges">Contornos fortes (paredes desenhadas com traço grosso)</option>
          </select>
        </label>
        <label className="mesa-range"><span>Sensibilidade: {autoSensitivity}% (limite de {MAX_AUTO_WALLS} segmentos)</span><input type="range" min={5} max={100} value={autoSensitivity} onChange={(event) => setAutoSensitivity(Number(event.target.value))}/></label>
        <div className="mesa-panel-actions">
          <button disabled={autoBusy} onClick={() => void detectAutoWalls()}><BrickWall/>{autoBusy ? "Analisando…" : "Detectar paredes pela imagem"}</button>
          <button disabled={autoBusy || autoWallsHere === 0} onClick={() => { setAutoWalls([], floorNow); setAutoMessage("Paredes automáticas removidas."); }}><Trash2/>Remover as automáticas</button>
        </div>
        {autoMessage && <p className="mesa-module-note" role="status">{autoMessage}</p>}
      </div>
      {wallsHere.length > 0 && <div className="mesa-panel-section"><h4>LISTA</h4><div className="mesa-automation-list">{wallsHere.map((wall, index) => <button key={wall.id} onClick={() => removeWall(wall.id)} title="Remover esta parede">
        <BrickWall/><span><strong>{wall.name || `Parede ${index + 1}`}</strong><small>{wall.type === "wall" ? "Parede" : wall.type === "window" ? "Janela" : "Barreira invisível"} · ({wall.x1},{wall.y1}) → ({wall.x2},{wall.y2})</small></span><Trash2/>
      </button>)}</div></div>}
    </>}

    {section === "portas" && !isPlayer && <>
      <div className="mesa-panel-section"><h4>PORTAS</h4>
        <div className="mesa-panel-actions"><button onClick={() => onArmMapTool?.("door")}><DoorOpen/>Criar porta no mapa</button></div>
        {doorsHere.length === 0 && <p className="mesa-block-empty">Nenhuma porta neste andar.</p>}
        <div className="mesa-automation-list">{doorsHere.map((door) => <button key={door.id} disabled={door.locked} onClick={() => {
          try { toggleBarrier(door.id); }
          catch (error) { appendChat({ author: "Sistema", text: (error as Error).message, kind: "system" }); }
        }}><DoorOpen/><span><strong>{door.name || "Porta"}</strong><small>{door.locked ? "Trancada" : door.open ? "Aberta" : "Fechada"} · clique para {door.open ? "fechar" : "abrir"}</small></span><ChevronRight/></button>)}</div>
        {doorsHere.length > 0 && <div className="mesa-panel-actions">{doorsHere.map((door) => <button key={`${door.id}-lock`} onClick={() => upsertWall({ ...door, locked: !door.locked, ...(door.locked ? {} : { open: false }) })}>{door.locked ? `Destrancar ${door.name || "porta"}` : `Trancar ${door.name || "porta"}`}</button>)}</div>}
        {doorsHere.length > 0 && <div className="mesa-panel-actions">{doorsHere.map((door) => <button key={`${door.id}-config`} className={editingDoorId === door.id ? "active" : ""} onClick={() => setEditingDoorId(editingDoorId === door.id ? null : door.id)}><DoorOpen/>Configurar {door.name || "porta"}</button>)}</div>}
        {(() => { const editing = doorsHere.find((door) => door.id === editingDoorId); return editing ? <DoorEditor door={editing}/> : null; })()}
      </div>
    </>}

    {section === "luz" && !isPlayer && <>
      <div className="mesa-panel-section"><h4>ILUMINAÇÃO DA CENA</h4>
        <div className="mesa-lighting-grid">{(Object.keys(LIGHTING_LABEL) as Array<keyof typeof LIGHTING_LABEL>).map((entry) => <button key={entry} className={lighting === entry ? "active" : ""} onClick={() => setLighting(entry)}>{LIGHTING_LABEL[entry]}</button>)}</div>
      </div>
      <div className="mesa-panel-section"><h4>FONTES DE LUZ</h4>
        <p className="mesa-module-note">{board.lights.filter((light) => light.enabled).length} luzes acesas na cena. Colocar, mudar e apagar luzes (tocha, lanterna, fogueira…) agora é na gaveta Ambientação.</p>
      </div>
    </>}

    {section !== "clima" && isPlayer && <p className="mesa-block-empty">Só o Mestre configura este item do ambiente.</p>}
  </div>;
}

function HistoryPanel({ snapshot }: { snapshot: RuntimeSnapshot }) {
  const [filter, setFilter] = useState<"all" | "chat" | "roll" | "combat" | "system">("all");
  const [whisperTo, setWhisperTo] = useState("");
  const conexoes = snapshot.multiplayer.peers || [];
  const entries = useMemo(() => {
    const eu = snapshot.multiplayer.peerId;
    const chat = snapshot.board.chat
      // sussurro so aparece para remetente e destinatario (Vtt/app.js rotearMensagem)
      .filter((entry) => !entry.whisperTo || entry.whisperTo === eu || entry.whisperFrom === eu)
      .map((entry) => ({ id: entry.id, kind: entry.kind || "chat", title: entry.whisperTo ? `${entry.author} (sussurro)` : entry.author, detail: entry.text, at: entry.timestamp }));
    const combat = snapshot.combat.log.map((entry) => ({ id: entry.id, kind: entry.type === "system" ? "system" : "combat", title: entry.title, detail: entry.detail, at: entry.timestamp || 0 }));
    return [...chat, ...combat].filter((entry) => filter === "all" || entry.kind === filter).sort((a, b) => b.at - a.at);
  }, [filter, snapshot.board.chat, snapshot.combat.log]);
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("message") as HTMLInputElement;
    const texto = input.value.trim();
    if (!texto) return;
    appendChat({
      author: snapshot.multiplayer.role === "player" ? "Jogador" : "Mestre",
      text: texto, kind: "chat",
      ...(whisperTo ? { whisperTo, whisperFrom: snapshot.multiplayer.peerId } : {}),
    });
    input.value = "";
  }
  return <div className="mesa-panel-stack"><div className="mesa-history-filters">{(["all", "chat", "roll", "combat", "system"] as const).map((id) => <button key={id} className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>{({ all: "Tudo", chat: "Chat", roll: "Rolagens", combat: "Combate", system: "Sistema" })[id]}</button>)}</div><div className="mesa-history-list">{entries.length ? entries.map((entry) => <article key={entry.id} className={entry.kind}><i/><span><strong>{entry.title}</strong><p>{entry.detail}</p><small>{entry.at ? new Date(entry.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "sessão"}</small></span></article>) : <div className="mesa-panel-empty"><History/><strong>Nenhum evento neste filtro.</strong></div>}</div><form className="mesa-message-form" onSubmit={send}>
    {conexoes.length > 0 && <select value={whisperTo} onChange={(event) => setWhisperTo(event.target.value)} aria-label="Destinatário" title="Sussurrar para alguém">
      <option value="">Todos</option>
      {conexoes.map((peer) => <option key={peer} value={peer}>{peer.slice(0, 8)}</option>)}
    </select>}
    <input name="message" placeholder={whisperTo ? "Sussurrar…" : "Narrar ou escrever para a mesa…"}/>
    <button aria-label="Enviar"><Send/></button>
  </form></div>;
}

function JukeboxPanel() {
  const juke = useSyncExternalStore(subscribeJukebox, jukeboxState, jukeboxState);
  const isMaster = getRuntimeSnapshot().multiplayer.role !== "player";
  return <div className="mesa-panel-stack">
    <div className="mesa-jukebox-now">
      <span><Headphones/></span>
      <div>
        <small>FAIXA ATUAL</small>
        <strong>{juke.title || "Nenhuma faixa tocando"}</strong>
        <em>{juke.url ? (juke.playing ? "Tocando" : "Pausada") : "Toque uma das faixas abaixo ou escolha um arquivo do computador."}</em>
      </div>
    </div>
    {isMaster && <JukeboxPresetsSection/>}
    <div className="mesa-audio-controls mesa-audio-controls-labeled">
      <button onClick={stopTrack} disabled={!juke.url} title="Parar a faixa"><Square/>Parar</button>
      <button className="play" onClick={() => (juke.playing ? pauseTrack() : void playTrack())} disabled={!juke.url} title={juke.playing ? "Pausar a faixa" : "Tocar a faixa"}>{juke.playing ? <><Pause/>Pausar</> : <><Play/>Tocar</>}</button>
      <button className={juke.loop ? "active" : ""} aria-pressed={juke.loop} onClick={() => setLoop(!juke.loop)} title="Repetir a faixa quando ela terminar"><Repeat/>Loop</button>
    </div>
    <label className="mesa-volume">
      <Volume2/>
      <input type="range" min={0} max={100} value={Math.round(juke.volume * 100)} onChange={(event) => setVolume(Number(event.target.value) / 100)} aria-label="Volume"/>
      <span>{Math.round(juke.volume * 100)}%</span>
    </label>
    <SoundboardSection volume={juke.volume}/>
  </div>;
}

/** Cinco faixas preparadas: nome do evento + link (YouTube ou áudio) ou arquivo do computador, cada uma com play/pausa. */
function JukeboxPresetsSection() {
  const juke = useSyncExternalStore(subscribeJukebox, jukeboxState, jukeboxState);
  const [presets, setPresets] = useState(loadPresets);
  const [status, setStatus] = useState("");

  function currentUrlOf(index: number) {
    const preset = presets[index];
    return preset.file ? cachedPresetUrl(index) : preset.url.trim();
  }
  async function toggle(index: number) {
    const preset = presets[index];
    const url = currentUrlOf(index);
    if (url && juke.url === url) { if (juke.playing) pauseTrack(); else void playTrack(); return; }
    let target = preset.url.trim();
    if (preset.file) {
      const opened = await presetFileUrl(index, presetAudioKey(index));
      if (!opened) { setStatus(`O arquivo "${preset.file}" não está mais neste navegador. Escolha-o de novo.`); return; }
      target = opened;
    }
    if (!target) { setStatus("Cole um link do YouTube ou de áudio, ou escolha um arquivo do computador."); return; }
    setStatus("");
    loadTrack(target, preset.name.trim() || preset.file || undefined);
    void playTrack();
  }
  async function chooseFile(index: number, file: File | undefined) {
    if (!file) return;
    await saveAudio(presetAudioKey(index), file);
    forgetPresetUrl(index);
    const current = presets[index];
    setPresets(updatePreset(index, { file: file.name, url: "", name: current.name || file.name.replace(/\.[a-z0-9]+$/i, "") }));
    setStatus(file.size > MAX_SHARED_AUDIO_BYTES ? "Arquivo guardado, mas passa de 25 MB: toca só para você. Use um arquivo menor (ou um link) para todos ouvirem." : "Arquivo guardado neste navegador. Ao tocar, ele é enviado aos jogadores e todos ouvem.");
  }
  async function clearFile(index: number) {
    await deleteAudio(presetAudioKey(index));
    forgetPresetUrl(index);
    setPresets(updatePreset(index, { file: "" }));
  }
  return <div className="mesa-panel-section"><h4>FAIXAS DA AVENTURA</h4>
    <div className="mesa-jukebox-presets">{presets.map((preset, index) => {
      const url = currentUrlOf(index);
      const current = Boolean(url) && juke.url === url;
      return <div key={index} className={`mesa-jukebox-preset ${current ? "is-current" : ""}`}>
        <input className="preset-name" value={preset.name} maxLength={60} placeholder={`Evento ${index + 1} (ex.: Combate)`} aria-label={`Nome da faixa ${index + 1}`}
          onChange={(event) => setPresets(updatePreset(index, { name: event.target.value }))}/>
        <input className="preset-link" value={preset.file ? `Arquivo: ${preset.file}` : preset.url} readOnly={Boolean(preset.file)} placeholder="Link do YouTube ou do áudio" aria-label={`Link da faixa ${index + 1}`}
          onChange={(event) => { forgetPresetUrl(index); setPresets(updatePreset(index, { url: event.target.value })); }}/>
        <button className="preset-play" onClick={() => void toggle(index)} title={current && juke.playing ? "Pausar" : "Tocar"} aria-label={`${current && juke.playing ? "Pausar" : "Tocar"} faixa ${index + 1}`}>{current && juke.playing ? <Pause/> : <Play/>}</button>
        <label className="preset-file" title="Escolher áudio do computador"><Upload/><input type="file" accept="audio/*" onChange={(event) => { void chooseFile(index, event.target.files?.[0]); event.target.value = ""; }}/></label>
        {preset.file && <button className="preset-clear" onClick={() => void clearFile(index)} title="Remover o arquivo desta faixa" aria-label={`Remover arquivo da faixa ${index + 1}`}><Trash2/></button>}
      </div>;
    })}</div>
    {(status || juke.error) && <p className="mesa-module-note">{status || juke.error}</p>}
    <p className="mesa-module-note">Prepare as faixas da cena e, na hora, é só apertar play. O que tocar aqui todos ouvem (Mestre e jogadores). Arquivos do computador são enviados aos jogadores pela sala (até 25 MB).</p>
  </div>;
}

/** Soundboard: sons escolhidos por busca no Freesound; o Mestre toca para toda a mesa. */
function SoundboardSection({ volume }: { volume: number }) {
  const [slots, setSlots] = useState(loadSoundboard);
  const [key, setKey] = useState(getFreesoundKey);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SoundHit[]>([]);
  const [status, setStatus] = useState("");
  const isMaster = getRuntimeSnapshot().multiplayer.role !== "player";
  function play(url: string) {
    if (!isPlayableUrl(url)) return;
    if (isMaster) sendSignal({ kind: "sfx", url }); else playSfx(url, volume);
  }
  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setKey((current) => { setFreesoundKey(current); return current; });
    setStatus("Buscando…");
    try {
      const found = await searchFreesound(query, key);
      setHits(found);
      setStatus(found.length ? `${found.length} sons` : "Nenhum som encontrado.");
    } catch (error) { setHits([]); setStatus((error as Error).message); }
  }
  return <div className="mesa-panel-section"><h4>SOUNDBOARD</h4>
    <div className="mesa-soundboard">{SOUNDBOARD.map((slot) => (
      <button key={slot.id} title={slot.label} onClick={() => play(slot.url)}><Sparkles/>{slot.label}</button>
    ))}{slots.map((slot) => (
      <button key={slot.id} title={isMaster ? `${slot.label} — botão direito remove` : slot.label} onClick={() => play(slot.url)}
        onContextMenu={(event) => { event.preventDefault(); if (isMaster) setSlots(removeSound(slot.id)); }}><Sparkles/>{slot.label}</button>
    ))}</div>
    {isMaster && <>
      <details className="mesa-freesound"><summary>Buscar novos sons (Freesound)</summary>
      <form className="mesa-audio-source" onSubmit={search}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar som (ex.: espada, trovão)" aria-label="Buscar som"/>
        <button type="submit" aria-label="Buscar"><Play/></button>
      </form>
      <label className="mesa-panel-field"><span>Chave gratuita do Freesound (fica só neste navegador)</span>
        <div><input type="password" value={key} onChange={(event) => setKey(event.target.value)} onBlur={() => setFreesoundKey(key)} placeholder="cole sua chave aqui" aria-label="Chave do Freesound"/></div></label>
      </details>
      {status && <p className="mesa-module-note">{status}</p>}
      <div className="mesa-automation-list">{hits.map((hit) => (
        <button key={hit.id} onClick={() => { setSlots(addSound({ id: hit.id, label: hit.name, url: hit.url })); playSfx(hit.url, volume); }} title="Ouvir e adicionar ao soundboard">
          <Sparkles/><span><strong>{hit.name}</strong><small>{hit.duration.toFixed(1)} s · toque para ouvir e adicionar</small></span><Plus/>
        </button>
      ))}</div>
    </>}
  </div>;
}

function AutomationPanel({ snapshot }: Props) {
  const isPlayer = snapshot.multiplayer.role === "player";
  const areas = snapshot.board.shapes.filter((shape) => shape.kind === "area");

  return <div className="mesa-panel-stack mesa-automation-stack">
    <GlobalMacros/>
    <TriggerList shapes={snapshot.board.shapes} isPlayer={isPlayer}/>
    <p className="mesa-module-note">{areas.length} {areas.length === 1 ? "área marcada" : "áreas marcadas"} na cena (as áreas ficam na Ambientação).</p>
  </div>;
}

/**
 * Submenu contextual do botão Macros. Não cria barra ou coluna nova: arma uma
 * ferramenta já existente e o próximo clique usa o BOARD oficial.
 */
function MapContextPanel({ snapshot, selectedUnit, onOpenPanel, onArmMapTool, onSelectStageTool }: Props) {
  const [editingObjectId, setEditingObjectId] = useState<string | null>(null);
  const [editingDoorId, setEditingDoorId] = useState<string | null>(null);
  const stage = useStageControl();
  const isPlayer = snapshot.multiplayer.role === "player";
  // Vindo do diálogo do objeto no mapa (botão Configurar): abre o editor desse objeto.
  useEffect(() => { if (stage.editObjectId) { setEditingObjectId(stage.editObjectId); clearObjectEditRequest(); } }, [stage.editObjectId]);
  const [shapeKind, setShapeKind] = useState<Exclude<ShapeKind, "polygon">>("circle");
  const [shapeSize, setShapeSize] = useState(6);
  const tools: Array<{ id: Extract<MapToolId, "door" | "shape" | "trigger" | "object">; title: string; detail: string; icon: LucideIcon }> = [
    { id: "shape", title: "Colocar área no mapa", detail: "Escolha a forma e o tamanho acima, clique no mapa e a área aparece animada para todos.", icon: Shapes },
    { id: "object", title: "Objetos", detail: "Clique no mapa para posicionar um objeto.", icon: PackageOpen },
    { id: "trigger", title: "Gatilhos", detail: "Clique nas casas para marcar; o efeito se configura em Macros.", icon: Sparkles },
  ];
  return <div className="mesa-panel-stack">
    <div className="mesa-system-card"><Map/><span><small>AMBIENTAÇÃO</small><strong>O que existe no palco</strong><em>Áreas, itens, armadilhas, luzes e mídia. Escolha a ferramenta e clique no mapa.</em></span></div>
    <div className="mesa-panel-section">
      <h4>FERRAMENTAS DO MAPA</h4>
      <div className="mesa-automation-list">
        {STAGE_TOOLS.filter((entry) => !entry.masterOnly || !isPlayer).map((entry) => {
          const Icon = entry.icon;
          return <button key={entry.id} className={stage.tool === entry.id ? "active" : ""} onClick={() => onSelectStageTool?.(stage.tool === entry.id ? "select" : entry.id)} title={entry.detail}>
            <Icon/><span><strong>{entry.title}</strong><small>{entry.detail}</small></span>{stage.tool === entry.id ? <em>ativa</em> : <ChevronRight/>}
          </button>;
        })}
      </div>
      {!isPlayer && ["fog", "light", "wall", "terrain"].includes(stage.tool) && <div className="mesa-panel-actions">
        <button className={stage.brush === "add" ? "active" : ""} onClick={() => setStageBrush("add")}>Adicionar</button>
        <button className={stage.brush === "erase" ? "active" : ""} onClick={() => setStageBrush("erase")}>Apagar</button>
      </div>}
      {!isPlayer && stage.tool === "terrain" && <label className="mesa-grid-select">Terreno
        <select value={stage.terrain.type} onChange={(event) => setStageTerrain({ ...stage.terrain, type: event.target.value as typeof stage.terrain.type })}>
          {(Object.keys(TERRAIN_LABEL) as Array<keyof typeof TERRAIN_LABEL>).map((type) => <option key={type} value={type}>{TERRAIN_LABEL[type]}</option>)}
        </select>
      </label>}
    </div>
    <div className="mesa-panel-section">
      <h4>ÁREA</h4>
      <label className="mesa-grid-select">Forma da área
        <select value={shapeKind} disabled={isPlayer} onChange={(event) => setShapeKind(event.target.value as Exclude<ShapeKind, "polygon">)}>
          {(Object.keys(SHAPE_LABEL) as ShapeKind[]).filter((kind) => kind !== "polygon").map((kind) => <option key={kind} value={kind}>{SHAPE_LABEL[kind]}</option>)}
        </select>
      </label>
      {shapeKind !== "cells" && shapeKind !== "rect" && <label className="mesa-grid-select">{shapeKind === "circle" ? "Raio" : shapeKind === "cone" ? "Alcance do cone" : "Comprimento da linha"}
        <select value={shapeSize} disabled={isPlayer} onChange={(event) => setShapeSize(Number(event.target.value))}>
          {[1.5, 3, 4.5, 6, 9, 12, 15, 18, 24, 30].map((meters) => <option key={meters} value={meters}>{String(meters).replace(".", ",")} m</option>)}
        </select>
      </label>}
      <p className="mesa-module-note">{shapeKind === "circle" ? "Clique no centro da área." : shapeKind === "cone" || shapeKind === "line" ? "Clique na origem e depois na direção que a área aponta (um sopro de dragão, por exemplo)." : shapeKind === "rect" ? "Clique num canto e depois no canto oposto." : "Clique nas casas para marcar ou desmarcar."}</p>
      {!isPlayer && snapshot.board.shapes.some((shape) => shape.kind === "area") && <div className="mesa-panel-actions"><button onClick={() => setShapes(snapshot.board.shapes.filter((shape) => shape.kind !== "area"))}><Trash2/>Apagar todas as áreas</button></div>}
    </div>
    <div className="mesa-automation-list">
      {tools.map((tool) => {
        const Icon = tool.icon;
        const options = tool.id === "shape" ? { shapeKind, ...(shapeKind !== "cells" && shapeKind !== "rect" ? { shapeSizeM: shapeSize } : {}) } : tool.id === "trigger" ? { triggerConfig: { condition: TRIGGER_CONDITIONS[0], mode: "once" as const } } : undefined;
        return <button key={tool.id} disabled={isPlayer} onClick={() => onArmMapTool?.(tool.id, options)} title={isPlayer ? `${tool.title} — somente Mestre` : tool.detail}>
          <Icon/><span><strong>{tool.title}</strong><small>{tool.detail}</small></span><ChevronRight/>
        </button>;
      })}
      <button onClick={() => onOpenPanel?.("scenes")}><Grid3X3/><span><strong>Andares</strong><small>Selecionar andar ativo e administrar a cena</small></span><ChevronRight/></button>
      <button onClick={() => onOpenPanel?.("roster")}><Users/><span><strong>Editor de token</strong><small>PV, PM, defesa, vínculo e propriedade</small></span><ChevronRight/></button>
    </div>
    {snapshot.board.objects.filter((object) => Math.trunc(object.floor ?? 0) === Math.trunc(snapshot.board.activeFloor ?? 0)).length > 0 && <section className="mesa-panel-section">
      <h4>OBJETOS DO ANDAR</h4>
      <div className="mesa-automation-list">{snapshot.board.objects.filter((object) => Math.trunc(object.floor ?? 0) === Math.trunc(snapshot.board.activeFloor ?? 0)).map((object) => <button key={object.id} disabled={isPlayer} onClick={() => {
        try { interactBoardObject(object.id); }
        catch (error) { appendChat({ author: "Sistema", text: (error as Error).message, kind: "system" }); }
      }}>
        <PackageOpen/><span><strong>{object.name}</strong><small>{object.locked ? "Trancado" : object.opened ? "Aberto" : "Fechado"} · {object.contents.length} conteúdo(s)</small></span><ChevronRight/>
      </button>)}</div>
      {!isPlayer && <div className="mesa-panel-actions">{snapshot.board.objects.filter((object) => Math.trunc(object.floor ?? 0) === Math.trunc(snapshot.board.activeFloor ?? 0)).map((object) => <button key={`${object.id}-lock`} onClick={() => updateBoardObject(object.id, { locked: !object.locked })}>{object.locked ? `Destrancar ${object.name}` : `Trancar ${object.name}`}</button>)}</div>}
      {!isPlayer && <div className="mesa-panel-actions">{snapshot.board.objects.filter((object) => Math.trunc(object.floor ?? 0) === Math.trunc(snapshot.board.activeFloor ?? 0)).map((object) => <button key={`${object.id}-config`} className={editingObjectId === object.id ? "active" : ""} onClick={() => setEditingObjectId(editingObjectId === object.id ? null : object.id)}><PackageOpen/>Configurar {object.name}</button>)}</div>}
      {!isPlayer && (() => { const editing = snapshot.board.objects.find((object) => object.id === editingObjectId); return editing ? <ObjectEditor object={editing}/> : null; })()}
    </section>}
    {!isPlayer && <>
      <SceneObjectsSection snapshot={snapshot} selectedUnit={selectedUnit}/>
      <TrapsSection snapshot={snapshot}/>
      <LightsSection snapshot={snapshot} onSelectStageTool={onSelectStageTool}/>
      <StageMediaSection snapshot={snapshot}/>
    </>}
    <p className="mesa-module-note">Círculo, retângulo, linha e cone: clique no ponto inicial e depois no ponto final. O polígono livre ainda não está disponível.</p>
    {isPlayer && <p className="mesa-module-note">Ferramentas de cena são do Mestre. Você continua podendo selecionar e usar seu próprio token.</p>}
  </div>;
}

/** O ícone superior existente abre este submenu; não há um novo controle-base. */
function UndoRedoPanel({ snapshot }: { snapshot: RuntimeSnapshot }) {
  const isPlayer = snapshot.multiplayer.role === "player";
  const undoAvailable = canUndo();
  const redoAvailable = canRedo();
  return <div className="mesa-panel-stack">
    <div className="mesa-system-card"><History/><span><small>HISTÓRICO DA CENA</small><strong>Desfazer e refazer</strong><em>BOARD rev. {snapshot.board.revision}</em></span></div>
    <div className="mesa-panel-actions">
      <button disabled={isPlayer || !undoAvailable} onClick={undoBoard} title={undoAvailable ? undoLabel() : "Nada para desfazer"}><Undo2/>Desfazer</button>
      <button disabled={isPlayer || !redoAvailable} onClick={redoBoard} title={redoAvailable ? redoLabel() : "Nada para refazer"}><Redo2/>Refazer</button>
    </div>
    {isPlayer && <p className="mesa-module-note">Somente o Mestre altera o histórico compartilhado da cena.</p>}
  </div>;
}

function OnlinePanel({ snapshot }: { snapshot: RuntimeSnapshot }) {
  const [code, setCode] = useState(""); const [status, setStatus] = useState(""); const [copied, setCopied] = useState("");
  const room = snapshot.multiplayer.roomCode;
  const copy = (what: "código" | "link", text: string) => { void navigator.clipboard?.writeText(text); setCopied(what); window.setTimeout(() => setCopied(""), 1800); };
  async function host() { try { setStatus("Abrindo sala…"); await hostMultiplayer(); setStatus("Sala aberta"); } catch (error) { setStatus((error as Error).message); } }
  async function join() { try { setStatus("Conectando…"); await joinMultiplayer(code); setStatus("Conectado"); } catch (error) { setStatus((error as Error).message); } }
  return <div className="mesa-panel-stack"><div className={`mesa-online-card ${snapshot.multiplayer.status === "connected" ? "connected" : ""}`}><Radio/><span><small>{snapshot.multiplayer.role.toUpperCase()}</small><strong>{status || snapshot.multiplayer.status}</strong><em>{snapshot.multiplayer.roomCode ? `Sala ${snapshot.multiplayer.roomCode}` : "Sem sala ativa"}{snapshot.multiplayer.peerId ? ` · Peer ${shortPeerId(snapshot.multiplayer.peerId)}` : ""}</em></span></div>{room && <div className="mesa-room-code"><small>CÓDIGO DA MESA</small><strong>{room}</strong><p>Quem tiver o código (ou o link) entra direto na sua mesa.</p><div className="mesa-panel-actions"><button onClick={() => copy("código", room)}>{copied === "código" ? "Copiado!" : "Copiar código"}</button><button onClick={() => copy("link", `${window.location.origin}${SITE_ROOT}mesa/?sala=${room}`)}>{copied === "link" ? "Copiado!" : "Copiar link"}</button></div></div>}<button className="mesa-primary-button" onClick={host}><Shield/>Criar sala como Mestre</button><div className="mesa-join-room"><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="CÓDIGO"/><button onClick={join}>Entrar</button></div><div className="mesa-peer-list"><small>CONEXÕES · {snapshot.multiplayer.peers.length}</small>{snapshot.multiplayer.peers.map((peer) => <span key={peer}><i/>{peer}{snapshot.multiplayer.role === "master" && <button type="button" className="mesa-kick-button" title="Expulsar este jogador da mesa" aria-label={`Expulsar ${peer}`} onClick={() => { if (window.confirm("Expulsar este jogador da mesa? Ele é desconectado e não volta a esta sala até você abri-la de novo.")) kickPlayer(peer); }}>Expulsar</button>}</span>)}</div></div>;
}

function SettingsPanel({ snapshot }: Props) {
  const prefs = usePreferences();
  return <div className="mesa-panel-stack">
    <div className="mesa-panel-section"><h4>MODO DA MESA</h4>
      <div className="mesa-panel-actions">
        <button className={prefs.tableMode === "minimal" ? "active" : ""} aria-pressed={prefs.tableMode === "minimal"} onClick={() => setPreferences({ tableMode: "minimal" })}>Minimalista</button>
        <button className={prefs.tableMode === "expanded" ? "active" : ""} aria-pressed={prefs.tableMode === "expanded"} onClick={() => setPreferences({ tableMode: "expanded" })}>Expandido</button>
      </div>
      <p className="mesa-module-note">Minimalista: a mesa sóbria, em dourado e marrom. Expandido: mais arte (interior azul-marinho, moldura vermelha de lava, dragões). Os botões e as funções são os mesmos nos dois.</p>
    </div>
    <div className="mesa-panel-section"><h4>ESCALA DO MAPA</h4>
      <div className="mesa-panel-actions">
        <button className={prefs.showScale ? "active" : ""} aria-pressed={prefs.showScale} onClick={() => setPreferences({ showScale: !prefs.showScale })}>{prefs.showScale ? "Escala ligada" : "Escala desligada"}</button>
      </div>
    </div><div className="mesa-automation-list"><button onClick={() => downloadGamePackage()}><Download/><span><strong>Backup da mesa</strong><small>Cenas, tokens e combate</small></span><ChevronRight/></button></div><div className="mesa-map-dimensions"><label>Colunas<input type="number" value={snapshot.board.map.cols} onChange={(event) => updateMap({ ...snapshot.board.map, cols: Math.max(4, Number(event.target.value)) })}/></label><label>Linhas<input type="number" value={snapshot.board.map.rows} onChange={(event) => updateMap({ ...snapshot.board.map, rows: Math.max(4, Number(event.target.value)) })}/></label></div>
    <GridSettingsSection grid={snapshot.board.grid}/>
  </div>;
}

/**
 * Escala, unidade, metrica e tipo de grade — a fonte unica de game/distance.ts
 * exposta na UI. Mudar aqui vale para regua, movimento, alcance e areas.
 */
/** Visão 2D ou isométrica (V3 religado) e giro do mapa; a escolha é de cada jogador. Arte isométrica dedicada: só o Mestre. */
/** Luzes da cena (Ambientação): escolhe o tipo (tocha, lanterna, fogueira, mágica), clica no mapa para colocar e ajusta cada uma. */
function LightsSection({ snapshot, onSelectStageTool }: { snapshot: RuntimeSnapshot; onSelectStageTool?: (tool: MapToolId) => void }) {
  const stage = useStageControl();
  const board = snapshot.board;
  const floorNow = Math.trunc(board.activeFloor ?? 0);
  const lightsHere = board.lights.filter((light) => Math.trunc(light.floor ?? 0) === floorNow);
  /** Clicar no tipo já cria a luz: aos pés do token selecionado ou, sem seleção, no meio do mapa. Depois é só arrastar o ícone no mapa. */
  function placeLight(preset: LightPreset) {
    setLightPreset(preset);
    const selected = board.tokens.find((token) => token.id === board.selectedTokenIds[0]);
    const x = selected ? selected.gx : Math.floor(board.map.cols / 2);
    const y = selected ? selected.gy : Math.floor(board.map.rows / 2);
    upsertLight(defaultLight(x, y, floorNow, preset));
  }
  return <div className="mesa-panel-section"><h4>LUZES · {lightsHere.length}</h4>
    <p className="mesa-module-note">Clique no tipo de luz: ela aparece aos pés do token selecionado (ou no meio do mapa) e você arrasta o ícone para onde quiser. Para uma luz que anda com o personagem, use a aura do token, no Elenco.</p>
    <div className="mesa-lighting-grid">{(Object.keys(MAP_LIGHT_PRESETS) as LightPreset[]).map((id) => <button key={id} className={stage.lightPreset === id ? "active" : ""} onClick={() => placeLight(id)}>{MAP_LIGHT_PRESETS[id].name} ({MAP_LIGHT_PRESETS[id].radius} m)</button>)}</div>
    <div className="mesa-panel-actions"><button className={stage.tool === "light" ? "active" : ""} aria-pressed={stage.tool === "light"} onClick={() => onSelectStageTool?.(stage.tool === "light" ? "select" : "light")}><Lightbulb/>{stage.tool === "light" ? "Parar de colocar" : "Colocar luz no mapa"}</button></div>
    {lightsHere.length > 0 && <div className="mesa-light-list">{lightsHere.map((light) => <div key={light.id} className="mesa-light-row">
      <input className="mesa-light-name" value={light.name} maxLength={40} aria-label="Nome da luz" onChange={(event) => upsertLight({ ...light, name: event.target.value })}/>
      <label>Alcance (m)<input type="number" min={1} max={90} step={1.5} value={light.radius} onChange={(event) => upsertLight({ ...light, radius: Math.max(1, Math.min(90, Number(event.target.value) || 1)) })}/></label>
      <label>Potência<input type="range" min={10} max={100} value={Math.round(light.intensity * 100)} onChange={(event) => upsertLight({ ...light, intensity: Number(event.target.value) / 100 })}/></label>
      <label>Cor<input type="color" value={light.color} onChange={(event) => upsertLight({ ...light, color: event.target.value })}/></label>
      <label className="mesa-check"><input type="checkbox" checked={light.enabled} onChange={(event) => upsertLight({ ...light, enabled: event.target.checked })}/><span>Acesa</span></label>
      <button title="Remover esta luz" onClick={() => removeLight(light.id)}><Trash2/>Remover</button>
    </div>)}</div>}
  </div>;
}

/** Armadilhas da cena (Ambientação): baús, itens e portas com armadilha, com o estado de cada uma, para o Mestre não precisar clicar em cada token. */
function TrapsSection({ snapshot }: { snapshot: RuntimeSnapshot }) {
  const board = snapshot.board;
  const floorNow = Math.trunc(board.activeFloor ?? 0);
  const onFloor = (entry: { floor?: number }) => Math.trunc(entry.floor ?? 0) === floorNow;
  const state = (trap: { armed: boolean; revealed?: boolean }) => (!trap.armed ? "desarmada" : trap.revealed ? "armada · descoberta pelos jogadores" : "armada · escondida");
  const rows = [
    ...board.objects.filter((object) => object.trap && onFloor(object)).map((object) => ({ id: object.id, name: object.name, where: `${OBJECT_KIND_LABEL[object.kind]} em (${object.x + 1}, ${object.y + 1})`, trap: object.trap!, open: () => openObjectDialog(object.id) })),
    ...board.walls.filter((wall) => wall.type === "door" && wall.trap && onFloor(wall)).map((wall) => ({ id: wall.id, name: wall.name || "Porta", where: `Porta em (${Math.round(wall.x1) + 1}, ${Math.round(wall.y1) + 1})`, trap: wall.trap!, open: () => openDoorDialog(wall.id) })),
  ];
  return <div className="mesa-panel-section"><h4>ARMADILHAS · {rows.length}</h4>
    {rows.length === 0 && <p className="mesa-block-empty">Nenhuma armadilha neste andar. Ao configurar um item, baú ou porta, ligue a armadilha e ela aparece aqui.</p>}
    <div className="mesa-automation-list">{rows.map((row) => <button key={row.id} onClick={row.open} title="Abrir">
      <ShieldAlert/><span><strong>{row.trap.name || "Armadilha"} · {row.name}</strong><small>{row.where} · {state(row.trap)} · Percepção {row.trap.detectDc} · Ladinagem {row.trap.disarmDc}{row.trap.damage ? ` · ${row.trap.damage}` : ""}</small></span><ChevronRight/>
    </button>)}</div>
  </div>;
}

/**
 * Mídia no palco (Mestre): guarda imagens e vídeos no navegador, aceita colar imagem da área de transferência e mostra
 * qualquer um para todos por cima do mapa. Só o Mestre fecha; o Diário registra o que foi mostrado.
 */
function StageMediaSection({ snapshot }: { snapshot: RuntimeSnapshot }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const shown = snapshot.board.stageMedia;

  useEffect(() => { void listMedia().then(setItems); }, []);
  useEffect(() => {
    const urls: Record<string, string> = {};
    for (const item of items) if (item.kind === "image") urls[item.id] = URL.createObjectURL(item.blob);
    setThumbs(urls);
    return () => { Object.values(urls).forEach((url) => URL.revokeObjectURL(url)); };
  }, [items]);

  async function addFiles(files: Array<{ blob: Blob; name: string }>) {
    setBusy(true);
    setNotice("");
    for (const { blob, name } of files) {
      try { await saveMedia(blob, name); } catch (error) { setNotice(`“${name}”: ${(error as Error).message}`); }
    }
    setItems(await listMedia());
    setBusy(false);
  }
  const pastedName = () => `Imagem colada ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

  // Ctrl+V com a gaveta aberta (fora dos campos de texto) guarda a imagem da área de transferência.
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const files = [...(event.clipboardData?.files ?? [])].filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"));
      if (!files.length) return;
      event.preventDefault();
      void addFiles(files.map((file) => ({ blob: file, name: file.name && file.name !== "image.png" ? mediaNameFromFile(file.name) : pastedName() })));
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  async function pasteFromClipboard() {
    try {
      const entries = await navigator.clipboard.read();
      const found: Array<{ blob: Blob; name: string }> = [];
      for (const entry of entries) {
        const type = entry.types.find((candidate) => candidate.startsWith("image/"));
        if (type) found.push({ blob: await entry.getType(type), name: pastedName() });
      }
      if (!found.length) { setNotice("Não há imagem na área de transferência."); return; }
      await addFiles(found);
    } catch {
      setNotice("O navegador não deixou ler a área de transferência. Clique aqui na gaveta e use Ctrl+V.");
    }
  }

  function show(item: MediaItem) {
    const check = checkMediaFile({ type: item.mime, size: item.size });
    if (!check.ok) { setNotice(check.error); return; }
    const url = URL.createObjectURL(item.blob);
    const id = registerSharedAudio(url, item.blob, item.name);
    if (!id) { setNotice("Arquivo grande demais para enviar à sala."); return; }
    try {
      showStageMedia({ id: `stage-${crypto.randomUUID()}`, kind: item.kind, name: item.name, src: `${SHARED_PREFIX}${id}`, shownAt: Date.now() });
    } catch (error) { setNotice((error as Error).message); return; }
    setNotice("");
    if (snapshot.multiplayer.role === "master") void shareAudioWithRoom(id).catch(() => setNotice("Não consegui enviar o arquivo a todos os jogadores."));
  }

  return <div className="mesa-panel-section mesa-stage-media-section"><h4>MÍDIA NA CENA</h4>
    <p className="mesa-module-note">Guarde imagens e vídeos aqui e mostre para todos por cima do mapa (vídeo toca com som para todos). Só você fecha.</p>
    {shown && <div className="mesa-stage-media-now"><strong>No palco agora:</strong><span>{shown.kind === "video" ? "Vídeo" : "Imagem"} “{shown.name}”</span><button onClick={() => { try { closeStageMedia(); } catch (error) { setNotice((error as Error).message); } }}>Fechar para todos</button></div>}
    <div className="mesa-panel-actions">
      <label><Upload/>{busy ? "Guardando…" : "Importar imagem ou vídeo"}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/ogg" multiple onChange={(event) => { const files = [...(event.target.files ?? [])]; event.target.value = ""; void addFiles(files.map((file) => ({ blob: file, name: mediaNameFromFile(file.name) }))); }}/></label>
      <button disabled={busy} onClick={() => void pasteFromClipboard()}><ClipboardPaste/>Colar imagem</button>
    </div>
    {notice && <p className="mesa-module-note" role="status">{notice}</p>}
    <div className="mesa-media-library">
      {items.length === 0 && <p className="mesa-block-empty">Nenhuma mídia guardada. Importe um arquivo ou cole uma imagem (Ctrl+V).</p>}
      {items.map((item) => <div key={item.id} className="mesa-media-card">
        <span className="mesa-media-thumb">{item.kind === "image" && thumbs[item.id] ? <img src={thumbs[item.id]} alt=""/> : item.kind === "video" ? <Film/> : <ImageIcon/>}</span>
        <div><strong title={item.name}>{item.name}</strong><small>{item.kind === "video" ? "Vídeo" : "Imagem"} · {(item.size / 1048576).toFixed(1)} MB</small></div>
        <button onClick={() => show(item)} title="Mostrar para todos"><Play/>Mostrar</button>
        <button title="Remover da biblioteca" aria-label={`Remover ${item.name}`} onClick={() => { void deleteMedia(item.id).then(async () => setItems(await listMedia())); }}><Trash2/></button>
      </div>)}
    </div>
  </div>;
}

function MapViewSection({ map, isPlayer }: { map: BattleMap; isPlayer: boolean }) {
  const control = useStageControl();
  async function importIsoArt(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const isoImage = await fileToDataUrl(file);
    if (isoImage) updateMap({ ...map, isoImage });
  }
  return <div className="mesa-panel-section"><h4>VISÃO DO MAPA</h4>
    <div className="mesa-panel-actions">
      <button className={control.view === "2d" ? "active" : ""} aria-pressed={control.view === "2d"} onClick={() => setStageView("2d")}><Grid3X3/>2D</button>
      <button className={control.view === "iso" ? "active" : ""} aria-pressed={control.view === "iso"} onClick={() => setStageView("iso")}><Shapes/>Isométrica</button>
      {control.view === "iso" && <button onClick={() => rotateStage(-1)}><Undo2/>Girar</button>}
      {control.view === "iso" && <button onClick={() => rotateStage(1)}><Redo2/>Girar</button>}
    </div>
    {control.view === "iso" && !isPlayer && <div className="mesa-panel-actions">
      <label><Upload/>{map.isoImage ? "Trocar arte isométrica" : "Arte isométrica dedicada"}<input type="file" accept="image/*" onChange={importIsoArt}/></label>
      {map.isoImage && <button onClick={() => updateMap({ ...map, isoImage: undefined })}><Trash2/>Usar projeção do mapa 2D</button>}
    </div>}
    {control.view === "iso" && <p className="mesa-module-note">{map.isoImage ? "Usando a arte isométrica dedicada deste mapa." : "O mapa 2D é projetado de uma vez em isométrico; células elevadas ganham faces laterais."} Alinhar o mapa só funciona na visão 2D.</p>}
  </div>;
}

/** Tamanho da grade e posição da imagem do mapa (só Mestre). O alinhamento fino é a ferramenta "Alinhar mapa". */
function MapGeometrySection({ map }: { map: BattleMap }) {
  const set = (partial: Partial<BattleMap>) => updateMap({ ...map, ...partial });
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(value) || min));
  return <div className="mesa-panel-section"><h4>TAMANHO E POSIÇÃO DO MAPA</h4>
    <div className="mesa-grid-settings-row">
      <label>Colunas<input type="number" min={4} max={200} value={map.cols} onChange={(event) => set({ cols: clamp(Number(event.target.value), 4, 200) })}/></label>
      <label>Linhas<input type="number" min={4} max={200} value={map.rows} onChange={(event) => set({ rows: clamp(Number(event.target.value), 4, 200) })}/></label>
    </div>
    <p className="mesa-module-note">A grade se ajusta sozinha ao mapa importado. Para alinhar a imagem, segure Ctrl e arraste o mapa (Ctrl + roda muda o tamanho da imagem).</p>
  </div>;
}

function GridSettingsSection({ grid }: { grid?: Partial<GridSettings> }) {
  const atual = gridSettings(grid);
  return <div className="mesa-panel-section"><h4>GRADE E ESCALA</h4>
    <div className="mesa-grid-settings-row">
      <label>Escala<input type="number" min={0.5} max={30} step={0.5} value={atual.scale}
        onChange={(event) => setGridSettings({ scale: Math.max(0.5, Number(event.target.value) || 1.5) })}/></label>
      <label>Unidade<input value={atual.unit} maxLength={4}
        onChange={(event) => setGridSettings({ unit: event.target.value || "m" })}/></label>
    </div>
    <label className="mesa-grid-select">Métrica de distância
      <select value={atual.distanceMode} onChange={(event) => setGridSettings({ distanceMode: event.target.value as GridSettings["distanceMode"] })}>
        {(Object.keys(DISTANCE_MODE_LABEL) as Array<GridSettings["distanceMode"]>).map((mode) => (
          <option key={mode} value={mode}>{DISTANCE_MODE_LABEL[mode]}</option>
        ))}
      </select>
    </label>
    <label className="mesa-grid-select">Formato da grade
      <select value={atual.type} onChange={(event) => setGridSettings({ type: event.target.value as GridSettings["type"] })}>
        <option value="square">Quadrada</option>
        <option value="hex">Hexagonal</option>
      </select>
    </label>
    <p className="mesa-module-note">1 quadrado = {atual.scale} {atual.unit}. Vale para régua, movimento, alcance e áreas ao mesmo tempo.</p>
  </div>;
}

/** Andares (Vtt: selecionarPatamar). A cena mostra um andar por vez. */
function FloorSection({ board, isPlayer }: { board: RuntimeSnapshot["board"]; isPlayer: boolean }) {
  const andares = floorsOf(board);
  const ativo = activeFloor(board);
  const selected = board.tokens.find((token) => token.id === board.selectedTokenIds[0]);
  const [destination, setDestination] = useState(selected?.floor ?? ativo);
  if (andares.length <= 1 && ativo === 0 && !andares.some((f) => f.tokens || f.walls || f.lights || f.shapes || f.objects)) {
    // Cena de um andar so: nao poluir a UI com um seletor inutil.
    return null;
  }
  return <div className="mesa-panel-section"><h4>ANDARES</h4>
    <div className="mesa-floor-list">{andares.map((andar) => (
      <button key={andar.index} className={andar.index === ativo ? "active" : ""}
        disabled={isPlayer} onClick={() => setActiveFloor(andar.index)}>
        <strong>{andar.label}</strong>
        <small>{andar.tokens} tokens · {andar.walls} barreiras · {andar.lights} luzes · {andar.objects} objetos</small>
      </button>
    ))}</div>
    {selected && !isPlayer && <label className="mesa-panel-field"><span>Mover {selected.name} para o andar</span><div>
      <input type="number" value={destination} onChange={(event) => setDestination(Math.trunc(Number(event.target.value) || 0))}/>
      <button onClick={() => moveTokenToFloor(selected.id, destination)}>Mover</button>
    </div></label>}
  </div>;
}

/** Viagem e passagem de dia (Vtt: avancarDia). Contador de cena, nao campanha. */
/** Ferramenta de mestre: contador de viagem e Encontro aleatório (ambiente + patamar do grupo → descrição e tokens das ameaças). */
/** Limpar a mesa: dois passos (botão e confirmação) para não apagar sem querer; "Desfazer" traz de volta. */
function ClearTableSection({ snapshot }: { snapshot: RuntimeSnapshot }) {
  const [asking, setAsking] = useState<"tokens" | "tudo" | null>(null);
  const isPlayer = snapshot.multiplayer.role === "player";
  const run = (what: "tokens" | "tudo") => { try { clearTable(what); } catch (error) { appendChat({ author: "Sistema", text: (error as Error).message, kind: "system" }); } setAsking(null); };
  return <div className="mesa-panel-section"><h4>LIMPAR A MESA</h4>
    <p className="mesa-module-note">{snapshot.board.tokens.length} token(s), {snapshot.board.objects.length} objeto(s), {snapshot.board.lights.length} luz(es) na cena. O mapa e as paredes não mudam.</p>
    {asking === null
      ? <div className="mesa-panel-actions">
        <button disabled={isPlayer} onClick={() => setAsking("tokens")}><Trash2/>Limpar tokens</button>
        <button disabled={isPlayer} onClick={() => setAsking("tudo")}><Trash2/>Limpar tudo</button>
      </div>
      : <div className="mesa-panel-actions">
        <button className="active" onClick={() => run(asking)}><Trash2/>Confirmar: {asking === "tokens" ? "apagar os tokens" : "apagar tokens, objetos, áreas e luzes"}</button>
        <button onClick={() => setAsking(null)}>Cancelar</button>
      </div>}
  </div>;
}

function MasterPanel({ snapshot, onSpawnThreats, onSpawnNpc }: { snapshot: RuntimeSnapshot; onSpawnThreats?: (template: ThreatTemplate, count: number) => void; onSpawnNpc?: (name: string) => void }) {
  const [online, setOnline] = useState(false);
  const [ambiente, setAmbiente] = useState("Floresta");
  const [patamar, setPatamar] = useState<PatamarId>("iniciante");
  const [resultado, setResultado] = useState<{ encontro: EncontroSorteado; ameacas: AmeacaDoEncontro<ThreatTemplate>[] } | null>(null);
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const travel = travelState(snapshot.board.travel);
  const chance = encounterChance(travel.days);

  function sortear() {
    const encontro = sortearEncontro(ambiente, patamar);
    setResultado({ encontro, ameacas: ameacasNaDescricao(encontro.descricao, listThreats()) });
    setQuantidades({});
    return encontro;
  }
  /** "Passar o dia": rola o d100 contra a chance; com encontro, sorteia o que apareceu e mostra no palco, para todos. */
  function testarSorte() {
    const dia = travel.done + 1;
    const { rolagem, encontro } = testarSorteDaViagem(chance);
    if (encontro) {
      resetTravelEncounter();
      appendChat({ author: "Viagem", text: `Perigo no dia ${dia}! Rolou ${rolagem} contra ${chance}%: houve encontro.`, kind: "system" });
      const sorteado = sortear();
      try { showTravelEvent({ day: dia, title: "Houve um encontro!", text: sorteado.descricao.replace(/\*+/g, ""), pag: sorteado.pag }); } catch { /* só o Mestre */ }
    } else {
      advanceTravelDay();
      appendChat({ author: "Viagem", text: `Dia ${dia} pacífico (rolou ${rolagem} contra ${chance}%).`, kind: "system" });
    }
  }
  const npcName = resultado ? resultado.encontro.descricao.replace(/^\d+(?:d\d+(?:\s*\+\s*\d+)?)?\s+/i, "").replace(/\*+/g, "").trim() : "";
  const npcLabel = npcName ? npcName.charAt(0).toUpperCase() + npcName.slice(1, 40) : "Viajante";

  if (online) return <div className="mesa-panel-stack">
    <div className="mesa-panel-actions"><button onClick={() => setOnline(false)}><ChevronRight style={{ transform: "rotate(180deg)" }}/>Ferramenta de mestre</button></div>
    <OnlinePanel snapshot={snapshot}/>
  </div>;
  return <div className="mesa-panel-stack">
    <div className="mesa-automation-list">
      <button onClick={() => setOnline(true)}><Radio/><span><strong>Sala online</strong><small>{snapshot.multiplayer.status === "connected" ? "Conectada" : "Criar ou entrar numa sala por código"}</small></span><ChevronRight/></button>
    </div>
    <TravelSection travel={snapshot.board.travel} scenes={snapshot.scenes} onPassDay={testarSorte}/>
    <ClearTableSection snapshot={snapshot}/>
    <div className="mesa-panel-section"><h4>ENCONTRO ALEATÓRIO</h4>
      <label className="mesa-grid-select">Ambiente ou região
        <select value={ambiente} onChange={(event) => setAmbiente(event.target.value)}>
          <optgroup label="Terrenos">{GRUPOS_DE_AMBIENTE.terrenos.map((nome) => <option key={nome} value={nome}>{nome}</option>)}</optgroup>
          <optgroup label="Regiões de Arton">{GRUPOS_DE_AMBIENTE.regioes.map((nome) => <option key={nome} value={nome}>{nome}</option>)}</optgroup>
        </select>
      </label>
      <label className="mesa-grid-select">Patamar do grupo
        <select value={patamar} onChange={(event) => setPatamar(event.target.value as PatamarId)}>
          {PATAMARES.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
        </select>
      </label>
      <div className="mesa-panel-actions"><button onClick={sortear}><Dices/>Sortear encontro</button></div>
      {resultado && <div className="mesa-encounter-result">
        <small>{resultado.encontro.ambiente} · d100 {resultado.encontro.rolagem}{resultado.encontro.total !== resultado.encontro.rolagem ? ` + ${resultado.encontro.total - resultado.encontro.rolagem} = ${resultado.encontro.total}` : ""}</small>
        <strong>{resultado.encontro.descricao}</strong>
        {resultado.encontro.pag && <em>{resultado.encontro.pag}</em>}
        {resultado.ameacas.map(({ template, quantidade, formula }) => {
          const quantos = quantidades[template.id] ?? quantidade;
          return <div key={template.id} className="mesa-encounter-threat">
            <span className="mesa-mini-portrait">{template.portrait ? <img src={template.portrait} alt=""/> : template.symbol}</span>
            <div><strong>{template.name}</strong><small>{formula ? `${formula} → ${quantidade} · ` : ""}PV {template.pv} · DEF {template.defense}</small></div>
            <input type="number" min={1} max={20} value={quantos} aria-label={`Quantidade de ${template.name}`} onChange={(event) => setQuantidades((current) => ({ ...current, [template.id]: Math.max(1, Math.min(20, Number(event.target.value) || 1)) }))}/>
            <button onClick={() => onSpawnThreats?.(template, quantos)}><Plus/>Adicionar</button>
          </div>;
        })}
        <div className="mesa-panel-actions">
          {resultado.ameacas.length === 0 && <button onClick={() => onSpawnNpc?.(npcLabel)}><Plus/>Criar token “{npcLabel}”</button>}
          <button onClick={() => appendChat({ author: "Encontro", text: `${resultado.encontro.ambiente}: ${resultado.encontro.descricao}${resultado.encontro.pag ? ` (${resultado.encontro.pag})` : ""}`, kind: "system" })}><Send/>Anunciar aos jogadores</button>
        </div>
      </div>}
    </div>
  </div>;
}

/** Biblioteca de tokens: importar imagens de miniatura e colocá-las no mapa. */
/** Tokens: a caixa com os tokens da pessoa; o primeiro lugar, fixo, é o "+" que abre a janela Novo token. */
function TokensPanel({ onAddLibraryToken }: Props) {
  const [items, setItems] = useState<LibraryToken[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<LibraryToken | "new" | null>(null);
  const account = hasAccount();
  const localOnly = items.filter((item) => !item.cloud).length;
  useEffect(() => {
    let alive = true;
    void listLibraryTokens().then((list) => { if (alive) setItems(list); });
    return () => { alive = false; };
  }, []);
  async function sendToAccount() {
    setBusy(true);
    const result = await syncLibraryToAccount();
    setNotice(result.error ? `${result.sent} enviado(s); parou em: ${result.error}` : `${result.sent} token(s) enviado(s) para a conta.`);
    setItems(await listLibraryTokens());
    setBusy(false);
  }
  const [catalogRevision, setCatalogRevision] = useState(0);
  // O Mestre também pode ligar um token aos heróis prontos do playtest, mesmo fora da campanha.
  const sheets = useMemo(() => [...loadCharacterSheets(), ...(getRuntimeSnapshot().multiplayer.role !== "player" ? loadReadyHeroSheets() : [])], [catalogRevision]);
  const threatList = useMemo(() => listThreats().filter((threat) => !threat.hidden), [catalogRevision]);
  /** Guarda o token vindo da janela (novo ou editado). Editar troca o antigo, na conta também. */
  async function saveFromDialog(next: LibraryToken, place: boolean) {
    const old = items.find((entry) => entry.id === next.id);
    if (old) await deleteLibraryToken(old.id);
    const fresh: LibraryToken = { ...next, id: old ? `tok-${crypto.randomUUID()}` : next.id, cloud: undefined };
    const result = await saveLibraryToken(fresh);
    setNotice(result.error ? `“${fresh.name}” ficou só neste navegador: ${result.error}` : "");
    setItems(await listLibraryTokens());
    setEditing(null);
    if (place) onAddLibraryToken?.(fresh);
  }
  async function removeItem(id: string) {
    await deleteLibraryToken(id);
    setItems(await listLibraryTokens());
  }
  return <div className="mesa-panel-stack mesa-token-stack">
    <p className="mesa-block-empty">Seus tokens ficam nesta caixa. {account ? "Você está logado: os tokens novos vão para a sua conta e aparecem em qualquer navegador." : "Sem login, os tokens ficam só neste navegador. Entre na sua conta no Portal para guardá-los na conta."}</p>
    {account && localOnly > 0 && <div className="mesa-panel-actions"><button disabled={busy} onClick={() => void sendToAccount()}><Upload/>Enviar {localOnly} token(s) deste navegador para a conta</button></div>}
    {notice && <p className="mesa-block-empty" role="status">{notice}</p>}
    <div className="mesa-token-library">
      <button className="mesa-token-add" aria-label="Novo token" title="Criar um novo token" onClick={() => setEditing("new")}><Plus/><span>Novo token</span></button>
      {items.map((item) => <div key={item.id} className="mesa-token-card">
        <button className="mesa-token-portrait" title="Editar token" aria-label={`Editar ${item.name}`} onClick={() => setEditing(item)}><img src={item.image} alt=""/></button>
        <strong title={item.name}>{item.name}{item.cloud ? " ☁" : ""}</strong>
        <div><button onClick={() => onAddLibraryToken?.(item)} title="Colocar no mapa"><Plus/>Mapa</button><button title="Remover da biblioteca" aria-label={`Remover ${item.name}`} onClick={() => void removeItem(item.id)}><Trash2/></button></div>
      </div>)}
    </div>
    {editing && <TokenEditorDialog token={editing === "new" ? undefined : editing} sheets={sheets} threats={threatList} onClose={() => setEditing(null)} onSave={saveFromDialog} onCatalogChanged={() => setCatalogRevision((value) => value + 1)}/>}
  </div>;
}

/**
 * Viagem (Ferramenta de mestre): define quantos dias dura a viagem, mostra em que dia estão, escolhe o mapa do encontro e
 * "passa o dia" testando a sorte; quando há encontro, ele aparece no palco para todos.
 */
function TravelSection({ travel, scenes, onPassDay }: { travel?: TravelState; scenes: SceneState[]; onPassDay: () => void }) {
  const atual = travelState(travel);
  const [dias, setDias] = useState(String(atual.planned || 7));
  const chance = encounterChance(atual.days);
  const ativa = atual.planned > 0;
  const terminou = ativa && atual.done >= atual.planned;
  return <div className="mesa-panel-section"><h4>VIAGEM</h4>
    <div className="mesa-travel-plan">
      <label>Duração da viagem (dias)<input type="number" min={1} max={365} value={dias} onChange={(event) => setDias(event.target.value)}/></label>
      <button onClick={() => startTravel(Number(dias) || 1, atual.sceneId)}><Play/>{ativa ? "Reiniciar viagem" : "Iniciar viagem"}</button>
    </div>
    <label className="mesa-grid-select">Mapa do encontro (cenário)
      <select value={atual.sceneId ?? ""} onChange={(event) => setTravelScene(event.target.value || undefined)}>
        <option value="">Nenhum (ficar no mapa atual)</option>
        {groupScenes(scenes).map((group) => <optgroup key={group.name} label={group.name}>{group.scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.name}</option>)}</optgroup>)}
      </select>
    </label>
    <div className="mesa-travel-stats">
      <span><b>{ativa ? `${atual.done}/${atual.planned}` : "—"}</b><small>{ativa ? "dias da viagem" : "sem viagem marcada"}</small></span>
      <span><b>{atual.days}</b><small>dias sem encontro</small></span>
      <span><b>{chance}%</b><small>chance hoje</small></span>
    </div>
    <div className="mesa-panel-actions mesa-travel-pass"><button disabled={terminou} onClick={onPassDay}><Dices/>{terminou ? "Viagem concluída" : `Passar o dia e testar a sorte (${chance}%)`}</button></div>
    {terminou && <p className="mesa-module-note">Chegaram ao destino. Inicie outra viagem para continuar.</p>}
  </div>;
}

const STAGE_TOOLS: Array<{ id: MapToolId; title: string; detail: string; icon: LucideIcon; masterOnly?: boolean }> = [
  { id: "terrain", title: "Terreno", detail: "Pinte terreno difícil, bloqueado ou elevação.", icon: Map, masterOnly: true },
];

function weatherLabel(weather: WeatherType) { return ({ clear: "Limpo", rain: "Chuva", snow: "Neve", embers: "Cinzas", fog: "Névoa", tormenta: "Tormenta", storm: "Tempestade" })[weather]; }
