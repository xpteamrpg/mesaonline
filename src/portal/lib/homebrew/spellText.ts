/**
 * Rótulos e textos do Criador de magias. ADAPTADO do hub-t20 de RaymundoJMSN (`static/carta.mjs` e `static/pocao.mjs`), portado para
 * TypeScript com autorização do usuário do site. Origem registrada em docs/CRIADOR_DE_MAGIAS_ORIGEM.md.
 */
import type { Alvo, Dados, Efeitos, Eixos, NumItem, ResultadoCusto } from "./spellCost";

export interface MagiaCriada {
  id: string;
  nome: string;
  tipo: "Arcana" | "Divina" | "Universal";
  escola: string;
  circulo: 1 | 2 | 3 | 4 | 5;
  descricao: string;
  eixos: Eixos;
  efeitos: Efeitos;
  aprimoramentos: { texto: string; pm: number; truque?: boolean; requerCirculo?: number | null }[];
  criadaEm: string;
  atualizadaEm: string;
}

export const ROTULOS = {
  execucao: { padrao: "padrão", movimento: "movimento", livre: "livre", reacao: "reação", completa: "completa", longa: "ritual (2+ rodadas)" },
  alcance: { pessoal: "pessoal", toque: "toque", curto: "curto (9m)", medio: "médio (30m)", longo: "longo (90m)", ilimitado: "ilimitado" },
  duracao: { instantanea: "instantânea", "1rodada": "1 rodada", sustentada: "sustentada", cena: "cena", "1dia": "1 dia", permanente: "permanente" },
  resistencia: { nenhuma: "nenhuma", desacredita: "desacredita", "reduz-metade": "reduz à metade", parcial: "parcial", anula: "anula" },
} as const;
type Rotulos = Record<string, string>;
const rot = (grupo: keyof typeof ROTULOS, chave: string) => (ROTULOS[grupo] as Rotulos)[chave] ?? chave;

export const RESTRITO_SINGULAR: Record<string, string> = { humanoides: "humanoide", animais: "animal", objetos: "objeto" };
export const FORMAS: Record<"p" | "m", Record<string, number>> = {
  p: { cone: 6, linha: 9, esfera: 3, cilindro: 3, nuvem: 3, quadrado: 3 },
  m: { cone: 9, linha: 30, esfera: 6, cilindro: 9, nuvem: 6, quadrado: 9 },
};
export const COND_ACENTO: Record<string, string> = { caido: "caído", imovel: "imóvel", vulneravel: "vulnerável", enfeiticado: "enfeitiçado" };
export const condNome = (c?: string) => (c ? COND_ACENTO[c] || c : "");

const tiposDe = (d?: Dados) => (d?.tipos?.length ? d.tipos : [d?.tipo].filter((x): x is string => Boolean(x)));
export function textoTipos(d?: Dados): string {
  const ts = tiposDe(d);
  if (ts.length < 2) return ts[0] || "";
  return `${ts.slice(0, -1).join(", ")} ou ${ts[ts.length - 1]}, à sua escolha`;
}
export const textoDados = (d?: Dados) => (d ? `${d.n}d${d.faces}${d.fixo ? "+" + d.fixo : ""}` : "");
export const textoDano = (m: MagiaCriada) => (m.efeitos.dano ? `${textoDados(m.efeitos.dano)} de ${textoTipos(m.efeitos.dano)}` : "{dano?}");
export const textoCura = (m: MagiaCriada) => (m.efeitos.cura ? `${textoDados(m.efeitos.cura)} PV` : "{cura?}");
const comValor = (l?: NumItem[]) => (l || []).filter((b) => b.valor);
export const textoBonus = (m: MagiaCriada) => { const l = comValor(m.efeitos.bonus); return l.length ? l.map((b) => `+${b.valor} em ${b.em || "…"}`).join(", ") : "{bônus?}"; };
export const textoPenalidade = (m: MagiaCriada) => { const l = comValor(m.efeitos.penalidade); return l.length ? l.map((b) => `−${b.valor} em ${b.em || "…"}`).join(", ") : "{penalidade?}"; };
export const textoCond = (m: MagiaCriada) => (m.efeitos.condicoes?.length ? m.efeitos.condicoes.map(condNome).join(" e ") : "{condição?}");

export function textoArea(a: Alvo): string {
  const forma = a.forma || "esfera";
  const metros = a.metros || FORMAS[a.tamanho === "m" ? "m" : "p"]?.[forma] || 6;
  return forma === "esfera" || forma === "nuvem" || forma === "cilindro" ? `${forma} com ${metros}m de raio` : `${forma} de ${metros}m`;
}
export function textoAlvo(m: MagiaCriada): string {
  const a = m.eixos.alvo;
  if (a.tipo === "pessoal") return "você";
  if (a.tipo === "area") return textoArea(a);
  const tipo = a.restrito ? (RESTRITO_SINGULAR[a.restrito] || a.restrito) : "criatura";
  const plural = a.restrito ? (a.restrito in RESTRITO_SINGULAR ? a.restrito : a.restrito + "s") : "criaturas";
  if (a.qtd === "escolhidas") return `${plural} escolhidas`;
  const q = Number(a.qtd) || 1;
  return `${q} ${q > 1 ? plural : tipo}`;
}
export function textoResistencia(m: MagiaCriada): string {
  const r = m.eixos.resistencia;
  const cd = m.eixos.cdFixa ? ` (CD ${m.eixos.cdFixa})` : "";
  return r === "nenhuma" ? "nenhuma" : `${m.eixos.teste} ${rot("resistencia", r)}${cd}`;
}
export const textoCd = (m: MagiaCriada) => (m.eixos.cdFixa ? `CD ${m.eixos.cdFixa}` : "CD da magia");

type Placeholder = (m: MagiaCriada) => string;
export const PLACEHOLDERS: Record<string, Placeholder> = {
  dano: textoDano, cura: textoCura, bonus: textoBonus, condicao: textoCond,
  alvo: textoAlvo, alcance: (m) => rot("alcance", m.eixos.alcance).replace(/ \(.+\)/, ""),
  duracao: (m) => rot("duracao", m.eixos.duracao), teste: (m) => m.eixos.teste || "",
  penalidade: textoPenalidade,
  efeitoespecial: (m) => m.efeitos.custom?.texto || "{efeito especial?}",
  dano_dado: (m) => textoDados(m.efeitos.dano) || "{dano?}",
  tipo_dano: (m) => textoTipos(m.efeitos.dano) || "{tipo?}",
  cura_dado: (m) => textoDados(m.efeitos.cura) || "{cura?}",
  cd: textoCd,
  resistencia: textoResistencia,
  area: (m) => (m.eixos.alvo?.tipo === "area" ? textoArea(m.eixos.alvo) : "{área?}"),
  execucao: (m) => rot("execucao", m.eixos.execucao),
  escola: (m) => m.escola || "",
  circulo: (m) => `${m.circulo || 1}º círculo`,
  nome: (m) => m.nome || "esta magia",
  condicao1: (m) => condNome(m.efeitos.condicoes?.[0]) || "{condição 1?}",
  condicao2: (m) => condNome(m.efeitos.condicoes?.[1]) || "{condição 2?}",
  condicao3: (m) => condNome(m.efeitos.condicoes?.[2]) || "{condição 3?}",
  condicao4: (m) => condNome(m.efeitos.condicoes?.[3]) || "{condição 4?}",
};

/** Troca os códigos {assim} da descrição pelos valores reais da magia. */
export const substituir = (texto: string, m: MagiaCriada): string =>
  texto.replace(/\{(\w+)\}/g, (tudo, chave: string) => { const fn = PLACEHOLDERS[chave]; return fn ? fn(m) : tudo; });

/** Descrição sem escrita livre: monta uma frase com os efeitos marcados. */
export function resumoDosEfeitos(m: MagiaCriada): string {
  const ef: string[] = [];
  if (m.efeitos.dano) ef.push(textoDano(m));
  if (m.efeitos.cura) ef.push("cura " + textoCura(m));
  if (textoBonus(m) !== "{bônus?}") ef.push(textoBonus(m));
  if (textoPenalidade(m) !== "{penalidade?}") ef.push(textoPenalidade(m));
  if (m.efeitos.condicoes?.length) ef.push("condição: " + textoCond(m));
  if (m.efeitos.custom?.texto) ef.push(m.efeitos.custom.texto);
  return ef.length ? ef.join("; ") + "." : "";
}

// ---- "Itens de uso único" (Livro Básico p.341): uma poção só pode conter magia com alvo criatura/objeto ou em área
const TEM_OBJETO = /objeto|arma|armadura|escudo|item/i;
const TEM_AREA = /[áa]rea|esfera|cone|cilindro|cubo|\blinha\b|quadrado|raio|nuvem/i;
const TEM_CRIATURA = /criatura|voc[êe]|aliad|alvo|humanoide|animal|mortos?-vivos?|esp[íi]rito|inimig|pessoa/i;
export function tipoDePocao(alvoOuArea: string): "granada" | "óleo" | "poção" | null {
  const t = String(alvoOuArea || "").trim();
  if (!t) return null;
  if (TEM_AREA.test(t)) return "granada";
  if (TEM_OBJETO.test(t)) return "óleo";
  if (TEM_CRIATURA.test(t)) return "poção";
  return null;
}
export const tipoDePocaoDosEixos = (alvo?: Alvo) =>
  !alvo ? null : tipoDePocao(alvo.tipo === "area" ? "área" : alvo.tipo === "pessoal" ? "você" : alvo.restrito || "criatura");

/** O texto da magia no formato do livro, para copiar e usar na mesa. */
export function textoPlano(m: MagiaCriada, r: ResultadoCusto): string {
  const linhas = [
    `${(m.nome || "Sem Nome").toUpperCase()} (${m.escola} ${m.tipo} ${m.circulo || 1})`,
    `Execução: ${rot("execucao", m.eixos.execucao)}; Alcance: ${rot("alcance", m.eixos.alcance).replace(/ \(.+\)/, "")}; Alvo: ${textoAlvo(m)}; Duração: ${rot("duracao", m.eixos.duracao)}; Resistência: ${textoResistencia(m)}`,
  ];
  if (m.descricao.trim()) linhas.push(substituir(m.descricao, m));
  else { const r2 = resumoDosEfeitos(m); if (r2) linhas.push(r2); }
  for (const a of m.aprimoramentos.filter((x) => x.texto)) linhas.push(`${a.truque ? "Truque" : "+" + a.pm + " PM"}: ${a.texto}${a.requerCirculo ? ` (requer ${a.requerCirculo}º círculo)` : ""}`);
  linhas.push(`[${r.total}/${r.orcamento} pontos de construção]`);
  return linhas.join("\n");
}
