import type { CharacterSheet } from "../types/sheet";
import { withBase } from "../../utils/assetUrl";
import renardJson from "./ready/renard.json";
import astolfoJson from "./ready/astolfo.json";
import lagrimaJson from "./ready/lagrima.json";

/**
 * Heróis prontos do playtest: fichas importadas dos PDFs reais (ver tests/_gerarHeroisProntos.test.ts) com retrato e
 * token em public/herois. Aparecem em "Personagens prontos" (Clonar leva para Meus Personagens) e ficam à disposição do
 * Mestre na Mesa, mesmo sem estarem em nenhuma campanha.
 */
export interface ReadyHero {
  id: string;
  sheet: CharacterSheet;
  /** arte inteira (cartão da galeria) e foco do enquadramento */
  portrait: string;
  pos: string;
}

const make = (json: unknown, portrait: string, pos: string): ReadyHero => {
  const sheet = json as CharacterSheet;
  return { id: sheet.id, sheet: { ...sheet, avatar: sheet.avatar ? withBase(sheet.avatar) : sheet.avatar }, portrait: withBase(portrait), pos };
};

export const READY_HEROES: ReadyHero[] = [
  make(renardJson, "/herois/renard.webp", "50% 12%"),
  make(astolfoJson, "/herois/kalop.webp", "50% 22%"),
  make(lagrimaJson, "/herois/m.webp", "50% 40%"),
];

export const isReadyHeroId = (id: string | undefined | null) => !!id && READY_HEROES.some((hero) => hero.id === id);
