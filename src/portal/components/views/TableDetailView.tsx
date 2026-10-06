import React from "react";
import type { TableEntry } from "../../lib/tables/client";
import { CONTENT_WARNINGS, SAFETY_TOOLS, announcementText, sessionLine, whatsappLink } from "../../lib/tables/details";
import type { CharacterSheet } from "../../types/sheet";
import { CopyButton } from "../common/CopyButton";
import { PartyStrip } from "../campaigns/MesaAccountSections";

const card = "rounded-lg border border-[#ded7c6] bg-white p-4 shadow-sm";
const h3 = "mb-2 font-serif text-base font-black text-[#2b261f]";
const tag = "rounded-full bg-[#eae4d5] px-2.5 py-1 text-[11px] font-bold text-[#5c5446]";
const ageLabel = (a?: string) => (a === "18" ? "+18" : a === "16" || a === "14" ? "+16" : "Livre");

/**
 * Página de uma mesa: capa 16:9, horários, sobre, regras, cenário, segurança e requisitos à esquerda; à direita entrar,
 * WhatsApp do mestre, cobrança, dados da mesa, plataformas, como participar e quem está na mesa.
 */
export const TableDetailView: React.FC<{ table: TableEntry; code: string; characters?: CharacterSheet[]; isMember?: boolean; onEnter: () => void; onClose: () => void; onOpenCharacter?: (id: string) => void }> = ({ table, code, characters = [], isMember = false, onEnter, onClose, onOpenCharacter = () => undefined }) => {
  const d = table.details ?? {};
  const wa = whatsappLink(d.whatsapp);
  const free = table.priceType !== "paga";
  const left = Math.max(0, (table.seatsTotal ?? 0) - (table.seatsFilled ?? 0));
  const row = (label: string, value: React.ReactNode) => <div className="flex items-center justify-between gap-3 border-b border-[#eee9da] py-1.5 text-xs last:border-0"><span className="text-[#9c9180]">{label}</span><b className="text-right text-[#2b261f]">{value}</b></div>;
  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-[#f5f2eb]" role="dialog" aria-modal="true" aria-label={`Mesa ${table.name}`} data-table-detail>
      <div className="mx-auto max-w-[1200px] p-3 sm:p-6">
        <button onClick={onClose} className="mb-3 rounded border border-[#ded7c6] bg-white px-3 py-1.5 text-xs font-bold text-[#726859] hover:bg-[#eae4d5]">← Voltar às mesas</button>
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            <h1 className="font-serif text-3xl font-black text-[#2b261f]">{table.name}</h1>
            {table.imageUrl ? <img src={table.imageUrl} alt="" className="aspect-video w-full rounded-lg bg-black object-contain" /> : <div className="aspect-video w-full rounded-lg bg-gradient-to-br from-[#2b261f] to-[#4a3f2c]" aria-hidden="true" />}

            {(d.sessions?.length || table.schedule) ? (
              <section className={card}><h3 className={h3}>📅 Horários das sessões</h3>
                {(d.sessions ?? []).map((s, i) => <div key={i} className="mb-1.5 rounded border border-[#ded7c6] bg-[#fbf9f4] px-3 py-2 text-sm font-bold text-[#2b261f]">{sessionLine(s)}</div>)}
                {!d.sessions?.length && table.schedule && <div className="rounded border border-[#ded7c6] bg-[#fbf9f4] px-3 py-2 text-sm font-bold text-[#2b261f]">{table.schedule}</div>}
              </section>
            ) : null}

            {table.description && <section className={card}><h3 className={h3}>📖 Sobre a mesa</h3><p className="whitespace-pre-line text-sm leading-6 text-[#5c5446]">{table.description}</p></section>}
            {d.rules && <section className={card}><h3 className={h3}>📜 Regras da mesa</h3><p className="whitespace-pre-line text-sm leading-6 text-[#5c5446]">{d.rules}</p></section>}
            {(d.scenario || d.scenarioTags?.length) ? (
              <section className={card}><h3 className={h3}>🗺️ Cenário</h3>
                {d.scenario && <p className="text-sm text-[#5c5446]">{d.scenario}</p>}
                {d.scenarioTags?.length ? <div className="mt-2 flex flex-wrap gap-1.5">{d.scenarioTags.map((t) => <span key={t} className={tag}>{t}</span>)}</div> : null}
              </section>
            ) : null}

            {(d.contentWarnings?.length || d.safetyTools?.length) ? (
              <section className={card}><h3 className={h3}>🛡️ Segurança e conforto</h3>
                {d.contentWarnings?.length ? <>
                  <div className="mb-1 text-xs font-black uppercase text-[#a05a00]">⚠ Avisos de conteúdo</div>
                  <div className="flex flex-wrap gap-1.5">{d.contentWarnings.map((w) => <span key={w} className="rounded-full bg-[#fff1cc] px-2.5 py-1 text-[11px] font-bold text-[#7a5200]">{w}</span>)}</div>
                  <ul className="mt-2 space-y-0.5 text-[11px] text-[#726859]">{d.contentWarnings.map((w) => <li key={w}><b>{w}:</b> {CONTENT_WARNINGS[w] ?? ""}</li>)}</ul>
                </> : null}
                {d.safetyTools?.length ? <>
                  <div className="mb-1 mt-3 text-xs font-black uppercase text-[#2f7d32]">Ferramentas de segurança</div>
                  <div className="flex flex-wrap gap-1.5">{d.safetyTools.map((w) => <span key={w} className="rounded-full bg-[#dff3e0] px-2.5 py-1 text-[11px] font-bold text-[#1f5d24]">{w}</span>)}</div>
                  <ul className="mt-2 space-y-0.5 text-[11px] text-[#726859]">{d.safetyTools.map((w) => <li key={w}><b>{w}:</b> {SAFETY_TOOLS[w] ?? ""}</li>)}</ul>
                </> : null}
              </section>
            ) : null}

            {d.techRequirements?.length ? <section className={card}><h3 className={h3}>💻 Requisitos técnicos</h3><div className="flex flex-wrap gap-1.5">{d.techRequirements.map((t) => <span key={t} className={tag}>{t}</span>)}</div></section> : null}
          </div>

          <aside className="space-y-3">
            <button onClick={onEnter} className="w-full rounded bg-[#b92b3a] py-3 text-sm font-black uppercase text-white hover:bg-[#9c1f2d]">Entrar na mesa</button>
            {wa && <a href={wa} target="_blank" rel="noreferrer" className="block w-full rounded bg-[#1fa855] py-2.5 text-center text-sm font-black uppercase text-white hover:bg-[#188a45]">Enviar WhatsApp</a>}
            <CopyButton text={announcementText(table, isMember ? code : undefined)} label="📋 Copiar anúncio" className="w-full rounded border border-[#ded7c6] bg-white py-2 text-xs font-bold text-[#726859] hover:bg-[#eae4d5]" />
            {table.seatsTotal > 0 && left > 0 && left <= 2 && <div className="text-xs font-black text-[#c2670a]">🔥 {left === 1 ? "Última vaga" : `Últimas ${left} vagas`}</div>}

            <section className={card}>
              <div className="text-[10px] font-black uppercase text-[#9c9180]">Cobrança</div>
              <div className={`mt-1 text-sm font-black ${free ? "text-[#2b8a3e]" : "text-[#b92b3a]"}`}>{free ? "Mesa gratuita — sem cobrança" : `R$ ${Number(table.priceValue || 0).toFixed(2)}`}</div>
              {d.acceptsDonations && <div className="mt-1 text-[11px] text-[#726859]">Aceita doações, combinadas direto com o mestre, fora da plataforma.</div>}
            </section>

            <section className={card}>
              {row("Sistema", table.system)}
              {row("Experiência", d.experience ?? "todos")}
              {row("Faixa etária", ageLabel(table.ageRating))}
              {row("Idioma", d.language || "pt-BR")}
              {row("Modalidade", table.modality)}
              {row("Vagas", `${table.seatsFilled ?? 0} de ${table.seatsTotal ?? "—"}`)}
            </section>

            {(table.vttPlatform || d.communication) && (
              <section className={card}>
                <div className="text-[10px] font-black uppercase text-[#7a4fb0]">Plataformas</div>
                {table.vttPlatform && row("Jogo", table.vttPlatform)}
                {d.communication && row("Comunicação", d.communication)}
              </section>
            )}

            {(wa || table.contactInfo) && (
              <section className={card}>
                <div className="mb-1 text-xs font-black uppercase text-[#2b261f]">Como participar</div>
                {wa ? <a href={wa} target="_blank" rel="noreferrer" className="block break-all text-xs font-bold text-[#1fa855] underline">{wa}</a> : null}
                {table.contactInfo && <div className="text-xs text-[#726859]">{table.contactInfo}</div>}
                <div className="mt-1 text-[11px] text-[#9c9180]">O mestre responde com o código da mesa; depois é só usar “Entrar em mesa privativa”.</div>
              </section>
            )}

            <section className={card}>
              <div className="text-[10px] font-black uppercase text-[#9c9180]">Mestre</div>
              <div className="mt-1 font-serif text-lg font-black text-[#2b261f]">{table.gmName || "—"}</div>
            </section>

            {isMember && <PartyStrip tableId={table.id} characters={characters} onOpenOwn={onOpenCharacter} />}
          </aside>
        </div>
      </div>
    </div>
  );
};
