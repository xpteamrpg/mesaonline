import { PageBanner } from "../layout/PageBanner";
import imgOficina from "../../assets/menu/oficina.jpg";
import { CampaignInvitesBox } from "../campaigns/CampaignInvitesBox";
import React, { useMemo, useState } from "react";
import type { BuilderMeta, CharacterSheet, EquipmentItem } from "../../types/sheet";
import {
  ATTR_KEYS,
  ATTR_NAMES,
  ITEM_CATEGORIES,
  pathLabel,
  POWER_CATEGORIES,
  powerMatchesCategory,
  powersForClass,
  powersForDeity,
  powersForRace,
  SELECTABLE_POWERS,
  skillName,
  SPELL_SCHOOLS,
  T20_CLASSES,
  T20_DEITIES,
  T20_DISTINCTIONS,
  T20_EQUIPMENT,
  T20_ORIGINS,
  T20_RACES,
  T20_SKILLS,
  T20_SPELLS,
  findItemByName,
  findClassByName,
  findRaceByName,
  CLASS_BY_ID,
  RACE_BY_ID,
  raceChoiceActive,
  raceChoiceEffects,
  raceChoiceOptions,
  raceChoicesDone,
  raceWithVariant,
  type AttrKey,
  type T20Origin,
  type T20Item,
} from "../../lib/t20/compendium";
import { buildSheet, itemToAttack, itemToEquipment, mergeEditedSheet, originItemPlan, originItemsFor, powerToEntry, racialVitals, sign, spellToItem, uid } from "../../lib/t20/sheetRules";
import { ItemRow, PowerCard, SpellCard } from "../sheet/SheetCatalogModals";
import { ImagePicker } from "../common/ImagePicker";
import { AvatarZoom } from "../common/AvatarZoom";

interface Props {
  onFinish: (s: CharacterSheet) => void;
  onCancel: () => void;
  campaignNames?: string[];
  /** ficha existente a editar passo a passo */
  initial?: CharacterSheet;
}

/** Compra de atributos do Jogo Básico: 10 pontos; custos por valor. */
const COST: Record<number, number> = { [-1]: -1, 0: 0, 1: 1, 2: 2, 3: 4, 4: 7 };
const POINTS = 10;

/** Dinheiro inicial por nível (Livro Básico, tabela "Dinheiro Inicial"). */
const MONEY_BY_LEVEL: Record<number, number> = {
  1: 24, 2: 300, 3: 600, 4: 1000, 5: 2000, 6: 3000, 7: 5000, 8: 7000, 9: 10000, 10: 13000,
  11: 19000, 12: 27000, 13: 36000, 14: 49000, 15: 66000, 16: 88000, 17: 110000, 18: 150000, 19: 200000, 20: 260000,
};

const forSale = (i: T20Item) => !["Encanto", "Maldição", "Modificação"].includes(i.categoria) || i.preco !== null;
const SHOP_CATEGORIES = ITEM_CATEGORIES.filter((c) => T20_EQUIPMENT.some((i) => i.categoria === c && forSale(i)));
const STEPS = ["Conceito", "Atributos", "Raça", "Classe & Perícias", "Origem & Divindade", "Poderes", "Equipamento", "Magias", "Revisão"];

/**
 * Kits prontos de equipamento inicial. Tupla de cada item: [nome, quantidade?, equipado?, grátis?].
 * "Grátis" marca os itens que o Livro Básico já dá de graça a QUALQUER personagem de 1º nível, independente
 * da origem — 1 arma simples (ou marcial, se proficiente), 1 armadura simples à escolha (ou brunea, se
 * proficiente com pesadas; arcanistas não recebem armadura), escudo leve (se proficiente com escudos),
 * mochila, saco de dormir e traje de viajante. Só esses ficam com preço 0; o resto do kit é comprado com o
 * dinheiro inicial (ver applyKit). Druida e Inventor são um rascunho meu (não confirmado no livro) — o
 * usuário pediu para adicioná-los mas não descreveu os itens; ajustar se estiver errado.
 */
const KITS: { id: string; name: string; classIds: string[]; items: [string, number?, boolean?, boolean?][] }[] = [
  { id: "basico", name: "Kit Básico (só o que é grátis)", classIds: [], items: [["Mochila", 1, false, true], ["Saco de dormir", 1, false, true], ["Traje de viajante", 1, false, true], ["Espada curta", 1, true, true], ["Gibão de peles", 1, true, true]] },
  { id: "guerreiro", name: "Kit do Guerreiro", classIds: ["guerreiro", "cavaleiro", "paladino"], items: [["Espada longa", 1, true, true], ["Escudo pesado", 1, true], ["Brunea", 1, true, true], ["Adaga", 1], ["Mochila", 1, false, true], ["Traje de viajante", 1, false, true], ["Ração de viagem", 5], ["Corda", 1], ["Saco de dormir", 1, false, true]] },
  { id: "arcanista", name: "Kit do Arcanista", classIds: ["arcanista", "bardo"], items: [["Adaga", 1, true, true], ["Bordão", 1], ["Armadura acolchoada", 1, true], ["Mochila", 1, false, true], ["Traje de viajante", 1, false, true], ["Tocha", 5], ["Ração de viagem", 5], ["Saco de dormir", 1, false, true]] },
  { id: "ladino", name: "Kit do Ladino", classIds: ["ladino", "bucaneiro"], items: [["Espada curta", 1, true, true], ["Adaga", 2], ["Armadura de couro", 1, true, true], ["Gazua", 1], ["Corda", 1], ["Mochila", 1, false, true], ["Traje de viajante", 1, false, true], ["Ração de viagem", 5], ["Saco de dormir", 1, false, true]] },
  { id: "clerigo", name: "Kit do Clérigo", classIds: ["clerigo"], items: [["Maça", 1, true, true], ["Escudo leve", 1, true, true], ["Cota de malha", 1, true], ["Símbolo sagrado", 1], ["Mochila", 1, false, true], ["Traje de viajante", 1, false, true], ["Ração de viagem", 5], ["Saco de dormir", 1, false, true]] },
  { id: "druida", name: "Kit do Druida (rascunho, confirmar)", classIds: ["druida"], items: [["Bordão", 1, true, true], ["Gibão de peles", 1, true, true], ["Mochila", 1, false, true], ["Traje de viajante", 1, false, true], ["Corda", 1], ["Ração de viagem", 5], ["Saco de dormir", 1, false, true]] },
  { id: "cacador", name: "Kit do Caçador", classIds: ["cacador", "barbaro", "lutador", "nobre"], items: [["Arco longo", 1, true, true], ["Flechas", 1], ["Machadinha", 1, true], ["Gibão de peles", 1, true, true], ["Mochila", 1, false, true], ["Traje de viajante", 1, false, true], ["Ração de viagem", 5], ["Corda", 1], ["Saco de dormir", 1, false, true]] },
  { id: "inventor", name: "Kit do Inventor (rascunho, confirmar)", classIds: ["inventor"], items: [["Espada curta", 1, true, true], ["Gibão de peles", 1, true, true], ["Mochila", 1, false, true], ["Traje de viajante", 1, false, true], ["Corda", 1], ["Ração de viagem", 5], ["Saco de dormir", 1, false, true]] },
];

const Box: React.FC<{ title: string; right?: React.ReactNode; children: React.ReactNode }> = ({ title, right, children }) => (
  <div className="space-y-4 rounded-lg border border-[#ded7c6] bg-white p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ded7c6] pb-2">
      <h2 className="font-serif text-lg font-black text-[#b92b3a]">{title}</h2>
      {right}
    </div>
    {children}
  </div>
);
const Lbl: React.FC<{ children: React.ReactNode }> = ({ children }) => <label className="mb-1 block text-[10px] font-bold uppercase text-[#726859]">{children}</label>;
const inp = "w-full rounded border border-[#ded7c6] bg-[#fbf9f4] p-2 text-sm outline-none focus:border-[#b92b3a]";
const Pill: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }> = ({ active, onClick, children, disabled }) => (
  <button type="button" disabled={disabled} onClick={onClick} className={`rounded px-2.5 py-1 text-xs font-bold transition-all disabled:opacity-40 ${active ? "bg-[#b92b3a] text-white" : "border border-[#ded7c6] bg-white text-[#726859] hover:bg-[#fbf9f4]"}`}>{children}</button>
);

/** Origens cujo benefício é "+1 em um atributo à sua escolha". */
const originGivesAttr = (o?: T20Origin) => !!o && /\+1 em um atributo (?:à|a) sua escolha/i.test(o.beneficioUnico?.descricao ?? "");

/** Reconstrói o estado da Oficina a partir de uma ficha pronta (com as escolhas guardadas ou, se não houver, deduzindo). */
function restoreFromSheet(s: CharacterSheet) {
  const baseRace = (s.raceId ? RACE_BY_ID.get(s.raceId) : undefined) ?? findRaceByName(s.race) ?? T20_RACES[0];
  const raceVariantId = s.raceVariantId ?? baseRace.variantes?.find((v) => s.race.toLowerCase().includes(v.nome.toLowerCase()))?.id ?? "";
  const race = raceWithVariant(baseRace, raceVariantId);
  const cls = (s.classId ? CLASS_BY_ID.get(s.classId) : undefined) ?? findClassByName(s.class) ?? T20_CLASSES[0];
  const meta = s.builder;
  const raceChoices = meta?.raceChoices ?? [];
  const origin = (s.originId ? T20_ORIGINS.find((o) => o.id === s.originId) : undefined) ?? T20_ORIGINS.find((o) => o.nome === s.origin);
  const originAttr = meta?.originAttr ?? "";
  const bought =
    meta?.bought ??
    (Object.fromEntries(ATTR_KEYS.map((k) => [k, (s.attributes[k]?.value ?? 0) - (race.atributos[k] ?? 0) - (raceChoices.includes(k) ? race.escolhas.valor : 0) - (originAttr === k ? 1 : 0)])) as Record<AttrKey, number>);
  const pathKey = s.path ? cls.caminhos.find((c) => pathLabel(c) === s.path || c === s.path) ?? "" : "";
  const deity = (s.deityId ? T20_DEITIES.find((d) => d.id === s.deityId) : undefined) ?? T20_DEITIES.find((d) => d.nome === s.deity);
  const trained = Object.entries(s.skills).filter(([, v]) => v.trained).map(([k]) => k);
  const fixedChoice: Record<number, string> = meta?.fixedChoice ?? {};
  if (!meta) cls.pericias.escolha.forEach((grp, i) => { const hit = grp.find((id) => trained.includes(id)); if (hit) fixedChoice[i] = hit; });
  const extraSkills = meta?.extraSkills ?? trained.filter((id) => !cls.pericias.fixas.includes(id) && !Object.values(fixedChoice).includes(id));
  const powerSet = new Set(SELECTABLE_POWERS.map((p) => p.id));
  const spellSet = new Set(T20_SPELLS.map((x) => x.id));
  const originPicks = meta?.originPicks ?? (origin && origin.tipo !== "atlas" ? origin.beneficios.map((b, i) => (s.powers.some((p) => p.name === b.nome) || (b.skillId && s.skills[b.skillId]?.trained && !cls.pericias.fixas.includes(b.skillId)) ? i : -1)).filter((i) => i >= 0) : []);
  return {
    hasMeta: !!meta,
    name: s.name,
    campaign: s.campaign,
    avatar: s.avatar ?? "",
    avatarPos: s.avatarPos ?? "50% 20%",
    languages: s.languages,
    appearance: s.appearance ?? "",
    personality: s.personality ?? "",
    history: s.history ?? "",
    level: s.level,
    bought,
    freeMode: meta?.freeMode ?? true,
    raceId: baseRace.id,
    raceVariantId,
    raceExtra: meta?.raceExtra ?? ({} as Record<string, string[]>),
    raceChoices,
    classId: cls.id,
    path: pathKey,
    extraSkills,
    fixedChoice,
    distinctionId: meta?.distinctionId ?? s.powers.find((p) => p.id.startsWith("dist-"))?.id.slice(5) ?? "",
    originId: origin?.id ?? "",
    originPicks,
    originAttr: originAttr as AttrKey | "",
    originItemPicks: meta?.originItemPicks ?? ({} as Record<number, number>),
    deityId: deity?.id ?? "",
    powerIds: s.powers.map((p) => p.id).filter((id) => powerSet.has(id)),
    items: s.equipment.filter((i) => !i.source?.startsWith("Origem")),
    spellIds: s.spells.map((x) => x.id).filter((id) => spellSet.has(id)),
  };
}

export const CharacterBuilderWorkshop: React.FC<Props> = ({ onFinish, onCancel, campaignNames = [], initial }) => {
  const [init] = useState(() => (initial ? restoreFromSheet(initial) : null));
  const [step, setStep] = useState(0);

  // 1 conceito
  const [name, setName] = useState(init?.name ?? "");
  const [campaign, setCampaign] = useState(init?.campaign ?? "Nova campanha");
  const [avatar, setAvatar] = useState(init?.avatar ?? "");
  const [avatarPos, setAvatarPos] = useState(init?.avatarPos ?? "50% 20%");
  const [languages, setLanguages] = useState(init?.languages ?? "Comum");
  const [appearance, setAppearance] = useState(init?.appearance ?? "");
  const [personality, setPersonality] = useState(init?.personality ?? "");
  const [history, setHistory] = useState(init?.history ?? "");
  const [level, setLevel] = useState(init?.level ?? 1);

  // 2 atributos
  const [bought, setBought] = useState<Record<AttrKey, number>>(init?.bought ?? { for: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 });
  const [freeMode, setFreeMode] = useState(init?.freeMode ?? false);

  // 3 raça
  const [raceId, setRaceId] = useState(init?.raceId ?? "humano");
  const [raceVariantId, setRaceVariantId] = useState(init?.raceVariantId ?? "");
  const [raceExtra, setRaceExtra] = useState<Record<string, string[]>>(init?.raceExtra ?? {});
  const [raceChoices, setRaceChoices] = useState<AttrKey[]>(init?.raceChoices ?? []);

  // 4 classe
  const [classId, setClassId] = useState(init?.classId ?? "guerreiro");
  const [path, setPath] = useState(init?.path ?? "");
  const [extraSkills, setExtraSkills] = useState<string[]>(init?.extraSkills ?? []);
  const [fixedChoice, setFixedChoice] = useState<Record<number, string>>(init?.fixedChoice ?? {});
  const [distinctionId, setDistinctionId] = useState(init?.distinctionId ?? "");

  // 5 origem / divindade
  const [originId, setOriginId] = useState(init?.originId ?? "");
  const [originPicks, setOriginPicks] = useState<number[]>(init?.originPicks ?? []);
  const [originAttr, setOriginAttr] = useState<AttrKey | "">(init?.originAttr ?? "");
  const [originItemPicks, setOriginItemPicks] = useState<Record<number, number>>(init?.originItemPicks ?? {});
  const [deityId, setDeityId] = useState(init?.deityId ?? "");

  // 6 poderes
  const [powerIds, setPowerIds] = useState<string[]>(init?.powerIds ?? []);
  const [powerQ, setPowerQ] = useState("");
  const [powerCat, setPowerCat] = useState("");

  // 7 equipamento
  const [items, setItems] = useState<EquipmentItem[]>(init?.items ?? []);
  const [money, setMoney] = useState<number | null>(initial ? initial.money + (init?.items ?? []).reduce((a, i) => a + (i.price ?? 0) * i.quantity, 0) : null);
  const [shopQ, setShopQ] = useState("");
  const [shopCat, setShopCat] = useState("");

  // 8 magias
  const [spellIds, setSpellIds] = useState<string[]>(init?.spellIds ?? []);
  const [spellQ, setSpellQ] = useState("");
  const [spellSchool, setSpellSchool] = useState("");

  const baseRace = T20_RACES.find((r) => r.id === raceId)!;
  const race = useMemo(() => raceWithVariant(baseRace, raceVariantId), [baseRace, raceVariantId]);
  const cls = T20_CLASSES.find((c) => c.id === classId)!;
  const origin = T20_ORIGINS.find((o) => o.id === originId);
  const deity = T20_DEITIES.find((d) => d.id === deityId);
  const distinction = T20_DISTINCTIONS.find((d) => d.id === distinctionId);
  const originBenefits = origin
    ? [
        ...(origin.tipo === "atlas" ? origin.beneficios : originPicks.map((i) => origin.beneficios[i]).filter(Boolean)),
        ...(origin.beneficioUnico ? [{ tipo: "power", nome: origin.beneficioUnico.nome || "Benefício da origem", descricao: origin.beneficioUnico.descricao + (originGivesAttr(origin) && originAttr ? ` (escolhido: +1 em ${ATTR_NAMES[originAttr]})` : "") }] : []),
      ]
    : [];
  const originPlan = useMemo(() => (origin ? originItemPlan(origin) : []), [origin]);
  const originEquip = useMemo(() => (origin ? originItemsFor(origin, originItemPicks) : { items: [] as EquipmentItem[], money: 0 }), [origin, originItemPicks]);

  const pointsUsed = ATTR_KEYS.reduce((a, k) => a + (COST[bought[k]] ?? 0), 0);
  const pointsLeft = POINTS - pointsUsed;

  const finalAttrs = useMemo(() => {
    const out = { ...bought };
    for (const k of ATTR_KEYS) out[k] += race.atributos[k] ?? 0;
    for (const k of raceChoices) out[k] += race.escolhas.valor;
    for (const k of raceChoiceEffects(race, raceExtra).attrs) out[k] += 1;
    if (originAttr && originGivesAttr(origin)) out[originAttr] += 1;
    return out;
  }, [bought, race, raceChoices, raceExtra, originAttr, origin]);

  const autoTrained = useMemo(() => new Set([...cls.pericias.fixas, ...Object.values(fixedChoice), ...originBenefits.filter((b) => b.tipo === "skill" && b.skillId).map((b) => b.skillId!)]), [cls, fixedChoice, originBenefits]);
  const classPool = cls.pericias.pool.length ? cls.pericias.pool : T20_SKILLS.map((s) => s.id);
  const extraAllowed = cls.pericias.extras + Math.max(0, finalAttrs.int) + (race.id === "humano" ? 2 : 0);

  const kits = KITS.filter((k) => k.classIds.includes(classId)).concat(KITS.filter((k) => !k.classIds.includes(classId)));
  const startMoney = money ?? MONEY_BY_LEVEL[level] ?? 24;
  const spent = items.reduce((a, i) => a + (i.price ?? 0) * i.quantity, 0);

  const filteredPowers = useMemo(() => {
    const q = powerQ.trim().toLowerCase();
    return SELECTABLE_POWERS.filter((p) => powerMatchesCategory(p, powerCat) && (!q || p.nome.toLowerCase().includes(q) || p.descricao.toLowerCase().includes(q) || p.subtipo.toLowerCase().includes(q))).slice(0, 200);
  }, [powerQ, powerCat]);
  const suggestedPowers = useMemo(() => [...powersForClass(cls.id, path || undefined), ...powersForRace(race.nome), ...(deity ? powersForDeity(deity.nome) : [])], [cls, path, race, deity]);
  const isCaster = !!cls.atributoChave || /magia|conjur/i.test(cls.descricao) || ["arcanista", "clerigo", "druida", "bardo", "paladino", "mistico"].includes(cls.id);

  const filteredItems = useMemo(() => {
    const q = shopQ.trim().toLowerCase();
    return T20_EQUIPMENT.filter((i) => forSale(i) && (!shopCat || i.categoria === shopCat) && (!q || i.nome.toLowerCase().includes(q)));
  }, [shopQ, shopCat]);

  const spellType = ["clerigo", "druida", "paladino", "frade"].includes(cls.id) ? "Divina" : ["arcanista", "bardo", "mistico"].includes(cls.id) ? "Arcana" : "";
  const filteredSpells = useMemo(() => {
    const q = spellQ.trim().toLowerCase();
    const maxCircle = Math.max(1, Math.min(5, Math.ceil(level / 4)));
    return T20_SPELLS.filter((s) => s.circulo <= maxCircle && (!spellSchool || s.escola === spellSchool) && (!spellType || s.tipo === "Universal" || s.tipo === spellType) && (!q || s.nome.toLowerCase().includes(q)));
  }, [spellQ, spellSchool, spellType, level]);

  const addItem = (it: T20Item) => setItems((p) => [...p, itemToEquipment(it, 1, ["Arma", "Armadura", "Escudo"].includes(it.categoria))]);
  const applyKit = (id: string) => {
    const kit = KITS.find((k) => k.id === id)!;
    // Itens marcados "grátis" (4º valor da tupla) são o que o Livro Básico já dá de graça a qualquer
    // personagem de 1º nível — entram na lista de equipamento (aparecem, contam peso), mas com preço 0,
    // para não descontar do dinheiro inicial duas vezes.
    setItems(kit.items.map(([n, q, e, free]) => { const d = findItemByName(n); if (!d) return null; const eq = itemToEquipment(d, q ?? 1, e ?? false); return free ? { ...eq, price: 0 } : eq; }).filter((x): x is EquipmentItem => !!x));
  };

  const relaxed = !!init && !init.hasMeta;
  const valid = [
    name.trim().length > 0,
    freeMode || pointsLeft === 0,
    relaxed || (raceChoices.length === race.escolhas.quantidade && (!baseRace.varianteObrigatoria || !!raceVariantId) && raceChoicesDone(race, raceExtra)),
    relaxed || (extraSkills.length <= extraAllowed && cls.pericias.escolha.every((_, i) => !!fixedChoice[i])),
    (relaxed || !origin || origin.tipo === "atlas" || originPicks.length === Math.min(origin.escolhas, origin.beneficios.length)) && (relaxed || !originGivesAttr(origin) || !!originAttr) && (relaxed || originPlan.every((e, i) => e.kind !== "choice" || originItemPicks[i] !== undefined)),
    true, true, true, true,
  ];

  const finish = () => {
    const meta: BuilderMeta = { bought, freeMode, raceChoices, raceExtra, originPicks, originItemPicks, originAttr: originAttr || undefined, fixedChoice, extraSkills, powerIds, spellIds, distinctionId: distinctionId || undefined };
    const weapons = items.filter((i) => i.category === "Arma").map((i) => T20_EQUIPMENT.find((x) => x.nome === i.name)).filter((x): x is T20Item => !!x).map(itemToAttack).filter((x): x is NonNullable<typeof x> => !!x);
    const distPowers = distinction ? [{ id: `dist-${distinction.id}`, name: distinction.marca?.nome ?? `Marca da Distinção: ${distinction.nome}`, type: `Distinção · ${distinction.nome}`, description: distinction.marca?.descricao ?? distinction.admissao }] : [];
    const sheet = buildSheet({
      name, avatar: avatar || undefined, avatarPos: avatar ? avatarPos : undefined, raceId, raceVariantId: raceVariantId || undefined, raceExtra, classId, path: path ? pathLabel(path) : undefined, originId: originId || undefined,
      originBenefits,
      deityId: deityId || undefined, deityName: deity?.nome, level, campaign,
      attributes: finalAttrs,
      trainedSkills: [...autoTrained, ...extraSkills],
      powers: [...distPowers, ...powerIds.map((id) => SELECTABLE_POWERS.find((p) => p.id === id)!).filter(Boolean).map(powerToEntry)],
      spells: spellIds.map((id) => T20_SPELLS.find((s) => s.id === id)!).filter(Boolean).map(spellToItem),
      equipment: items,
      attacks: weapons.length ? weapons : undefined,
      money: Math.max(0, startMoney - spent),
      languages, appearance, personality, history,
      notes: `Criado na Oficina de Heróis${origin ? ` · Origem: ${origin.nome}` : ""}.`,
      builder: meta,
      originItemPicks,
    });
    // A história vira a primeira entrada do Diário (não fica mais duplicada em Detalhes). Só na criação —
    // ao editar, mergeEditedSheet já preserva o diário existente, então isso nunca duplica a entrada.
    if (!initial && history.trim()) sheet.journal = [{ id: uid("diario"), adventure: "Bem-vindo a Arton", level, xp: 0, text: history.trim() }];
    onFinish(initial ? mergeEditedSheet(initial, sheet, Math.max(0, startMoney - spent)) : sheet);
  };

  return (
    <div className="mx-auto max-w-[1400px] p-3 text-[#2b261f] sm:p-5">
      <PageBanner image={imgOficina} position="50% 60%" title="Oficina de Heróis" crumb="Oficina de Heróis" />
      <div className="mb-4 rounded-lg border border-[#ded7c6] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 font-serif text-2xl font-black"><span className="flex h-7 w-7 items-center justify-center rounded bg-[#b92b3a] text-xs text-white">⚒️</span> {initial ? "Editar personagem" : "Oficina de Heróis"} — Tormenta 20</h1>
            <p className="mt-1 text-xs text-[#726859]">Passo a passo do Jogo Básico: compra de atributos, raça, classe, perícias, origem, poderes, equipamento e magias — tudo do compêndio oficial.</p>
          </div>
          <button onClick={onCancel} className="rounded border border-[#ded7c6] bg-[#fbf9f4] px-4 py-2 text-xs font-bold text-[#726859] hover:border-[#b92b3a] hover:text-[#b92b3a]">← Cancelar</button>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-[#ded7c6] pt-3">
          {STEPS.map((s, i) => (
            <button key={s} onClick={() => setStep(i)} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase transition-all ${step === i ? "bg-[#b92b3a] text-white shadow" : valid[i] && i < step ? "bg-[#2b8a3e] text-white" : "bg-[#f5f2eb] text-[#726859] hover:bg-[#eae4d5]"}`}>
              <span>{valid[i] && i < step ? "✓" : i + 1}</span><span className="hidden sm:inline">{s}</span>
            </button>
          ))}
        </div>
      </div>

      {relaxed && <div className="mb-4 rounded border border-[#c2892c] bg-[#fef9ed] p-3 text-xs text-[#7a5a12]"><strong>Ficha criada antes da edição em passos.</strong> Os atributos atuais já incluem os bônus de raça e origem. Se escolher bônus de novo nos passos 3 e 5, ajuste os pontos no passo 2 (modo livre) para não contar em dobro.</div>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          {step === 0 && (
            <Box title="1. Conceito do personagem">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><Lbl>Nome *</Lbl><input value={name} onChange={(e) => setName(e.target.value)} className={`${inp} font-bold`} placeholder="Ex.: Vharo Lumen" autoFocus /></div>
                <div><Lbl>Mesa online</Lbl><input list="campaign-options" value={campaign} onChange={(e) => setCampaign(e.target.value)} className={inp} /><datalist id="campaign-options">{campaignNames.map((name) => <option key={name} value={name} />)}</datalist></div>
            <div className="sm:col-span-2"><CampaignInvitesBox /></div>
                <div><Lbl>Nível inicial</Lbl><input type="number" min={1} max={20} value={level} onChange={(e) => setLevel(Math.max(1, Math.min(20, Number(e.target.value))))} className={inp} /></div>
                <div><Lbl>Idiomas</Lbl><input value={languages} onChange={(e) => setLanguages(e.target.value)} className={inp} /></div>
                <div className="sm:col-span-2"><ImagePicker label="Retrato do personagem (arraste a imagem no quadro para escolher o foco)" value={avatar} pos={avatarPos} onChange={(v, p) => { setAvatar(v); if (p) setAvatarPos(p); }} /></div>
                <div><Lbl>Aparência</Lbl><input value={appearance} onChange={(e) => setAppearance(e.target.value)} className={inp} /></div>
                <div><Lbl>Personalidade</Lbl><input value={personality} onChange={(e) => setPersonality(e.target.value)} className={inp} /></div>
              </div>
              <div><Lbl>História inicial (vira a 1ª entrada do Diário na ficha)</Lbl><textarea value={history} onChange={(e) => setHistory(e.target.value)} rows={3} className={inp} /></div>
            </Box>
          )}

          {step === 1 && (
            <Box title="2. Atributos (compra de pontos)" right={<label className="flex items-center gap-1 text-[11px] text-[#726859]"><input type="checkbox" checked={freeMode} onChange={(e) => setFreeMode(e.target.checked)} className="accent-[#b92b3a]" /> modo livre (sem limite)</label>}>
              <div className={`flex flex-wrap items-center justify-between gap-2 rounded border p-3 ${pointsLeft === 0 ? "border-[#2b8a3e] bg-[#ebfbee]" : pointsLeft < 0 ? "border-[#b92b3a] bg-[#fbebee]" : "border-[#c2892c] bg-[#fef9ed]"}`}>
                <div><span className="text-[10px] font-bold uppercase text-[#726859]">Pontos restantes</span><div className="font-serif text-3xl font-black">{pointsLeft} <span className="text-sm text-[#726859]">/ {POINTS}</span></div></div>
                <div className="text-[11px] text-[#726859]">Custo: −1 = −1 · 0 = 0 · +1 = 1 · +2 = 2 · +3 = 4 · +4 = 7</div>
                <button type="button" onClick={() => setBought({ for: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 })} className="rounded border border-[#ded7c6] bg-white px-3 py-1 text-xs font-bold text-[#726859]">Zerar</button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {ATTR_KEYS.map((k) => {
                  const v = bought[k];
                  const racial = (race.atributos[k] ?? 0) + (raceChoices.includes(k) ? race.escolhas.valor : 0);
                  const canUp = freeMode ? v < 10 : v < 4 && pointsLeft - (COST[v + 1] - COST[v]) >= 0;
                  const canDown = freeMode ? v > -5 : v > -1;
                  return (
                    <div key={k} className="rounded-lg border border-[#ded7c6] bg-[#fbf9f4] p-3 text-center">
                      <span className="text-xs font-bold uppercase">{k}</span>
                      <div className="text-[10px] text-[#726859]">{ATTR_NAMES[k]}</div>
                      <div className="my-2 flex items-center justify-center gap-1">
                        <button type="button" disabled={!canDown} onClick={() => setBought({ ...bought, [k]: v - 1 })} className="h-7 w-7 rounded border border-[#ded7c6] bg-white text-sm font-bold disabled:opacity-30">−</button>
                        <span className="w-12 font-serif text-2xl font-black">{sign(v)}</span>
                        <button type="button" disabled={!canUp} onClick={() => setBought({ ...bought, [k]: v + 1 })} className="h-7 w-7 rounded border border-[#ded7c6] bg-white text-sm font-bold disabled:opacity-30">+</button>
                      </div>
                      <div className="text-[10px] text-[#726859]">custo {COST[v] ?? "—"}</div>
                      <div className="mt-1 rounded bg-white py-1 text-xs font-bold text-[#b92b3a]" title="valor final com raça">Final {sign(finalAttrs[k])}{racial ? <span className="text-[#9c9180]"> ({sign(racial)} raça)</span> : null}</div>
                    </div>
                  );
                })}
              </div>
            </Box>
          )}

          {step === 2 && (
            <Box title="3. Raça">
              <div className="grid max-h-96 grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                {T20_RACES.map((r) => (
                  <button type="button" key={r.id} onClick={() => { setRaceId(r.id); setRaceVariantId(""); setRaceChoices([]); setRaceExtra({}); }} className={`rounded-lg border p-3 text-left transition-all ${raceId === r.id ? "border-[#b92b3a] bg-[#fbebee] shadow-sm" : "border-[#ded7c6] bg-white hover:bg-[#fbf9f4]"}`}>
                    <div className="flex items-center justify-between text-sm font-bold"><span>{r.nome}</span><span className="rounded bg-[#eee] px-1.5 py-0.5 text-[10px]">{r.tamanho}</span></div>
                    <div className="text-[10px] text-[#9c9180]">{r.fonte}</div>
                    <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                      {Object.entries(r.atributos).map(([k, v]) => <span key={k} className={`rounded px-1.5 py-0.5 font-bold ${v > 0 ? "bg-[#ebfbee] text-[#2b8a3e]" : "bg-[#fbebee] text-[#b92b3a]"}`}>{sign(v)} {k.toUpperCase()}</span>)}
                      {r.escolhas.quantidade > 0 && <span className="rounded bg-[#e7f5ff] px-1.5 py-0.5 font-bold text-[#1c7ed6]">+{r.escolhas.valor} em {r.escolhas.quantidade} à escolha</span>}
                    </div>
                  </button>
                ))}
              </div>
              {baseRace.variantes && baseRace.variantes.length > 0 && (
                <div className="rounded border border-[#c2892c]/50 bg-[#fef9ed] p-3">
                  <div className="text-xs font-bold text-[#7a5a12]">{baseRace.varianteRotulo ?? "Variante"} de {baseRace.nome}{baseRace.varianteObrigatoria && !raceVariantId ? " (obrigatório)" : ""}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {!baseRace.varianteObrigatoria && <Pill active={!raceVariantId} onClick={() => { setRaceVariantId(""); setRaceChoices([]); setRaceExtra({}); }}>Base</Pill>}
                    {baseRace.variantes.map((v) => <Pill key={v.id} active={raceVariantId === v.id} onClick={() => { setRaceVariantId(v.id); setRaceChoices([]); setRaceExtra({}); }}>{v.nome}</Pill>)}
                  </div>
                </div>
              )}
              {(race.escolhasExtras ?? []).filter((c) => raceChoiceActive(c, raceExtra)).map((c) => {
                const picked = raceExtra[c.id] ?? [];
                const qtd = c.tipo === "atributo-aleatorio" ? 1 : c.quantidade ?? 1;
                const toggle = (v: string) => setRaceExtra((p) => { const cur = p[c.id] ?? []; const next = cur.includes(v) ? cur.filter((x) => x !== v) : qtd === 1 ? [v] : [...cur, v]; const out = { ...p, [c.id]: next }; for (const d of race.escolhasExtras ?? []) if (d.dependeDe?.id === c.id) delete out[d.id]; return out; });
                const opts = c.tipo === "atributo-aleatorio" ? [] : raceChoiceOptions(c);
                const comDescricao = opts.some((o) => o.d);
                return (
                  <div key={c.id} className="rounded border border-[#7a3fe0]/40 bg-[#f3eeff] p-3">
                    <div className="text-xs font-bold">{c.rotulo}{c.tipo === "atributo-aleatorio" ? "" : ` — escolha ${c.ateQuantidade ? "até " : ""}${qtd} (${picked.length}/${qtd})`}</div>
                    {c.tipo === "atributo-aleatorio" ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button type="button" disabled={picked.length > 0} onClick={() => setRaceExtra((p) => ({ ...p, [c.id]: [ATTR_KEYS[Math.floor(Math.random() * ATTR_KEYS.length)]] }))} className="rounded bg-[#7a3fe0] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">🎲 Rolar atributo aleatório</button>
                        <span className="text-xs font-bold">{picked.length ? `Sorteado: ${ATTR_NAMES[picked[0] as AttrKey]} +1` : "Ainda não rolado (obrigatório)"}</span>
                      </div>
                    ) : opts.length > 15 ? (
                      <div className="mt-2">
                        <select value={picked[0] ?? ""} onChange={(e) => setRaceExtra((p) => ({ ...p, [c.id]: e.target.value ? [e.target.value] : [] }))} className="w-full rounded border border-[#ded7c6] bg-white p-2 text-xs font-semibold"><option value="">— escolha —</option>{opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
                        {picked[0] && <p className="mt-1 text-[11px] text-[#5c5446]">{opts.find((o) => o.v === picked[0])?.d}</p>}
                      </div>
                    ) : comDescricao ? (
                      <div className="mt-2 space-y-1">
                        {opts.map((o) => {
                          const on = picked.includes(o.v);
                          return (
                            <label key={o.v} className={`flex cursor-pointer items-start gap-2 rounded border p-1.5 text-xs ${on ? "border-[#7a3fe0] bg-white" : "border-[#ded7c6] bg-white/60"}`}>
                              <input type="checkbox" checked={on} disabled={!on && qtd > 1 && picked.length >= qtd} onChange={() => toggle(o.v)} className="mt-0.5 accent-[#7a3fe0]" />
                              <span><strong>{o.l}</strong>{o.d ? <span className="text-[#5c5446]"> — {o.d}</span> : null}</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {opts.map((o) => <Pill key={o.v} active={picked.includes(o.v)} disabled={!picked.includes(o.v) && qtd > 1 && picked.length >= qtd} onClick={() => toggle(o.v)}>{o.l}</Pill>)}
                      </div>
                    )}
                  </div>
                );
              })}
              {race.escolhas.quantidade > 0 && (
                <div className="rounded border border-[#1c7ed6]/40 bg-[#e7f5ff] p-3">
                  <div className="text-xs font-bold">Escolha {race.escolhas.quantidade} atributo(s) para receber +{race.escolhas.valor} ({raceChoices.length}/{race.escolhas.quantidade})</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ATTR_KEYS.filter((k) => !(race.escolhas.bloqueados ?? []).includes(k)).map((k) => (
                      <Pill key={k} active={raceChoices.includes(k)} disabled={!raceChoices.includes(k) && raceChoices.length >= race.escolhas.quantidade} onClick={() => setRaceChoices((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))}>{ATTR_NAMES[k]}</Pill>
                    ))}
                  </div>
                </div>
              )}
              <div className="rounded border border-[#ded7c6] bg-[#fbf9f4] p-3">
                <h3 className="mb-1 text-xs font-bold uppercase text-[#b92b3a]">Habilidades de {race.nome} <span className="font-normal normal-case text-[#9c9180]">· {race.fonte}</span></h3>
                <ul className="space-y-1 text-xs">{race.habilidades.map((t, i) => <li key={i}><strong>• {t.nome}:</strong> <span className="text-[#5c5446]">{t.descricao}</span></li>)}</ul>
                {race.bonusTexto && <p className="mt-2 text-[10px] italic text-[#726859]">Atributos: {race.bonusTexto}</p>}
              </div>
            </Box>
          )}

          {step === 3 && (
            <Box title="4. Classe & Perícias">
              <div className="grid max-h-72 grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
                {T20_CLASSES.map((c) => (
                  <button type="button" key={c.id} onClick={() => { setClassId(c.id); setExtraSkills([]); setFixedChoice({}); setSpellIds([]); }} className={`rounded-lg border p-3 text-left transition-all ${classId === c.id ? "border-[#b92b3a] bg-[#fbebee] shadow-sm" : "border-[#ded7c6] bg-white hover:bg-[#fbf9f4]"}`}>
                    <div className="flex items-center justify-between text-sm font-bold"><span>{c.nome}</span>{c.fonte !== "Tormenta 20 — Jogo Básico" && <span className="rounded bg-[#e7f5ff] px-1 text-[9px] text-[#1c7ed6]">{c.fonte}</span>}</div>
                    <div className="text-[10px] font-semibold text-[#b92b3a]">PV {c.pvInicial}+CON (+{c.pvPorNivel}/nv) · PM {c.pmInicial} (+{c.pmPorNivel}/nv)</div>
                    <div className="mt-1 text-[10px] text-[#726859]">{c.proficiencias}</div>
                  </button>
                ))}
              </div>
              <p className="rounded border border-[#ded7c6] bg-[#fbf9f4] p-2 text-xs text-[#5c5446]"><strong>{cls.nome}:</strong> {cls.descricao} <span className="text-[#9c9180]">· Atributo-chave: {cls.atributoTexto}</span></p>

              {cls.caminhos.length > 0 && (
                <div>
                  <Lbl>Caminho / variante de classe {cls.id === "arcanista" ? "(obrigatório para Arcanista)" : "(opcional)"}</Lbl>
                  <div className="flex flex-wrap gap-1.5">
                    <Pill active={!path} onClick={() => setPath("")}>Base</Pill>
                    {cls.caminhos.map((pt) => {
                      const v = cls.variantes.find((x) => x.id === pt);
                      return <Pill key={pt} active={path === pt} onClick={() => setPath(pt)}>{pathLabel(pt)}{v?.fonte && v.fonte !== "Tormenta 20 — Jogo Básico" ? <span className="ml-1 opacity-60">({v.fonte})</span> : null}</Pill>;
                    })}
                  </div>
                  {path && (cls.habilidadesCaminho[path]?.length ?? 0) > 0 && (
                    <ul className="mt-2 space-y-1 rounded border border-[#ded7c6] bg-[#faf8f3] p-2 text-[11px]">
                      {cls.habilidadesCaminho[path].slice(0, 6).map((h, i) => <li key={i}><span className="font-serif font-bold text-[#b92b3a]">{h.nivel}º</span> <strong>{h.nome}</strong> — <span className="text-[#5c5446]">{h.descricao}</span></li>)}
                    </ul>
                  )}
                </div>
              )}

              <div>
                <Lbl>Distinção (opcional — Heróis de Arton e suplementos)</Lbl>
                <select value={distinctionId} onChange={(e) => setDistinctionId(e.target.value)} className={inp}>
                  <option value="">— nenhuma —</option>
                  {T20_DISTINCTIONS.map((d) => <option key={d.id} value={d.id}>{d.nome} ({d.fonte})</option>)}
                </select>
                {distinction && (
                  <div className="mt-2 space-y-1 rounded border border-[#ded7c6] bg-[#faf8f3] p-2 text-[11px]">
                    <p><strong className="text-[#b92b3a]">Admissão:</strong> {distinction.admissao}</p>
                    {distinction.marca && <p><strong className="text-[#b92b3a]">{distinction.marca.nome}:</strong> {distinction.marca.descricao}</p>}
                    <p className="text-[#9c9180]">{distinction.poderes.length} poderes de distinção disponíveis no catálogo do compêndio.</p>
                  </div>
                )}
              </div>

              {cls.pericias.escolha.map((opts, i) => (
                <div key={i}><Lbl>Perícia obrigatória — escolha uma</Lbl><div className="flex flex-wrap gap-1.5">{opts.map((id) => <Pill key={id} active={fixedChoice[i] === id} onClick={() => setFixedChoice({ ...fixedChoice, [i]: id })}>{skillName(id)}</Pill>)}</div></div>
              ))}

              <div>
                <div className="mb-1 flex items-center justify-between"><Lbl>Perícias treinadas</Lbl><span className={`text-xs font-bold ${extraSkills.length > extraAllowed ? "text-[#b92b3a]" : "text-[#2b8a3e]"}`}>{extraSkills.length} / {extraAllowed} à escolha</span></div>
                <p className="mb-2 text-[10px] text-[#726859]">Fixas: <strong className="text-[#b92b3a]">{[...autoTrained].map(skillName).join(", ") || "—"}</strong> · Extras = {cls.pericias.extras} da classe + INT ({Math.max(0, finalAttrs.int)}){race.id === "humano" ? " + 2 (Versátil)" : ""}</p>
                <div className="flex flex-wrap gap-1.5">
                  {T20_SKILLS.map((s) => {
                    const fixed = autoTrained.has(s.id);
                    const inPool = classPool.includes(s.id);
                    const on = extraSkills.includes(s.id);
                    return <Pill key={s.id} active={fixed || on} disabled={fixed || (!on && (!inPool || extraSkills.length >= extraAllowed))} onClick={() => setExtraSkills((p) => (on ? p.filter((x) => x !== s.id) : [...p, s.id]))}>{s.nome} <span className="opacity-60">{s.atributo.toUpperCase()}</span>{!inPool && !fixed ? " ✕" : ""}</Pill>;
                  })}
                </div>
              </div>
            </Box>
          )}

          {step === 4 && (
            <Box title="5. Origem & Divindade">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Lbl>Origem</Lbl>
                  <select value={originId} onChange={(e) => { setOriginId(e.target.value); setOriginPicks([]); setOriginAttr(""); setOriginItemPicks({}); }} className={inp}>
                    <option value="">— sem origem —</option>
                    {["Tormenta 20 — Jogo Básico", ...[...new Set(T20_ORIGINS.map((o) => o.fonte))].filter((f) => f !== "Tormenta 20 — Jogo Básico")].map((f) => (
                      <optgroup key={f} label={f}>{T20_ORIGINS.filter((o) => o.fonte === f).map((o) => <option key={o.id} value={o.id}>{o.nome}{o.regiao ? ` — ${o.regiao}` : ""}</option>)}</optgroup>
                    ))}
                  </select>
                  {origin && (
                    <div className="mt-2 space-y-2 rounded border border-[#ded7c6] bg-[#faf8f3] p-2 text-xs">
                      <p className="text-[#5c5446]">{origin.descricao.slice(0, 300)}{origin.descricao.length > 300 ? "…" : ""}</p>
                      <p><strong className="text-[#b92b3a]">Itens iniciais:</strong> {origin.itens || "—"}</p>
                      {originPlan.map((e, i) => e.kind === "choice" && (
                        <div key={i} className="rounded border border-[#c2892c]/40 bg-[#fef9ed] p-2">
                          <div className="mb-1 font-bold text-[#c2892c]">Item inicial — escolha um{originItemPicks[i] === undefined ? " (obrigatório)" : ""}</div>
                          <div className="flex flex-wrap gap-1">{e.options.map((o, j) => <Pill key={j} active={originItemPicks[i] === j} onClick={() => setOriginItemPicks({ ...originItemPicks, [i]: j })}>{o.charAt(0).toUpperCase() + o.slice(1)}</Pill>)}</div>
                        </div>
                      ))}
                      {origin.tipo === "atlas" ? (
                        <div><strong className="text-[#b92b3a]">Benefícios (automáticos):</strong><ul className="mt-1 space-y-0.5">{origin.beneficios.map((b, i) => <li key={i}>• <strong>{b.nome}</strong> — {b.descricao}</li>)}</ul></div>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between"><strong className="text-[#b92b3a]">Escolha {Math.min(origin.escolhas, origin.beneficios.length)} benefício(s):</strong><span className={`font-bold ${originPicks.length === Math.min(origin.escolhas, origin.beneficios.length) ? "text-[#2b8a3e]" : "text-[#c2892c]"}`}>{originPicks.length}/{Math.min(origin.escolhas, origin.beneficios.length)}</span></div>
                          <div className="mt-1 space-y-1">
                            {origin.beneficios.map((b, i) => {
                              const on = originPicks.includes(i);
                              return (
                                <label key={i} className={`flex cursor-pointer items-start gap-2 rounded border p-1.5 ${on ? "border-[#b92b3a] bg-[#fbebee]" : "border-[#ded7c6] bg-white"}`}>
                                  <input type="checkbox" checked={on} disabled={!on && originPicks.length >= origin.escolhas} onChange={() => setOriginPicks((p) => (on ? p.filter((x) => x !== i) : [...p, i]))} className="mt-0.5 accent-[#b92b3a]" />
                                  <span><span className="rounded bg-[#f5f2eb] px-1 text-[9px] font-bold uppercase text-[#726859]">{b.tipo === "skill" ? "perícia" : "poder"}</span> <strong>{b.nome}</strong> — <span className="text-[#5c5446]">{b.descricao}</span></span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {origin.beneficioUnico && <p><strong className="text-[#b92b3a]">{origin.beneficioUnico.nome || "Benefício único"}:</strong> {origin.beneficioUnico.descricao}</p>}
                      {originGivesAttr(origin) && (
                        <div className="rounded border border-[#b92b3a]/30 bg-[#fbebee] p-2">
                          <div className="mb-1 font-bold text-[#b92b3a]">Escolha o atributo que recebe +1{originAttr ? ` — escolhido: ${ATTR_NAMES[originAttr]}` : " (obrigatório)"}</div>
                          <div className="flex flex-wrap gap-1">{ATTR_KEYS.map((k) => <Pill key={k} active={originAttr === k} onClick={() => setOriginAttr(k)}>{ATTR_NAMES[k]}</Pill>)}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <Lbl>Divindade</Lbl>
                  <select value={deityId} onChange={(e) => setDeityId(e.target.value)} className={inp}><option value="">— não devoto —</option>{T20_DEITIES.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}</select>
                  {deity && (
                    <div className="mt-2 space-y-1 rounded border border-[#ded7c6] bg-[#faf8f3] p-2 text-xs">
                      <p className="font-serif font-bold text-[#b92b3a]">{deity.nome}, {deity.epiteto}</p>
                      <p><strong className="text-[#b92b3a]">Energia:</strong> {deity.energia} · <strong className="text-[#b92b3a]">Arma:</strong> {deity.arma} · <strong className="text-[#b92b3a]">Devotos:</strong> {deity.devotos}</p>
                      <p><strong className="text-[#b92b3a]">Obrigações:</strong> {deity.obrigacoes.join("; ")}</p>
                      {deity.poderesConcedidos.length > 0 && <p><strong className="text-[#b92b3a]">Poderes concedidos ({deity.poderesConcedidos.length}):</strong> {deity.poderesConcedidos.map((p) => p.nome).join(", ")} <span className="text-[#9c9180]">— escolha no passo 6</span></p>}
                    </div>
                  )}
                </div>
              </div>
            </Box>
          )}

          {step === 5 && (
            <Box title="6. Poderes" right={<span className="text-xs font-bold text-[#2b8a3e]">{powerIds.length} selecionado(s)</span>}>
              <p className="text-xs text-[#726859]">No 1º nível você recebe os poderes de raça/origem e um poder de classe a cada nível a partir do 2º (devotos também escolhem um poder concedido). Sugestões para <strong>{cls.nome}{path ? ` (${pathLabel(path)})` : ""}</strong>, <strong>{race.nome}</strong>{deity ? <> e <strong>{deity.nome}</strong></> : null} aparecem primeiro.</p>
              <input value={powerQ} onChange={(e) => setPowerQ(e.target.value)} placeholder="Buscar poder…" className={inp} />
              <div className="flex flex-wrap gap-1.5">{POWER_CATEGORIES.map((c) => <Pill key={c.id} active={powerCat === c.id} onClick={() => setPowerCat(c.id)}>{c.label}</Pill>)}</div>
              <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                {(powerQ || powerCat ? filteredPowers : [...suggestedPowers, ...filteredPowers.filter((p) => !suggestedPowers.includes(p))].slice(0, 200)).map((p) => (
                  <PowerCard key={p.id} p={p} action={<button type="button" onClick={() => setPowerIds((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))} className={`shrink-0 rounded px-3 py-1.5 text-xs font-bold uppercase text-white ${powerIds.includes(p.id) ? "bg-[#b92b3a]" : "bg-[#2b8a3e]"}`}>{powerIds.includes(p.id) ? "Remover" : "+ Escolher"}</button>} />
                ))}
              </div>
            </Box>
          )}

          {step === 6 && (
            <Box title="7. Equipamento inicial" right={<div className="flex items-center gap-2 text-xs"><span className="font-bold text-[#726859]">Dinheiro inicial</span><input type="number" value={startMoney} onChange={(e) => setMoney(Number(e.target.value))} className="w-20 rounded border border-[#ded7c6] bg-white p-1 text-center font-bold" /><span className="font-bold text-[#c2892c]">T$ · gasto {spent} · resta {startMoney - spent}</span></div>}>
              <div>
                <span className="mb-1.5 block text-[11px] font-bold uppercase text-[#726859]">⚡ Kits prontos (1 clique)</span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{kits.map((k) => <button type="button" key={k.id} onClick={() => applyKit(k.id)} className="rounded border border-[#ded7c6] bg-[#fbf9f4] p-2 text-left hover:border-[#b92b3a] hover:bg-[#fbebee]"><div className="text-xs font-bold text-[#b92b3a]">{k.name}</div><div className="text-[10px] text-[#726859]">{k.items.map((i) => i[0]).join(", ")}</div></button>)}</div>
              </div>
              {originEquip.items.length > 0 && (
                <div className="rounded border border-[#c2892c]/50 bg-[#fef9ed] p-2 text-xs">
                  <div className="font-bold uppercase text-[#c2892c]">🎒 Itens de origem — {origin?.nome} (já entram na ficha)</div>
                  <ul className="mt-1 list-disc pl-4 text-[#5c5446]">{originEquip.items.map((i) => <li key={i.id}>{i.name}{i.quantity > 1 ? ` ×${i.quantity}` : ""}</li>)}</ul>
                  {originEquip.money > 0 && <div className="mt-1 font-bold text-[#5c5446]">+ T$ {originEquip.money}</div>}
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2 rounded border border-[#ded7c6] bg-[#fbf9f4] p-3">
                  <div className="flex items-center justify-between"><span className="text-xs font-bold uppercase text-[#b92b3a]">Loja</span></div>
                  <input value={shopQ} onChange={(e) => setShopQ(e.target.value)} placeholder="Filtrar…" className="w-full rounded border border-[#ded7c6] bg-white p-1.5 text-xs" />
                  <div className="flex flex-wrap gap-1"><Pill active={!shopCat} onClick={() => setShopCat("")}>Todos</Pill>{SHOP_CATEGORIES.map((c) => <Pill key={c} active={shopCat === c} onClick={() => setShopCat(c)}>{c}</Pill>)}</div>
                  <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">{filteredItems.map((it) => <ItemRow key={it.id} it={it} action={<button type="button" onClick={() => addItem(it)} className="shrink-0 rounded bg-[#2b8a3e] px-2 py-1 text-[10px] font-bold text-white">+ Add</button>} />)}</div>
                </div>
                <div className="space-y-2 rounded border border-[#ded7c6] bg-white p-3">
                  <div className="flex items-center justify-between text-xs font-bold uppercase text-[#726859]"><span>Itens ({items.length})</span><button type="button" onClick={() => setItems([])} className="text-[10px] text-[#b92b3a] hover:underline">Limpar</button></div>
                  {items.length === 0 ? <div className="p-6 text-center text-xs text-[#9c9180]">Escolha um kit ou adicione itens da loja.</div> : (
                    <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
                      {items.map((it) => (
                        <div key={it.id} className="flex items-center justify-between rounded border border-[#ded7c6] bg-[#fbf9f4] p-1.5 text-xs">
                          <label className="flex items-center gap-2"><input type="checkbox" checked={it.equipped} onChange={() => setItems((p) => p.map((x) => (x.id === it.id ? { ...x, equipped: !x.equipped } : x)))} title="Equipado" className="accent-[#b92b3a]" /><div><div className="font-bold">{it.name} <span className="font-normal text-[#9c9180]">×{it.quantity}</span></div><div className="text-[10px] text-[#726859]">{it.price !== null ? `T$ ${it.price}` : "T$ —"} · {it.slots} slot · {it.category}</div></div></label>
                          <button type="button" onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))} className="px-1 text-[#b92b3a]">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Box>
          )}

          {step === 7 && (
            <Box title="8. Magias" right={<span className="text-xs font-bold text-[#2b8a3e]">{spellIds.length} conhecida(s)</span>}>
              {!isCaster && <p className="rounded border border-[#c2892c] bg-[#fef9ed] p-2 text-xs text-[#7a5a12]">{cls.nome} não é conjurador por padrão. Você pode pular este passo ou adicionar magias obtidas por poderes/raça.</p>}
              {spellType && <p className="text-[10px] text-[#726859]">Mostrando magias <strong>{spellType}s</strong> e universais até o círculo permitido pelo nível {level}.</p>}
              <input value={spellQ} onChange={(e) => setSpellQ(e.target.value)} placeholder="Buscar magia…" className={inp} />
              <div className="flex flex-wrap gap-1"><Pill active={!spellSchool} onClick={() => setSpellSchool("")}>Todas</Pill>{SPELL_SCHOOLS.map((s) => <Pill key={s} active={spellSchool === s} onClick={() => setSpellSchool(s)}>{s}</Pill>)}</div>
              <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                {filteredSpells.map((s) => <SpellCard key={s.id} s={s} action={<button type="button" onClick={() => setSpellIds((p) => (p.includes(s.id) ? p.filter((x) => x !== s.id) : [...p, s.id]))} className={`shrink-0 rounded px-3 py-1.5 text-xs font-bold uppercase text-white ${spellIds.includes(s.id) ? "bg-[#b92b3a]" : "bg-[#2b8a3e]"}`}>{spellIds.includes(s.id) ? "Remover" : "+ Aprender"}</button>} />)}
              </div>
            </Box>
          )}

          {step === 8 && (
            <Box title="9. Revisão">
              <div className="rounded border border-[#ded7c6] bg-[#fbf9f4] p-4 text-xs">
                <div className="font-serif text-base font-bold text-[#b92b3a]">{name || "—"} — {race.nome} {cls.nome}{path ? ` (${pathLabel(path)})` : ""} {level}º nível</div>
                <div className="mt-1 text-[#5c5446]">Mesa online: {campaign}{origin ? ` · Origem: ${origin.nome}` : ""}{deity ? ` · Devoto de ${deity.nome}` : ""}{distinction ? ` · Distinção: ${distinction.nome}` : ""}</div>
                <div className="mt-2 grid grid-cols-6 gap-1 text-center">{ATTR_KEYS.map((k) => <div key={k} className="rounded border border-[#ded7c6] bg-white p-1"><div className="text-[9px] font-bold text-[#726859]">{k.toUpperCase()}</div><div className="font-serif text-sm font-black">{sign(finalAttrs[k])}</div></div>)}</div>
                <div className="mt-2 text-[#5c5446]"><strong>Perícias:</strong> {[...autoTrained, ...extraSkills].map(skillName).join(", ") || "—"}</div>
                <div className="text-[#5c5446]"><strong>Poderes:</strong> {powerIds.length} · <strong>Magias:</strong> {spellIds.length} · <strong>Itens:</strong> {items.length} · <strong>T$</strong> {startMoney - spent}</div>
                {!valid[0] && <p className="mt-2 font-bold text-[#b92b3a]">⚠ Informe o nome no passo 1.</p>}
                {!valid[1] && <p className="font-bold text-[#b92b3a]">⚠ Distribua todos os pontos de atributo (ou ative o modo livre).</p>}
                {!valid[2] && <p className="font-bold text-[#b92b3a]">⚠ Escolha os bônus raciais livres.</p>}
                {!valid[3] && <p className="font-bold text-[#b92b3a]">⚠ Verifique as perícias obrigatórias / quantidade.</p>}
                {!valid[4] && <p className="font-bold text-[#b92b3a]">⚠ Escolha os benefícios, o atributo e os itens iniciais da origem.</p>}
              </div>
              <button type="button" disabled={!valid.every(Boolean)} onClick={finish} className="w-full rounded bg-[#b92b3a] px-8 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-lg hover:bg-[#9c1f2d] disabled:opacity-40">{initial ? "✦ Salvar alterações e abrir a ficha" : "✦ Criar herói e abrir a ficha"}</button>
            </Box>
          )}

          <div className="flex items-center justify-between border-t border-[#ded7c6] pt-4">
            <button type="button" disabled={step === 0} onClick={() => setStep((s) => s - 1)} className="rounded border border-[#ded7c6] bg-white px-4 py-2 text-xs font-bold text-[#726859] disabled:opacity-40">← Anterior</button>
            <span className="text-xs font-bold text-[#726859]">Passo {step + 1} de {STEPS.length}</span>
            {step < STEPS.length - 1 ? <button type="button" onClick={() => setStep((s) => s + 1)} className="rounded bg-[#b92b3a] px-6 py-2 text-xs font-bold uppercase text-white shadow hover:bg-[#9c1f2d]">Próximo →</button> : <button type="button" disabled={!valid.every(Boolean)} onClick={finish} className="rounded bg-[#2b8a3e] px-6 py-2 text-xs font-bold uppercase text-white shadow disabled:opacity-40">Salvar ficha ✓</button>}
          </div>
        </div>

        <aside className="lg:col-span-4">
          <div className="space-y-3 rounded-lg border border-[#ded7c6] bg-white p-4 shadow-sm lg:sticky lg:top-28">
            <h3 className="border-b border-[#ded7c6] pb-1.5 font-serif text-xs font-bold uppercase tracking-wider text-[#b92b3a]">Prévia em tempo real</h3>
            <div className="flex items-center gap-2.5">
              <AvatarZoom src={avatar || undefined} pos={avatarPos} name={name || "?"} className="h-14 w-14" />
              <div><div className="font-serif text-sm font-black">{name || "Aventureiro"}</div><div className="text-[11px] font-semibold text-[#b92b3a]">{race.nome} · {cls.nome}{path ? ` (${pathLabel(path)})` : ""} · {level}º</div></div>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center">{ATTR_KEYS.map((k) => <div key={k} className="rounded border border-[#ded7c6] bg-[#fbf9f4] p-1"><div className="text-[9px] font-bold text-[#726859]">{k.toUpperCase()}</div><div className="font-serif text-sm font-black">{sign(finalAttrs[k])}</div></div>)}</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded border border-[#b92b3a]/20 bg-[#fbebee] p-1.5"><span className="block text-[10px] font-bold text-[#b92b3a]">PV</span><span className="font-serif text-lg font-black">{cls.pvInicial + finalAttrs.con + racialVitals(race.id).pv1 + (level - 1) * (cls.pvPorNivel + finalAttrs.con + racialVitals(race.id).pvLvl)}</span></div>
              <div className="rounded border border-[#1c7ed6]/20 bg-[#e7f5ff] p-1.5"><span className="block text-[10px] font-bold text-[#1c7ed6]">PM</span><span className="font-serif text-lg font-black">{cls.pmInicial + cls.pmPorNivel * (level - 1) + racialVitals(race.id).pmLvl * level}</span></div>
              <div className="rounded border border-[#ded7c6] bg-[#fbf9f4] p-1.5"><span className="block text-[10px] font-bold text-[#726859]">Defesa</span><span className="font-serif text-lg font-black">{10 + finalAttrs.des + items.filter((i) => i.equipped).reduce((a, i) => a + (i.defenseBonus ?? 0), 0)}</span></div>
            </div>
            <ul className="space-y-1 border-t border-[#eee] pt-2 text-[11px]">{STEPS.map((s, i) => <li key={s} className="flex items-center gap-2"><span className={valid[i] && (i < step || i === STEPS.length - 1) ? "text-[#2b8a3e]" : "text-[#c2b7a0]"}>{valid[i] && i < step ? "✓" : "○"}</span><span className={i === step ? "font-bold" : "text-[#726859]"}>{s}</span></li>)}</ul>
          </div>
        </aside>
      </div>
    </div>
  );
};
