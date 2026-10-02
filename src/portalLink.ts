/**
 * Ponte para o site principal do ModernRPG.
 *
 * O Portal (Home, Ficha, Oficina, Campanhas, Compêndio, Bestiário, Magias,
 * Poderes e Itens) NÃO faz parte deste projeto: ele já existe e é publicado
 * separadamente. A Mesa Online é aberta a partir dele e só precisa saber o
 * endereço de volta.
 *
 * Configure com a variável de ambiente `VITE_PORTAL_URL` (ex.: no `.env`:
 * `VITE_PORTAL_URL=https://modernrpg.com.br/`). Sem configuração a Mesa usa a
 * raiz do mesmo domínio, que é o caso quando ela é publicada como subrota do
 * próprio Portal.
 */
import { setActiveCharacterId } from "../ficha-modernrpg/characterRoute";
import { SITE_ROOT } from "./utils/assetUrl";

const RAW_PORTAL_URL = (import.meta.env?.VITE_PORTAL_URL as string | undefined)?.trim();

export const PORTAL_URL = RAW_PORTAL_URL || SITE_ROOT;

/** Endereço do Portal, opcionalmente em uma rota interna dele. */
export function portalHref(hashRoute = ""): string {
  if (!hashRoute) return PORTAL_URL;
  const base = PORTAL_URL.endsWith("/") ? PORTAL_URL : `${PORTAL_URL}/`;
  return `${base}#/${hashRoute.replace(/^#?\/?/, "")}`;
}

/** Sai da Mesa e volta para o Portal. */
export function goToPortal(): void {
  window.location.href = PORTAL_URL;
}

/**
 * Abre uma área oficial do Portal sem derrubar a sessão PeerJS da Mesa.
 * Todo controle que pertence ao Portal (ficha, itens etc.) passa por esta
 * ponte, em vez de apontar para telas ou dados decorativos locais.
 */
export function openPortalRoute(route: string): void {
  window.open(portalHref(route), "_blank", "noopener,noreferrer");
}

/** Abre a ficha oficial do personagem no Portal. */
export function openPortalSheet(characterId: string): void {
  // O Portal abre a ficha do personagem ativo (mesmo armazenamento da Mesa); sem isto ele mostraria outro personagem.
  setActiveCharacterId(characterId);
  openPortalRoute(`ficha?characterId=${encodeURIComponent(characterId)}`);
}
