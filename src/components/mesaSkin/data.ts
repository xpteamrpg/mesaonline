import { createElement } from "react";
import {
  Angry,
  Backpack,
  Bolt,
  BookOpen,
  Boxes,
  Brain,
  Briefcase,
  Church,
  Compass,
  Crosshair,
  Crown,
  Dices,
  Disc,
  Drama,
  Dumbbell,
  Eye,
  EyeOff,
  Flag,
  Flame,
  FlaskConical,
  Footprints,
  Handshake,
  Hammer,
  Headphones,
  HeartPulse,
  Home,
  Key,
  Lock,
  Map,
  Music,
  PawPrint,
  Scroll,
  Search,
  Settings,
  Shapes,
  Ship,
  Shield,
  Sparkles,
  Star,
  Swords,
  User,
  RotateCcw,
  Ruler,
  Sun,
  Target,
  Users,
  WandSparkles,
  Wind,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ImgKey } from "./assets";

export type View = "explore" | "combat";

/** Chapéu de mago com "M": ícone do botão Ferramenta de mestre (mesma assinatura dos ícones do lucide). */
const MasterToolIcon = (({ size = 24, strokeWidth = 2, className }: { size?: number | string; strokeWidth?: number | string; className?: string }) =>
  createElement("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth, strokeLinecap: "round", strokeLinejoin: "round", className, "aria-hidden": true },
    createElement("path", { d: "M12 2.5 7.2 14h9.6L12 2.5Z" }),
    createElement("path", { d: "M4 14h16" }),
    createElement("path", { d: "M7 21v-5l2.5 2.5L12 16l2.5 2.5L17 16v5" }),
  )) as unknown as LucideIcon;

/** `masterOnly`: o botão aparece para todos, mas fica escuro e inativo para o jogador. */
export type NavItem = { id: string; label: string; icon: LucideIcon; masterOnly?: boolean };

/** Em ordem alfabética. Personagem saiu (o ícone do perfil, em cima, abre "Meus personagens") e Configurações também (o engrenagem do cabeçalho). */
export const NAV: NavItem[] = [
  { id: "objects", label: "Ambientação", icon: Boxes, masterOnly: true },
  { id: "scenes", label: "Cenas e\nmapas", icon: Map },
  { id: "inventory", label: "Compêndio", icon: Backpack },
  { id: "journal", label: "Diário", icon: BookOpen },
  { id: "group", label: "Elenco", icon: Users },
  { id: "master", label: "Ferramenta\nde mestre", icon: MasterToolIcon, masterOnly: true },
  { id: "macros", label: "Macros", icon: Music, masterOnly: true },
  { id: "music", label: "Música", icon: Headphones },
  { id: "ruler", label: "Régua", icon: Ruler },
  { id: "tokens", label: "Tokens", icon: Shapes },
];

export const CHROME_ICONS: { id: string; icon: LucideIcon; title: string; masterOnly?: boolean }[] = [
  { id: "ping", icon: Target, title: "Ping: marcar um ponto no mapa" },
  { id: "theme", icon: Sun, title: "Iluminação da mesa" },
  { id: "undo", icon: RotateCcw, title: "Desfazer última rolagem", masterOnly: true },
  { id: "home", icon: Home, title: "Voltar ao site" },
  { id: "settings", icon: Settings, title: "Preferências" },
];

export type Combatant = {
  id: string;
  name: string;
  portrait: ImgKey;
  portraitUrl?: string;
  side: "ally" | "enemy";
  hp: number;
  hpMax: number;
  mp: number;
  mpMax: number;
};

export const GROUP: Combatant[] = [
  { id: "kael", name: "Kael Thorne", portrait: "kael", side: "ally", hp: 22, hpMax: 28, mp: 12, mpMax: 12 },
  { id: "seraphine", name: "Seraphine", portrait: "seraphine", side: "ally", hp: 18, hpMax: 24, mp: 10, mpMax: 10 },
  { id: "sombrio", name: "Guerreiro Sombrio", portrait: "foe", side: "enemy", hp: 14, hpMax: 22, mp: 8, mpMax: 8 },
  { id: "brom", name: "Brom", portrait: "brom", side: "ally", hp: 26, hpMax: 32, mp: 10, mpMax: 10 },
  { id: "tormento", name: "Tormento Menor", portrait: "foe", side: "enemy", hp: 12, hpMax: 18, mp: 6, mpMax: 6 },
];

export const INITIATIVE: (Combatant & { turn: number; active?: boolean })[] = [
  { turn: 1, id: "kael", name: "Kael Thorne", portrait: "kael", side: "ally", hp: 22, hpMax: 28, mp: 12, mpMax: 12, active: true },
  { turn: 2, id: "brasa", name: "Brasa do Crepúsculo", portrait: "foe", side: "enemy", hp: 9, hpMax: 30, mp: 4, mpMax: 10 },
  { turn: 3, id: "seraphine", name: "Seraphine", portrait: "seraphine", side: "ally", hp: 18, hpMax: 24, mp: 10, mpMax: 10 },
  { turn: 4, id: "sombrio", name: "Guerreiro Sombrio", portrait: "foe", side: "enemy", hp: 14, hpMax: 22, mp: 8, mpMax: 8 },
  { turn: 5, id: "tormento", name: "Tormento Menor", portrait: "foe", side: "enemy", hp: 12, hpMax: 18, mp: 6, mpMax: 6 },
  { turn: 6, id: "brom", name: "Brom", portrait: "brom", side: "ally", hp: 26, hpMax: 32, mp: 10, mpMax: 10 },
  { turn: 7, id: "cultista", name: "Cultista da Tormenta", portrait: "foe", side: "enemy", hp: 7, hpMax: 16, mp: 0, mpMax: 0 },
];

export const SAVES: { id: string; name: string; value: string; icon: "pentagram" | "shield" | "star"; tone: string }[] = [
  { id: "saves", name: "Reflexos", value: "+7", icon: "pentagram", tone: "#a855c7" },
  { id: "saves", name: "Fortitude", value: "+6", icon: "shield", tone: "#d9a94c" },
  { id: "saves", name: "Vontade", value: "+5", icon: "star", tone: "#d9a94c" },
];

/** As perícias do Tormenta 20, na ordem da ficha (nomes idênticos aos de T20_SKILLS). */
export const SKILLS: { name: string; value: string; icon: LucideIcon }[] = [
  { name: "Acrobacia", value: "—", icon: Wind },
  { name: "Adestramento", value: "—", icon: PawPrint },
  { name: "Atletismo", value: "—", icon: Dumbbell },
  { name: "Atuação", value: "—", icon: Drama },
  { name: "Cavalgar", value: "—", icon: Footprints },
  { name: "Conhecimento", value: "—", icon: BookOpen },
  { name: "Cura", value: "—", icon: HeartPulse },
  { name: "Diplomacia", value: "—", icon: Handshake },
  { name: "Enganação", value: "—", icon: Sparkles },
  { name: "Fortitude", value: "—", icon: Shield },
  { name: "Furtividade", value: "—", icon: EyeOff },
  { name: "Guerra", value: "—", icon: Flag },
  { name: "Iniciativa", value: "—", icon: Zap },
  { name: "Intimidação", value: "—", icon: Angry },
  { name: "Intuição", value: "—", icon: Brain },
  { name: "Investigação", value: "—", icon: Search },
  { name: "Jogatina", value: "—", icon: Dices },
  { name: "Ladinagem", value: "—", icon: Lock },
  { name: "Luta", value: "—", icon: Swords },
  { name: "Misticismo", value: "—", icon: WandSparkles },
  { name: "Nobreza", value: "—", icon: Crown },
  { name: "Ofício", value: "—", icon: Hammer },
  { name: "Percepção", value: "—", icon: Eye },
  { name: "Pilotagem", value: "—", icon: Ship },
  { name: "Pontaria", value: "—", icon: Crosshair },
  { name: "Reflexos", value: "—", icon: Bolt },
  { name: "Religião", value: "—", icon: Church },
  { name: "Sobrevivência", value: "—", icon: Compass },
  { name: "Vontade", value: "—", icon: Flame },
];

export const EQUIPMENT: { name: string; icon: LucideIcon; tone: string }[] = [
  { name: "Poção de Cura (2)", icon: FlaskConical, tone: "#e0574f" },
  { name: "Ração de Viagem (5)", icon: Briefcase, tone: "#d9a94c" },
  { name: "Corda (15 m)", icon: Disc, tone: "#c8a677" },
  { name: "Tocha (6)", icon: Flame, tone: "#f0a24b" },
  { name: "Kit de Ferramentas", icon: Backpack, tone: "#c8a677" },
];

export const HOTKEYS: { slot: number; label: string; qty: string; icon: LucideIcon; tone: string; link: string }[] = [
  { slot: 1, label: "Poção de Cura", qty: "2", icon: FlaskConical, tone: "#e0574f", link: "hotkey1" },
  { slot: 2, label: "Poção de Mana", qty: "2", icon: FlaskConical, tone: "#4d9be6", link: "hotkey2" },
  { slot: 3, label: "Pergaminho", qty: "3", icon: Scroll, tone: "#d9a94c", link: "hotkey3" },
  { slot: 4, label: "Chave", qty: "4", icon: Key, tone: "#d9a94c", link: "hotkey4" },
  { slot: 5, label: "Mochila", qty: "5", icon: Backpack, tone: "#c8a677", link: "hotkey5" },
];

export const ACTION_TABS: { id: string; label: string; icon: LucideIcon; link: string }[] = [
  { id: "tabActions", label: "Ações", icon: Swords, link: "tabActions" },
  { id: "tabSheet", label: "Ficha", icon: BookOpen, link: "tabSheet" },
  { id: "tabInventory", label: "Inventário", icon: Backpack, link: "tabInventory" },
  { id: "tabPowers", label: "Poderes", icon: Star, link: "tabPowers" },
];

export const COMBAT_ACTIONS: {
  id: string;
  name: string;
  hint: string;
  icon: "boot" | "swords" | "pentagram" | "bag" | "shield" | "hourglass";
  link: string;
  featured?: boolean;
}[] = [
  { id: "actionMove", name: "Mover", hint: "Desloca até 9 m", icon: "boot", link: "actionMove", featured: true },
  { id: "actionAct", name: "Agir", hint: "Ataque, habilidade, manobra", icon: "swords", link: "actionAct" },
  { id: "actionMagic", name: "Magia", hint: "Conjurar magia", icon: "pentagram", link: "actionMagic" },
  { id: "actionItems", name: "Itens", hint: "Usar item do inventário", icon: "bag", link: "actionItems" },
  { id: "actionCondition", name: "Condição", hint: "Ver e gerenciar condições", icon: "shield", link: "actionCondition" },
  { id: "actionWait", name: "Esperar", hint: "Passar o turno", icon: "hourglass", link: "actionWait" },
];

export type Roll = {
  id: string;
  author: string;
  portrait?: ImgKey;
  portraitUrl?: string;
  icon?: "pentagram";
  time: string;
  title: string;
  formula: string;
  result: string;
  outcome: string;
  outcomeTone: string;
  narrative?: boolean;
};

export const ROLLS: Roll[] = [
  {
    id: "r1",
    author: "Kael Thorne",
    portrait: "kael",
    time: "há 53 nm",
    title: "Ataque (Espada Longa)",
    formula: "d20 + 7",
    result: "23",
    outcome: "Acerto crítico!",
    outcomeTone: "#5ec46a",
  },
  {
    id: "r2",
    author: "Seraphine",
    portrait: "seraphine",
    time: "há 8 nm",
    title: "Magia: Bola de Fogo",
    formula: "8d6",
    result: "28",
    outcome: "Dano de fogo",
    outcomeTone: "#f08a3c",
  },
  {
    id: "r3",
    author: "Brom",
    portrait: "brom",
    time: "há 5 nm",
    title: "Teste de Fortitude",
    formula: "d20 + 5",
    result: "12",
    outcome: "Sucesso",
    outcomeTone: "#5ec46a",
  },
  {
    id: "r4",
    author: "Mestre",
    icon: "pentagram",
    time: "",
    title: "Tormenta se intensifica.",
    formula: "",
    result: "",
    outcome: "",
    outcomeTone: "#a855c7",
    narrative: true,
    narrativeText: "A chuva de sangue fica mais densa.",
  } as Roll & { narrativeText: string },
  {
    id: "r5",
    author: "Guerreiro Sombrio",
    portrait: "foe",
    time: "há 8 nm",
    title: "Ataque (Machado)",
    formula: "d20 + 6",
    result: "17",
    outcome: "Acerto",
    outcomeTone: "#5ec46a",
  },
];

export const SCENARIO = {
  campaign: "A Queda de Valrion",
  scene: "Ponte de Tormenta Rubra",
  brand: "Armada Nexus RPG",
};
