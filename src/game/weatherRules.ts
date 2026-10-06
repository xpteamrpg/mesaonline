import type { WeatherType } from "./types";
import { LIGHTING_LABEL, lightingFromWeather } from "./vision";

/**
 * Regras de clima — Tormenta20 Jogo do Ano v1.3, "Clima", p.267 (Chuva = penalidade em Percepção + efeitos de vento forte;
 * Neve = chuva + terreno difícil; Tempestade = penalidade maior em Percepção + efeitos de vendaval + raio; Neblina = camuflagem).
 * O sinal "–" dos valores se perdeu na extração do PDF; as penalidades abaixo seguem o texto ("–5 em Percepção", "–10", "–2", "–5").
 * A redução de alcance de visão por clima NÃO está no livro: é regra da casa do usuário (visão pela metade com chuva, neve e névoa).
 */
export interface WeatherRule {
  label: string;
  /** modificador em testes de Percepção (negativo = penalidade) */
  perception: number;
  /** modificador em testes de ataque à distância */
  ranged: number;
  /** o terreno inteiro conta como difícil (custa o dobro para andar) */
  difficultTerrain: boolean;
  /** camuflagem para quem é atacado (neblina) */
  concealment: "none" | "light";
  /** chance (0–1) por rodada de um raio cair numa criatura aleatória, e o dano dele */
  lightning?: { chance: number; damage: string };
  /** linhas mostradas ao passar o mouse sobre o clima no cabeçalho */
  lines: string[];
}

const HOUSE_VISION = (weather: WeatherType) => `Visão (regra da casa): ${LIGHTING_LABEL[lightingFromWeather(weather)]}.`;

export const WEATHER_RULES: Record<WeatherType, WeatherRule> = {
  clear: { label: "Céu limpo", perception: 0, ranged: 0, difficultTerrain: false, concealment: "none", lines: ["Sem efeitos de clima.", HOUSE_VISION("clear")] },
  rain: {
    label: "Chuva", perception: -5, ranged: -2, difficultTerrain: false, concealment: "none",
    lines: ["−5 em testes de Percepção (livro p.267).", "−2 em ataques à distância (efeitos de vento forte, p.267).", "Vento forte: 50% por rodada de apagar chamas ou dissipar névoas.", HOUSE_VISION("rain")],
  },
  snow: {
    label: "Neve", perception: -5, ranged: -2, difficultTerrain: true, concealment: "none",
    lines: ["Como chuva: −5 em Percepção e −2 em ataques à distância.", "Cria terreno difícil: andar custa o dobro (livro p.267).", HOUSE_VISION("snow")],
  },
  fog: {
    label: "Névoa", perception: 0, ranged: 0, difficultTerrain: false, concealment: "light",
    lines: ["Neblina fornece camuflagem: ataques contra quem está nela têm 20% de chance de falha (livro p.267 e p.238).", "Neblina espessa (camuflagem total além de 1,5 m) não está modelada.", HOUSE_VISION("fog")],
  },
  storm: {
    label: "Tempestade", perception: -10, ranged: -5, difficultTerrain: false, concealment: "none",
    lightning: { chance: 0.1, damage: "8d10" },
    lines: ["−10 em testes de Percepção (livro p.267).", "−5 em ataques à distância (efeitos de vendaval); apaga chamas e dissipa névoas.", "Em combate, no início de cada rodada rola-se 1d10: com 1 (10%) um raio atinge uma criatura aleatória (8d10 de eletricidade). A janelinha mostra o d10 de cada rodada.", HOUSE_VISION("storm")],
  },
  tormenta: {
    label: "Tormenta", perception: 0, ranged: 0, difficultTerrain: false, concealment: "none",
    lines: ["Clima da Tormenta: o livro não traz regras mecânicas para ele (efeito visual).", HOUSE_VISION("tormenta")],
  },
  embers: {
    label: "Cinzas", perception: 0, ranged: 0, difficultTerrain: false, concealment: "none",
    lines: ["Cinzas: o livro não traz regras mecânicas para elas (efeito visual).", HOUSE_VISION("embers")],
  },
};

export const weatherRule = (weather: WeatherType | undefined): WeatherRule => WEATHER_RULES[weather ?? "clear"] ?? WEATHER_RULES.clear;
