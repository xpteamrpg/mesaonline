import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CHROME_ICONS, NAV, SKILLS } from "../src/components/mesaSkin/data";
import { LeftRail, TopBar } from "../src/components/mesaSkin/components/Chrome";
import { SkinRuntimeContext, type SkinRuntime } from "../src/components/mesaSkin/runtime";
import { formatRollTime, parseModifier } from "../src/components/mesa/DicePanel";
import { T20_SKILLS } from "../ficha-modernrpg/t20/compendium";
import { deleteLibraryToken, listLibraryTokens, saveLibraryToken, tokenNameFromFile } from "../src/game/tokenLibrary";

/** Fase 1 (exploração): barra esquerda, cabeçalho, perícias reais, mesinha de rolagem e biblioteca de tokens. */
const runtimeFor = (isMaster: boolean, diceOpen = false) => ({ campaign: "Mesa", scene: "Cena", playerPortrait: "kael", isMaster, diceOpen }) as unknown as SkinRuntime;
const render = (node: React.ReactNode, runtime: SkinRuntime) => renderToStaticMarkup(<SkinRuntimeContext.Provider value={runtime}>{node}</SkinRuntimeContext.Provider>);
/** O atributo `disabled` do botão (as classes do Tailwind também trazem a palavra "disabled:"). */
const isDisabled = (tag: string) => /\sdisabled(=""|\s|>)/.test(tag);
const buttonTag = (html: string, label: string) => {
  const index = html.indexOf(label);
  const start = html.lastIndexOf("<button", index);
  return html.slice(start, html.indexOf(">", start));
};

describe("barra esquerda", () => {
  it("tem os botões combinados, sem Combate nem Fichas", () => {
    // em ordem alfabética; sem Personagem (o ícone do perfil abre "Meus personagens") e sem Configurações (a engrenagem do cabeçalho)
    expect(NAV.map((item) => item.id)).toEqual(["objects", "scenes", "inventory", "journal", "group", "master", "macros", "music", "ruler", "tokens"]);
    expect(NAV.map((item) => item.label.replace("\n", " "))).toEqual(["Ambientação", "Cenas e mapas", "Compêndio", "Diário", "Elenco", "Ferramenta de mestre", "Macros", "Música", "Régua", "Tokens"]);
  });

  it("jogador vê todos os botões, mas Ambientação, Macros e Ferramenta de mestre ficam desativados", () => {
    const html = render(<LeftRail links={{}} onNavigate={() => undefined} />, runtimeFor(false));
    for (const label of ["Ambientação", "Macros", "Ferramenta"]) expect(isDisabled(buttonTag(html, label))).toBe(true);
    for (const label of ["Elenco", "Tokens", "Compêndio", "Música", "Diário", "Cenas e"]) expect(isDisabled(buttonTag(html, label))).toBe(false);
  });

  it("mestre usa todos", () => {
    const html = render(<LeftRail links={{}} onNavigate={() => undefined} />, runtimeFor(true));
    expect(html).not.toMatch(/<button[^>]*\sdisabled(=""|\s|>)/);
  });
});

describe("cabeçalho", () => {
  it("tem o botão Combate; dentro do combate vira Encerrar combate; sem o ícone de grupo", () => {
    expect(CHROME_ICONS.map((item) => item.id)).toEqual(["ping", "theme", "climate", "vision", "undo", "home", "settings"]);
    const explore = render(<TopBar links={{}} onAction={() => undefined} view="explore" onCombat={() => undefined} />, runtimeFor(true));
    const combat = render(<TopBar links={{}} onAction={() => undefined} view="combat" onCombat={() => undefined} />, runtimeFor(true));
    expect(explore).toContain(">Combate<");
    expect(combat).toContain(">Encerrar combate<");
  });

  it("desfazer é só do mestre", () => {
    const player = render(<TopBar links={{}} onAction={() => undefined} view="explore" onCombat={() => undefined} />, runtimeFor(false));
    const master = render(<TopBar links={{}} onAction={() => undefined} view="explore" onCombat={() => undefined} />, runtimeFor(true));
    expect(isDisabled(buttonTag(player, "Desfazer última rolagem"))).toBe(true);
    expect(isDisabled(buttonTag(master, "Desfazer última rolagem"))).toBe(false);
  });
});

describe("perícias do painel", () => {
  it("são exatamente as do T20, na ordem da ficha", () => {
    expect(SKILLS.map((skill) => skill.name)).toEqual(T20_SKILLS.map((skill) => skill.nome));
  });
});

describe("mesinha de rolagem", () => {
  it("lê o modificador digitado (+44, -3, vazio)", () => {
    expect(parseModifier("+44")).toBe(44);
    expect(parseModifier(" -3 ")).toBe(-3);
    expect(parseModifier("7")).toBe(7);
    expect(parseModifier("abc")).toBe(0);
    expect(parseModifier("")).toBe(0);
  });

  it("formata data e hora do histórico", () => {
    expect(formatRollTime(new Date(2026, 8, 30, 16, 5).getTime())).toBe("30/09 16:05");
  });
});

describe("biblioteca de tokens", () => {
  it("guarda, lista e remove", async () => {
    await saveLibraryToken({ id: "t1", name: "Goblin", image: "data:image/png;base64,AA", addedAt: 1 });
    await saveLibraryToken({ id: "t2", name: "Ogro", image: "data:image/png;base64,BB", addedAt: 2 });
    expect((await listLibraryTokens()).map((token) => token.id)).toEqual(["t2", "t1"]);
    await deleteLibraryToken("t1");
    expect((await listLibraryTokens()).map((token) => token.id)).toEqual(["t2"]);
    await deleteLibraryToken("t2");
  });

  it("nome vem do arquivo", () => {
    expect(tokenNameFromFile("goblin-guerreiro.png")).toBe("goblin guerreiro");
    expect(tokenNameFromFile(".png")).toBe("Token");
  });
});
