import { ChevronLeft, WandSparkles } from "lucide-react";

export interface CastInfo {
  actionId: string;
  name: string;
  baseCost: number;
  maxCircle: number;
  circle: number;
  racial: boolean;
  level: number;
  kind?: string;
  description: string;
  currentPm: number;
  candidates: { id: string; name: string }[];
  entry: {
    alvo?: { lado?: string; adjacentes?: boolean; alcanceM?: number; incluiSi?: boolean; max?: number };
    duracao?: { tipo: string; n?: number; rotulo?: string };
    efeito?: { rotulo?: string; mods?: Record<string, number> };
    aprimoramentos?: { custo: number; tipo: "aumenta" | "muda" | "truque" | "extra"; rotulo: string; manual?: boolean; extraTargets?: number; soma?: Record<string, number>; limiteBonus?: "circulo"; altera?: string[]; requerCirculo?: number; execucao?: "standard" | "reaction" | "free" | "movement" | "full"; addHealing?: string; addDamage?: string; alcance?: string; todosOsAlvos?: boolean; define?: Record<string, number>; exige?: number; areaM?: number }[];
  };
}

export interface CastPreview {
  cost: number;
  mods: Record<string, number>;
  error: string;
}

interface CastPanelProps {
  info: CastInfo;
  counts: Record<number, number>;
  targets: string[];
  racial: boolean;
  preview: CastPreview | null;
  onRacial: (racial: boolean) => void;
  onCounts: (counts: Record<number, number>) => void;
  onTargets: (targets: string[]) => void;
  onCast: () => void;
  onCancel: () => void;
}

const modNames: Record<string, string> = { ataque: "ataque", dano: "dano", defesa: "Defesa" };

export function durationText(duracao?: { tipo: string; n?: number; rotulo?: string }) {
  if (!duracao) return "";
  if (duracao.tipo === "cena") return "até o fim da cena (combate)";
  if (duracao.tipo === "rodadas") return `${duracao.n ?? 1} rodada${(duracao.n ?? 1) > 1 ? "s" : ""}`;
  if (duracao.tipo === "sustentada") return "sustentada";
  return duracao.rotulo ?? "";
}

export function modsText(mods: Record<string, number>) {
  return Object.entries(mods)
    .filter(([, value]) => value)
    .map(([key, value]) => `${value > 0 ? "+" : ""}${value} em ${modNames[key] ?? key}`)
    .join(", ");
}

export default function CastPanel({ info, counts, targets, racial, preview, onRacial, onCounts, onTargets, onCast, onCancel }: CastPanelProps) {
  const { entry } = info;
  const enh = entry.aprimoramentos ?? [];
  const selfOnly = entry.alvo?.lado === "si";
  const needsTarget = !selfOnly;
  const canCast = !!preview && !preview.error && (selfOnly || targets.length > 0);
  const setCount = (index: number, value: number) => onCounts({ ...counts, [index]: Math.max(0, value) });
  const toggleTarget = (id: string) => onTargets(targets.includes(id) ? targets.filter((entryId) => entryId !== id) : [...targets, id]);
  const kindNote = info.kind === "full" ? "Ação completa · usa também o movimento" : info.kind === "move" ? "Ação de movimento" : "";

  return (
    <aside className="fft-command-shell cast-shell">
      <div className="command-window">
        <div className="command-window-title">
          <button onClick={onCancel} aria-label="Voltar"><ChevronLeft size={16} /></button>
          <span>LANÇAR MAGIA</span>
          <small>{info.currentPm} PM</small>
        </div>
        <div className="cast-panel">
          <div className="cast-head">
            <span className="action-icon arcane large"><WandSparkles /></span>
            <div>
              <strong>{info.name}</strong>
              <small>Custo base {info.baseCost} PM · você lança até o {info.maxCircle}º círculo · limite de PM por magia: {info.level}{kindNote ? ` · ${kindNote}` : ""}</small>
            </div>
          </div>
          {info.description && <p className="cast-desc">{info.description}</p>}
          <label className="cast-racial"><input type="checkbox" checked={racial} onChange={(event) => onRacial(event.target.checked)} /> Magia racial (concedida pela raça, não pela classe)<small>{racial ? "Limite de PM = seu nível; não cumpre pré-requisito de círculo." : "Marque se esta magia vem de uma habilidade racial."}</small></label>

          {enh.length > 0 && (
            <section className="cast-section" aria-label="Aprimoramentos">
              <h4>Aprimoramentos</h4>
              {enh.map((option, index) => {
                const count = counts[index] ?? 0;
                return (
                  <div key={index} className={`cast-enh ${option.manual ? "manual" : ""}`}>
                    <span><strong>+{option.custo} PM</strong> {option.rotulo}{option.manual && <em> · não automático (aplique à mão)</em>}</span>
                    {option.manual ? null : option.tipo === "aumenta" ? (
                      <span className="cast-stepper">
                        <button aria-label={`Menos ${option.rotulo}`} disabled={count <= 0} onClick={() => setCount(index, count - 1)}>−</button>
                        <b aria-label={`Usos de ${option.rotulo}`}>{count}</b>
                        <button aria-label={`Mais ${option.rotulo}`} onClick={() => setCount(index, count + 1)}>+</button>
                      </span>
                    ) : (
                      <label className="cast-check"><input type="checkbox" checked={count > 0} onChange={(event) => setCount(index, event.target.checked ? 1 : 0)} /> usar</label>
                    )}
                  </div>
                );
              })}
            </section>
          )}

          {needsTarget && (
            <section className="cast-section" aria-label="Alvos">
              <h4>Alvos ({entry.alvo?.lado === "aliados" ? "aliados" : entry.alvo?.lado === "inimigos" ? "inimigos" : "criaturas"}{entry.alvo?.adjacentes ? " adjacentes" : entry.alvo?.alcanceM ? ` até ${entry.alvo.alcanceM} m` : ""})</h4>
              {info.candidates.length === 0 && <p className="cast-empty">Nenhum alvo válido ao alcance.</p>}
              {info.candidates.map((candidate) => (
                <label key={candidate.id} className="cast-target">
                  <input type="checkbox" checked={targets.includes(candidate.id)} onChange={() => toggleTarget(candidate.id)} />
                  {candidate.name}
                </label>
              ))}
            </section>
          )}

          <footer className="cast-foot">
          <div className="cast-summary">
            <div><small>CUSTO</small><strong>{preview?.cost ?? info.baseCost} PM</strong></div>
            <div><small>EFEITO</small><strong>{preview ? modsText(preview.mods) || entry.efeito?.rotulo || "Especial" : "-"}</strong></div>
            <div><small>DURAÇÃO</small><strong>{durationText(entry.duracao)}</strong></div>
          </div>
          {preview?.error && <p className="cast-error" role="alert">{preview.error}</p>}
          <div className="confirm-actions">
            <button onClick={onCancel}>Cancelar</button>
            <button className="confirm" disabled={!canCast} onClick={onCast}>Lançar magia</button>
          </div>
          </footer>
        </div>
      </div>
    </aside>
  );
}
