/**
 * Detalhes da página de uma mesa (horários, regras, cenário, avisos de conteúdo, segurança, requisitos, contato).
 * O mestre preenche ao criar ou editar a mesa; ficam na coluna `details` (jsonb) de `mrpg_tables`
 * (db/supabase-mesas-detalhe.sql) e na cópia local da mesa.
 */
export interface TableSession { day: string; start: string; end: string; recurrence: "avulsa" | "semanal" | "quinzenal" | "mensal" }

export interface TableDetails {
  sessions?: TableSession[];
  /** regras da mesa (gatilhos, requisitos, observações...) */
  rules?: string;
  scenario?: string;
  scenarioTags?: string[];
  contentWarnings?: string[];
  safetyTools?: string[];
  techRequirements?: string[];
  experience?: string;
  language?: string;
  /** onde o grupo conversa (Discord, WhatsApp...) */
  communication?: string;
  /** número do mestre com DDD, só dígitos; vira o botão "Enviar WhatsApp" */
  whatsapp?: string;
  acceptsDonations?: boolean;
}

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const RECURRENCES: TableSession["recurrence"][] = ["avulsa", "semanal", "quinzenal", "mensal"];
export const EXPERIENCE_LEVELS = ["todos", "iniciantes", "intermediário", "veteranos"];

/** Avisos de conteúdo que o mestre marca, com o que cada um significa para quem vai jogar. */
export const CONTENT_WARNINGS: Record<string, string> = {
  "violência": "A mesa pode incluir descrições de combate, ferimentos ou violência explícita.",
  "violência gráfica": "A mesa pode incluir descrições explícitas e detalhadas de violência ou ferimentos.",
  "terror": "A mesa explora temas de horror, medo ou tensão psicológica.",
  "morte": "A mesa pode incluir a morte de personagens (jogadores ou NPCs) como parte da narrativa.",
  "discriminação": "A narrativa pode retratar preconceito ou discriminação como parte do enredo (não endossado pela mesa).",
  "gore": "A mesa pode incluir descrições gráficas e explícitas de violência extrema ou mutilação.",
  "conteúdo sexual": "A mesa pode incluir referências ou cenas de natureza sexual.",
  "uso de drogas": "A narrativa pode incluir uso de drogas ou substâncias.",
};

export const SAFETY_TOOLS: Record<string, string> = {
  "linha e véu": "“Linhas” são temas que nunca aparecem na mesa; “véus” são temas que podem existir mas são narrados de forma implícita, sem detalhes.",
  "x-card": "Qualquer pessoa pode pausar ou cortar uma cena que a incomode, sem precisar explicar o motivo.",
};

export const TECH_REQUIREMENTS = ["Microfone necessário", "Câmera necessária", "Computador necessário", "Celular serve"];

/** Só dígitos; sem DDI assume Brasil (55). Vazio se não parece um telefone. */
export function whatsappDigits(raw?: string): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length < 10) return "";
  return digits.length <= 11 ? `55${digits}` : digits;
}
export const whatsappLink = (raw?: string): string => { const digits = whatsappDigits(raw); return digits ? `https://wa.me/${digits}` : ""; };

/** O dia e o horário de uma sessão em uma linha ("Sábado · 15:00 – 18:00 · avulsa"). */
export const sessionLine = (session: TableSession) => `${session.day} · ${session.start || "—"}${session.end ? ` – ${session.end}` : ""} · ${session.recurrence}`;

/** Texto do anúncio para copiar e colar (grupo, rede social). */
export function announcementText(table: { name: string; system?: string; modality?: string; ageRating?: string; seatsTotal?: number; seatsFilled?: number; priceType?: string; priceValue?: number; gmName?: string; description?: string; details?: TableDetails }, code?: string): string {
  const d = table.details ?? {};
  const age = table.ageRating && table.ageRating !== "livre" ? `+${table.ageRating}` : "Livre";
  const lines = [
    `🎲 ${table.name}`,
    [table.system, table.modality, age].filter(Boolean).join(" · "),
    table.gmName ? `Mestre: ${table.gmName}` : "",
    ...(d.sessions ?? []).map((s) => `📅 ${sessionLine(s)}`),
    table.seatsTotal ? `Vagas: ${Math.max(0, table.seatsTotal - (table.seatsFilled ?? 0))} de ${table.seatsTotal}` : "",
    table.priceType === "paga" ? `Valor: R$ ${Number(table.priceValue ?? 0).toFixed(2)}` : "Mesa gratuita",
    table.description ?? "",
    code ? `Código da mesa: ${code}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}
