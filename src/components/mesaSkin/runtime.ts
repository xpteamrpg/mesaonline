import { createContext, useContext, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { ImgKey } from "./assets";
import type { Combatant, Roll } from "./data";

/**
 * Dados reais da mesa entregues à máscara visual. A máscara só lê este
 * contexto; quem o preenche é a aplicação (src/components/mesa/skinRuntime.ts),
 * a partir do mesmo BOARD/combatState do motor. Nenhum layout depende daqui.
 */
export type SkinMapToken = {
  id: string;
  name: string;
  portrait: ImgKey;
  portraitUrl?: string;
  ring: string;
  /** posição em % do mapa visível */
  x: number;
  y: number;
  hp: number;
  hpMax: number;
  active?: boolean;
  /** selos de condição desenhados sobre o token */
  badges?: { key: string; glyph: string; label: string; tone: "danger" | "warn" | "control" | "buff" }[];
  hiddenBadges?: number;
  /** casas que o token ocupa de lado (1 = normal; Grande 2, Enorme 3, Colossal 4) */
  footprint?: number;
  /** cavaleiro montado: aparece como um selo pequeno sobre a montaria (os dois formam um token só) */
  rider?: { id: string; name: string; portrait: ImgKey; portraitUrl?: string };
};

/** Poder da ficha com os dados do Compêndio (requisito, fonte e descrição). */
export type SkinPower = { id: string; actionId: string; marked: boolean; name: string; type: string; requirement?: string; source?: string; description: string; /** sem ativação: aparece só como passivo */ passive: boolean };

export type SkinFocus = {
  name: string;
  subtitle: string;
  combatSubtitle: string;
  portrait: ImgKey;
  portraitUrl?: string;
  hp: number;
  hpMax: number;
  pm: number;
  pmMax: number;
  defense: number;
  /** Deslocamento em metros (1 quadrado = 1,5 m), com o de voo e o de escavação quando existem. */
  speed?: { walkM: number; flyM?: number; burrowM?: number };
  /** Seis atributos da ficha (valor = bônus), na ordem FOR…CAR. */
  attributes?: { key: string; short: string; value: number }[];
};

export type SkinRuntime = {
  campaign: string;
  scene: string;
  brand: string;
  mapImage: string | null;
  mapName: string;
  mapTokens: SkinMapToken[];
  group: Combatant[];
  /** `roll`: o número que a pessoa tirou na iniciativa. */
  initiative: (Combatant & { turn: number; active?: boolean; roll?: number })[];
  focus: SkinFocus | null;
  saves: { id: string; name: string; value: string; icon: "pentagram" | "shield" | "star"; tone: string }[];
  skills: { name: string; value: string; icon: LucideIcon }[];
  equipment: { id: string; name: string; label: string; icon: LucideIcon; tone: string; /** marcado para o combate */ marked: boolean }[];
  /** Ataques da ficha, com a marca "mostrar em Agir". */
  attacks: { id: string; actionId: string; name: string; detail: string; marked: boolean }[];
  /** Poderes da ficha do personagem em foco. */
  powers: SkinPower[];
  /** Quem joga pode agir sobre o personagem em foco (mestre ou dono do token). */
  canOperateFocus?: boolean;
  /** Magias da ficha do personagem em foco (nome, círculo e custo em PM). */
  spells: { name: string; circle: number; cost: number }[];
  hotkeys: { slot: number; label: string; qty: string; icon: LucideIcon; tone: string; link: string }[];
  rolls: Roll[];
  /** Arrastar um item da mochila para um slot grava a hotkey; botão direito no slot limpa. */
  hotkeyActions?: { assign: (slot: number, itemId: string) => void; clear: (slot: number) => void };
  /** Palco real do VTT (câmera, grade, fog, luzes, paredes...). Substitui a arte figurativa do mapa. */
  stage?: ReactNode;
  /** Escala do mapa (régua no canto), derivada da grade da cena. */
  scale?: { labels: string[]; text: string };
  /** Mestre (ou mesa local) vê e usa tudo; o jogador vê alguns botões escuros e inativos. */
  isMaster: boolean;
  /** Botões da barra esquerda que estão ativos agora (gaveta aberta, régua ligada): ficam em vermelho. */
  activeNav?: string[];
  /** Mostra a régua de escala no canto do mapa (Configurações). */
  showScale?: boolean;
  /** Mesinha de rolagem (d20 da barra esquerda) aberta. */
  diceOpen: boolean;
  /** Conteúdo da mesinha de rolagem, entre a barra esquerda e o mapa. */
  dicePanel?: ReactNode;
  /** Ícone/retrato do jogador no topo */
  playerPortrait: ImgKey;
  playerPortraitUrl?: string;
};

export const SkinRuntimeContext = createContext<SkinRuntime | null>(null);

export function useSkinRuntime(): SkinRuntime {
  const runtime = useContext(SkinRuntimeContext);
  if (!runtime) throw new Error("MesaSkinTable precisa receber o `runtime` com os dados reais da mesa.");
  return runtime;
}
