/**
 * Guildas (sistema do site, fora das campanhas e one-shots): cada guilda tem um dono que recebe quem entra,
 * personagens que fazem parte dela e lojas dos próprios personagens. Aqui só a parte inicial: lista, página da guilda e lojas de exemplo.
 * Os textos do Nicolas e as lojas abaixo são PROVISÓRIOS (exemplos); o usuário vai passar os definitivos.
 */
export interface GuildShop { id: string; name: string; owner: string; kind: string; description: string }
export interface Guild {
  id: string;
  name: string;
  logo: string;
  tagline: string;
  owner: { name: string; title: string };
  /** fala de boas-vindas do dono da guilda */
  welcome: string;
  /** personagens que fazem parte da guilda (por enquanto ainda não há inscrição) */
  characters: number;
  shops: GuildShop[];
}

export const GUILDS: Guild[] = [
  {
    id: "armada-de-vectora",
    name: "Armada de Vectora",
    logo: "./images/armada-de-vectora-logo.png",
    tagline: "A guilda do servidor de Discord do projeto.",
    owner: { name: "Nicolas", title: "Dono da guilda" },
    welcome: "Seja bem-vindo à Armada de Vectora! Eu sou o Nicolas e vou te mostrar como a guilda funciona. Aqui os membros têm lojas, serviços e negócios próprios, e só quem faz parte da guilda pode comprar neles.",
    characters: 0,
    shops: [
      { id: "forja", name: "Forja do Anão Rubro", owner: "(exemplo)", kind: "Armas e reparos", description: "Armas, armaduras e consertos para quem vai se meter em encrenca." },
      { id: "emporio", name: "Empório da Lua Cinza", owner: "(exemplo)", kind: "Poções e alquímicos", description: "Frascos, elixires e itens alquímicos de procedência duvidosa." },
      { id: "taverna", name: "Taverna do Corvo Manco", owner: "(exemplo)", kind: "Comida, bebida e boatos", description: "Uma boa refeição e as últimas notícias da cidade." },
      { id: "santuario", name: "Santuário das Velas", owner: "(exemplo)", kind: "Curas e bênçãos", description: "Cuidados para feridas, males e cansaço do corpo e do espírito." },
    ],
  },
];
