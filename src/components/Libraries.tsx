import { Map as MapIcon, Plus, ScrollText, Trash2, Upload, X } from "lucide-react";
import { type ChangeEvent, useMemo, useState } from "react";
import type { CharacterSheet } from "../../ficha-modernrpg/sheet";
import { loadCharacterSheets } from "../../ficha-modernrpg/characterRoute";
import type { BattleMap, TerrainType, ThreatTemplate } from "../game/types";
import { importCharacterSheet } from "../game/importers";
import CustomThreatForm from "./tactics/CustomThreatForm";
import { openPortalRoute } from "../portalLink";

interface BaseProps { open: boolean; onClose: () => void; }

/** Ataques e habilidades da ameaça (do catálogo: ataques, qualidades, ações, reações), para ler sem adicionar ao mapa. Só monta ao abrir. */
function ThreatDetails({ template }: { template: ThreatTemplate }) {
  const [open, setOpen] = useState(false);
  const attacks = open ? (template.customActions ?? []).filter((action) => action.category === "weapon" && !action.charge) : [];
  const abilities = template.abilities ?? [];
  return <details className="threat-details" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>Ataques e habilidades ({abilities.length} habilidade{abilities.length === 1 ? "" : "s"})</summary>
    {open && <div className="threat-details-body">
      <h4>Ataques</h4>
      {attacks.length === 0 ? <p>Sem ataque listado.</p> : <ul>{attacks.map((action) => <li key={action.id}><strong>{action.name}</strong>{action.attackBonus !== undefined ? ` ${action.attackBonus >= 0 ? "+" : ""}${action.attackBonus}` : ""} · {action.damage || "sem dano"}{action.crit && action.crit < 20 ? ` · crítico ${action.crit}${action.critMultiplier ? `/x${action.critMultiplier}` : ""}` : action.critMultiplier && action.critMultiplier !== 2 ? ` · x${action.critMultiplier}` : ""}</li>)}</ul>}
      <h4>Habilidades</h4>
      {abilities.length === 0 ? <p>Sem habilidades listadas.</p> : <ul>{abilities.map((ability, index) => <li key={`${ability.name}-${index}`}><strong>{ability.name}</strong>{ability.type ? ` (${ability.type})` : ""}{ability.description ? `: ${ability.description}` : ""}</li>)}</ul>}
    </div>}
  </details>;
}

export function CharacterLibraryDialog({ open, onClose, onAdd }: BaseProps & { onAdd: (sheet: CharacterSheet) => void }) {
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const sheets = useMemo(() => loadCharacterSheets(), [revision, open]);
  if (!open) return null;
  function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { try { const data = JSON.parse(String(reader.result)); const sheet = importCharacterSheet(Array.isArray(data) ? data[0] : data); setError(""); setRevision((value) => value + 1); onAdd(sheet); } catch (cause) { setError((cause as Error).message); } };
    reader.readAsText(file);
    event.target.value = "";
  }
  return <Dialog eyebrow="PERSONAGENS" title="Personagens da mesa" subtitle="Escolha um herói da campanha ou importe uma ficha nova." onClose={onClose}>
    <div className="character-dialog-grid">
      <section>
        <div className="dialog-section-title"><strong>Personagens da campanha</strong><small>{sheets.length} fichas</small></div>
        <div className="character-library-list">
          {sheets.map((sheet) => <article key={sheet.id} className="character-library-item">
            <span className="character-avatar">{sheet.avatar ? <img src={sheet.avatar} alt=""/> : <ScrollText size={18}/>}</span>
            <span><strong>{sheet.name}</strong><small>{sheet.race} · {sheet.class} · Nv {sheet.level}</small><i>PV {sheet.hp.current}/{sheet.hp.max} · PM {sheet.mp.current}/{sheet.mp.max}</i></span>
            <button className="spawn-threat" onClick={() => onAdd(sheet)}><Plus size={14}/>Adicionar</button>
          </article>)}
          {!sheets.length && <div className="empty-sheet-preview">Nenhuma ficha ainda. Crie na Oficina de Heróis ou importe ao lado.</div>}
        </div>
      </section>
      <section className="character-import-panel">
        <div className="dialog-section-title"><strong>Adicionar personagem</strong><small>JSON ou PDF</small></div>
        <div className="sheet-drop-row">
          <label className="sheet-json-drop"><Upload size={20}/><strong>Importar JSON</strong><small>ficha do ModernRPG ou do VTT</small><input type="file" accept="application/json,.json" onChange={importJson}/></label>
          <button className="sheet-portrait-drop" onClick={() => openPortalRoute("personagens")}><ScrollText size={20}/><small>PDF no Portal</small></button>
        </div>
        <div className="sheet-data-note"><strong>Como funciona</strong><span>O herói importado entra na lista da campanha e vai para o mapa. Fichas em PDF são lidas pelo Portal (Personagens → Importar PDF).</span></div>
        {error && <p className="dialog-error">{error}</p>}
      </section>
    </div>
  </Dialog>;
}

export function ThreatLibraryDialog({ open, templates, onClose, onSpawn, onCatalogChanged, onDelete }: BaseProps & { templates: ThreatTemplate[]; onSpawn: (template: ThreatTemplate) => void; onCatalogChanged?: () => void; onDelete?: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  // Mostra 60 de cada vez: desenhar 200 cartões com imagem de uma vez travava o celular.
  const [limit, setLimit] = useState(60);
  if (!open) return null;
  const visible = templates.filter((template) => !template.hidden);
  const needle = query.trim().toLowerCase();
  const shown = visible.filter((template) => `${template.name} ${template.title}`.toLowerCase().includes(needle));
  const page = shown.slice(0, limit);
  // Bestiário: lista do compêndio à esquerda e o formulário "Nova ameaça" (imagem, JSON, ND, atributos) à direita.
  return <Dialog eyebrow="BESTIÁRIO T20" title="Bestiário" subtitle="Importe uma ficha, escolha a criatura e posicione-a no tabuleiro." onClose={onClose}>
    <div className="threat-dialog-grid">
      <section>
        <div className="dialog-section-title"><strong>Compêndio ModernRPG</strong><small>{visible.length} ameaças</small></div>
        <label className="field-label library-search"><input value={query} onChange={(event) => { setQuery(event.target.value); setLimit(60); }} placeholder="Buscar por nome, tipo ou ND..." aria-label="Buscar ameaça"/></label>
        {error && <p className="dialog-error" role="alert">{error}</p>}
        <div className="threat-list">{page.map((template) => <article key={template.id} className="threat-item">
          <span className="threat-avatar">{template.portrait ? <img src={template.portrait} alt="" loading="lazy" decoding="async"/> : template.symbol}</span>
          <span className="threat-item-copy"><strong>{template.name}</strong><small>{template.title}</small><i>PV {template.pv} | DEF {template.defense} | {template.damage}</i>
            <ThreatDetails template={template}/><em>{template.actionCount ?? template.customActions?.length ?? 0} ações interpretadas{template.treasure ? ` · tesouro: ${template.treasure.length > 60 ? `${template.treasure.slice(0, 60)}…` : template.treasure}` : ""}</em></span>
          <button className="spawn-threat" onClick={() => onSpawn(template)}><Plus size={14}/>Adicionar</button>
          {template.custom && onDelete ? <button className="delete-template" aria-label={`Remover ${template.name}`} onClick={() => onDelete(template.id)}><Trash2 size={14}/></button> : <span/>}
        </article>)}
        {shown.length === 0 && <div className="empty-sheet-preview">Nenhuma ameaça encontrada.</div>}
        {shown.length > page.length && <button type="button" className="spawn-threat" onClick={() => setLimit((value) => value + 60)}>Mostrar mais ({shown.length - page.length})</button>}</div>
      </section>
      {onCatalogChanged && <CustomThreatForm onCreated={() => { setError(""); onCatalogChanged(); }} onError={setError}/>}
    </div>
  </Dialog>;
}

export function MapLibraryDialog({ open, maps, currentMapId, onClose, onChoose, onAdd, onEditTerrain, terrainBrush, setTerrainBrush }: BaseProps & { maps: BattleMap[]; currentMapId: string; onChoose: (map: BattleMap) => void; onAdd: (map: BattleMap) => void; onEditTerrain?: () => void; terrainBrush?: TerrainType; setTerrainBrush?: (value: TerrainType) => void }) {
  if (!open) return null;
  function importImage(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => onAdd({ id: `map-${crypto.randomUUID()}`, name: file.name.replace(/\.[^.]+$/, ""), location: "Mapa importado", image: String(reader.result), cols: 20, rows: 20, terrain: {}, custom: true }); reader.readAsDataURL(file); }
  return <Dialog eyebrow="MAPAS" title="Mapas e cenas" subtitle="A mesma cena em 2D e isométrico" onClose={onClose}><label className="save-import"><Upload/>Importar mapa<input hidden type="file" accept="image/*" onChange={importImage}/></label><div className="map-cards">{maps.map((map) => <button key={map.id} className={map.id === currentMapId ? "active" : ""} onClick={() => onChoose(map)}>{map.image ? <img src={map.image} alt=""/> : <MapIcon/>}<strong>{map.name}</strong></button>)}</div>{onEditTerrain && <div><select value={terrainBrush} onChange={(event) => setTerrainBrush?.(event.target.value as TerrainType)}><option value="blocked">Bloqueado</option><option value="difficult">Difícil</option><option value="cover">Cobertura</option><option value="elevated">Elevação</option></select><button onClick={onEditTerrain}>Editar terreno</button></div>}</Dialog>;
}

function Dialog({ eyebrow, title, subtitle, onClose, children }: { eyebrow: string; title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="dialog-backdrop"><section className="dialog wide" role="dialog" aria-label={title}><header className="dialog-header"><div><span>{eyebrow}</span><h2>{title}</h2><p>{subtitle}</p></div><button onClick={onClose} aria-label="Fechar"><X/></button></header>{children}</section></div>;
}
