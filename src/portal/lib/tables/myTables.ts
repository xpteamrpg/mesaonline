/**
 * Lembra localmente quais mesas o navegador atual criou (código + token de
 * gerenciamento), para reabrir/gerenciar depois sem precisar de conta.
 */
export interface MyTableLink {
  id: string;
  code: string;
  managementToken: string;
  name: string;
  kind?: "campanha" | "oneshot";
  /** código da sala ao vivo (o mesmo da mesa); vazio nas mesas antigas */
  liveRoomCode?: string;
  /** criada sem o servidor de mesas (só neste navegador) */
  local?: boolean;
  /** cópia dos dados da mesa (capa, vagas, horário...) para mostrar o cartão completo mesmo sem rede */
  data?: Partial<import("./client").TableEntry>;
}

const KEY = "tormenta20_online_my_tables_v1";

export function getMyTables(): MyTableLink[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function addMyTable(entry: MyTableLink) {
  const list = getMyTables().filter((t) => t.id !== entry.id);
  try {
    localStorage.setItem(KEY, JSON.stringify([entry, ...list]));
  } catch {
    /* localStorage indisponível: link vale só para a sessão atual */
  }
}

export function alreadyRated(tableId: string): boolean {
  try {
    return localStorage.getItem(`t20_rated_${tableId}`) === "1";
  } catch {
    return false;
  }
}

export function markRated(tableId: string) {
  try {
    localStorage.setItem(`t20_rated_${tableId}`, "1");
  } catch {
    /* ignorado */
  }
}
