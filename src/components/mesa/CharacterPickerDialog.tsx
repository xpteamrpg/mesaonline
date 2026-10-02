import { ExternalLink, ScrollText, X } from "lucide-react";
import { createPortal } from "react-dom";
import type { CharacterSheet } from "../../../ficha-modernrpg/sheet";
import type { BoardToken } from "../../game/types";

/**
 * "Meus personagens": abre pelo ícone do perfil, no canto de cima. A pessoa escolhe qual personagem vai usar e o painel
 * do personagem (o resumo da ficha) passa a mostrar esse. O Mestre vê um "M" dourado no lugar do retrato.
 */
interface Props {
  sheets: CharacterSheet[];
  tokens: BoardToken[];
  isMaster: boolean;
  /** `CharacterSheet.id` do personagem em uso agora */
  currentId?: string;
  onPick: (sheet: CharacterSheet) => void;
  onOpenPortalSheet: (sheet: CharacterSheet) => void;
  onOpenPortalList: () => void;
  onClose: () => void;
  /** Heróis prontos (fichas-modelo do playtest), oferecidos só ao Mestre */
  readySheets?: CharacterSheet[];
}

export default function CharacterPickerDialog({ sheets, tokens, isMaster, currentId, onPick, onOpenPortalSheet, onOpenPortalList, onClose, readySheets = [] }: Props) {
  const renderRow = (sheet: CharacterSheet, ready = false) => {
    const token = tokens.find((entry) => entry.modernRpgCharacterId === sheet.id);
    const current = sheet.id === currentId;
    return (
      <div key={sheet.id} className={`mesa-char-row ${current ? "current" : ""}`}>
        <button type="button" className="mesa-char-pick" onClick={() => onPick(sheet)}>
          <span className="mesa-char-avatar">{sheet.avatar ? <img src={sheet.avatar} alt=""/> : <ScrollText/>}</span>
          <span className="mesa-char-copy">
            <strong>{sheet.name}</strong>
            <small>{[sheet.race, sheet.class].filter(Boolean).join(" · ")} · Nv {sheet.level}</small>
            <i>PV {sheet.hp.current}/{sheet.hp.max} · PM {sheet.mp.current}/{sheet.mp.max}</i>
          </span>
          <em>{current ? "Em uso" : token ? "No mapa" : ready ? "Adicionar à mesa" : "Usar"}</em>
        </button>
        {!ready && <button type="button" className="mesa-char-sheet" title="Abrir a ficha completa no Portal" aria-label={`Ficha completa de ${sheet.name}`} onClick={() => onOpenPortalSheet(sheet)}><ExternalLink/></button>}
      </div>
    );
  };
  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="dialog mesa-char-dialog" role="dialog" aria-label="Meus personagens">
        <header className="mesa-token-dialog-head">
          <div className="mesa-char-head">
            {isMaster && <span className="mesa-master-badge" title="Você é o Mestre">M</span>}
            <div><small>{isMaster ? "MESTRE" : "JOGADOR"}</small><h2>Meus personagens</h2></div>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose}><X/></button>
        </header>
        <p className="mesa-module-note">Escolha o personagem que você vai usar. O painel da direita mostra o resumo da ficha dele.</p>
        <div className="mesa-char-list">
          {sheets.length === 0 && <p className="mesa-block-empty">Nenhum personagem ainda. Crie ou importe um na Oficina de Heróis do Portal.</p>}
          {sheets.map((sheet) => renderRow(sheet))}
          {isMaster && readySheets.length > 0 && (
            <>
              <p className="mesa-module-note">Heróis prontos do playtest (só o Mestre vê): use o token deles à vontade, mesmo sem estarem na campanha.</p>
              {readySheets.map((sheet) => renderRow(sheet, true))}
            </>
          )}
        </div>
        <footer className="mesa-token-dialog-foot">
          <button type="button" onClick={onOpenPortalList}>Gerenciar personagens no Portal</button>
          <button type="button" onClick={onClose}>Fechar</button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
