import type { AttrKey, ItemCategory } from "../lib/t20/compendium";

export type { AttrKey };

/** Em Tormenta 20 o valor do atributo JÁ É o modificador (ex.: FOR +2). */
export interface Attribute {
  key: AttrKey;
  short: string; // FOR
  name: string; // Força
  value: number; // +2
}

export interface SkillState {
  trained: boolean;
  /** bônus extras (poderes, itens, condições) */
  other?: number;
  /** ex.: especialização de Ofício ou Conhecimento */
  note?: string;
  /** atributo-chave alterado por poder/habilidade (padrão: o da perícia) */
  attr?: AttrKey;
}

/** Linha do diário de aventuras da ficha. */
export interface JournalEntry {
  id: string;
  adventure: string;
  level: number;
  xp: number;
  /** miniatura pequena (data URL) */
  image?: string;
  text: string;
}

export interface AttackItem {
  id: string;
  name: string;
  /** perícia usada no teste de ataque */
  skill: "Luta" | "Pontaria";
  damage: string; // "1d8"
  /** atributo somado ao dano (FOR por padrão em corpo a corpo) */
  damageAttr?: AttrKey | null;
  critical: string; // "19/x2"
  range?: string; // "Curto (9m)" ou undefined
  damageType: string;
  properties?: string;
  /** bônus extra no teste de ataque */
  bonus?: number;
  /** bônus extra no dano */
  damageBonus?: number;
}

export interface Ability {
  id: string;
  name: string;
  description: string;
  level?: number;
  source?: string;
}

export interface PowerEntry {
  id: string;
  name: string;
  type: string; // Combate, Destino, Classe – Guerreiro, Racial – Elfo…
  description: string;
  requirement?: string;
  cost?: number | null;
}

export interface SpellItem {
  id: string;
  name: string;
  circle: number;
  school?: string;
  type?: string; // Arcana / Divina / Universal
  cost: number; // PM
  execution?: string;
  range?: string;
  duration?: string;
  resistance?: string;
  effect?: string; // dados de dano/cura para rolar, ex.: "2d6"
  description?: string;
}

export type { ItemCategory } from "../lib/t20/compendium";

export interface EquipmentItem {
  id: string;
  equipped: boolean;
  name: string;
  quantity: number;
  /** espaços ocupados por unidade */
  slots: number;
  /** preço unitário em T$ (null = desconhecido) */
  price: number | null;
  description: string;
  category: ItemCategory;
  /** bônus na Defesa (armadura / escudo) */
  defenseBonus?: number;
  /** penalidade de armadura (negativa) */
  armorPenalty?: number;
  /** de onde veio o item (ex.: "Origem: Guarda") */
  source?: string;
  /** melhorias já aplicadas ao item (nomes do catálogo, categoria Modificação); item importado já vem pago, nada é cobrado */
  modifications?: string[];
}

/** Escolhas feitas na Oficina de Heróis, guardadas para reabrir a ficha no passo a passo. */
export interface BuilderMeta {
  bought: Record<AttrKey, number>;
  freeMode: boolean;
  raceChoices: AttrKey[];
  originPicks: number[];
  originAttr?: AttrKey;
  originItemPicks?: Record<number, number>;
  /** escolhas raciais (perícias, opções, atributo sorteado), por id da escolha */
  raceExtra?: Record<string, string[]>;
  fixedChoice: Record<number, string>;
  extraSkills: string[];
  /** Perícias extras separadas por origem para reabrir a Oficina sem perder as escolhas. */
  classExtraSkills?: string[];
  intExtraSkills?: string[];
  versatileSkills?: string[];
  /** Perícias escolhidas em poderes que concedem treinamento à escolha. */
  powerSkillChoices?: Record<string, string[]>;
  powerIds: string[];
  spellIds: string[];
  distinctionId?: string;
}

export interface CharacterSheet {
  id: string;
  name: string;
  avatar?: string;
  /** ponto de foco do retrato, ex.: "50% 20%" */
  avatarPos?: string;
  race: string;
  raceId?: string;
  /** variante escolhida da raça (chassi do Golem, herança do Moreau...) */
  raceVariantId?: string;
  class: string;
  classId?: string;
  /** caminho / especialização (ex.: Mago, Bruxo) */
  path?: string;
  origin?: string;
  originId?: string;
  deity?: string;
  deityId?: string;
  level: number;
  campaign: string;
  campaignUrl?: string;

  attributes: Record<AttrKey, Attribute>;

  hp: { current: number; max: number; temp?: number };
  mp: { current: number; max: number };

  /** bônus na Defesa vindos de poderes/outros (armadura e escudo vêm do inventário) */
  defenseOther: number;
  /** bônus temporário na Defesa (efeitos de cena/magias); soma com defenseOther */
  defenseOtherTemp?: number;
  /** deslocamento em metros */
  speed: number;
  /** deslocamento de voo em metros (0 = não voa; sem valor, usa o da raça) */
  flySpeed?: number;
  /** deslocamento de escavação em metros */
  burrowSpeed?: number;

  skills: Record<string, SkillState>;
  attacks: AttackItem[];

  racialAbilities: Ability[];
  classAbilities: Ability[];
  powers: PowerEntry[];
  spells: SpellItem[];

  /** tibares (T$) */
  money: number;
  equipment: EquipmentItem[];

  conditions?: string[];
  languages: string;
  appearance?: string;
  personality?: string;
  history?: string;
  /** pontos de experiência acumulados */
  xp: number;
  notes: string;
  /** diário de aventuras jogadas */
  journal?: JournalEntry[];
  /** escolhas da Oficina (para editar a ficha em passos) */
  builder?: BuilderMeta;

  createdAt?: string;
  updatedAt?: string;
}
