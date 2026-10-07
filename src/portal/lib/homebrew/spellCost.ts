/**
 * Motor de custo do Criador de magias (balanceamento por pontos). ADAPTADO do hub-t20 de RaymundoJMSN
 * (https://github.com/RaymundoJMSN/hub-t20: `static/custo.mjs`, com a tabela `data/tabela-custos.json` e `data/tarifas-pm.json`),
 * copiado e portado para TypeScript com autorização do usuário do site (06–07/10/2026). Origem registrada em docs/CRIADOR_DE_MAGIAS_ORIGEM.md.
 * Não é regra oficial de Tormenta 20: os preços são uma estimativa da comunidade, calibrada contra as magias oficiais.
 */
import tabelaRaw from "./tabela-custos.json";
import tarifasRaw from "./tarifas-pm.json";

export interface Dados { n: number; faces: number; fixo?: number; tipo?: string; tipos?: string[] }
export interface NumItem { valor: number; em?: string; escopo?: "especifico" | "combate" | "amplo" }
export interface Alvo {
  tipo: "pessoal" | "alvos" | "area";
  qtd?: number | "escolhidas";
  tamanho?: "p" | "m" | "g";
  restrito?: string | null;
  restritoCustom?: boolean;
  forma?: string;
  metros?: number;
}
export interface Eixos {
  execucao: string; alcance: string; duracao: string; resistencia: string; teste?: string; alvo: Alvo;
  cdFixa?: number | null; umaVezPorCena?: boolean; componente?: boolean;
}
export interface Efeitos {
  dano?: Dados; cura?: Dados; bonus?: NumItem[]; penalidade?: NumItem[]; condicoes?: string[];
  custom?: { texto: string; pontos: number }; resistenciaForcada?: boolean;
}
export interface AprimoramentoCriado { texto: string; pm: number; truque?: boolean; requerCirculo?: number | null }
export interface MagiaParaCusto { circulo?: number; escola?: string; eixos?: Partial<Eixos>; efeitos?: Efeitos; aprimoramentos?: AprimoramentoCriado[] }

interface EscolaPerfil {
  n: number; perfil: string; dano: string; dano_n?: number; tiposDano?: string[]; cura: string; areas: string; areas_n?: number;
  condCategorias?: string[]; condRaras?: boolean; testeTipico?: string | null;
}
export interface TabelaCustos {
  orcamento: Record<string, number>;
  max_devolvido: Record<string, number> | number;
  eixos: { execucao: Record<string, number>; alcance: Record<string, number>; duracao: Record<string, number>; resistencia: Record<string, number>; alvo: Record<string, number> };
  areas: { g_max_m?: Record<string, number> } & Record<string, unknown>;
  efeitos: {
    dano_por_dado: Record<string, number>; dano_fixo_por_ponto: number; cura_por_dado: Record<string, number>; cura_fixa_por_ponto: number;
    condicoes_tier: Record<string, string[]>; condicao_custo_por_tier: Record<string, number>; condicao_rider_dano_mult?: number;
    utilitario_base?: number; bonus_escalonado: number[]; bonus_escopo_mult?: Record<string, number>; dano_repetivel_mult?: number;
    dano_puro_bonus_dados?: Record<string, number>; custo_tipo_dano?: Record<string, number>;
  };
  travas?: Record<string, { tier_max_area?: number; tier4_exige?: { alvos_max: number }; permanente_so_custom?: boolean }>;
  aval_mestre_pct?: number;
  escolas?: Record<string, EscolaPerfil | string>;
  condicao_categoria?: Record<string, string[]>;
  cd_fixa?: { neutra?: number; por_ponto?: number; min?: number; max?: number };
  modificadores?: { uma_vez_por_cena?: number; componente_material?: number };
}
export const TABELA = tabelaRaw as unknown as TabelaCustos;

export interface TarifaPm { n: number; pm_mediana: number; por_circulo?: Record<string, number> }
export interface TarifasPm { tarifas: Record<string, TarifaPm>; efeito_novo_por_circulo: Record<string, { n: number; pm_mediana: number }> }
export const TARIFAS = tarifasRaw as unknown as TarifasPm;

/** PM total que leva a magia ao poder de cada círculo (Tabela 4-1 do Livro Básico: 1, 3, 6, 10 e 15 PM). */
export const ORDEM_CIRCULO: [number, number][] = [[1, 1], [3, 2], [6, 3], [10, 4], [15, 5]];
export const PM_BASE_DO_CIRCULO: Record<number, number> = { 1: 1, 2: 3, 3: 6, 4: 10, 5: 15 };

export function circuloEfetivo(pmTotal: number): number {
  let c = 1;
  for (const [pm, circ] of ORDEM_CIRCULO) if (pmTotal >= pm) c = circ;
  return c;
}

export const semAcento = (x?: string) => (x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const temValor = (x: unknown) => (Array.isArray(x) ? x.length > 0 : !!x);

function custoDados(d: Dados | undefined, porDado: Record<string, number>, fixoPorPonto: number): number {
  if (!d || !d.n) return 0;
  return d.n * (porDado[String(d.faces)] ?? porDado["6"]) + (d.fixo || 0) * fixoPorPonto;
}

function tierCondicao(nome: string, tiers: Record<string, string[]>): number {
  for (const [tier, lista] of Object.entries(tiers)) if (lista.includes(nome)) return Number(tier);
  return 2; // condição desconhecida: tier médio
}

export const ehOfensiva = (m: MagiaParaCusto): boolean =>
  !!m.efeitos?.dano || !!m.efeitos?.condicoes?.length || temValor(m.efeitos?.penalidade) || !!m.efeitos?.resistenciaForcada;

export interface ResultadoCusto {
  total: number; partes: Record<string, number>; orcamento: number; avisos: string[]; bloqueada: boolean; precisaAval: boolean;
  limiteAval: number; devolvido: number; valido: boolean;
}

/** Quanto custa a magia em pontos de construção, o orçamento do círculo, avisos e se está válida. */
export function calcular(magia: MagiaParaCusto, t: TabelaCustos = TABELA): ResultadoCusto {
  const e = t.eixos, ef = t.efeitos;
  const circulo = magia.circulo || 1;
  const eixos = (magia.eixos || {}) as Partial<Eixos>;
  const efeitos = magia.efeitos || {};
  const travas = t.travas?.[String(circulo)] || {};
  const partes: Record<string, number> = {};
  const avisos: string[] = [];
  let bloqueada = false;

  const alvo: Alvo = eixos.alvo || { tipo: "alvos", qtd: 1 };

  partes.execucao = e.execucao[eixos.execucao ?? ""] ?? 0;
  let alcance = eixos.alcance;
  if (alcance === "pessoal" && alvo.tipo === "alvos") {
    alcance = "toque";
    avisos.push("Alcance pessoal com alvo externo não existe — cobrado como toque.");
  }
  partes.alcance = e.alcance[alcance ?? ""] ?? 0;
  partes.duracao = e.duracao[eixos.duracao ?? ""] ?? 0;

  if (alvo.tipo === "pessoal") partes.alvo = e.alvo.pessoal;
  else if (alvo.tipo === "area") partes.alvo = e.alvo["area_" + (alvo.tamanho || "p")];
  else if (alvo.qtd === "escolhidas") partes.alvo = e.alvo.escolhidas;
  else partes.alvo = e.alvo["1alvo"] + (Math.max(1, Number(alvo.qtd) || 1) - 1) * e.alvo.alvo_extra;
  if (alvo.tipo === "alvos" && alvo.restrito) partes.alvo += e.alvo.restrito ?? -1;

  const condicoes = efeitos.condicoes || [];
  const ofensiva = ehOfensiva(magia);
  const res = eixos.resistencia || "nenhuma";
  partes.resistencia = ofensiva ? (e.resistencia[res] ?? 0) : 0;
  if (!ofensiva && res !== "nenhuma") avisos.push("Resistência só se aplica a magia ofensiva (com dano, condição ou penalidade).");

  // CD fixa: não escala com o nível (a normal é 10 + metade do nível + atributo).
  const cdEscrita = Number(eixos.cdFixa) || 0;
  if (cdEscrita) {
    const c = t.cd_fixa || {};
    const cd = Math.min(Math.max(cdEscrita, c.min ?? 2), c.max ?? 30);
    if (!ofensiva || res === "nenhuma") {
      avisos.push("CD fixa só faz sentido com teste de resistência — escolha um teste.");
    } else {
      partes.cd = (cd - (c.neutra ?? 15)) * (c.por_ponto ?? 0.5);
      if (partes.cd) avisos.push(`CD fixa ${cd} (a normal cresce: 10 + metade do nível + atributo): ${partes.cd > 0 ? "+" : ""}${partes.cd} pt.`);
    }
  }

  let tiposDano: string[] = [];
  if (efeitos.dano) {
    partes.dano = custoDados(efeitos.dano, ef.dano_por_dado, ef.dano_fixo_por_ponto);
    // dano com duração = repetível toda rodada
    if (["sustentada", "cena", "1dia"].includes(eixos.duracao ?? "")) {
      partes.dano *= ef.dano_repetivel_mult ?? 1.5;
      avisos.push(`Dano com duração ${eixos.duracao} repete a cada rodada — custo do dano ×${ef.dano_repetivel_mult ?? 1.5}.`);
    }
    // blast puro: dano é o ÚNICO efeito e instantâneo -> o círculo dá dados de bônus
    const puro = !efeitos.cura && !temValor(efeitos.bonus) && !temValor(efeitos.penalidade) && !condicoes.length &&
      !(efeitos.custom && efeitos.custom.texto) && eixos.duracao === "instantanea";
    const nBonus = Number(ef.dano_puro_bonus_dados?.[String(circulo)] || 0);
    if (puro && nBonus > 0) {
      const precoDado = ef.dano_por_dado[String(efeitos.dano.faces)] ?? ef.dano_por_dado["6"];
      const desconto = Math.min(Math.min(efeitos.dano.n, nBonus) * precoDado, partes.dano / 2);
      partes.dano -= desconto;
      avisos.push(`Blast puro: o ${circulo}º círculo desconta ${nBonus} dado(s) do dano (−${desconto} pts).`);
    }
    // tipo de dano: mundano -1, luz/trevas +1, psíquico/essência +2; 2+ tipos = escolhido na hora: paga o mais caro
    tiposDano = efeitos.dano.tipos?.length ? efeitos.dano.tipos : [efeitos.dano.tipo].filter((x): x is string => Boolean(x));
    const deltas = tiposDano.map((tp) => ef.custo_tipo_dano?.[semAcento(tp)] ?? 0);
    const delta = deltas.length ? Math.max(...deltas) : 0;
    if (delta) {
      partes.dano += delta;
      avisos.push(`Dano de ${tiposDano.join(" / ")}: ${delta > 0 ? "+" : ""}${delta} pt${tiposDano.length > 1 ? " — a lista paga o tipo mais caro" : " (raridade de resistência)"}.`);
    }
  }
  if (efeitos.cura) partes.cura = custoDados(efeitos.cura, ef.cura_por_dado, ef.cura_fixa_por_ponto);
  if (efeitos.dano && efeitos.cura) avisos.push("Dano E cura na mesma magia: os dois somam. Se são modos alternativos (como Infligir Ferimentos), o mestre pode cobrar só o maior.");

  const custoBonus = (valor: number, escopo?: string) => {
    const esc = ef.bonus_escalonado;
    const v = Math.max(1, Math.min(Math.abs(valor), esc.length));
    const mult = ef.bonus_escopo_mult?.[escopo || "especifico"] ?? 1;
    return esc[v - 1] * mult;
  };
  const custoListaBonus = (lista: NumItem[]) => {
    const custos = lista.filter((b) => b.valor).map((b) => custoBonus(b.valor, b.escopo)).sort((a, b) => b - a);
    // o mais caro paga cheio; extras pagam metade (mesma regra das condições)
    return custos.reduce((soma, c, i) => soma + (i === 0 ? c : c / 2), 0);
  };
  const bonusLista = efeitos.bonus || [];
  if (bonusLista.length) {
    partes.bonus = custoListaBonus(bonusLista);
    if (bonusLista.some((b) => Math.abs(b.valor) > ef.bonus_escalonado.length)) avisos.push(`Bônus acima de +${ef.bonus_escalonado.length}: precifique como efeito especial.`);
  }
  const penLista = efeitos.penalidade || [];
  if (penLista.length) partes.penalidade = custoListaBonus(penLista);

  if (condicoes.length) {
    const tiers = condicoes.map((c) => tierCondicao(c, ef.condicoes_tier)).sort((a, b) => b - a);
    const custoTier = (tier: number) => ef.condicao_custo_por_tier[String(tier)];
    // a mais cara paga cheio; extras pagam metade do próprio tier
    let custo = custoTier(tiers[0]) + tiers.slice(1).reduce((s, tr) => s + custoTier(tr) / 2, 0);
    // condição junto com dano é rider ("atordoado se falhar"): metade
    if (efeitos.dano) custo *= ef.condicao_rider_dano_mult ?? 0.5;
    partes.condicao = custo;

    if (!efeitos.dano && travas.tier4_exige && tiers[0] >= 4) {
      const ok = alvo.tipo === "alvos" && !(Number(alvo.qtd) > travas.tier4_exige.alvos_max) && alvo.qtd !== "escolhidas" && res !== "nenhuma";
      if (!ok) {
        bloqueada = true;
        avisos.push(`Condição incapacitante no ${circulo}º círculo só como o Sono oficial: 1 alvo e com teste de resistência.`);
      }
    }
    if (!efeitos.dano && travas.tier_max_area && tiers[0] > travas.tier_max_area && (alvo.tipo === "area" || alvo.qtd === "escolhidas")) {
      bloqueada = true;
      avisos.push(`Condição forte (tier ${tiers[0]}) em área/escolhidas não existe no ${circulo}º círculo — nenhuma oficial faz isso.`);
    }
  }

  // permanente com cura, bônus ou condição só do 3º círculo para cima
  if (travas.permanente_so_custom && eixos.duracao === "permanente" && (efeitos.cura || temValor(efeitos.bonus) || temValor(efeitos.penalidade) || condicoes.length)) {
    bloqueada = true;
    avisos.push(`Duração permanente no ${circulo}º círculo só para dano (armadilha, como a Runa de Proteção) ou efeito especial com aval do mestre — nunca cura/bônus/condição.`);
  }

  // limites que barateiam a magia
  const mods = t.modificadores || {};
  if (eixos.umaVezPorCena) {
    if (ofensiva) partes.limite = mods.uma_vez_por_cena ?? -1;
    else avisos.push("\"Uma vez por cena\" só desconta em magia que afeta alvos (dano, condição ou penalidade).");
  }
  if (eixos.componente) partes.componente = mods.componente_material ?? -1;

  if (efeitos.custom && (efeitos.custom.texto || efeitos.custom.pontos)) {
    partes.custom = Number(efeitos.custom.pontos) || 0;
    if (!efeitos.custom.texto) avisos.push("Efeito especial sem descrição.");
    if (partes.custom <= 0) avisos.push("Efeito especial sem preço: combine o valor com o mestre.");
  }

  // cap de devolução (anti-empilhar desvantagem), por círculo
  const maxDev = typeof t.max_devolvido === "object" ? (t.max_devolvido[String(circulo)] ?? 4) : t.max_devolvido;
  const devolvidoBruto = Object.values(partes).filter((v) => v < 0).reduce((a, b) => a + b, 0);
  let ajusteCap = 0;
  if (-devolvidoBruto > maxDev) {
    ajusteCap = -devolvidoBruto - maxDev;
    avisos.push(`Desvantagens devolvem no máximo ${maxDev} pontos (cortado ${ajusteCap}).`);
  }

  const total = Object.values(partes).reduce((a, b) => a + b, 0) + ajusteCap;
  const orcamento = t.orcamento[String(circulo)];

  // aprimoramentos: não gastam pontos; valida o trilho de círculo
  const pmBase = PM_BASE_DO_CIRCULO[circulo];
  for (const ap of magia.aprimoramentos || []) {
    const circ = circuloEfetivo(pmBase + (Number(ap.pm) || 0));
    if (circ > circulo && !ap.requerCirculo) avisos.push(`Aprimoramento "+${ap.pm} PM" leva a magia ao poder de ${circ}º círculo — considere a trava "requer ${circ}º círculo".`);
  }

  // coerência de escola, derivada do perfil das oficiais
  const escolaRaw = magia.escola ? t.escolas?.[magia.escola] : undefined;
  const escola = escolaRaw && typeof escolaRaw === "object" ? escolaRaw : undefined;
  if (escola && escola.n) {
    if (efeitos.dano) {
      if (escola.dano === "bloqueio") {
        bloqueada = true;
        avisos.push(`${magia.escola} não causa dano em NENHUMA das ${escola.n} oficiais — o perfil é ${escola.perfil}. Troque a escola (ex.: Evocação).`);
      } else if (escola.tiposDano?.length && !escola.tiposDano.some((td) => tiposDano.some((tp) => semAcento(td) === semAcento(tp)))) {
        avisos.push(`${magia.escola} oficial causa dano de ${escola.tiposDano.join("/")} — ${tiposDano.join("/")} foge do perfil.`);
      } else if (escola.dano === "aviso") {
        avisos.push(`Dano em ${magia.escola} é raríssimo nas oficiais (${escola.dano_n}/${escola.n}).`);
      }
    }
    if (efeitos.cura) {
      if (escola.cura === "bloqueio") {
        bloqueada = true;
        avisos.push(`Nenhuma das ${escola.n} oficiais de ${magia.escola} cura — cura é Evocação (luz) ou Necromancia (drenagem). Troque a escola.`);
      } else if (escola.cura === "aviso") {
        avisos.push(`Cura em ${magia.escola} é rara nas oficiais (drenagem vampírica).`);
      }
    }
    if (condicoes.length) {
      if (escola.condRaras) {
        avisos.push(`Condições em ${magia.escola} quase não existem nas oficiais — o perfil é ${escola.perfil}.`);
      } else if (escola.condCategorias?.length) {
        const catDe = (c: string) => {
          for (const [cat, lista] of Object.entries(t.condicao_categoria || {})) if (lista.includes(c)) return cat;
          return "outra";
        };
        const fora = [...new Set(condicoes.map(catDe))].filter((cat) => cat !== "outra" && !escola.condCategorias!.includes(cat));
        if (fora.length) avisos.push(`${magia.escola} nunca impõe condição ${fora.join("/")} nas oficiais (categorias da escola: ${escola.condCategorias.join(", ")}).`);
      }
    }
    if (ofensiva && res !== "nenhuma" && escola.testeTipico && eixos.teste && eixos.teste !== escola.testeTipico) {
      avisos.push(`${magia.escola} quase sempre resiste com ${escola.testeTipico} nas oficiais — ${eixos.teste} é incomum.`);
    }
    if (alvo.tipo === "area" && escola.areas === "raro") avisos.push(`Magia de área é rara em ${magia.escola} nas oficiais (${escola.areas_n}/${escola.n}).`);
  }

  const limiteAval = orcamento + Math.max(1, Math.round(orcamento * (t.aval_mestre_pct ?? 0.15)));
  const precisaAval = !bloqueada && total > orcamento && total <= limiteAval;
  if (precisaAval) avisos.push(`Passou do orçamento em ${total - orcamento} pt(s) — dá para usar, mas combine com o mestre.`);
  return {
    total, partes, orcamento, avisos, bloqueada, precisaAval, limiteAval,
    devolvido: Math.max(devolvidoBruto, -maxDev),
    valido: total <= orcamento && !bloqueada,
  };
}

/** Tarifa oficial de PM para um delta de aprimoramento (vinda das tarifas mineradas das magias oficiais). */
function sugerirPm(chaveDelta: string, circulo = 1): { pm: number; n: number; generico?: boolean } | null {
  const t = TARIFAS.tarifas[chaveDelta];
  if (t) return { pm: t.por_circulo?.[String(circulo)] ?? t.pm_mediana, n: t.n };
  const en = TARIFAS.efeito_novo_por_circulo[String(circulo)];
  return en ? { pm: en.pm_mediana, n: en.n, generico: true } : null;
}

/** Reconhece o que um aprimoramento escrito muda e devolve quanto PM as oficiais cobram por isso (para alertar quando foge). */
export function tarifaDoTexto(texto: string, magia: MagiaParaCusto): { pm: number; n: number; chave: string } | null {
  const n = semAcento(texto);
  if (!n) return null;
  const faces = magia.efeitos?.dano?.faces || 6;
  const tenta: string[] = [];
  if (/aumenta o dano/.test(n)) tenta.push(`dano+:1d${faces}`, "dano+:1d6");
  if (/aumenta a cura/.test(n)) tenta.push("cura+:1d8");
  if (/(aumenta o numero de alvos|afeta todos)/.test(n)) tenta.push("alvos+:1");
  const alc = n.match(/muda o alcance para (\w+)/);
  if (alc) tenta.push(`alcance->:${alc[1]}`);
  if (/muda a duracao para permanente/.test(n)) tenta.push("duracao->:permanente");
  if (/muda a resistencia/.test(n)) tenta.push("resistencia->:reflexos");
  if (/(muda a area|aumenta a area|muda o alvo para (uma )?(esfera|cone|linha))/.test(n)) tenta.push("area->");
  for (const chave of tenta) {
    const s = sugerirPm(chave, 1);
    if (s && !s.generico) return { pm: s.pm, n: s.n, chave };
  }
  return null;
}
