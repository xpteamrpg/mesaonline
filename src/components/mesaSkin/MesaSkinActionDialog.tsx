import { CONDITION_NAMES, conditionDescription } from "../../game/conditionInfo";
import { Backpack, Bot, Footprints, Shield, Sparkles, Swords, WandSparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { actionsForToken } from "../../game/actions";
import { canControlToken } from "../../game/permissions";
import type { BoardState, GameAction, RuntimeSnapshot, TacticalUnitView } from "../../game/types";
import { appendChat, updateToken } from "../../game/vttBridge";
import { runAiTurn } from "../../tactics/engine/ai";
import { hasLineOfEffect, rangeM } from "../../tactics/engine/targeting";
import { executeTacticalAction } from "../../tactics/engine/runtimeCommands";
import { type AugmentChoice, type CastPlan, ELEMENTS, buildCastInfo, computeCastPlan, findSpellEntry, normalizeAugments, spellKeyOf } from "../../tactics/interpretation/spellCasting";
import { parseRangeM } from "../../tactics/interpretation/modernRpgRules";
import { castCircleContext, isRacialSpell } from "../../tactics/interpretation/castContext";
import { spellAllowsTarget } from "../../tactics/interpretation/spellTargeting";

type Mode = "actions" | "magic" | "items" | "conditions";

export type MesaSkinActionDialogProps = {
  mode: Mode;
  snapshot: RuntimeSnapshot;
  units: TacticalUnitView[];
  onClose: () => void;
  onArmMove: () => void;
  onArmAreaAction: (action: GameAction, augment?: AugmentChoice) => void;
  /** alvo único: a escolha é feita clicando no token no mapa (sem janela de lista) */
  onArmTargetAction: (action: GameAction, augment?: AugmentChoice) => void;
  /** Ação escolhida por uma hotkey: já abre com ela selecionada. */
  preselectActionId?: string | null;
};

// Catálogo completo de condições (texto do legado) + "Amedrontado", usado na mesa como estado de medo.
const CONDITION_SUGGESTIONS = [...CONDITION_NAMES, "Amedrontado"].sort((x, y) => x.localeCompare(y, "pt-BR"));

/**
 * Interaction-only dialog for the supplied skin. It delegates every mutation
 * to the existing combat/runtime commands and deliberately does not replace
 * the table's visual layout while closed.
 */
export default function MesaSkinActionDialog({ mode, snapshot, units, onClose, onArmMove, onArmAreaAction, onArmTargetAction, preselectActionId }: MesaSkinActionDialogProps) {
  const selectedToken = snapshot.board.tokens.find((token) => token.id === snapshot.board.selectedTokenIds[0]);
  const isPlayer = snapshot.multiplayer.role === "player";
  // O jogador age com o token que controla (mesmo fora do turno, para reagir); Mestre/local seguem o turno ativo.
  const actorId = isPlayer && selectedToken && canControlToken(snapshot.multiplayer, selectedToken)
    ? selectedToken.id
    : snapshot.combat.activeTokenId || snapshot.board.selectedTokenIds[0] || "";
  const actor = snapshot.board.tokens.find((token) => token.id === actorId);
  const actorUnit = units.find((unit) => unit.id === actorId);
  const [targeting, setTargeting] = useState<{ action: GameAction; augment?: AugmentChoice; maxTargets: number } | null>(null);
  const [cast, setCast] = useState<{ action: GameAction; counts: Record<number, number>; weaponId?: string; element?: string } | null>(null);
  const [pending, setPending] = useState<{ action: GameAction; targetIds: string[]; augment?: AugmentChoice } | null>(null);
  const [condition, setCondition] = useState("");
  const canControl = Boolean(actor && canControlToken(snapshot.multiplayer, actor));
  const activeTurn = Boolean(actor && snapshot.combat.active && snapshot.combat.activeTokenId === actor.id);
  const { actions, reactions } = useMemo(() => {
    if (!actor) return { actions: [] as GameAction[], reactions: [] as GameAction[] };
    const all = actionsForToken(actor);
    const byMode = mode === "magic" ? all.filter((action) => action.category === "spell")
      : mode === "items" ? all.filter((action) => action.category === "item")
        // Poderes passivos (categoria "special") não são ações: ficam na aba Poderes do painel.
        : all.filter((action) => ["weapon", "power"].includes(action.category));
    // Reações têm lugar próprio (V3): valem fora do turno e não entram na lista comum.
    return {
      actions: byMode.filter((action) => action.kind !== "reaction"),
      reactions: mode === "actions" ? all.filter((action) => action.kind === "reaction") : [],
    };
  }, [actor, mode]);
  const combatOn = snapshot.combat.active;
  const reactionOnly = combatOn && !activeTurn && reactions.length > 0 && mode === "actions";
  const aiTurn = !isPlayer && activeTurn && actor?.side === "threats" && mode === "actions";

  function fail(message: string) {
    appendChat({ author: "Sistema", text: message, kind: "system" });
  }

  function chooseAction(action: GameAction) {
    if (!actor || !canControl || (!activeTurn && action.kind !== "reaction")) return;
    // Magia do catálogo com aprimoramentos: escolhe-os antes do alvo, mesmo em magia pessoal ou de área (V3: página "cast").
    const entry = action.category === "spell" ? findSpellEntry(action) : null;
    if (entry && normalizeAugments(entry).length) {
      setCast({ action, counts: {} });
      return;
    }
    if (action.target === "self") {
      run(action, [actor.id]);
      return;
    }
    if (action.target === "area" || action.target === "cell") {
      onArmAreaAction(action);
      onClose();
      return;
    }
    onArmTargetAction(action);
    onClose();
  }

  // Hotkey de ataque ou poder: escolhe a ação assim que o diálogo abre (o alvo é indicado em seguida).
  useEffect(() => {
    if (!preselectActionId || !actor) return;
    const wanted = actionsForToken(actor).find((candidate) => candidate.id === preselectActionId);
    if (!wanted) { fail("Essa ação não está mais disponível na ficha."); onClose(); return; }
    if (wanted.pmCost > actor.pm) { fail(`PM insuficiente para ${wanted.name}.`); onClose(); return; }
    chooseAction(wanted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectActionId]);

  function runAi() {
    if (!actor) return;
    try {
      const report = runAiTurn(actor.id);
      appendChat({ author: "IA", text: report.steps.join(" "), kind: "system" });
      onClose();
    } catch (error) {
      fail((error as Error).message);
    }
  }

  function run(action: GameAction, targetIds: string[], augment?: AugmentChoice) {
    if (!actor) return;
    try {
      executeTacticalAction(actor.id, action.id, targetIds, null, augment || null);
      onClose();
    } catch (error) {
      fail((error as Error).message);
    }
  }

  function addCondition() {
    const value = condition.trim();
    if (!actor || !value || !canControl) return;
    updateToken(actor.id, { conditions: Array.from(new Set([...(actor.conditions || []), value])) });
    setCondition("");
  }

  function removeCondition(value: string) {
    if (!actor || !canControl) return;
    updateToken(actor.id, { conditions: (actor.conditions || []).filter((entry) => entry !== value) });
  }

  function renderAction(action: GameAction) {
    return <button key={action.id} type="button" onClick={() => chooseAction(action)} disabled={!actor || action.pmCost > actor.pm}>
      <span className={action.category}><IconForAction action={action}/></span>
      <span><strong>{action.name}</strong><small>{action.description}</small><em>{action.rangeM} m · {action.pmCost} PM</em></span>
    </button>;
  }

  const title = mode === "magic" ? "Magias" : mode === "items" ? "Itens" : mode === "conditions" ? "Condições" : "Ações";
  const Icon = mode === "magic" ? WandSparkles : mode === "items" ? Backpack : mode === "conditions" ? Shield : Swords;

  return (
    <div className="mesa-skin-action-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="mesa-skin-action-dialog scroll-tray" role="dialog" aria-modal="true" aria-label={`${title} de combate`} onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <span><Icon size={18}/></span>
          <div><small>COMBATE ATIVO</small><strong>{title}{actorUnit ? ` · ${actorUnit.name}` : ""}</strong></div>
          <button type="button" onClick={onClose} aria-label="Fechar"><X size={18}/></button>
        </header>

        {!actor || !actorUnit ? <p className="mesa-skin-dialog-note">Selecione um participante do combate antes de usar esta ação.</p> : !canControl ? <p className="mesa-skin-dialog-note">Você não controla {actor.name}.</p> : !activeTurn && !reactionOnly ? <p className="mesa-skin-dialog-note">Aguarde o turno de {actor.name}.</p> : mode === "conditions" ? (
          <div className="mesa-skin-condition-manager">
            <p>Condições de <strong>{actor.name}</strong></p>
            <div className="mesa-skin-condition-list">
              {(actor.conditions || []).length ? (actor.conditions || []).map((entry) => <button key={entry} type="button" onClick={() => removeCondition(entry)} title={`Remover ${entry}${conditionDescription(entry) ? ` — ${conditionDescription(entry)}` : ""}`}>{entry}<X size={13}/></button>) : <em>Nenhuma condição ativa.</em>}
            </div>
            <form onSubmit={(event) => { event.preventDefault(); addCondition(); }}>
              <input value={condition} onChange={(event) => setCondition(event.target.value)} placeholder="Adicionar condição" maxLength={80}/>
              <button type="submit" disabled={!condition.trim()}>Aplicar</button>
            </form>
            <div className="mesa-skin-condition-suggestions">{CONDITION_SUGGESTIONS.filter((entry) => !(actor.conditions || []).includes(entry)).map((entry) => <button key={entry} type="button" onClick={() => updateToken(actor.id, { conditions: Array.from(new Set([...(actor.conditions || []), entry])) })} title={conditionDescription(entry)}>{entry}</button>)}</div>
          </div>
        ) : pending ? (
          <ActionConfirm actor={actorUnit} action={pending.action} targets={pending.targetIds.map((id) => units.find((unit) => unit.id === id)).filter((unit): unit is TacticalUnitView => Boolean(unit))} board={snapshot.board} cost={pending.augment && actor ? computeCastPlan(buildCastInfo({ action: pending.action, entry: findSpellEntry(pending.action)!, level: actor.level || 1, currentPm: actor.pm, candidates: [] }), pending.augment).cost : pending.action.pmCost} onBack={() => setPending(null)} onConfirm={() => run(pending.action, pending.targetIds, pending.augment)}/>
        ) : targeting ? (
          <TargetChooser actor={actorUnit} action={targeting.action} units={units} board={snapshot.board} maxTargets={targeting.maxTargets} onBack={() => setTargeting(null)} onPick={(targetIds) => setPending({ action: targeting.action, targetIds, augment: targeting.augment })}/>
        ) : cast && actor ? (
          <CastStep actor={actor} action={cast.action} counts={cast.counts} weaponId={cast.weaponId} element={cast.element} onChange={(counts, weaponId, element) => setCast({ action: cast.action, counts, weaponId, element })} onBack={() => setCast(null)} onContinue={(augment, plan, weaponSpell) => {
            // Com os aprimoramentos, a ação, o alcance e o limite de alvos podem ter mudado.
            const shown: GameAction = { ...cast.action, kind: plan.kind ?? cast.action.kind, rangeM: plan.alcance ? parseRangeM(plan.alcance, cast.action.rangeM) : cast.action.rangeM };
            setCast(null);
            if (weaponSpell || shown.target === "self") { run(shown, [actor.id], augment); return; }
            if (shown.target === "area" || shown.target === "cell") { onArmAreaAction(shown, augment); onClose(); return; }
            if (plan.maxTargets <= 1) { onArmTargetAction(shown, augment); onClose(); return; }
            setTargeting({ action: shown, augment, maxTargets: plan.maxTargets });
          }}/>
        ) : (
          <div className="mesa-skin-action-list">
            {reactionOnly && <p className="mesa-skin-dialog-note">Fora do turno de {actor.name}: só reações estão disponíveis.</p>}
            {!reactionOnly && aiTurn && <button type="button" className="mesa-skin-move-action" onClick={runAi}><Bot size={19}/><span><strong>Executar turno da IA</strong><small>Move, ataca se puder e encerra o turno</small></span></button>}
            {!reactionOnly && mode === "actions" && <button type="button" className="mesa-skin-move-action" onClick={() => { onArmMove(); onClose(); }}><Footprints size={19}/><span><strong>Mover</strong><small>Escolha o destino diretamente no mapa</small></span></button>}
            {!reactionOnly && (actions.length ? actions.map((action) => renderAction(action)) : <p className="mesa-skin-dialog-note">Nenhuma ação utilizável nesta categoria.</p>)}
            {reactions.length > 0 && <p className="mesa-skin-dialog-note"><strong>Reação</strong> · também fora do turno</p>}
            {reactions.map((action) => renderAction(action))}
          </div>
        )}
      </section>
    </div>
  );
}

function tokenOf(board: BoardState, id: string) {
  return board.tokens.find((token) => token.id === id);
}

/** Alvos elegíveis pelo lado, pelo alcance e pela linha de efeito (mesma regra do runtime). */
function TargetChooser({ actor, action, units, board, maxTargets, onBack, onPick }: { actor: TacticalUnitView; action: GameAction; units: TacticalUnitView[]; board: BoardState; maxTargets: number; onBack: () => void; onPick: (ids: string[]) => void }) {
  const source = tokenOf(board, actor.id);
  const [chosen, setChosen] = useState<string[]>([]);
  const candidates = units.map((unit) => {
    if (unit.defeated) return null;
    const curated = spellAllowsTarget(action, { id: actor.id, side: actor.side }, { id: unit.id, side: unit.side });
    const sideOk = curated ?? (action.target === "ally" || action.effect === "heal" || action.effect === "buff" ? unit.side === actor.side : unit.side !== actor.side);
    const token = tokenOf(board, unit.id);
    if (!sideOk || !source || !token) return null;
    const distance = rangeM(source, token);
    if (distance > action.rangeM + 0.001 || !hasLineOfEffect(board, source, token)) return null;
    return { unit, distance };
  }).filter((entry): entry is { unit: TacticalUnitView; distance: number } => Boolean(entry));
  return <div className="mesa-skin-target-picker">
    <p><small>ALVO PARA</small><strong>{action.name}</strong></p>
    <div>{candidates.map(({ unit, distance }) => <button type="button" key={unit.id} className={chosen.includes(unit.id) ? "selected" : undefined} aria-pressed={chosen.includes(unit.id)} onClick={() => { if (maxTargets <= 1) { onPick([unit.id]); return; } setChosen((current) => current.includes(unit.id) ? current.filter((id) => id !== unit.id) : current.length < maxTargets ? [...current, unit.id] : current); }}><span>{unit.portrait ? <img src={unit.portrait} alt=""/> : unit.symbol}</span><strong>{chosen.includes(unit.id) ? "✓ " : ""}{unit.name}</strong><small>PV {unit.pv}/{unit.pvMax} · {distance.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m</small></button>)}</div>
    {!candidates.length && <em>Nenhum alvo ao alcance ({action.rangeM} m) e com linha de efeito.</em>}
    {maxTargets > 1 && <em>Escolha até {maxTargets} alvos ({chosen.length}/{maxTargets}).</em>}
    {maxTargets > 1 && <button type="button" className="mesa-skin-dialog-primary" disabled={!chosen.length} onClick={() => onPick(chosen)}>Continuar</button>}
    <button type="button" className="mesa-skin-dialog-back" onClick={onBack}>Voltar</button>
  </div>;
}

/** Confirmação da ação (V3: confirm-action): resume alcance, custo, ataque e resistência antes de gastar PM. */
function ActionConfirm({ actor, action, targets, board, cost, onBack, onConfirm }: { actor: TacticalUnitView; action: GameAction; targets: TacticalUnitView[]; board: BoardState; cost: number; onBack: () => void; onConfirm: () => void }) {
  const target = targets[0];
  const source = tokenOf(board, actor.id);
  const destination = target ? tokenOf(board, target.id) : undefined;
  const distance = source && destination ? rangeM(source, destination) : 0;
  const bonus = action.attackSkill ? actor[action.attackSkill] + (action.attackBonus || 0) : 0;
  const attack = action.attackSkill ? `${action.attackSkill === "luta" ? "Luta" : "Pontaria"} ${bonus >= 0 ? "+" : ""}${bonus}` : "";
  const saveName = action.save === "fortitude" ? "Fortitude" : action.save === "reflexes" ? "Reflexos" : "Vontade";
  const parts = [
    `${distance.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m de ${action.rangeM} m`,
    `${cost} PM`,
    attack,
    action.save ? `CD ${action.saveDC || actor.spellDC} ${saveName}` : "",
    action.damage ? `dano ${action.damage}` : action.healing ? `cura ${action.healing}` : "",
  ].filter(Boolean);
  return <div className="mesa-skin-target-picker">
    <p><small>CONFIRMAR AÇÃO</small><strong>{action.name}{targets.length ? ` → ${targets.map((unit) => unit.name).join(", ")}` : ""}</strong></p>
    <div><button type="button" onClick={onConfirm}><span>{target?.portrait ? <img src={target.portrait} alt=""/> : target?.symbol}</span><strong>Confirmar ação</strong><small>{parts.join(" · ")}</small></button></div>
    <button type="button" className="mesa-skin-dialog-back" onClick={onBack}>Voltar</button>
  </div>;
}

function IconForAction({ action }: { action: GameAction }) {
  if (action.category === "spell") return <WandSparkles size={18}/>;
  if (action.category === "item") return <Backpack size={18}/>;
  if (action.category === "power" || action.category === "special") return <Sparkles size={18}/>;
  return <Swords size={18}/>;
}

/** Página "cast" do V3: aprimoramentos da magia, com o custo final calculado pelo motor. */
function CastStep({ actor, action, counts, weaponId, element, onChange, onBack, onContinue }: { actor: BoardState["tokens"][number]; action: GameAction; counts: Record<number, number>; weaponId?: string; element?: string; onChange: (counts: Record<number, number>, weaponId?: string, element?: string) => void; onBack: () => void; onContinue: (augment: AugmentChoice, plan: CastPlan, weaponSpell: boolean) => void }) {
  const entry = findSpellEntry(action);
  if (!entry) return null;
  const [racial, setRacial] = useState(() => isRacialSpell(actor, spellKeyOf(action.sourceId || action.name)));
  const info = buildCastInfo({ action, entry, level: actor.level || 1, currentPm: actor.pm, candidates: [], ...castCircleContext(actor, entry.circulo), racial });
  const augments = info.entry.aprimoramentos || [];
  // Magia cujo alvo é uma arma (Arma Mágica): escolhe uma das armas equipadas do personagem.
  const weaponSpell = /^\s*1 arma/i.test(entry.alvo || "");
  const weapons = weaponSpell ? actionsForToken(actor).filter((candidate) => candidate.category === "weapon") : [];
  const choice: AugmentChoice = { counts, racial, ...(weaponSpell && weaponId ? { weaponId } : {}), ...(element ? { element } : {}) };
  const plan = computeCastPlan(info, choice);
  const cycle = (index: number) => {
    const current = counts[index] || 0;
    const kind = augments[index].tipo;
    const next = kind === "aumenta" ? current + 1 : current ? 0 : 1;
    const proposed = { ...counts, [index]: next };
    // Se passar do limite de PM, volta a zero (o ciclo recomeça) em vez de travar o clique.
    if (computeCastPlan(info, { counts: proposed, racial }).cost > Math.max(1, info.level)) proposed[index] = 0;
    onChange(Object.fromEntries(Object.entries(proposed).filter(([, times]) => times > 0)) as Record<number, number>, weaponId, element);
  };
  return <div className="mesa-skin-target-picker mesa-skin-cast">
    <p><small>APRIMORAMENTOS DE</small><strong>{action.name}</strong></p>
    {weaponSpell && <div>
      {weapons.map((weapon) => <button type="button" key={weapon.id} className={weaponId === weapon.id ? "selected" : undefined} aria-pressed={weaponId === weapon.id} onClick={() => onChange(counts, weapon.id, element)}>
        <span className="cast-count">{weaponId === weapon.id ? "✓" : "+"}</span>
        <strong className="cast-text">{weapon.name}<i>Arma que recebe a magia</i></strong>
      </button>)}
      {!weapons.length && <em className="cast-error">Este personagem não tem arma equipada.</em>}
    </div>}
    {plan.mods.elemental > 0 && <div>
      {ELEMENTS.map((name) => <button type="button" key={name} className={element === name ? "selected" : undefined} aria-pressed={element === name} onClick={() => onChange(counts, weaponId, name)}>
        <span className="cast-count">{element === name ? "✓" : "+"}</span>
        <strong className="cast-text">{name}<i>Energia do dano extra da arma</i></strong>
      </button>)}
    </div>}
    <div>{augments.map((option, index) => <button type="button" key={index} className={counts[index] ? "selected" : undefined} aria-pressed={Boolean(counts[index])} onClick={() => cycle(index)}>
      <span className="cast-count">{counts[index] ? `×${counts[index]}` : "+"}</span>
      <strong className="cast-text">{option.rotulo}{option.manual && <i>Efeito aplicado à mão pelo Mestre</i>}</strong>
      <small className="cast-cost">+{option.custo} PM</small>
    </button>)}
    <button type="button" className={racial ? "selected" : undefined} aria-pressed={racial} onClick={() => setRacial(!racial)}>
      <span className="cast-count">{racial ? "✓" : "+"}</span>
      <strong className="cast-text">Magia racial (concedida pela raça, não pela classe)<i>Círculo máximo passa a ser o da própria magia</i></strong>
      <small className="cast-cost">{info.maxCircle}º</small>
    </button></div>
    <div className="cast-summary">
      <p><small>CUSTO</small><strong>{plan.cost} PM</strong></p>
      <p><small>ALVOS</small><strong>até {plan.maxTargets}</strong></p>
      <p><small>SEUS PM</small><strong>{actor.pm}</strong></p>
    </div>
    {plan.error && <em className="cast-error">{plan.error}</em>}
    <button type="button" className="mesa-skin-dialog-primary" disabled={Boolean(plan.error) || (weaponSpell && !weaponId)} onClick={() => onContinue(choice, plan, weaponSpell)}>{weaponSpell || action.target === "self" ? "Lançar magia" : action.target === "area" || action.target === "cell" ? "Escolher o ponto" : "Escolher alvos"}</button>
    <button type="button" className="mesa-skin-dialog-back" onClick={onBack}>Voltar</button>
  </div>;
}
