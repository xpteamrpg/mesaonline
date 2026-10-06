import { getModernRpgCharacter } from "../integration/modernRpgCharacterBridge";
import { restRecovery, REST_LABEL, type RestCondition, type RestPlace } from "./rest";
import { appendChat, getBoard, getRuntimeSnapshot, updateToken } from "./vttBridge";

/**
 * Mestre: faz os personagens descansarem uma noite (Tormenta20 p.106). Recupera PV e PM pela condição de descanso e pelos poderes/itens da ficha
 * (`game/rest.ts`), nunca acima do máximo; a noite passa, então os PV temporários acabam (p.106). Quem morreu não descansa.
 */
export function restTokens(tokenIds: string[], condition: RestCondition, place: RestPlace): string[] {
  if (getRuntimeSnapshot().multiplayer.role === "player") throw new Error("Só o Mestre pode mandar o grupo descansar.");
  const lines: string[] = [];
  for (const id of tokenIds) {
    const token = getBoard().tokens.find((entry) => entry.id === id);
    if (!token || token.dead) continue;
    const sheet = token.modernRpgCharacterId ? getModernRpgCharacter(token.modernRpgCharacterId) : null;
    const result = restRecovery({ level: token.level || sheet?.level || 1, condition, place, sheet, missingPv: token.hpMax - token.hp, missingPm: token.pmMax - token.pm });
    const hp = Math.min(token.hpMax, token.hp + result.pv);
    const pm = Math.min(token.pmMax, token.pm + result.pm);
    updateToken(token.id, { hp, pm, tempHp: undefined, tempHpScope: undefined });
    const gainedPv = Math.max(0, hp - token.hp);
    const gainedPm = Math.max(0, pm - token.pm);
    lines.push(`${token.name}: +${gainedPv} PV, +${gainedPm} PM${result.notes.length ? ` (${result.notes.join("; ")})` : ""}`);
  }
  appendChat({ author: "Descanso", text: `Uma noite de descanso (${REST_LABEL[condition]}, ${place === "ermos" ? "nos ermos" : "em local urbano"}). ${lines.join(" · ") || "Ninguém para descansar."}`, kind: "system" });
  return lines;
}
