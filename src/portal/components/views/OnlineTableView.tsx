import React, { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth/AuthContext";
import { createTable, getTableByCode, listPublicTables, rateTable, updateTable, type TableEntry } from "../../lib/tables/client";
import { addMyTable, alreadyRated, getMyTables, markRated, type MyTableLink } from "../../lib/tables/myTables";
import { PageBanner } from "../layout/PageBanner";
import imgCampanhas from "../../assets/menu/campanhas.jpg";
import { OfficialCampaigns } from "../campaigns/OfficialCampaigns";
import type { CampaignRecord } from "./CampaignsView";
import { ImagePicker } from "../common/ImagePicker";
import { SITE_ROOT } from "../../../utils/assetUrl";

/** Arte própria da página (pintura do projeto). */
const MESA_ONLINE_ART = imgCampanhas;

const inp = "w-full rounded border border-[#ded7c6] bg-[#fbf9f4] p-2 text-xs";
const AGE_RATINGS = ["livre", "10", "12", "14", "16", "18"];

function extractCode(raw: string): string {
  const match = raw.toUpperCase().match(/[A-Z0-9]{8}/);
  return match ? match[0] : raw.trim().toUpperCase();
}

/**
 * Abre a Mesa já dentro da sala: `host` = o mestre abre (ou reabre) a sala com esse código; `sala` = jogador entra nela.
 * O lobby antigo da Mesa foi aposentado; esta página é a entrada.
 */
function openMesa(opts: { name: string; host?: string; sala?: string }) {
  const params = new URLSearchParams();
  if (opts.host) params.set("host", opts.host);
  else if (opts.sala) params.set("sala", opts.sala);
  params.set("nome", opts.name);
  window.open(`${SITE_ROOT}mesa/?${params.toString()}`, "_blank", "noopener,noreferrer");
}

/** Selo grande: CAMPANHA (azul) ou ONE-SHOT (vermelho). */
export const MesaSeal: React.FC<{ kind?: "campanha" | "oneshot"; official?: boolean; big?: boolean }> = ({ kind = "oneshot", official, big }) => (
  <span className={`inline-flex items-center rounded font-black uppercase tracking-[0.18em] text-white shadow ${big ? "px-4 py-1.5 text-sm" : "px-2 py-0.5 text-[10px]"} ${kind === "campanha" ? "bg-[#1c5fb5]" : "bg-[#b92b3a]"}`}>
    {official ? "Campanha oficial" : kind === "campanha" ? "Campanha" : "One-shot"}
  </span>
);

const randomCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("");
};

const emptyForm = { name: "", system: "Tormenta20", modality: "online" as "online" | "presencial", schedule: "", gmName: "", seatsTotal: "4", ageRating: "livre", vttPlatform: "Mesa de Arton (deste site)", description: "", imageUrl: "", priceType: "gratuita" as "gratuita" | "paga", priceValue: "", contactInfo: "", isPublic: false };

/** Mesa montada no próprio navegador (servidor de mesas desligado, ou código de sala direto). */
function emptyTable(input: Partial<TableEntry> & { name: string }): TableEntry {
  return {
    id: "", code: "", name: input.name, system: input.system ?? "Tormenta20", modality: input.modality ?? "online", priceType: input.priceType ?? "gratuita",
    priceValue: Number(input.priceValue) || 0, schedule: input.schedule ?? "", gmName: input.gmName ?? "", seatsTotal: Number(input.seatsTotal) || 4, seatsFilled: 0,
    ageRating: input.ageRating ?? "livre", vttPlatform: input.vttPlatform ?? "Mesa de Arton (deste site)", description: input.description ?? "", imageUrl: input.imageUrl ?? "",
    contactInfo: input.contactInfo ?? "", liveRoomCode: "", kind: input.kind ?? "oneshot", isPublic: false, ratingAvg: null, ratingCount: 0, createdAt: new Date().toISOString(),
  };
}

const CreatePrivateTable: React.FC<{ onCreated: () => void }> = ({ onCreated }) => {
  const { user, requireLogin } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [created, setCreated] = useState<TableEntry | null>(null);
  const [kind, setKind] = useState<"campanha" | "oneshot">("oneshot");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = () => {
    setError("");
    if (!requireLogin("Para criar uma mesa você precisa estar logado.")) return;
    if (!form.name.trim()) { setError("Nome da mesa é obrigatório."); return; }
    setBusy(true);
    const payload = { ...form, kind, gmName: form.gmName || user?.email || "", seatsTotal: Number(form.seatsTotal) || 1, priceValue: Number(form.priceValue) || 0 };
    createTable(payload)
      .then(async (t) => {
        // A sala ao vivo usa o mesmo código da mesa: quem tem o código entra direto.
        let table = t;
        try { table = { ...(await updateTable(t.id, t.managementToken!, { liveRoomCode: t.code })), managementToken: t.managementToken }; } catch { table = { ...t, liveRoomCode: t.code }; }
        setCreated(table);
        addMyTable({ id: table.id, code: table.code, managementToken: table.managementToken!, name: table.name, kind, liveRoomCode: table.code, data: { ...table, managementToken: undefined } });
        onCreated();
      })
      .catch(() => {
        // Servidor de mesas desligado: a mesa nasce só neste navegador, com código que funciona na sala ao vivo.
        const code = randomCode();
        const local = { ...emptyTable(payload), id: `local-${code}`, code, liveRoomCode: code, managementToken: "local" } as TableEntry;
        setCreated(local);
        addMyTable({ id: local.id, code, managementToken: "local", name: local.name, kind, liveRoomCode: code, local: true, data: { ...local, managementToken: undefined } });
        setNotice("O servidor de mesas está desligado: a mesa foi criada só neste navegador. O código e o link funcionam na sala ao vivo; a lista pública e as avaliações voltam quando o servidor ligar.");
        onCreated();
      })
      .finally(() => setBusy(false));
  };

  if (created) {
    return (
      <div className="rounded-lg border border-[#ded7c6] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2"><h2 className="font-serif text-xl font-black text-[#b92b3a]">Mesa criada!</h2><MesaSeal kind={created.kind ?? kind} big /></div>
        <p className="mt-2 text-xs leading-5 text-[#726859]">Compartilhe o código ou o link abaixo com quem você quiser convidar.</p>
        <div className="mt-3 rounded border border-[#ded7c6] bg-[#fbf9f4] p-3 text-center"><div className="text-[10px] font-black uppercase text-[#726859]">Código</div><div className="font-mono text-2xl font-black tracking-widest text-[#b92b3a]">{created.code}</div></div>
        <button onClick={() => navigator.clipboard?.writeText(`${window.location.origin}${window.location.pathname}#/mesa-online?codigo=${created.code}`)} className="mt-2 w-full rounded border border-[#ded7c6] bg-white py-2 text-xs font-bold text-[#726859] hover:bg-[#eae4d5]">📋 Copiar link de convite</button>
        <button onClick={() => { if (requireLogin("Para entrar na mesa você precisa estar logado.")) openMesa({ name: created.name, host: created.liveRoomCode || created.code }); }} className="mt-2 w-full rounded bg-[#b92b3a] py-3 text-xs font-black uppercase text-white hover:bg-[#9c1f2d]">🎲 Entrar na mesa online agora</button>
        {notice && <p className="mt-3 rounded border border-[#e0c98c] bg-[#fff8e6] p-2 text-[11px] leading-4 text-[#7a5a14]">{notice}</p>}
        <button onClick={() => { setCreated(null); setNotice(""); }} className="mt-4 w-full text-center text-[11px] font-bold text-[#726859] hover:text-[#b92b3a]">← Criar outra mesa</button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#ded7c6] bg-white p-5 shadow-sm">
      <h2 className="font-serif text-xl font-black text-[#b92b3a]">Criar mesa privativa</h2>
      <p className="mt-1 text-xs leading-5 text-[#726859]">Escolha se é uma campanha ou um one-shot. Gera um código e um link para você convidar quem quiser. Não precisa de conta.</p>
      <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de mesa">
        <button type="button" role="radio" aria-checked={kind === "campanha"} onClick={() => setKind("campanha")} className={`rounded border-2 py-2 text-xs font-black uppercase tracking-widest ${kind === "campanha" ? "border-[#1c5fb5] bg-[#1c5fb5] text-white" : "border-[#ded7c6] bg-white text-[#1c5fb5]"}`}>Campanha</button>
        <button type="button" role="radio" aria-checked={kind === "oneshot"} onClick={() => setKind("oneshot")} className={`rounded border-2 py-2 text-xs font-black uppercase tracking-widest ${kind === "oneshot" ? "border-[#b92b3a] bg-[#b92b3a] text-white" : "border-[#ded7c6] bg-white text-[#b92b3a]"}`}>One-shot</button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome da mesa *" className={`${inp} font-bold sm:col-span-2`} />
        <input value={form.system} onChange={(e) => setForm({ ...form, system: e.target.value })} placeholder="Sistema" className={inp} />
        <select value={form.modality} onChange={(e) => setForm({ ...form, modality: e.target.value as "online" | "presencial" })} className={inp}><option value="online">Online</option><option value="presencial">Presencial</option></select>
        <input value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} placeholder="Horário (ex: Sábados 20h)" className={inp} />
        <input value={form.gmName} onChange={(e) => setForm({ ...form, gmName: e.target.value })} placeholder={`Mestre responsável${user ? ` (padrão: ${user.email})` : ""}`} className={inp} />
        <input value={form.seatsTotal} onChange={(e) => setForm({ ...form, seatsTotal: e.target.value })} type="number" min="1" placeholder="Vagas" className={inp} />
        <select value={form.ageRating} onChange={(e) => setForm({ ...form, ageRating: e.target.value })} className={inp}>{AGE_RATINGS.map((a) => <option key={a} value={a}>{a === "livre" ? "Livre" : `${a} anos`}</option>)}</select>
        <input value={form.vttPlatform} onChange={(e) => setForm({ ...form, vttPlatform: e.target.value })} placeholder="Plataforma / VTT" className={inp} />
        <select value={form.priceType} onChange={(e) => setForm({ ...form, priceType: e.target.value as "gratuita" | "paga" })} className={inp}><option value="gratuita">Gratuita</option><option value="paga">Paga</option></select>
        {form.priceType === "paga" && <input value={form.priceValue} onChange={(e) => setForm({ ...form, priceValue: e.target.value })} type="number" min="0" step="0.01" placeholder="Valor (R$)" className={inp} />}
        <div className="sm:col-span-2"><ImagePicker label="Imagem de capa (opcional)" aspect={2.5} bake maxSize={800} value={form.imageUrl} onChange={(v) => setForm({ ...form, imageUrl: v })} /></div>
        <input value={form.contactInfo} onChange={(e) => setForm({ ...form, contactInfo: e.target.value })} placeholder="Contato (e-mail/WhatsApp, opcional)" className={`${inp} sm:col-span-2`} />
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição da mesa" rows={2} className={`${inp} sm:col-span-2`} />
        <label className="flex items-center gap-2 text-[11px] text-[#726859] sm:col-span-2"><input type="checkbox" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} /> Anunciar esta mesa publicamente no catálogo abaixo</label>
        {error && <p className="text-[11px] font-bold text-[#b92b3a] sm:col-span-2">{error}</p>}
        <button onClick={submit} disabled={busy} className="rounded bg-[#b92b3a] py-2 text-xs font-bold uppercase text-white hover:bg-[#9c1f2d] disabled:opacity-50 sm:col-span-2">{busy ? "Criando…" : "Criar mesa privativa"}</button>
      </div>
    </div>
  );
};

const JoinPrivateTable: React.FC = () => {
  const { requireLogin } = useAuth();
  const [code, setCode] = useState(() => new URLSearchParams(window.location.hash.split("?")[1] || "").get("codigo") ?? "");
  const [found, setFound] = useState<TableEntry | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = () => {
    setError(""); setFound(null);
    if (!code.trim()) return;
    if (!requireLogin("Para entrar numa mesa você precisa estar logado.")) return;
    setBusy(true);
    const typed = extractCode(code);
    getTableByCode(typed)
      .then(setFound)
      // Sem o servidor, ou código de uma sala direta: o próprio código abre a sala ao vivo.
      .catch(() => setFound({ ...(emptyTable({ name: `Mesa ${typed}` }) as TableEntry), id: `direct-${typed}`, code: typed, liveRoomCode: typed }))
      .finally(() => setBusy(false));
  };

  return (
    <div className="rounded-lg border border-[#ded7c6] bg-[#2b261f] p-5 text-white shadow-sm">
      <h2 className="font-serif text-xl font-black text-[#f2c572]">Entrar em mesa privativa</h2>
      <p className="mt-1 text-xs leading-5 text-white/70">Cole o código ou o link que o mestre te enviou.</p>
      <div className="mt-4 flex gap-2"><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código ou link da mesa" className="w-full rounded border border-white/20 bg-white/10 p-2 text-xs text-white placeholder:text-white/50" onKeyDown={(e) => { if (e.key === "Enter") submit(); }} /><button onClick={submit} disabled={busy} className="shrink-0 rounded bg-[#b92b3a] px-4 text-xs font-bold uppercase disabled:opacity-50">Buscar</button></div>
      {error && <p className="mt-2 text-[11px] font-bold text-[#ffb0b8]">{error}</p>}
      {found && (
        <div className="mt-4 rounded border border-white/20 bg-white/10 p-3 text-xs">
          <div className="font-serif text-lg font-black">{found.name}</div>
          <div className="mt-1 text-white/70">{[found.system, found.modality, found.schedule].filter(Boolean).join(" · ")}</div>
          {found.gmName && <div className="text-white/70">Mestre: {found.gmName}</div>}
          <div className="mt-1 text-white/70">Vagas: {found.seatsFilled}/{found.seatsTotal}</div>
          <button onClick={() => { if (requireLogin("Para entrar numa mesa você precisa estar logado.")) openMesa({ name: found.name, sala: found.liveRoomCode || found.code }); }} className="mt-3 w-full rounded bg-[#b92b3a] py-2 text-xs font-black uppercase text-white">🎲 Entrar na mesa</button>
        </div>
      )}
    </div>
  );
};

/** Cartão de uma mesa criada neste navegador: capa, selo e as informações que o mestre preencheu. */
const MyTableCard: React.FC<{ link: MyTableLink; fresh?: TableEntry }> = ({ link, fresh }) => {
  const { requireLogin } = useAuth();
  const t = { ...(link.data ?? {}), ...(fresh ?? {}) } as Partial<TableEntry>;
  const code = link.liveRoomCode || fresh?.liveRoomCode || link.code;
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-[#ded7c6] bg-white shadow-sm">
      {t.imageUrl ? <img src={t.imageUrl} alt="" className="h-32 w-full object-cover" /> : <div className="h-32 w-full bg-gradient-to-br from-[#2b261f] to-[#4a3f2c]" aria-hidden="true" />}
      <div className="flex flex-1 flex-col p-3">
        <div className="flex items-center gap-2"><MesaSeal kind={link.kind ?? t.kind} />{link.local && <span className="text-[9px] font-bold uppercase text-[#9c9180]">só neste navegador</span>}</div>
        <div className="mt-1 font-serif text-lg font-black leading-tight text-[#b92b3a]">{link.name}</div>
        <div className="text-[11px] text-[#726859]">{[t.system, t.modality, t.schedule].filter(Boolean).join(" · ")}</div>
        {t.gmName && <div className="text-[11px] text-[#9c9180]">Mestre: {t.gmName}</div>}
        {t.description && <p className="mt-1 line-clamp-3 text-[11px] leading-4 text-[#726859]">{t.description}</p>}
        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="font-bold text-[#2b8a3e]">{t.priceType === "paga" ? `R$ ${Number(t.priceValue || 0).toFixed(2)}` : "Gratuita"}</span>
          <span className="text-[#726859]">Vagas {t.seatsFilled ?? 0}/{t.seatsTotal ?? "—"}{t.isPublic ? " · pública" : " · privada"}</span>
        </div>
        <div className="mt-2 flex items-center gap-2 rounded border border-[#ded7c6] bg-[#fbf9f4] px-2 py-1 text-[11px]">
          <span className="text-[#9c9180]">Código</span><b className="font-mono tracking-widest text-[#2b261f]">{code}</b>
          <button onClick={() => navigator.clipboard?.writeText(code)} className="ml-auto rounded border border-[#ded7c6] bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-[#726859]">Copiar</button>
        </div>
        <button onClick={() => { if (requireLogin("Para entrar na mesa você precisa estar logado.")) openMesa({ name: link.name, host: code }); }} className="mt-3 w-full rounded bg-[#b92b3a] py-2 text-xs font-black uppercase text-white hover:bg-[#9c1f2d]">Entrar na mesa online</button>
      </div>
    </div>
  );
};

/** "Minhas campanhas" (mesas do tipo campanha + campanhas do Portal) e "Meus one-shots": cada mesa com seu cartão. */
const MyTablesSection: React.FC<{ kind: "campanha" | "oneshot"; title: string; campaigns?: CampaignRecord[]; onManage?: () => void }> = ({ kind, title, campaigns = [], onManage }) => {
  const { requireLogin } = useAuth();
  const [links] = useState<MyTableLink[]>(getMyTables());
  const [fresh, setFresh] = useState<Record<string, TableEntry>>({});
  useEffect(() => {
    links.filter((l) => !l.local).forEach((l) => { getTableByCode(l.code).then((t) => setFresh((prev) => ({ ...prev, [l.id]: t }))).catch(() => {}); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const mine = links.filter((l) => (l.kind ?? l.data?.kind ?? "oneshot") === kind);
  const color = kind === "campanha" ? "text-[#1c5fb5]" : "text-[#b92b3a]";
  return (
    <div className="mb-6 rounded-lg border border-[#ded7c6] bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className={`font-serif text-base font-black ${color}`}>{title}</h2>
        {kind === "campanha" && onManage && <button onClick={onManage} className="rounded border border-[#ded7c6] bg-white px-3 py-1 text-[10px] font-bold uppercase text-[#726859] hover:bg-[#eae4d5]">Gerenciar campanhas</button>}
      </div>
      {mine.length === 0 && campaigns.length === 0 ? (
        <p className="rounded border border-dashed border-[#ded7c6] p-4 text-center text-xs text-[#726859]">{kind === "campanha" ? "Nenhuma campanha ainda. Crie uma acima escolhendo “Campanha”." : "Nenhum one-shot ainda. Crie uma acima escolhendo “One-shot”."}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {mine.map((l) => <MyTableCard key={l.id} link={l} fresh={fresh[l.id]} />)}
          {campaigns.map((c) => {
            const code = campaignRoomCode(c.id);
            return (
              <div key={c.id} className="flex flex-col overflow-hidden rounded-lg border border-[#ded7c6] bg-white shadow-sm">
                <div className="h-32 w-full bg-gradient-to-br from-[#12315f] to-[#1c5fb5]" aria-hidden="true" />
                <div className="flex flex-1 flex-col p-3">
                  <MesaSeal kind="campanha" />
                  <div className="mt-1 font-serif text-lg font-black leading-tight text-[#b92b3a]">{c.name}</div>
                  <div className="mt-2 flex items-center gap-2 rounded border border-[#ded7c6] bg-[#fbf9f4] px-2 py-1 text-[11px]">
                    <span className="text-[#9c9180]">Código</span><b className="font-mono tracking-widest text-[#2b261f]">{code}</b>
                    <button onClick={() => navigator.clipboard?.writeText(code)} className="ml-auto rounded border border-[#ded7c6] bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-[#726859]">Copiar</button>
                  </div>
                  <button onClick={() => { if (requireLogin("Para entrar na mesa você precisa estar logado.")) openMesa({ name: c.name, host: code }); }} className="mt-3 w-full rounded bg-[#1c5fb5] py-2 text-xs font-black uppercase text-white">Entrar na mesa online</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const StarRating: React.FC<{ table: TableEntry; onRated: () => void }> = ({ table, onRated }) => {
  const [done, setDone] = useState(alreadyRated(table.id));
  if (done) return <span className="text-[10px] text-[#9c9180]">{table.ratingAvg ? `★ ${table.ratingAvg} (${table.ratingCount})` : "Sem avaliações"}</span>;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((v) => (
        <button key={v} onClick={() => rateTable(table.id, v).then(() => { markRated(table.id); setDone(true); onRated(); })} className="text-sm text-[#c2892c] hover:scale-110">★</button>
      ))}
    </div>
  );
};

/** Código fixo da sala de uma campanha (o mesmo sempre), tirado do id dela: os jogadores entram com ele em "Entrar em mesa privativa". */
export function campaignRoomCode(id: string): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let h = 2166136261;
  const out: string[] = [];
  for (let i = 0; i < 8; i += 1) {
    for (const ch of `${id}:${i}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    out.push(alphabet[h % alphabet.length]);
  }
  return out.join("");
}

export const OnlineTableView: React.FC<{ campaigns?: CampaignRecord[]; onManageCampaigns?: () => void }> = ({ campaigns = [], onManageCampaigns }) => {
  const { requireLogin } = useAuth();
  const [tables, setTables] = useState<TableEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [system, setSystem] = useState("");
  const [modality, setModality] = useState("");
  const [priceType, setPriceType] = useState("");
  const [sort, setSort] = useState("relevancia");
  const [error, setError] = useState("");

  const load = (nextPage: number, append: boolean) => {
    listPublicTables({ q: q || undefined, system: system || undefined, modality: modality || undefined, priceType: priceType || undefined, sort, page: nextPage })
      .then((r) => { setTables((prev) => (append ? [...prev, ...r.tables] : r.tables)); setTotal(r.total); setHasMore(r.hasMore); setPage(nextPage); setError(""); })
      .catch((e) => setError(e instanceof Error ? e.message : "Não foi possível carregar as mesas abertas."));
  };

  useEffect(() => { load(1, false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [q, system, modality, priceType, sort]);

  return (
    <div className="mx-auto max-w-[1400px] p-3 sm:p-5">
      <PageBanner image={MESA_ONLINE_ART} position="50% 40%" title="Mesa online" crumb="Mesa online" />

      <div className="grid gap-4 lg:grid-cols-2">
        <CreatePrivateTable onCreated={() => load(1, false)} />
        <JoinPrivateTable />
      </div>

      <div className="mt-6"><MyTablesSection kind="campanha" title="Minhas campanhas" campaigns={campaigns} onManage={() => onManageCampaigns?.()} /></div>
      <MyTablesSection kind="oneshot" title="Meus one-shots" />
      <div className="mb-6 [&_h2]:!text-[#f2c572]"><OfficialCampaigns /></div>

      <div className="mt-8 border-t-4 border-[#b92b3a] pt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-2xl font-black text-[#2b261f]">Mesas abertas na comunidade</h2>
          <span className="text-[10px] font-bold uppercase text-[#9c9180]">{total} mesa(s) aberta(s)</span>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className={`${inp} max-w-[180px]`} />
          <input value={system} onChange={(e) => setSystem(e.target.value)} placeholder="Sistema" className={`${inp} max-w-[140px]`} />
          <select value={modality} onChange={(e) => setModality(e.target.value)} className={`${inp} max-w-[140px]`}><option value="">Toda modalidade</option><option value="online">Online</option><option value="presencial">Presencial</option></select>
          <select value={priceType} onChange={(e) => setPriceType(e.target.value)} className={`${inp} max-w-[140px]`}><option value="">Todo preço</option><option value="gratuita">Gratuita</option><option value="paga">Paga</option></select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className={`${inp} max-w-[160px]`}><option value="relevancia">Mais relevantes</option><option value="recentes">Recentes</option><option value="vagas">Mais vagas</option><option value="preco">Menor preço</option></select>
        </div>
        {error && <p className="mb-3 text-xs font-bold text-[#b92b3a]">{error}</p>}
        {tables.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#ded7c6] bg-white p-12 text-center text-xs text-[#726859]">Nenhuma mesa aberta encontrada.</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tables.map((t) => (
              <div key={t.id} className="flex flex-col overflow-hidden rounded-lg border border-[#ded7c6] bg-white shadow-sm">
                {t.imageUrl && <img src={t.imageUrl} alt="" className="h-28 w-full object-cover" />}
                <div className="flex flex-1 flex-col p-3">
                  <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-[#9c9180]"><span className="rounded bg-[#2b261f] px-1.5 py-0.5 text-white">{t.ageRating === "livre" ? "Livre" : `${t.ageRating}+`}</span><span>{t.modality}</span><span>·</span><span>{t.vttPlatform}</span></div>
                  <div className="mt-1 flex items-center gap-2"><MesaSeal kind={t.kind} /></div>
                  <div className="mt-1 font-serif text-lg font-black text-[#b92b3a]">{t.name}</div>
                  <div className="text-[11px] text-[#726859]">{t.system}{t.schedule ? ` · ${t.schedule}` : ""}</div>
                  {t.gmName && <div className="text-[11px] text-[#9c9180]">Mestre: {t.gmName}</div>}
                  {t.description && <p className="mt-1 text-[11px] leading-4 text-[#726859]">{t.description}</p>}
                  <div className="mt-2 flex items-center justify-between text-[11px]"><span className="font-bold text-[#2b8a3e]">{t.priceType === "paga" ? `R$ ${t.priceValue.toFixed(2)}` : "Gratuita"}</span><span className="text-[#726859]">{t.seatsFilled}/{t.seatsTotal} vagas</span></div>
                  <div className="mt-2"><StarRating table={t} onRated={() => load(page, false)} /></div>
                  {t.contactInfo && <div className="mt-1 text-[10px] text-[#1c7ed6]">Contato: {t.contactInfo}</div>}
                  <button onClick={() => { if (requireLogin("Para entrar numa mesa você precisa estar logado.")) openMesa({ name: t.name, sala: t.liveRoomCode || t.code }); }} className="mt-3 w-full rounded bg-[#b92b3a] py-2 text-xs font-black uppercase text-white hover:bg-[#9c1f2d]">Entrar na mesa</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {hasMore && <button onClick={() => load(page + 1, true)} className="mx-auto mt-4 block rounded border border-[#ded7c6] bg-white px-6 py-2 text-xs font-bold text-[#726859] hover:bg-[#eae4d5]">Carregar mais mesas</button>}
      </div>
    </div>
  );
};
