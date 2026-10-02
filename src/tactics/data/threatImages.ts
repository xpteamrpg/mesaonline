import type { ThreatTemplate } from "../../game/types";
import localThreatImages from "./threatImageManifest.json";
import { withBase } from "../../utils/assetUrl";

/** Catálogos legados permanecem em public/vtt para compatibilidade do VTT. */
export const THREAT_IMAGE_MANIFEST_URL = withBase("/vtt/threat-image-manifest.js");
export const THREAT_IMAGES_URL = withBase("/vtt/threat-images.js");

/**
 * Resolvedor UNICO da arte de uma ameaca.
 * Ordem: retrato customizado do Mestre > sprite do catalogo > retrato oficial.
 * Antes este arquivo era orfao e cada ponto lia `sprite || portrait` na mao.
 */
export function threatImage(threat: Pick<ThreatTemplate, "sprite" | "portrait">): string | undefined {
  const url = threat.sprite || threat.portrait || undefined;
  // Prefere a cópia local (public/threat-images) ao link externo; retrato customizado (data:/blob:) passa direto.
  return url ? withBase((localThreatImages as Record<string, string>)[url] || url) : undefined;
}

/** Iniciais para quando nao ha arte nenhuma. */
export function threatInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "?";
}
