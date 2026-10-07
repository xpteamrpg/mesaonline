/**
 * Quadro da campanha (área do mestre): NPCs aliados, missões e estabelecimentos de uma mesa.
 * Estrutura tirada do painel "Relacionamentos" da campanha oficial A Libertação de Valkaria (public/libertacao/script.js),
 * refeita no visual do site. Fica guardado neste navegador, por mesa (chave com o id da mesa); é privado do mestre.
 */
/** Tipo de afinidade de um NPC com o grupo (os mesmos nomes do painel antigo, sem a contagem de corações). */
export const AFFINITIES = ["Inimigo", "Hostil", "Neutro", "Amigável", "Aliado", "Íntimo"] as const;
export type Affinity = (typeof AFFINITIES)[number];

export interface BoardAlly { id: string; name: string; desc: string; bonus: string; image?: string; afinidade?: Affinity }
export interface BoardMission { id: string; nome: string; descricao: string; recompensa: string; completa: boolean }
export interface BoardPlace { id: string; nome: string; descricao: string; servicos: string; honrarias: string; imagem?: string }
export interface CampaignBoard { allies: BoardAlly[]; missions: BoardMission[]; places: BoardPlace[] }

const KEY = "tormenta20_campaign_board_v1:";
export const emptyBoard = (): CampaignBoard => ({ allies: [], missions: [], places: [] });
export const newId = () => `b-${Math.random().toString(36).slice(2, 10)}`;

export function loadBoard(tableId: string): CampaignBoard {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY + tableId) || "null");
    if (!raw || typeof raw !== "object") return emptyBoard();
    return { allies: Array.isArray(raw.allies) ? raw.allies : [], missions: Array.isArray(raw.missions) ? raw.missions : [], places: Array.isArray(raw.places) ? raw.places : [] };
  } catch {
    return emptyBoard();
  }
}

export function saveBoard(tableId: string, board: CampaignBoard): void {
  try { localStorage.setItem(KEY + tableId, JSON.stringify(board)); } catch { /* sem armazenamento: vale só nesta sessão */ }
}

/** Soma itens ao quadro de uma campanha (clonar uma missão, um aliado ou um estabelecimento oficial). */
export function addToBoard(tableId: string, items: Partial<CampaignBoard>): CampaignBoard {
  const board = loadBoard(tableId);
  const next: CampaignBoard = {
    allies: [...board.allies, ...(items.allies ?? []).map((x) => ({ ...x, id: newId() }))],
    missions: [...board.missions, ...(items.missions ?? []).map((x) => ({ ...x, id: newId(), completa: false }))],
    places: [...board.places, ...(items.places ?? []).map((x) => ({ ...x, id: newId() }))],
  };
  saveBoard(tableId, next);
  return next;
}

/** Campanhas oficiais: o conteúdo de cada uma, para ler e clonar para "Minhas campanhas". */
export interface OfficialCampaignData { id: string; title: string; tag: string; text: string; image: string; board: CampaignBoard }

export const OFFICIAL_CAMPAIGN_DATA: OfficialCampaignData[] = [
  {
    id: "libertacao-de-valkaria",
    title: "A Libertação de Valkaria",
    tag: "Painel do Mestre",
    text: "NPCs com nível de afinidade, locais da cidade (Templo de Valkaria, Taverna do Corvo, Casa de Banho, Laboratório Alquímico) e missões da campanha.",
    image: "./libertacao/images/templo_valkaria.png",
    board: {
      allies: [
        { id: "o-a1", name: "Mestre Aurélio", desc: "Sábio ancião que conhece os segredos de Candeh'ssa.", bonus: "+2 em testes de Conhecimento", afinidade: "Aliado" },
        { id: "o-a2", name: "Irmãs do Destino", desc: "Duas irmãs gêmeas que operam a casa de banho.", bonus: "Cura +1d6 por descanso", afinidade: "Amigável" },
        { id: "o-a3", name: "Corvo Noturno", desc: "Informante misterioso que frequenta a taverna.", bonus: "+1 dado em testes de Investigação", afinidade: "Neutro" },
      ],
      missions: [
        { id: "o-m1", nome: "O Ritual Perdido", descricao: "Encontrar os 3 fragmentos do antigo ritual nas masmorras ao norte.", recompensa: "Poção da Vitalidade + 200 PE", completa: false },
        { id: "o-m2", nome: "A Coroa de Gelo", descricao: "Recuperar a coroa do Rei de Gelo na câmara 13 da Masmorra Glacial.", recompensa: "Arma Mágica Menor + 500 PE", completa: false },
        { id: "o-m3", nome: "O Sumiço de Bartholomeu", descricao: "O ferreiro Bartholomeu desapareceu há 3 dias. Investigar a mina abandonada.", recompensa: "Armadura Reforçada + Favor da Guilda", completa: false },
      ],
      places: [
        { id: "o-p1", nome: "Casa de Banho", descricao: "Um local sereno de águas termais mágicas para purificação e cura dos heróis.", servicos: "Recuperação completa de PV e PM por descanso.", honrarias: "Banho Abençoado (Cura extra e bônus em testes de Vontade)", imagem: "./libertacao/images/casa_de_banho.png" },
        { id: "o-p2", nome: "Taverna do Corvo", descricao: "A taverna local, ponto central de boatos, fofocas e contratação de mercenários.", servicos: "Obtenção de boatos sobre as masmorras e contratação de aliados temporários.", honrarias: "Cliente VIP (Desconto em serviços e aliados)", imagem: "./libertacao/images/taverna_corvo.png" },
        { id: "o-p3", nome: "Templo de Valkaria", descricao: "Um suntuoso templo erguido em devoção à Deusa da Ambição e da Humanidade.", servicos: "Remoção de condições negativas, maldições e ressurreição.", honrarias: "Bênção da Ambição (+1 em testes de ataque e Defesa)", imagem: "./libertacao/images/templo_valkaria.png" },
        { id: "o-p4", nome: "Laboratório Alquímico", descricao: "Oficina repleta de frascos borbulhantes controlada por alquimistas excêntricos.", servicos: "Compra e identificação de poções, elixires e itens alquímicos.", honrarias: "Desconto em Alquímicos (20% de desconto em poções)", imagem: "./libertacao/images/laboratorio_alquimico.png" },
      ],
    },
  },
];
