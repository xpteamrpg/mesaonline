import React, { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth/AuthContext";
import { deletePublicBook, listMyBooks, type PublicBook } from "../../lib/books/client";

/** "Na minha conta": o que eu publiquei (com quantas pessoas adquiriram) e o que eu adquiri, para abrir a qualquer hora. */
export const AccountBooksView: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<{ published: PublicBook[]; acquired: PublicBook[] } | null>(null);
  const [error, setError] = useState("");
  const load = () => listMyBooks().then((r) => { setData(r); setError(""); }).catch((e) => setError(e instanceof Error ? e.message : "Não foi possível carregar seus livros."));
  useEffect(() => { if (user) void load(); else setData(null); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user]);

  if (!user) return <div className="rounded-lg border border-dashed border-[#ded7c6] bg-white p-12 text-center text-xs text-[#726859]">Entre na sua conta para ver os livros que você publicou e os que adquiriu.</div>;

  const card = (b: PublicBook, mineBook: boolean) => (
    <div key={b.id} className="flex flex-col rounded-lg border border-[#ded7c6] bg-white p-2 shadow-sm" data-account-book>
      <div className="book-3d flex aspect-[3/4] items-center justify-center text-center font-serif text-xs font-bold text-white"><div className="book-3d-cover">{b.coverUrl ? <img src={b.coverUrl} alt="" className="h-full w-full object-cover" /> : <span className="p-2">{b.title}</span>}</div></div>
      <div className="mt-2 flex-1">
        <div className="text-xs font-bold">{b.title}</div>
        <div className="text-[10px] text-[#9c9180]">por {b.authorName || "autor"}</div>
        <div className="mt-1 text-[10px] font-bold text-[#2b8a3e]">{b.priceType === "paga" ? `R$ ${b.priceValue.toFixed(2)}` : "Gratuito"}</div>
        {mineBook && <div className="text-[10px] font-bold text-[#1c5fb5]" data-book-count>{b.downloadCount ?? 0} {b.downloadCount === 1 ? "pessoa adquiriu" : "pessoas adquiriram"}</div>}
      </div>
      <div className="mt-2 flex gap-1">
        {b.fileUrl && <a href={b.fileUrl} target="_blank" rel="noreferrer" className="flex-1 rounded bg-[#b92b3a] py-1 text-center text-[10px] font-bold text-white">Abrir</a>}
        {mineBook && <button onClick={() => { if (confirm("Remover este livro do acervo público? Quem já adquiriu perde o acesso.")) deletePublicBook(b.id).then(load).catch((e) => setError(e instanceof Error ? e.message : "Falha ao remover.")); }} className="rounded border border-[#ded7c6] px-2 text-[10px]" aria-label="Remover do acervo">✕</button>}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {error && <p className="text-xs font-bold text-[#b92b3a]">{error}</p>}
      <section>
        <h2 className="mb-2 font-serif text-base font-black text-[#b92b3a]">Que eu publiquei ({data?.published.length ?? 0})</h2>
        {!data?.published.length ? <div className="rounded-lg border border-dashed border-[#ded7c6] bg-white p-8 text-center text-xs text-[#726859]">Você ainda não publicou nenhum livro. Publique em “Livros disponíveis”.</div>
          : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{data.published.map((b) => card(b, true))}</div>}
      </section>
      <section>
        <h2 className="mb-2 font-serif text-base font-black text-[#1c5fb5]">Que eu adquiri ({data?.acquired.length ?? 0})</h2>
        {!data?.acquired.length ? <div className="rounded-lg border border-dashed border-[#ded7c6] bg-white p-8 text-center text-xs text-[#726859]">Você ainda não adquiriu nenhum livro. Adquira em “Livros disponíveis”.</div>
          : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{data.acquired.map((b) => card(b, false))}</div>}
      </section>
    </div>
  );
};
