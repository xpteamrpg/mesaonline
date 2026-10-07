export type View =
  | "home"
  | "about"
  | "sheet"
  | "workshop"
  | "characters"
  | "companions"
  | "campaigns"
  | "online"
  | "compendium"
  | "books"
  | "races"
  | "classes"
  | "equipment"
  | "spells"
  | "bestiary"
  | "homebrew"
  | "guilds"
  | "createChar"
  | "readyChars"
  | "account"
  | "accountProfile"
  | "accountOrders";

export const VIEW_HASH: Record<View, string> = {
  home: "#/",
  about: "#/sobre",
  sheet: "#/ficha",
  workshop: "#/oficina",
  characters: "#/personagens",
  companions: "#/ajudantes",
  campaigns: "#/campanhas",
  online: "#/mesa-online",
  compendium: "#/compendio",
  books: "#/livros",
  races: "#/racas",
  classes: "#/classes",
  equipment: "#/equipamentos",
  spells: "#/magias",
  bestiary: "#/monstros",
  homebrew: "#/homebrew",
  guilds: "#/guildas",
  createChar: "#/personagens/novo",
  readyChars: "#/personagens/prontos",
  account: "#/conta",
  accountProfile: "#/conta/perfil",
  accountOrders: "#/conta/pedidos",
};

export function viewFromHash(): View {
  const h = window.location.hash.toLowerCase();
  if (h.startsWith("#/oneshots")) return "online";
  const hit = (Object.entries(VIEW_HASH) as [View, string][]).sort((a, b) => b[1].length - a[1].length).find(([, hash]) => hash !== "#/" && h.startsWith(hash));
  if (hit) return hit[0];
  if (h.includes("workshop") || h.startsWith("#/forja")) return "workshop";
  if (h.includes("mesa-online")) return "online";
  return "home";
}
