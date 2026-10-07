import React, { useEffect, useMemo, useRef, useState } from "react";
import type { View } from "../../types/view";
import { PageBanner } from "../layout/PageBanner";
import { ImagePicker } from "../common/ImagePicker";
import { HOMEBREW_KINDS, type HomebrewKind } from "./homebrewKinds";
import { deleteLocalFile, getLocalFile, putLocalFile } from "../../lib/localFiles";
import { useAuth } from "../../lib/auth/AuthContext";
import { SpellCreator } from "./SpellCreator";

/** Arte própria da página (pintura do projeto, diferente da usada no card da Home). */
import imgHomebrew from "../../assets/menu/homebrew.jpg";
const HOMEBREW_ART = imgHomebrew;
const STORAGE_KEY = "tormenta20_online_homebrew_v1";
const MAX_FILE_MB = 30;
const FILE_ACCEPT = ".pdf,.doc,.docx,.odt,.rtf,.txt,.md,.json,.zip,image/*,application/pdf";

/** Tipos de material homebrew aceitos e onde cada um aparece no site. */
const HOMEBREW_TYPES: { label: string; icon: string; view: View }[] = [
  { label: "Raças", icon: "🧬", view: "races" },
  { label: "Classes & Distinções", icon: "⚔️", view: "classes" },
  { label: "Poderes", icon: "💪", view: "compendium" },
  { label: "Magias", icon: "✨", view: "spells" },
  { label: "Equipamentos", icon: "🎒", view: "equipment" },
  { label: "Monstros & Ameaças", icon: "🐉", view: "bestiary" },
  { label: "Parceiros", icon: "🐺", view: "companions" },
  { label: "Origens e Divindades", icon: "📜", view: "compendium" },
];

interface HomebrewEntry {
  id: string;
  kind: string;
  title: string;
  author: string;
  system: string;
  description: string;
  tags: string;
  link: string;
  cover: string;
  data: Record<string, string>;
  fileId?: string;
  fileName?: string;
  fileSize?: number;
  createdAt: string;
}

const load = (): HomebrewEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HomebrewEntry[]) : [];
  } catch {
    return [];
  }
};

const inp = "w-full rounded border border-[#ded7c6] bg-[#fbf9f4] p-2 text-sm outline-none focus:border-[#b92b3a]";
const lbl = "mb-1 block text-[10px] font-bold uppercase text-[#726859]";
const kindOf = (id: string): HomebrewKind => HOMEBREW_KINDS.find((k) => k.id === id) ?? HOMEBREW_KINDS[0];
const fmtSize = (n?: number) => (n === undefined ? "" : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export const HomebrewView: React.FC<{ onNavigate: (v: View) => void }> = ({ onNavigate }) => {
  const { requireLogin } = useAuth();
  const [creator, setCreator] = useState(false);
  const [entries, setEntries] = useState<HomebrewEntry[]>(load);
  const [kindId, setKindId] = useState(HOMEBREW_KINDS[0].id);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [system, setSystem] = useState("Tormenta 20");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [link, setLink] = useState("");
  const [cover, setCover] = useState("");
  const [data, setData] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [ok, setOk] = useState("");
  const [filter, setFilter] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const kind = kindOf(kindId);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      /* armazenamento cheio ou bloqueado */
    }
  }, [entries]);

  const visible = useMemo(() => entries.filter((e) => !filter || e.kind === filter), [entries, filter]);

  const submit = async () => {
    const errs: string[] = [];
    if (!title.trim()) errs.push("Informe o título.");
    if (!author.trim()) errs.push("Informe o nome do autor.");
    if (!description.trim()) errs.push("Escreva uma descrição curta.");
    for (const f of kind.fields) if (f.required && !(data[f.key] ?? "").trim()) errs.push(`Preencha: ${f.label}.`);
    if (kind.fileRequired && !file) errs.push("Envie o arquivo (PDF ou documento).");
    if (file && file.size > MAX_FILE_MB * 1048576) errs.push(`O arquivo passa de ${MAX_FILE_MB} MB.`);
    if (!accepted) errs.push("Confirme a declaração de responsabilidade.");
    setErrors(errs);
    setOk("");
    if (errs.length) return;
    const id = `hb-${Date.now().toString(36)}`;
    try {
      if (file) await putLocalFile(id, file);
    } catch {
      setErrors(["Não consegui guardar o arquivo neste navegador (armazenamento indisponível ou cheio)."]);
      return;
    }
    const entry: HomebrewEntry = { id, kind: kindId, title: title.trim(), author: author.trim(), system: system.trim(), description: description.trim(), tags: tags.trim(), link: link.trim(), cover, data, fileId: file ? id : undefined, fileName: file?.name, fileSize: file?.size, createdAt: new Date().toISOString() };
    setEntries((p) => [entry, ...p]);
    setTitle(""); setDescription(""); setTags(""); setLink(""); setCover(""); setData({}); setFile(null); setAccepted(false);
    if (fileInput.current) fileInput.current.value = "";
    setOk("Homebrew salvo na sua lista abaixo.");
  };

  const openFile = async (e: HomebrewEntry, download: boolean) => {
    if (!e.fileId) return;
    const blob = await getLocalFile(e.fileId).catch(() => undefined);
    if (!blob) { alert("O arquivo não está mais neste navegador."); return; }
    const url = URL.createObjectURL(blob);
    if (download) {
      const a = document.createElement("a");
      a.href = url; a.download = e.fileName ?? "homebrew"; a.click();
    } else window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const remove = (e: HomebrewEntry) => {
    if (!confirm(`Remover "${e.title}"? O arquivo guardado também será apagado.`)) return;
    if (e.fileId) void deleteLocalFile(e.fileId).catch(() => undefined);
    setEntries((p) => p.filter((x) => x.id !== e.id));
  };

  return (
    <div className="mx-auto max-w-[1400px] p-3 text-[#2b261f] sm:p-5">
      <PageBanner image={HOMEBREW_ART} position="50% 20%" title="Homebrew" crumb="Homebrew" />

      <section className="mb-4 rounded-lg border border-[#ded7c6] bg-white p-5 shadow-sm">
        <h2 className="font-serif text-2xl font-black text-[#b92b3a]">Material da comunidade</h2>
        <p className="mt-2 text-sm leading-6 text-[#5c5446]">Aqui fica tudo o que a comunidade cria: raças, classes, poderes, magias, equipamentos, monstros, parceiros, origens e mais. Todo item homebrew leva um selo próprio e pode ser filtrado à parte do conteúdo oficial.</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {HOMEBREW_TYPES.map((t) => (
            <button key={t.label} onClick={() => onNavigate(t.view)} className="rounded-lg border border-[#ded7c6] bg-[#fbf9f4] p-3 text-center text-xs font-bold hover:border-[#b92b3a] hover:text-[#b92b3a]">
              <span className="block text-2xl">{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-[#b92b3a]/40 bg-white p-4 shadow-sm" data-spell-creator-entry>
        <div className="min-w-0 flex-1"><h2 className="font-serif text-xl font-black text-[#b92b3a]">✦ Criador de magias</h2><p className="text-xs leading-5 text-[#5c5446]">Crie a sua própria magia passo a passo. As magias que você criar são só suas: ficam guardadas na sua conta e ninguém mais vê.</p></div>
        <button type="button" onClick={() => { if (requireLogin("Para criar e guardar magias você precisa estar logado.")) setCreator(true); }} className="rounded bg-[#b92b3a] px-5 py-2.5 text-xs font-black uppercase text-white shadow hover:bg-[#9c1f2d]">Criar magia</button>
      </section>

      {creator && <SpellCreator onClose={() => setCreator(false)} />}

      <section id="enviar" className="mb-4 rounded-lg border border-[#c2892c]/50 bg-[#fef9ed] p-5 shadow-sm">
        <h2 className="font-serif text-2xl font-black text-[#c2892c]">Enviar meu homebrew</h2>
        <p className="mt-1 text-sm leading-6 text-[#5c5446]">Escolha o tipo de material, preencha os dados que ele exige e, se quiser, anexe o PDF ou documento. Por enquanto o material fica guardado <b>neste navegador</b>; a publicação para a comunidade abre junto com as contas online.</p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {HOMEBREW_KINDS.map((k) => (
            <button key={k.id} type="button" onClick={() => { setKindId(k.id); setData({}); setErrors([]); }} className={`rounded px-3 py-1.5 text-xs font-bold transition-all ${kindId === k.id ? "bg-[#b92b3a] text-white shadow" : "border border-[#ded7c6] bg-white text-[#726859] hover:bg-[#fbf9f4]"}`}>{k.icon} {k.label}</button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div><label className={lbl}>Título *</label><input value={title} onChange={(e) => setTitle(e.target.value)} className={`${inp} font-bold`} placeholder={`Nome d${kind.id === "documento" ? "o documento" : "o material"}`} /></div>
          <div><label className={lbl}>Autor *</label><input value={author} onChange={(e) => setAuthor(e.target.value)} className={inp} placeholder="Seu nome ou apelido" /></div>
          <div><label className={lbl}>Sistema / versão</label><input value={system} onChange={(e) => setSystem(e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Etiquetas (separe por vírgula)</label><input value={tags} onChange={(e) => setTags(e.target.value)} className={inp} placeholder="ex.: fantasia sombria, nível 1-5" /></div>
          <div className="sm:col-span-2"><label className={lbl}>Descrição curta *</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inp} /></div>

          {kind.fields.map((f) => (
            <div key={f.key} className={f.kind === "textarea" ? "sm:col-span-2" : ""}>
              <label className={lbl}>{f.label}{f.required ? " *" : ""}</label>
              {f.kind === "textarea" ? (
                <textarea value={data[f.key] ?? ""} onChange={(e) => setData({ ...data, [f.key]: e.target.value })} rows={3} className={inp} placeholder={f.placeholder} />
              ) : f.kind === "select" ? (
                <select value={data[f.key] ?? ""} onChange={(e) => setData({ ...data, [f.key]: e.target.value })} className={inp}><option value="">— escolha —</option>{f.options?.map((o) => <option key={o}>{o}</option>)}</select>
              ) : (
                <input type={f.kind === "number" ? "number" : "text"} value={data[f.key] ?? ""} onChange={(e) => setData({ ...data, [f.key]: e.target.value })} className={inp} placeholder={f.placeholder} />
              )}
            </div>
          ))}

          <div className="sm:col-span-2 rounded-lg border border-[#ded7c6] bg-white p-3">
            <label className={lbl}>Arquivo (PDF ou documento){kind.fileRequired ? " *" : " — opcional"}</label>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => fileInput.current?.click()} className="rounded bg-[#b92b3a] px-4 py-2 text-xs font-bold text-white hover:bg-[#9c1f2d]">📎 Escolher arquivo do computador</button>
              <input ref={fileInput} type="file" accept={FILE_ACCEPT} className="hidden" onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
              {file ? (
                <span className="text-xs font-semibold text-[#2b8a3e]">✔ {file.name} ({fmtSize(file.size)}) <button type="button" onClick={() => setFile(null)} className="ml-2 font-bold text-[#b92b3a] hover:underline">remover</button></span>
              ) : <span className="text-xs text-[#9c9180]">PDF, DOC/DOCX, ODT, RTF, TXT, MD, JSON, ZIP ou imagem — até {MAX_FILE_MB} MB.</span>}
            </div>
            <div className="mt-2"><label className={lbl}>Ou link para o material (Drive, itch.io...)</label><input value={link} onChange={(e) => setLink(e.target.value)} className={inp} placeholder="https://…" /></div>
          </div>

          <div className="sm:col-span-2 rounded-lg border border-[#ded7c6] bg-white p-3"><ImagePicker label="Capa ou imagem (opcional)" aspect={1.5} bake maxSize={640} value={cover} onChange={(v) => setCover(v)} /></div>

          <label className="sm:col-span-2 flex items-start gap-2 rounded border border-[#c2892c]/50 bg-white p-3 text-xs leading-5 text-[#5c5446]">
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 accent-[#b92b3a]" />
            <span>Declaro que sou o autor deste material (ou tenho permissão para compartilhá-lo) e que ele não reproduz conteúdo protegido sem autorização. A responsabilidade pelo que envio é minha.</span>
          </label>
        </div>

        {errors.length > 0 && <ul className="mt-3 list-disc rounded border border-[#b92b3a] bg-[#fbebee] p-3 pl-6 text-xs font-semibold text-[#b92b3a]">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        {ok && <p className="mt-3 rounded border border-[#2b8a3e] bg-[#ebfbee] p-3 text-xs font-bold text-[#2b8a3e]">{ok}</p>}
        <button type="button" onClick={() => void submit()} className="mt-4 rounded bg-[#b92b3a] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow hover:bg-[#9c1f2d]">✦ Salvar homebrew</button>
      </section>

      <section className="rounded-lg border border-[#ded7c6] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-2xl font-black text-[#b92b3a]">Meus homebrews ({entries.length})</h2>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setFilter("")} className={`rounded px-2.5 py-1 text-xs font-bold ${!filter ? "bg-[#b92b3a] text-white" : "border border-[#ded7c6] bg-white text-[#726859]"}`}>Todos</button>
            {HOMEBREW_KINDS.filter((k) => entries.some((e) => e.kind === k.id)).map((k) => <button key={k.id} type="button" onClick={() => setFilter(k.id)} className={`rounded px-2.5 py-1 text-xs font-bold ${filter === k.id ? "bg-[#b92b3a] text-white" : "border border-[#ded7c6] bg-white text-[#726859]"}`}>{k.icon} {k.label}</button>)}
          </div>
        </div>
        {visible.length === 0 ? (
          <p className="mt-4 rounded border border-dashed border-[#ded7c6] bg-[#fbf9f4] p-8 text-center text-xs text-[#726859]">Nada por aqui ainda. Use o formulário acima para guardar o seu primeiro homebrew.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {visible.map((e) => {
              const k = kindOf(e.kind);
              const open = openId === e.id;
              return (
                <article key={e.id} className="overflow-hidden rounded-lg border border-[#ded7c6] bg-[#fbf9f4] shadow-sm">
                  <div className="flex gap-3 p-3">
                    <div className="flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded border border-[#ded7c6] bg-white text-3xl">{e.cover ? <img src={e.cover} alt="" className="h-full w-full object-cover" /> : k.icon}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5"><span className="rounded bg-[#c2892c] px-1.5 py-0.5 text-[9px] font-black uppercase text-white">Homebrew</span><span className="text-[10px] font-bold uppercase text-[#726859]">{k.label}</span></div>
                      <h3 className="truncate font-serif text-lg font-black leading-tight">{e.title}</h3>
                      <div className="text-[11px] text-[#726859]">por {e.author} · {e.system} · {new Date(e.createdAt).toLocaleDateString("pt-BR")}</div>
                      <p className="mt-1 line-clamp-2 text-xs text-[#5c5446]">{e.description}</p>
                      {e.tags && <div className="mt-1 flex flex-wrap gap-1">{e.tags.split(",").map((t) => t.trim()).filter(Boolean).map((t) => <span key={t} className="rounded bg-[#f5f2eb] px-1.5 py-0.5 text-[10px] text-[#726859]">{t}</span>)}</div>}
                    </div>
                  </div>
                  {open && (
                    <dl className="space-y-1 border-t border-[#ded7c6] bg-white p-3 text-xs">
                      {k.fields.filter((f) => e.data[f.key]).map((f) => <div key={f.key}><dt className="inline font-bold text-[#b92b3a]">{f.label}: </dt><dd className="inline whitespace-pre-line text-[#5c5446]">{e.data[f.key]}</dd></div>)}
                      {e.link && <div><dt className="inline font-bold text-[#b92b3a]">Link: </dt><dd className="inline"><a href={e.link} target="_blank" rel="noreferrer" className="text-[#1c7ed6] underline">{e.link}</a></dd></div>}
                      {e.fileName && <div className="text-[#726859]">Arquivo: {e.fileName} ({fmtSize(e.fileSize)})</div>}
                    </dl>
                  )}
                  <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-[#ded7c6] bg-[#f7f3e9] px-3 py-2">
                    <button type="button" onClick={() => remove(e)} title="Remover" className="rounded border border-[#ded7c6] bg-white px-2 py-1 text-xs font-bold text-[#726859] hover:text-[#b92b3a]">🗑️</button>
                    <button type="button" onClick={() => setOpenId(open ? null : e.id)} className="rounded border border-[#ded7c6] bg-white px-2.5 py-1 text-xs font-bold text-[#726859]">{open ? "Ocultar dados" : "Ver dados"}</button>
                    {e.fileId && <button type="button" onClick={() => void openFile(e, true)} className="rounded border border-[#ded7c6] bg-white px-2.5 py-1 text-xs font-bold text-[#726859]">⬇ Baixar</button>}
                    {e.fileId && <button type="button" onClick={() => void openFile(e, false)} className="rounded bg-[#b92b3a] px-3 py-1 text-xs font-bold text-white hover:bg-[#9c1f2d]">📄 Abrir arquivo</button>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
