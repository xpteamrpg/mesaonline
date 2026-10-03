import React, { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth/AuthContext";
import { acquireBook, deletePublicBook, listMyBooks, listPublicBooks, publishBook, type PublicBook } from "../../lib/books/client";

const inp = "w-full rounded border border-[#ded7c6] bg-[#fbf9f4] p-2 text-xs";

export const PublicBooksView: React.FC = () => {
  const { user } = useAuth();
  const [books, setBooks] = useState<PublicBook[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [priceType, setPriceType] = useState("");
  const [loadError, setLoadError] = useState("");
  /** ids dos livros que já estão na minha conta (adquiridos ou publicados por mim) */
  const [mine, setMine] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!user) { setMine(new Set()); return; }
    listMyBooks().then((r) => setMine(new Set([...r.published, ...r.acquired].map((b) => b.id)))).catch(() => undefined);
  }, [user]);
  const acquire = (b: PublicBook) => {
    acquireBook(b.id)
      .then((full) => { setMine((prev) => new Set(prev).add(b.id)); setBooks((prev) => prev.map((x) => (x.id === b.id ? { ...x, downloadCount: full.downloadCount, fileUrl: full.fileUrl } : x))); if (full.fileUrl) window.open(full.fileUrl, "_blank", "noopener,noreferrer"); })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Não foi possível adquirir o livro."));
  };

  const [form, setForm] = useState<{ title: string; authorName: string; system: string; coverUrl: string; fileUrl: string; priceType: "gratuita" | "paga"; priceValue: string; description: string; declaresOriginal: boolean }>({
    title: "", authorName: "", system: "Tormenta20", coverUrl: "", fileUrl: "", priceType: "gratuita", priceValue: "", description: "", declaresOriginal: false,
  });
  const [publishError, setPublishError] = useState("");
  const [publishing, setPublishing] = useState(false);

  const load = (nextPage: number, append: boolean) => {
    listPublicBooks({ q: q || undefined, priceType: priceType || undefined, page: nextPage })
      .then((r) => { setBooks((prev) => (append ? [...prev, ...r.books] : r.books)); setTotal(r.total); setHasMore(r.hasMore); setPage(nextPage); setLoadError(""); })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Falha ao carregar catálogo."));
  };

  useEffect(() => { load(1, false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [q, priceType]);

  const submitPublish = () => {
    setPublishError("");
    if (!form.title.trim() || !form.fileUrl.trim()) { setPublishError("Título e link do arquivo são obrigatórios."); return; }
    if (!form.declaresOriginal) { setPublishError("Confirme que o material é de sua própria criação."); return; }
    setPublishing(true);
    publishBook({ ...form, priceValue: Number(form.priceValue) || 0 })
      .then(() => { setForm({ title: "", authorName: "", system: "Tormenta20", coverUrl: "", fileUrl: "", priceType: "gratuita", priceValue: "", description: "", declaresOriginal: false }); load(1, false); })
      .catch((e) => setPublishError(e instanceof Error ? e.message : "Falha ao publicar."))
      .finally(() => setPublishing(false));
  };

  const remove = (id: string) => {
    if (!confirm("Remover este livro do catálogo público?")) return;
    deletePublicBook(id).then(() => load(1, false)).catch((e) => setLoadError(e instanceof Error ? e.message : "Falha ao remover."));
  };

  return (
    <div>
      <p className="mb-4 rounded-lg border border-[#ded7c6] bg-[#fbf9f4] p-3 text-[11px] leading-5 text-[#726859]">
        Este site apenas hospeda links e informações de materiais <b>homebrew</b> (de criação própria dos autores). Nenhum conteúdo oficial pode ser publicado aqui, e o site não incentiva, aconselha nem apoia pirataria. Ao publicar, o autor declara ser o responsável e o criador original do material.
      </p>

      <div className="mb-4 rounded-lg border border-[#ded7c6] bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-serif text-sm font-black text-[#b92b3a]">Publicar um livro</h2>
        {!user ? (
          <p className="text-xs text-[#726859]">Entre na sua conta (canto superior direito) para publicar um material homebrew no catálogo público.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Título *" className={`${inp} font-bold sm:col-span-2`} />
            <input value={form.authorName} onChange={(e) => setForm({ ...form, authorName: e.target.value })} placeholder={`Nome do autor (padrão: ${user.email})`} className={inp} />
            <input value={form.system} onChange={(e) => setForm({ ...form, system: e.target.value })} placeholder="Sistema" className={inp} />
            <input value={form.coverUrl} onChange={(e) => setForm({ ...form, coverUrl: e.target.value })} placeholder="URL da capa (opcional)" className={inp} />
            <input value={form.fileUrl} onChange={(e) => setForm({ ...form, fileUrl: e.target.value })} placeholder="Link do arquivo (PDF, Drive, itch.io...) *" className={inp} />
            <select value={form.priceType} onChange={(e) => setForm({ ...form, priceType: e.target.value as "gratuita" | "paga" })} className={inp}>
              <option value="gratuita">Gratuito</option>
              <option value="paga">Pago</option>
            </select>
            {form.priceType === "paga" && <input value={form.priceValue} onChange={(e) => setForm({ ...form, priceValue: e.target.value })} placeholder="Valor (R$)" type="number" min="0" step="0.01" className={inp} />}
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição" rows={2} className={`${inp} sm:col-span-2`} />
            {form.priceType === "paga" && <p className="text-[10px] text-[#9c9180] sm:col-span-2">Cobrança automática ainda não existe — por enquanto, combine o pagamento diretamente com o autor pelo link informado.</p>}
            <label className="flex items-start gap-2 text-[11px] leading-4 text-[#726859] sm:col-span-2"><input type="checkbox" checked={form.declaresOriginal} onChange={(e) => setForm({ ...form, declaresOriginal: e.target.checked })} className="mt-0.5" /> Confirmo que este material é de minha própria criação (homebrew) e assumo responsabilidade pelo conteúdo publicado.</label>
            {publishError && <p className="text-[11px] font-bold text-[#b92b3a] sm:col-span-2">{publishError}</p>}
            <button onClick={submitPublish} disabled={publishing} className="rounded bg-[#b92b3a] py-2 text-xs font-bold uppercase text-white hover:bg-[#9c1f2d] disabled:opacity-50 sm:col-span-2">{publishing ? "Publicando…" : "Publicar no catálogo"}</button>
          </div>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por título, autor ou descrição" className={`${inp} max-w-xs`} />
        <select value={priceType} onChange={(e) => setPriceType(e.target.value)} className={`${inp} max-w-[140px]`}>
          <option value="">Todos os preços</option>
          <option value="gratuita">Gratuito</option>
          <option value="paga">Pago</option>
        </select>
        <span className="ml-auto text-[10px] font-bold uppercase text-[#9c9180]">{total} livro(s) no catálogo</span>
      </div>

      {loadError && <p className="mb-3 text-xs font-bold text-[#b92b3a]">{loadError}</p>}

      {books.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#ded7c6] bg-white p-12 text-center text-xs text-[#726859]">Nenhum livro publicado ainda.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {books.map((b) => (
            <div key={b.id} className="flex flex-col rounded-lg border border-[#ded7c6] bg-white p-2 shadow-sm">
              <div className="book-3d flex aspect-[3/4] items-center justify-center text-center font-serif text-xs font-bold text-white"><div className="book-3d-cover">{b.coverUrl ? <img src={b.coverUrl} alt="" /> : <span>{b.title}</span>}</div></div>
              <div className="mt-2 flex-1">
                <div className="flex items-center gap-1.5"><span className="rounded bg-[#c2892c] px-1.5 py-0.5 text-[9px] font-black uppercase text-white">Homebrew</span>{b.system && <span className="text-[10px] text-[#726859]">{b.system}</span>}</div>
                <div className="mt-1 text-xs font-bold">{b.title}</div>
                <div className="text-[10px] text-[#9c9180]">por {b.authorName}</div>
                {b.description && <div className="mt-1 text-[10px] leading-4 text-[#726859]">{b.description}</div>}
                <div className="mt-1 text-[10px] font-bold text-[#2b8a3e]">{b.priceType === "paga" ? `R$ ${b.priceValue.toFixed(2)}` : "Gratuito"}</div>
                <div className="text-[10px] text-[#9c9180]" data-book-count>{b.downloadCount ?? 0} {b.downloadCount === 1 ? "aquisição" : "aquisições"}</div>
              </div>
              <div className="mt-2 flex gap-1">
                {mine.has(b.id) && b.fileUrl
                  ? <a href={b.fileUrl} target="_blank" rel="noreferrer" className="flex-1 rounded bg-[#2b8a3e] py-1 text-center text-[10px] font-bold text-white">Abrir (na sua conta)</a>
                  : user
                    ? <button onClick={() => acquire(b)} className="flex-1 rounded bg-[#b92b3a] py-1 text-center text-[10px] font-bold text-white" data-book-acquire>{b.priceType === "paga" ? `Adquirir · R$ ${b.priceValue.toFixed(2)}` : "Adquirir (grátis)"}</button>
                    : <span className="flex-1 rounded border border-[#ded7c6] py-1 text-center text-[10px] text-[#726859]">Entre na conta para adquirir</span>}
                {user?.id === b.ownerId && <button onClick={() => remove(b.id)} className="rounded border border-[#ded7c6] px-2 text-[10px]">✕</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore && <button onClick={() => load(page + 1, true)} className="mx-auto mt-4 block rounded border border-[#ded7c6] bg-white px-6 py-2 text-xs font-bold text-[#726859] hover:bg-[#eae4d5]">Carregar mais livros</button>}
    </div>
  );
};
