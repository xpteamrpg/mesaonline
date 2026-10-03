import { beforeEach, describe, expect, it, vi } from "vitest";

/** Acervo de livros no Supabase (db/supabase-livros.sql): o cliente chama as funções mrpg_book* e cai no servidor local só sem Supabase. */
const rpc = vi.fn();
vi.mock("../src/portal/lib/supabase/client", () => ({ supabase: { rpc: (fn: string, args: unknown) => rpc(fn, args) } }));

beforeEach(() => { rpc.mockReset(); vi.resetModules(); });

describe("cliente do acervo de livros", () => {
  it("lista, publica, adquire, apaga e lista os meus pelas funções do banco", async () => {
    const client = await import("../src/portal/lib/books/client");
    rpc.mockResolvedValueOnce({ data: { books: [{ id: "1", title: "Nona Arton", downloadCount: 3 }], total: 1, hasMore: false }, error: null });
    const list = await client.listPublicBooks({ q: "nona", page: 2 });
    expect(rpc).toHaveBeenLastCalledWith("mrpg_books_list", { p_q: "nona", p_system: null, p_price: null, p_page: 2 });
    expect(list.books[0].downloadCount).toBe(3);

    rpc.mockResolvedValueOnce({ data: { id: "2", title: "Novo" }, error: null });
    await client.publishBook({ title: "Novo", fileUrl: "https://x", declaresOriginal: true });
    expect(rpc).toHaveBeenLastCalledWith("mrpg_book_publish", { p: { title: "Novo", fileUrl: "https://x", declaresOriginal: true } });

    rpc.mockResolvedValueOnce({ data: { id: "1", fileUrl: "https://arquivo", downloadCount: 4 }, error: null });
    const bought = await client.acquireBook("1");
    expect(rpc).toHaveBeenLastCalledWith("mrpg_book_acquire", { p_id: "1" });
    expect(bought.fileUrl).toBe("https://arquivo");

    rpc.mockResolvedValueOnce({ data: { published: [{ id: "2", downloadCount: 0 }], acquired: [{ id: "1" }] }, error: null });
    const mine = await client.listMyBooks();
    expect(mine.published).toHaveLength(1);
    expect(mine.acquired[0].id).toBe("1");

    rpc.mockResolvedValueOnce({ data: true, error: null });
    await client.deletePublicBook("2");
    expect(rpc).toHaveBeenLastCalledWith("mrpg_book_delete", { p_id: "2" });
  });

  it("erro de regra do banco (ex.: sem conta) sobe com a mensagem, sem cair no servidor local", async () => {
    const client = await import("../src/portal/lib/books/client");
    rpc.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "Entre na sua conta para adquirir um livro." } });
    await expect(client.acquireBook("1")).rejects.toThrow(/Entre na sua conta/);
  });
});
