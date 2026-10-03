import spellsJson from "../../../ficha-modernrpg/t20/vtt/magias.json";
import type { GameAction } from "../../game/types";
import type { CastInfo } from "../../components/tactics/CastPanel";
import enhancementsJson from "../data/spellEnhancements.json";

/**
 * Normalização de conjuração.
 *
 * O CastPanel esperava uma entrada rica (alvo/duração/efeito/aprimoramentos
 * tipados) que nunca existiu: magias.json só traz `aprimoramentos: [{custo,
 * desc}]` em texto livre. Este módulo é a peça que faltava, e é PURO de
 * propósito — a UI usa para montar o painel e o runtime do Mestre usa para
 * recalcular o custo, para que um jogador não consiga conjurar mais barato
 * mandando um payload adulterado.
 */

export interface CanonicalSpellEntry {
  id: string;
  nome: string;
  circulo: number;
  tipo?: string;
  escola?: string;
  execucao?: string;
  alcance?: string;
  alvo?: string;
  duracao?: string;
  resistencia?: string;
  custo?: number;
  descricao?: string;
  aprimoramentos?: { custo: number; desc: string }[];
}

const CATALOG = spellsJson as CanonicalSpellEntry[];

export function spellKeyOf(name: string): string {
  return normalize(name);
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const BY_ID = new Map(CATALOG.map((entry) => [entry.id, entry]));
const BY_NAME = new Map(CATALOG.map((entry) => [normalize(entry.nome), entry]));

/** Resolve a magia oficial de uma ação. Devolve null quando a ação é homebrew. */
export function findSpellEntry(action: Pick<GameAction, "sourceId" | "name" | "category">): CanonicalSpellEntry | null {
  if (action.category !== "spell") return null;
  const bySourceId = action.sourceId ? BY_ID.get(action.sourceId) || BY_NAME.get(normalize(action.sourceId)) : undefined;
  return bySourceId || BY_NAME.get(normalize(action.name)) || null;
}

export type AugmentKind = "aumenta" | "muda" | "truque" | "extra";

/**
 * Aprimoramentos curados das 25 magias com efeito automático (fonte: registro
 * `ArmadaSpellEffects` de `public/vtt/spell-effects.js`, ModernRPG-2026-09-23).
 * Trazem o que o texto livre do catálogo não tem: bônus somado por uso (`soma`),
 * limite pelo círculo (`limiteBonus`), círculo mínimo (`requerCirculo`) e a
 * característica alterada por um "muda" (`altera`).
 */
interface CuratedEnhancement {
  custo: number;
  tipo: AugmentKind;
  rotulo: string;
  soma?: Record<string, number>;
  limiteBonus?: "circulo";
  altera?: string[];
  requerCirculo?: number;
  manual?: boolean;
  /** índice de outro aprimoramento que este exige */
  exige?: number;
  /** muda a execução da magia (ex.: Campo de Força, +1 PM: reação) */
  execucao?: GameAction["kind"];
  /** muda o alcance da magia ("curto", "toque"...) */
  alcance?: string;
  /** vira explosão com este raio a partir de quem lança */
  areaM?: number;
  addDamage?: string;
  addHealing?: string;
}
const CURATED = enhancementsJson as unknown as Record<string, { baseMods?: Record<string, number>; aprimoramentos: CuratedEnhancement[] }>;

/** Bônus base do efeito da magia (ex.: Bênção +1 ataque e +1 dano). */
export function curatedBaseMods(entry: Pick<CanonicalSpellEntry, "nome">): Record<string, number> {
  return { ...(CURATED[normalize(entry.nome)]?.baseMods || {}) };
}

export interface NormalizedAugment {
  custo: number;
  tipo: AugmentKind;
  rotulo: string;
  /** true = o painel só cobra o PM; o efeito é aplicado pelo mestre à mão. */
  manual: boolean;
  /** Alvos extras concedidos por uso, quando o texto é explícito. */
  extraTargets?: number;
  /** quanto cada uso soma aos bônus do efeito (ataque, dano, defesa, rd) */
  soma?: Record<string, number>;
  /** o primeiro bônus não passa do círculo máximo que o conjurador lança */
  limiteBonus?: "circulo";
  /** características que um "muda" altera (duas mudanças na mesma não acumulam) */
  altera?: string[];
  /** círculo mínimo que o conjurador precisa lançar (magia racial nunca cumpre) */
  requerCirculo?: number;
  /** muda a execução da magia ("muda a execução para padrão/reação...") */
  execucao?: GameAction["kind"];
  /** dados somados à cura ou ao dano por uso ("aumenta a cura em +1d8+1") */
  addHealing?: string;
  addDamage?: string;
  /** novo alcance ("muda o alcance para curto") */
  alcance?: string;
  /** afeta todos os alvos válidos ("alvo para criaturas escolhidas", "todos os alvos válidos") */
  todosOsAlvos?: boolean;
  /** valores que o aprimoramento troca no efeito ("muda a RD para 20") */
  define?: Record<string, number>;
  /** vira área de explosão com este raio, a partir de quem lança ("muda o alcance para pessoal e a área para explosão de 6m de raio") */
  areaM?: number;
  /** só vale junto de outro aprimoramento (índice): "muda o bônus de dano do aprimoramento acima" */
  exige?: number;
}

const EXECUTION_WORDS: Record<string, GameAction["kind"]> = { padrao: "standard", reacao: "reaction", livre: "free", movimento: "movement", completa: "full" };

type ParsedAugment = Pick<NormalizedAugment, "execucao" | "addHealing" | "addDamage" | "alcance" | "todosOsAlvos" | "define" | "requerCirculo" | "areaM">;

/** O que um aprimoramento de texto livre sabe fazer sozinho (o resto é cobrado em PM e aplicado à mão). */
function parseAugmentEffects(desc: string): ParsedAugment {
  const out: ParsedAugment = {};
  // minúsculas sem acento, mantendo "+" e dígitos (os dados "+1d8+1" precisam do "+")
  const text = desc.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const exec = text.match(/muda a execucao para (padrao|reacao|livre|movimento|completa)/);
  if (exec) out.execucao = EXECUTION_WORDS[exec[1]];
  const dice = (word: string) => text.match(new RegExp(`aumenta ${word} em \\+?(\\d+d\\d+(?: ?\\+ ?\\d+)?)`))?.[1]?.replace(/ /g, "");
  const heal = dice("a cura");
  if (heal) out.addHealing = heal;
  const dmg = dice("o dano");
  if (dmg) out.addDamage = dmg;
  const range = text.match(/muda o alcance para (pessoal|toque|curto|medio|longo)/);
  if (range) out.alcance = range[1] === "medio" ? "Médio" : range[1][0].toUpperCase() + range[1].slice(1);
  const burst = text.match(/muda o alcance para pessoal e (?:o alvo|a area) para (?:area de )?explosao (?:de|com) (\d+(?:[.,]\d+)?) ?m de raio/);
  if (burst) out.areaM = Number(burst[1].replace(",", "."));
  if (/alvo para criaturas escolhidas|afeta todos os alvos validos|todos os alvos validos/.test(text)) out.todosOsAlvos = true;
  const rd = text.match(/muda (?:os pv temporarios ou )?a rd para (\d+)/);
  if (rd) out.define = { rd: Number(rd[1]) };
  if (/apavorados? por \d+d\d+ ?\+ ?\d+ rodadas/.test(text)) out.define = { ...(out.define || {}), apavorado: 1 };
  // duração que o aprimoramento muda: cena ou 1 dia (efeito do tipo "define", lido pelo motor da magia)
  const duration = /^\s*muda/.test(text) ? text.match(/a duracao para (cena|1 dia)/)?.[1] : undefined;
  if (duration) out.define = { ...(out.define || {}), [duration === "cena" ? "cena" : "dia"]: 1 };
  // o inimigo que ataca rola dois dados e usa o pior (Concentração de Combate, 3º círculo)
  if (/inimigo deve rolar dois dados e usar o pior/.test(text)) out.define = { ...(out.define || {}), inimigoPior: 1 };
  const circle = text.match(/requer (\d)\D{0,2} circulo/);
  if (circle) out.requerCirculo = Number(circle[1]);
  return out;
}

function augmentKind(desc: string): AugmentKind {
  if (/^\s*aumenta/i.test(desc)) return "aumenta";
  if (/^\s*muda/i.test(desc)) return "muda";
  if (/^\s*truque/i.test(desc)) return "truque";
  return "extra";
}

/**
 * Único aprimoramento que o motor sabe aplicar sozinho hoje: "aumenta o número
 * de alvos em +N". Todo o resto é marcado `manual` — o painel cobra o PM certo
 * e diz, na cara, que o efeito precisa ser aplicado à mão. Fingir automação
 * que não existe seria pior do que não ter o painel.
 */
export function normalizeAugments(entry: CanonicalSpellEntry): NormalizedAugment[] {
  const curated = CURATED[normalize(entry.nome)];
  if (curated) {
    return curated.aprimoramentos.map((option) => {
      const targets = Number(option.rotulo.match(/n[úu]mero de alvos em \+(\d+)/i)?.[1]);
      const targetsAuto = option.tipo === "aumenta" && Number.isFinite(targets) && targets > 0;
      return {
        custo: option.custo,
        tipo: option.tipo,
        rotulo: option.rotulo,
        manual: !option.soma && !targetsAuto && !option.addDamage && !option.addHealing && !option.areaM,
        extraTargets: targetsAuto ? targets : undefined,
        soma: option.soma,
        limiteBonus: option.limiteBonus,
        altera: option.altera,
        requerCirculo: option.requerCirculo,
        execucao: option.execucao,
        alcance: option.alcance,
        areaM: option.areaM,
        addDamage: option.addDamage,
        addHealing: option.addHealing,
        exige: option.exige,
      };
    });
  }
  return (entry.aprimoramentos || []).map((option) => {
    const desc = String(option.desc || "").trim();
    const targets = Number(desc.match(/n[úu]mero de alvos em \+(\d+)/i)?.[1]);
    const extraTargets = Number.isFinite(targets) && targets > 0 ? targets : undefined;
    const parsed = parseAugmentEffects(desc);
    const automatable = Boolean(extraTargets) || Object.keys(parsed).length > 0;
    return {
      custo: Number(option.custo) || 0,
      tipo: augmentKind(desc),
      rotulo: desc || "Aprimoramento",
      manual: !automatable,
      extraTargets,
      ...parsed,
    };
  });
}

function parseDuration(value?: string): CastInfo["entry"]["duracao"] {
  const text = String(value || "").trim();
  if (!text) return undefined;
  if (/cena/i.test(text)) return { tipo: "cena" };
  if (/sustentada/i.test(text)) return { tipo: "sustentada" };
  const rounds = Number(text.match(/(\d+)\s*rodada/i)?.[1]);
  if (Number.isFinite(rounds) && rounds > 0) return { tipo: "rodadas", n: rounds };
  return { tipo: "outra", rotulo: text };
}

function targetSide(action: GameAction): string {
  if (action.target === "self") return "si";
  if (action.target === "ally" || action.effect === "heal" || action.effect === "buff") return "aliados";
  return "inimigos";
}

function maxTargetsFromText(entry: CanonicalSpellEntry): number | undefined {
  const explicit = Number(String(entry.alvo || "").match(/(\d+)\s*criatur/i)?.[1]);
  return Number.isFinite(explicit) && explicit > 0 ? explicit : undefined;
}

export interface CastContext {
  action: GameAction;
  entry: CanonicalSpellEntry;
  /** Nível do conjurador — é o teto de PM por magia no T20. */
  level: number;
  currentPm: number;
  candidates: { id: string; name: string }[];
  effectLabel?: string;
  /** Círculo máximo que o conjurador lança (por classe e nível); sem valor, usa o círculo da magia. */
  maxCircle?: number;
  /** Magia racial: concedida pela raça, não pela classe. */
  racial?: boolean;
}

export function buildCastInfo(context: CastContext): CastInfo {
  const { action, entry } = context;
  return {
    actionId: action.id,
    name: action.name,
    baseCost: action.pmCost || entry.custo || Math.max(1, entry.circulo * 2 - 1),
    // Magia racial não cumpre pré-requisito de círculo: usa o círculo da própria magia como máximo.
    maxCircle: context.racial ? entry.circulo : Math.max(1, context.maxCircle ?? entry.circulo),
    circle: entry.circulo,
    racial: context.racial === true,
    level: Math.max(1, context.level),
    kind: action.kind,
    description: entry.descricao || action.description,
    currentPm: context.currentPm,
    candidates: context.candidates,
    entry: {
      alvo: {
        lado: targetSide(action),
        alcanceM: action.rangeM,
        incluiSi: action.target === "self",
        max: maxTargetsFromText(entry),
      },
      duracao: parseDuration(entry.duracao),
      efeito: { rotulo: context.effectLabel || action.damage || action.healing || action.condition || entry.alvo || "Especial", mods: curatedBaseMods(entry) },
      aprimoramentos: normalizeAugments(entry),
    },
  };
}

export interface CastPlan {
  cost: number;
  mods: Record<string, number>;
  error: string;
  maxTargets: number;
  manualNotes: string[];
  /** ação que a magia gasta com os aprimoramentos escolhidos (só quando algum a muda) */
  kind?: GameAction["kind"];
  /** alcance novo, quando um aprimoramento o muda */
  alcance?: string;
  /** a magia vira explosão em área com este raio, centrada em quem lança */
  areaM?: number;
  /** dados somados à cura e ao dano pelos aprimoramentos */
  addHealing: string[];
  addDamage: string[];
}

export interface AugmentChoice {
  counts: Record<number, number>;
  racial: boolean;
  /** arma escolhida, para magias cujo alvo é uma arma (Arma Mágica) */
  weaponId?: string;
  /** energia escolhida para o dano extra da Arma Mágica */
  element?: string;
}

export const ELEMENTS = ["Ácido", "Eletricidade", "Fogo", "Frio"] as const;

/** Sanitiza uma escolha vinda da rede antes de qualquer cálculo. */
export function sanitizeAugmentChoice(value: unknown): AugmentChoice {
  const raw = (value && typeof value === "object" ? value : {}) as { counts?: unknown; racial?: unknown };
  const counts: Record<number, number> = {};
  if (raw.counts && typeof raw.counts === "object") {
    for (const [key, amount] of Object.entries(raw.counts as Record<string, unknown>)) {
      const index = Number(key);
      const times = Math.floor(Number(amount));
      // Teto defensivo: ninguém precisa de 10 mil usos do mesmo aprimoramento.
      if (Number.isInteger(index) && index >= 0 && index < 64 && Number.isFinite(times) && times > 0) counts[index] = Math.min(times, 99);
    }
  }
  const rawWeapon = (raw as { weaponId?: unknown }).weaponId;
  const weaponId = typeof rawWeapon === "string" && rawWeapon ? rawWeapon.slice(0, 160) : undefined;
  const rawElement = (raw as { element?: unknown }).element;
  const element = typeof rawElement === "string" && (ELEMENTS as readonly string[]).includes(rawElement) ? rawElement : undefined;
  return { counts, racial: raw.racial === true, ...(weaponId ? { weaponId } : {}), ...(element ? { element } : {}) };
}

/**
 * Custo final e validação. Mesma função nos dois lados da rede: a UI usa para
 * habilitar o botão, o Mestre usa para recusar um pedido adulterado.
 */
export function computeCastPlan(info: CastInfo, choice: AugmentChoice): CastPlan {
  const augments = info.entry.aprimoramentos || [];
  // Racial marcada na escolha: o círculo máximo passa a ser o da própria magia e os pré-requisitos de círculo não valem.
  const racial = choice.racial === true;
  const maxCircle = racial ? info.circle : info.maxCircle;
  const mods: Record<string, number> = { ...(info.entry.efeito?.mods || {}) };
  const changed = new Set<string>();
  let cost = info.baseCost;
  let extraTargets = 0;
  let allTargets = false;
  let kind: GameAction["kind"] | undefined;
  let alcance: string | undefined;
  let areaM: number | undefined;
  const addHealing: string[] = [];
  const addDamage: string[] = [];
  let used = 0;
  let trick = false;
  let error = "";
  const fail = (message: string) => { if (!error) error = message; };
  const manualNotes: string[] = [];

  for (const [key, times] of Object.entries(choice.counts)) {
    const option = augments[Number(key)];
    if (!option || times <= 0) continue;
    used += 1;
    if (option.requerCirculo && (racial || maxCircle < option.requerCirculo)) fail(`"${option.rotulo}" exige lançar magias de ${option.requerCirculo}º círculo.`);
    // Só o "aumenta" acumula; os demais valem uma vez.
    const uses = option.tipo === "aumenta" ? times : 1;
    if (option.tipo !== "aumenta" && times > 1) fail(`"${option.rotulo}" só pode ser usado uma vez (só os aprimoramentos "aumenta" acumulam).`);
    if (option.tipo === "muda") {
      for (const feature of option.altera || []) {
        if (changed.has(feature)) fail(`Mudanças na mesma característica (${feature}) não se acumulam.`);
        changed.add(feature);
      }
    }
    if (option.tipo === "truque") trick = true;
    cost += option.custo * uses;
    // "Muda" nunca acumula na mesma característica (execução, alcance, alvo, efeito).
    const touched = [option.execucao && "execução", option.alcance && "alcance", option.todosOsAlvos && "alvo", option.define && "efeito"].filter(Boolean) as string[];
    if (option.tipo === "muda") {
      for (const feature of touched) {
        if (changed.has(feature)) fail(`Mudanças na mesma característica (${feature}) não se acumulam.`);
        changed.add(feature);
      }
    }
    if (option.exige !== undefined && !(choice.counts[option.exige] > 0)) fail(`"${option.rotulo}" só vale junto do aprimoramento ${option.exige + 1}.`);
    if (option.execucao) kind = option.execucao;
    if (option.alcance) alcance = option.alcance;
    if (option.areaM) areaM = option.areaM;
    if (option.todosOsAlvos) allTargets = true;
    for (const [mod, value] of Object.entries(option.define || {})) mods[mod] = value;
    for (let n = 0; n < uses; n += 1) {
      if (option.addHealing) addHealing.push(option.addHealing);
      if (option.addDamage) addDamage.push(option.addDamage);
    }
    for (const [mod, value] of Object.entries(option.soma || {})) mods[mod] = (mods[mod] || 0) + value * uses;
    if (option.limiteBonus === "circulo") {
      const first = Object.keys(option.soma || {})[0];
      if (first && mods[first] > maxCircle) fail(`O bônus não pode passar do círculo máximo que você lança (${maxCircle}º).`);
    }
    if (option.extraTargets) extraTargets += option.extraTargets * uses;
    else if (option.manual) manualNotes.push(option.rotulo);
  }
  if (trick) {
    if (used > 1) fail("Truque não pode ser usado junto com outros aprimoramentos.");
    cost = 0;
  }

  if ((mods.elemental || 0) > 0 && !choice.element) fail("Escolha a energia do dano extra: ácido, eletricidade, fogo ou frio.");
  const pmLimit = Math.max(1, info.level);
  if (cost > pmLimit) fail(`Limite de PM em uma magia: ${pmLimit} (seu nível). Este lançamento custaria ${cost}.`);
  else if (cost > info.currentPm) fail(`PM insuficientes: precisa de ${cost}, você tem ${info.currentPm}.`);

  return {
    cost,
    mods,
    error,
    maxTargets: allTargets || areaM ? 99 : Math.max(1, (info.entry.alvo?.max || 1) + extraTargets),
    manualNotes,
    kind,
    alcance,
    areaM,
    addHealing,
    addDamage,
  };
}
