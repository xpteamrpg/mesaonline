import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../lib/auth/AuthContext";
import { CopyButton } from "../common/CopyButton";
import { MagiaCard } from "./MagiaCard";
import { PublishSpellDialog } from "./PublishSpellDialog";
import { myPublishedIds, publishingAvailable, spellLink, unpublishSpell } from "../../lib/homebrew/publicSpells";
import { deleteMySpell, loadMySpells, novaMagia, novoId, saveMySpell, type SaveWhere } from "../../lib/homebrew/mySpells";
import { PM_BASE_DO_CIRCULO, TABELA, calcular, circuloEfetivo, ehOfensiva, semAcento, tarifaDoTexto } from "../../lib/homebrew/spellCost";
import {
  FORMAS, PLACEHOLDERS, ROTULOS, RESTRITO_SINGULAR, condNome, resumoDosEfeitos, substituir, textoAlvo, textoPlano, textoResistencia, tipoDePocaoDosEixos, type MagiaCriada,
} from "../../lib/homebrew/spellText";

const inp = "w-full rounded border border-[#ded7c6] bg-[#fbf9f4] p-2 text-sm outline-none focus:border-[#b92b3a]";
const lbl = "mb-1 block text-[10px] font-bold uppercase text-[#726859]";
const sub = "mb-1 mt-4 font-serif text-sm font-black uppercase tracking-wide text-[#b92b3a]";

const EXPLICA: Record<string, Record<string, string>> = {
  execucao: { padrao: "uma ação padrão do seu turno — o normal", movimento: "gasta só a ação de movimento", livre: "quase de graça no turno", reacao: "conjura fora do seu turno, reagindo", completa: "consome o turno inteiro", longa: "2+ rodadas conjurando — execução de 1 rodada não existe: use completa" },
  alcance: { pessoal: "só em você / a partir de você", toque: "precisa encostar no alvo", curto: "9 metros — o padrão das magias", medio: "30 metros", longo: "90 metros", ilimitado: "qualquer distância" },
  duracao: { instantanea: "acontece e acabou (dano, cura...)", "1rodada": "dura só 1 rodada", sustentada: "você gasta ação para manter e pode ser interrompido — devolve ponto", cena: "dura a cena inteira — padrão de buffs", "1dia": "dura um dia", permanente: "para sempre (caro!)" },
  resistencia: { nenhuma: "sem teste — sempre funciona (caro)", desacredita: "o alvo pode desconfiar da ilusão", "reduz-metade": "passou: metade do dano — modo do dano puro (Bola de Fogo)", parcial: "passou: metade do dano E escapa da condição — o que as oficiais com dano+condição usam", anula: "passou: nada acontece (devolve ponto)" },
};
const TESTES = ["Fortitude", "Reflexos", "Vontade"];
const TIPOS_DANO = ["fogo", "frio", "eletricidade", "ácido", "veneno", "corte", "impacto", "perfuração", "luz", "trevas", "psíquico", "essência"];
const RESTRITOS: [string | null, string, string][] = [
  [null, "qualquer criatura", "afeta tudo — o padrão"], ["humanoides", "só humanoides", "pessoas, orcs, goblins…"],
  ["animais", "só animais", "bichos naturais"], ["objetos", "só objetos", "itens, portas, armas…"],
];
const ESCOLAS = ["Abjuração", "Adivinhação", "Convocação", "Encantamento", "Evocação", "Ilusão", "Necromancia", "Transmutação"];
const BLOCOS: [keyof MagiaCriada["efeitos"], string, string][] = [
  ["dano", "💥 Causa dano", "dados de dano num alvo ou área"], ["cura", "✚ Cura", "recupera pontos de vida"],
  ["bonus", "🛡 Dá um bônus", "+X em Defesa, ataque, perícia…"], ["condicoes", "🕸 Atrapalha", "impõe condições: lento, cego, caído…"],
  ["penalidade", "➖ Penalidade", "−X em Defesa, ataques, perícias do alvo"], ["custom", "✨ Efeito especial", "qualquer outra coisa — voar, ilusão, comando…"],
];
const efeitoInicial = (k: string) => ({
  dano: { n: 2, faces: 6, fixo: 0, tipo: "fogo" }, cura: { n: 2, faces: 8, fixo: 2 }, bonus: [{ valor: 2, em: "", escopo: "especifico" }],
  penalidade: [{ valor: 2, em: "", escopo: "especifico" }], condicoes: [], custom: { texto: "", pontos: 0 },
} as Record<string, unknown>)[k];

const money = (n: number) => `${n > 0 ? "+" : ""}${n}`;
const Opcao: React.FC<{ marcado: boolean; titulo: string; custo?: number; explica?: string; onClick: () => void }> = ({ marcado, titulo, custo, explica, onClick }) => (
  <button type="button" onClick={onClick} aria-pressed={marcado} className={`flex flex-col items-start rounded-lg border-2 p-2.5 text-left transition-colors ${marcado ? "border-[#b92b3a] bg-[#fdeef0]" : "border-[#ded7c6] bg-white hover:bg-[#f5f2eb]"}`} data-opcao>
    <span className="text-sm font-bold text-[#2b261f]">{titulo}</span>
    {custo != null && <span className={`text-[11px] font-black ${custo > 0 ? "text-[#b92b3a]" : custo < 0 ? "text-[#2f7d32]" : "text-[#9c9180]"}`}>{custo === 0 ? "0 pt" : `${money(custo)} pt`}</span>}
    {explica && <span className="text-[11px] leading-4 text-[#726859]">{explica}</span>}
  </button>
);
const Grade: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
const Sel: React.FC<{ label: string; value: string | number; options: (string | number)[]; onChange: (v: string) => void }> = ({ label, value, options, onChange }) => (
  <label className="block"><span className={lbl}>{label}</span><select value={String(value)} onChange={(e) => onChange(e.target.value)} className={inp}>{options.map((o) => <option key={String(o)} value={String(o)}>{String(o)}</option>)}</select></label>
);

type Passo = { id: string; titulo: string; pergunta: string; visivel?: (m: MagiaCriada) => boolean };
const PASSOS: Passo[] = [
  { id: "basico", titulo: "A magia", pergunta: "Como ela se chama?" },
  { id: "efeitos", titulo: "Efeitos", pergunta: "O que a magia faz?" },
  { id: "config", titulo: "Detalhes", pergunta: "Configure cada efeito", visivel: (m) => Object.keys(m.efeitos).length > 0 },
  { id: "alvo", titulo: "Alvo", pergunta: "Quem ela atinge?" },
  { id: "tempo", titulo: "Tempo", pergunta: "Quando e por quanto tempo?" },
  { id: "resistencia", titulo: "Resistência", pergunta: "O alvo pode resistir?", visivel: ehOfensiva },
  { id: "descricao", titulo: "Descrição", pergunta: "Descreva a magia" },
  { id: "aprimoramentos", titulo: "Aprimoramentos", pergunta: "Como ela cresce gastando PM?" },
  { id: "revisao", titulo: "Pronto!", pergunta: "Revise e guarde" },
];

/**
 * Criador de magias, passo a passo, com balanceamento por pontos (estimativa da comunidade, não regra oficial). Cada pessoa cria e guarda as
 * próprias magias e só ela vê (logada na conta). O motor de custo e os textos são adaptados do hub-t20 (RaymundoJMSN).
 */
export const SpellCreator: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [magia, setMagia] = useState<MagiaCriada>(novaMagia);
  const [passo, setPasso] = useState(0);
  const [mine, setMine] = useState<MagiaCriada[]>([]);
  const [where, setWhere] = useState<SaveWhere>("navegador");
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const descRef = useRef<HTMLTextAreaElement>(null);
  const [published, setPublished] = useState<Set<string>>(new Set());
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!userId) return;
    void loadMySpells(userId).then((res) => { setMine(res.spells); setWhere(res.where); });
    void myPublishedIds(userId).then(setPublished);
  }, [userId]);

  const r = useMemo(() => calcular(magia), [magia]);
  const visiveis = PASSOS.filter((p) => !p.visivel || p.visivel(magia));
  const atual = visiveis[Math.min(passo, visiveis.length - 1)];
  const mut = (fn: (m: MagiaCriada) => void) => setMagia((prev) => { const next = structuredClone(prev); fn(next); return next; });
  const ef = magia.efeitos;
  const a = magia.eixos.alvo;

  const grupo = (eixo: "execucao" | "alcance" | "duracao" | "resistencia") => (
    <Grade>
      {Object.entries(ROTULOS[eixo]).filter(([k]) => k in TABELA.eixos[eixo]).map(([k, rotulo]) => (
        <Opcao key={k} marcado={magia.eixos[eixo] === k} titulo={rotulo} custo={TABELA.eixos[eixo][k]} explica={EXPLICA[eixo]?.[k]} onClick={() => mut((m) => { m.eixos[eixo] = k; })} />
      ))}
    </Grade>
  );

  const passoBasico = (
    <div className="space-y-3">
      <label className="block"><span className={lbl}>Nome da magia *</span><input value={magia.nome} maxLength={40} onChange={(e) => mut((m) => { m.nome = e.target.value; })} className={`${inp} font-bold`} placeholder="Ex.: Lança de Cinzas" /></label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block"><span className={lbl}>Círculo</span><select value={magia.circulo} onChange={(e) => mut((m) => { m.circulo = Number(e.target.value) as MagiaCriada["circulo"]; })} className={inp}>{[1, 2, 3, 4, 5].map((c) => <option key={c} value={c}>{c}º círculo — {TABELA.orcamento[String(c)]} pontos</option>)}</select></label>
        <Sel label="Tipo" value={magia.tipo} options={["Arcana", "Divina", "Universal"]} onChange={(v) => mut((m) => { m.tipo = v as MagiaCriada["tipo"]; })} />
        <Sel label="Escola" value={magia.escola} options={ESCOLAS} onChange={(v) => mut((m) => { m.escola = v; })} />
      </div>
    </div>
  );

  const passoEfeitos = (
    <div><p className="mb-2 text-xs text-[#726859]">Marque tudo que a magia faz (pode combinar):</p>
      <Grade>{BLOCOS.map(([k, titulo, explica]) => {
        const ligado = k === "condicoes" ? !!ef.condicoes : !!ef[k];
        return <Opcao key={k} marcado={ligado} titulo={titulo} explica={explica} onClick={() => mut((m) => { if (ligado) delete m.efeitos[k]; else (m.efeitos as Record<string, unknown>)[k] = efeitoInicial(k); })} />;
      })}</Grade></div>
  );

  const dadosEditor = (chave: "dano" | "cura", titulo: string) => {
    const d = ef[chave]!;
    return (
      <div className="rounded-lg border border-[#ded7c6] bg-[#fbf9f4] p-3" key={chave}>
        <h3 className="font-serif text-base font-black text-[#2b261f]">{titulo}</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <Sel label="quantos dados" value={d.n} options={[1, 2, 3, 4, 5, 6, 7, 8, 10, 12]} onChange={(v) => mut((m) => { m.efeitos[chave]!.n = Number(v); })} />
          <Sel label="qual dado" value={d.faces} options={[4, 6, 8, 10, 12]} onChange={(v) => mut((m) => { m.efeitos[chave]!.faces = Number(v); })} />
          <Sel label="+ fixo" value={d.fixo ?? 0} options={[0, 1, 2, 3, 4, 5, 6, 8, 10]} onChange={(v) => mut((m) => { m.efeitos[chave]!.fixo = Number(v); })} />
        </div>
        {chave === "dano" && (
          <>
            <div className={sub}>Tipo de dano (2+ tipos: quem conjura escolhe na hora e paga o mais caro)</div>
            <div className="flex flex-wrap gap-1.5">{TIPOS_DANO.map((tp) => {
              const tipos = d.tipos?.length ? d.tipos : [d.tipo || "fogo"];
              const delta = TABELA.efeitos.custo_tipo_dano?.[semAcento(tp)] ?? 0;
              const on = tipos.includes(tp);
              return <button key={tp} type="button" aria-pressed={on} onClick={() => mut((m) => { const dd = m.efeitos.dano!; const cur = dd.tipos?.length ? [...dd.tipos] : [dd.tipo || "fogo"]; const i = cur.indexOf(tp); if (i >= 0) { if (cur.length > 1) cur.splice(i, 1); } else cur.push(tp); dd.tipos = cur; dd.tipo = cur[0]; })} className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${on ? "border-[#b92b3a] bg-[#b92b3a] text-white" : "border-[#ded7c6] bg-white text-[#726859]"}`}>{tp} <span className="opacity-70">{delta > 0 ? `+${delta}` : delta}pt</span></button>;
            })}</div>
          </>
        )}
        <p className="mt-2 text-[11px] text-[#9c9180]">cada d{d.faces} custa {(chave === "dano" ? TABELA.efeitos.dano_por_dado : TABELA.efeitos.cura_por_dado)[String(d.faces)]} pts · +1 fixo = {chave === "dano" ? TABELA.efeitos.dano_fixo_por_ponto : TABELA.efeitos.cura_fixa_por_ponto} pt · referência oficial: {chave === "dano" ? "2d6 num alvo, 2d8+2 no toque" : "Curar Ferimentos = 2d8+2 no toque"}</p>
      </div>
    );
  };

  const numerico = (chave: "bonus" | "penalidade", titulo: string, sinal: string) => {
    const lista = ef[chave]!;
    const escopos: [string, string][] = [["especifico", "1 perícia / 1 uso específico (×1)"], ["combate", "Defesa OU ataques OU resistências (×1,5)"], ["amplo", "uma categoria inteira de testes (×2)"]];
    return (
      <div className="rounded-lg border border-[#ded7c6] bg-[#fbf9f4] p-3" key={chave}>
        <h3 className="font-serif text-base font-black text-[#2b261f]">{titulo}</h3>
        {lista.map((item, i) => (
          <div key={i} className="mt-2 grid items-end gap-2 sm:grid-cols-[90px_1fr_1fr_auto]">
            <Sel label="valor" value={item.valor} options={[1, 2, 3, 4, 5]} onChange={(v) => mut((m) => { m.efeitos[chave]![i].valor = Number(v); })} />
            <label className="block"><span className={lbl}>abrangência</span><select value={item.escopo || "especifico"} onChange={(e) => mut((m) => { m.efeitos[chave]![i].escopo = e.target.value as "especifico"; })} className={inp}>{escopos.map(([v, rr]) => <option key={v} value={v}>{rr}</option>)}</select></label>
            <label className="block"><span className={lbl}>em quê, exatamente?</span><input value={item.em || ""} maxLength={60} onChange={(e) => mut((m) => { m.efeitos[chave]![i].em = e.target.value; })} className={inp} placeholder={sinal === "+" ? "Defesa, Atletismo…" : "Defesa, ataques do alvo…"} /></label>
            {lista.length > 1 && <button type="button" onClick={() => mut((m) => { m.efeitos[chave]!.splice(i, 1); })} className="rounded border border-[#ded7c6] px-2 py-2 text-xs font-bold text-[#b92b3a]" aria-label="Remover">✕</button>}
          </div>
        ))}
        <button type="button" onClick={() => mut((m) => { m.efeitos[chave]!.push({ valor: 2, em: "", escopo: "especifico" }); })} className="mt-2 rounded border border-[#1c5fb5] px-3 py-1 text-[11px] font-black uppercase text-[#1c5fb5]">{sinal === "+" ? "+ outro bônus" : "+ outra penalidade"}</button>
        <p className="mt-2 text-[11px] text-[#9c9180]">custo por valor: {TABELA.efeitos.bonus_escalonado.map((c, i) => `${sinal}${i + 1}=${c}pt`).join("  ")} × abrangência · o mais caro paga cheio, extras pagam metade</p>
      </div>
    );
  };

  const condicoes = () => {
    const tierDe: Record<string, string> = {};
    for (const [tier, lista] of Object.entries(TABELA.efeitos.condicoes_tier)) for (const c of lista) tierDe[c] = tier;
    const grupos: Record<string, string[]> = { ...(TABELA.condicao_categoria || {}) };
    const comTipo = new Set(Object.values(grupos).flat());
    grupos["sem tipo"] = Object.keys(tierDe).filter((c) => !comTipo.has(c)).sort();
    return (
      <div className="rounded-lg border border-[#ded7c6] bg-[#fbf9f4] p-3" key="condicoes">
        <h3 className="font-serif text-base font-black text-[#2b261f]">🕸 Condições</h3>
        <p className="text-[11px] text-[#9c9180]">a mais cara conta cheia; extras pagam metade do próprio tier. Com resistência parcial/reduz, tudo sai por metade.</p>
        {Object.entries(grupos).map(([g, lista]) => (
          <div key={g}><div className={sub}>{g}</div>
            <div className="flex flex-wrap gap-1.5">{[...lista].sort().map((c) => {
              const on = ef.condicoes!.includes(c);
              return <button key={c} type="button" aria-pressed={on} onClick={() => mut((m) => { const l = m.efeitos.condicoes!; const i = l.indexOf(c); if (i >= 0) l.splice(i, 1); else l.push(c); })} className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${on ? "border-[#b92b3a] bg-[#b92b3a] text-white" : "border-[#ded7c6] bg-white text-[#726859]"}`}>{condNome(c)} <span className="opacity-70">{TABELA.efeitos.condicao_custo_por_tier[tierDe[c]]}pt</span></button>;
            })}</div></div>
        ))}
      </div>
    );
  };

  const passoConfig = (
    <div className="space-y-3">
      {ef.dano && dadosEditor("dano", "💥 Dano")}
      {ef.cura && dadosEditor("cura", "✚ Cura")}
      {ef.bonus && numerico("bonus", "🛡 Bônus", "+")}
      {ef.penalidade && numerico("penalidade", "➖ Penalidade (o alvo resiste)", "−")}
      {ef.condicoes && condicoes()}
      {ef.custom && (
        <div className="rounded-lg border border-[#ded7c6] bg-[#fbf9f4] p-3">
          <h3 className="font-serif text-base font-black text-[#2b261f]">✨ Efeito especial</h3>
          <textarea value={ef.custom.texto} rows={4} onChange={(e) => mut((m) => { m.efeitos.custom!.texto = e.target.value; })} className={`${inp} mt-2`} placeholder="Descreva o efeito. Os códigos {assim} viram os valores reais…" />
          <label className="mt-2 flex items-center gap-2 text-xs text-[#726859]"><input type="checkbox" checked={!!ef.resistenciaForcada} onChange={(e) => mut((m) => { m.efeitos.resistenciaForcada = e.target.checked; })} /> o alvo pode resistir a este efeito (magia ofensiva)</label>
          <label className="mt-2 block max-w-[260px]"><span className={lbl}>custo combinado com o mestre (pontos)</span><input type="number" min={0} max={20} step={0.5} value={ef.custom.pontos} onChange={(e) => mut((m) => { m.efeitos.custom!.pontos = Number(e.target.value); })} className={inp} /></label>
          <p className="mt-1 text-[11px] text-[#9c9180]">sem ideia do preço? a mediana de um efeito utilitário de 1º círculo é {TABELA.efeitos.utilitario_base} pts.</p>
        </div>
      )}
    </div>
  );

  const passoAlvo = (
    <div>
      <Grade>
        <Opcao marcado={a.tipo === "pessoal"} titulo="você mesmo" custo={TABELA.eixos.alvo.pessoal} explica="buff pessoal — alcance vira pessoal" onClick={() => mut((m) => { m.eixos.alvo = { ...m.eixos.alvo, tipo: "pessoal" }; m.eixos.alcance = "pessoal"; })} />
        <Opcao marcado={a.tipo === "alvos"} titulo="criaturas / objetos" custo={0} explica="1 ou mais alvos que você aponta" onClick={() => mut((m) => { m.eixos.alvo = { ...m.eixos.alvo, tipo: "alvos", qtd: m.eixos.alvo.qtd || 1 }; if (m.eixos.alcance === "pessoal") m.eixos.alcance = "curto"; })} />
        <Opcao marcado={a.tipo === "area"} titulo="uma área" custo={TABELA.eixos.alvo.area_p} explica="cone, esfera, linha — pega todo mundo dentro" onClick={() => mut((m) => { m.eixos.alvo = { ...m.eixos.alvo, tipo: "area", tamanho: m.eixos.alvo.tamanho || "p" }; })} />
      </Grade>
      {a.tipo === "alvos" && (
        <>
          <div className={sub}>Quantos alvos?</div>
          <Grade>{([[1, "1 alvo", 0], [2, "2 alvos", TABELA.eixos.alvo.alvo_extra], [3, "3 alvos", 2 * TABELA.eixos.alvo.alvo_extra], ["escolhidas", "escolhidos à vontade", TABELA.eixos.alvo.escolhidas]] as [number | string, string, number][]).map(([q, rotulo, custo]) => (
            <Opcao key={String(q)} marcado={String(a.qtd) === String(q)} titulo={rotulo} custo={custo} onClick={() => mut((m) => { m.eixos.alvo.qtd = q === "escolhidas" ? "escolhidas" : Number(q); })} />
          ))}</Grade>
          <div className={sub}>Atinge o quê? (restringir o tipo devolve ponto)</div>
          <Grade>
            {RESTRITOS.map(([chave, rotulo, explica]) => (
              <Opcao key={String(chave)} marcado={(a.restrito || null) === chave && !(a.restritoCustom && chave === null)} titulo={rotulo} custo={chave ? TABELA.eixos.alvo.restrito : 0} explica={explica} onClick={() => mut((m) => { m.eixos.alvo.restrito = chave; m.eixos.alvo.restritoCustom = false; })} />
            ))}
            <Opcao marcado={!!a.restritoCustom} titulo="outro tipo…" custo={TABELA.eixos.alvo.restrito} explica="mortos-vivos, espíritos, plantas…" onClick={() => mut((m) => { const al = m.eixos.alvo; al.restritoCustom = true; al.restrito = al.restrito && !(al.restrito in RESTRITO_SINGULAR) ? al.restrito : "espíritos"; })} />
          </Grade>
          {a.restritoCustom && <label className="mt-2 block max-w-[300px]"><span className={lbl}>qual tipo?</span><input value={a.restrito || ""} maxLength={30} onChange={(e) => mut((m) => { m.eixos.alvo.restrito = e.target.value; })} className={inp} /></label>}
        </>
      )}
      {a.tipo === "area" && (
        <>
          <div className={sub}>Que tamanho?</div>
          <Grade>{([["p", "pequena", "cone 6m · linha 9m · esfera 3m"], ["m", "média", "cone 9m · esfera 6m"], ["g", "grande", "esfera 9m+ · quadrado 18m"]] as ["p" | "m" | "g", string, string][]).map(([t, rotulo, ex]) => (
            <Opcao key={t} marcado={(a.tamanho || "p") === t} titulo={rotulo} custo={TABELA.eixos.alvo["area_" + t]} explica={ex} onClick={() => mut((m) => { m.eixos.alvo.tamanho = t; delete m.eixos.alvo.metros; })} />
          ))}</Grade>
          <div className={sub}>Qual forma?</div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Sel label="forma" value={a.forma || "esfera"} options={Object.keys(FORMAS.p)} onChange={(v) => mut((m) => { m.eixos.alvo.forma = v; if ((m.eixos.alvo.tamanho || "p") !== "g") m.eixos.alvo.metros = FORMAS[(m.eixos.alvo.tamanho || "p") as "p" | "m"][v]; })} />
            {(a.tamanho || "p") === "g"
              ? <Sel label="metros" value={a.metros || 9} options={[9, 12, 15, 18, 30].filter((mm) => mm <= (TABELA.areas.g_max_m?.[a.forma || "esfera"] ?? 18))} onChange={(v) => mut((m) => { m.eixos.alvo.metros = Number(v); })} />
              : <span className="self-end pb-2 text-[11px] text-[#726859]">{FORMAS[(a.tamanho || "p") as "p" | "m"][a.forma || "esfera"]}m (o tamanho oficial dessa forma)</span>}
          </div>
        </>
      )}
      {a.tipo !== "pessoal" && <><div className={sub}>A que distância?</div>{grupo("alcance")}</>}
    </div>
  );

  const limite = (chave: "umaVezPorCena" | "componente", custo: number, rotulo: string, explica: string) => (
    <label className="flex items-start gap-2 text-sm" key={chave}>
      <input type="checkbox" className="mt-1" checked={!!magia.eixos[chave]} onChange={(e) => mut((m) => { m.eixos[chave] = e.target.checked; })} />
      <span><b>{rotulo}</b> <b className="text-[#2f7d32]">{custo} pt</b><span className="block text-[11px] text-[#726859]">{explica}</span></span>
    </label>
  );
  const passoTempo = (
    <div>
      <div className={sub}>Execução — o que ela custa do seu turno?</div>{grupo("execucao")}
      <div className={sub}>Duração — quanto tempo o efeito fica?</div>{grupo("duracao")}
      <div className="mt-4 space-y-2 rounded-lg border border-[#ded7c6] bg-[#fbf9f4] p-3">
        <h3 className="font-serif text-base font-black text-[#2b261f]">⏳ Limites (devolvem pontos)</h3>
        {limite("umaVezPorCena", TABELA.modificadores?.uma_vez_por_cena ?? -1, "o mesmo alvo só é afetado uma vez por cena", "como Adaga Mental, Comando e Leque Cromático — impede reaplicar no mesmo inimigo na mesma cena")}
        {limite("componente", TABELA.modificadores?.componente_material ?? -1, "exige um componente material que se gasta", "como Aprisionamento, Runa de Proteção e Servo Divino — sem o material, a magia não sai")}
      </div>
    </div>
  );

  const passoResistencia = (
    <div>
      <p className="mb-2 text-xs text-[#726859]">Sua magia é ofensiva — o alvo tem direito a um teste?</p>
      {grupo("resistencia")}
      {magia.eixos.resistencia !== "nenhuma" && (
        <>
          <div className={sub}>Qual teste?</div>
          <Grade>{TESTES.map((t) => <Opcao key={t} marcado={magia.eixos.teste === t} titulo={t} explica={({ Fortitude: "resistir com o corpo (veneno, doença)", Reflexos: "desviar (rajadas, áreas)", Vontade: "resistir com a mente (medo, encanto)" } as Record<string, string>)[t]} onClick={() => mut((m) => { m.eixos.teste = t; })} />)}</Grade>
          <div className="mt-4 rounded-lg border border-[#ded7c6] bg-[#fbf9f4] p-3">
            <h3 className="font-serif text-base font-black text-[#2b261f]">🎯 CD do teste</h3>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!magia.eixos.cdFixa} onChange={(e) => mut((m) => { m.eixos.cdFixa = e.target.checked ? 15 : null; })} /> a magia tem CD própria, fixa (não escala com o nível)</label>
            {magia.eixos.cdFixa ? <label className="mt-2 block max-w-[120px]"><span className={lbl}>CD</span><input type="number" min={2} max={30} value={magia.eixos.cdFixa} onChange={(e) => mut((m) => { m.eixos.cdFixa = Number(e.target.value); })} className={inp} /></label> : null}
            <p className="mt-1 text-[11px] text-[#9c9180]">{magia.eixos.cdFixa ? "CD 15 é neutra; cada ponto abaixo devolve 0,5 pt e cada ponto acima cobra 0,5." : "sem marcar, vale a CD normal: 10 + metade do nível + atributo-chave — cresce com quem conjura."}</p>
          </div>
        </>
      )}
    </div>
  );

  const termos = ["nome", "circulo", "escola", "execucao", "alvo", "alcance", "duracao", ...(a.tipo === "area" ? ["area"] : []), ...(ef.dano ? ["dano", "dano_dado", "tipo_dano"] : []), ...(ef.cura ? ["cura", "cura_dado"] : []),
    ...(ef.bonus?.length ? ["bonus"] : []), ...(ef.penalidade?.length ? ["penalidade"] : []), ...(ef.condicoes?.length ? ["condicao", ...ef.condicoes.slice(0, 4).map((_, i) => `condicao${i + 1}`)] : []),
    ...(ehOfensiva(magia) && magia.eixos.resistencia !== "nenhuma" ? ["teste", "resistencia", "cd"] : []), ...(ef.custom ? ["efeitoespecial"] : [])];
  const inserir = (termo: string) => { const ta = descRef.current; const txt = `{${termo}}`; if (!ta) { mut((m) => { m.descricao += txt; }); return; } const i = ta.selectionStart ?? ta.value.length; mut((m) => { m.descricao = m.descricao.slice(0, i) + txt + m.descricao.slice(ta.selectionEnd ?? i); }); };
  const passoDescricao = (
    <div>
      <p className="mb-2 text-xs text-[#726859]">Escreva livre. Os códigos {"{assim}"} viram os valores reais na carta; se você mudar o dano depois, o texto acompanha:</p>
      <div className="mb-2 flex flex-wrap gap-1.5">{termos.map((t) => <button key={t} type="button" onClick={() => inserir(t)} className="rounded-full border border-[#ded7c6] bg-white px-2.5 py-1 text-[11px] text-[#5c5446] hover:bg-[#f5f2eb]" title={PLACEHOLDERS[t]?.(magia)}>{`{${t}}`} = {String(PLACEHOLDERS[t]?.(magia) ?? "").slice(0, 32)}</button>)}</div>
      <textarea ref={descRef} value={magia.descricao} rows={7} onChange={(e) => mut((m) => { m.descricao = e.target.value; })} className={inp} placeholder="Ex.: Você lança uma bola de fogo que causa {dano} em {alvo}. Quem falhar no teste de {teste} fica {condicao}." />
    </div>
  );

  const passoAprimoramentos = (
    <div>
      <p className="mb-2 text-xs text-[#726859]">Aprimoramentos não gastam pontos da magia — quem conjura paga PM a mais. Escreva os seus (as oficiais cobram mais ou menos o valor sugerido ao lado).</p>
      <div className="mb-2 flex gap-2">
        <button type="button" onClick={() => mut((m) => { m.aprimoramentos.push({ texto: "", pm: 1 }); })} className="rounded border border-[#1c5fb5] px-3 py-1.5 text-[11px] font-black uppercase text-[#1c5fb5]">+ escrever um</button>
        <button type="button" onClick={() => mut((m) => { m.aprimoramentos.push({ texto: "", pm: 0, truque: true }); })} className="rounded border border-[#ded7c6] px-3 py-1.5 text-[11px] font-black uppercase text-[#726859]">+ truque (0 PM)</button>
      </div>
      {magia.aprimoramentos.map((ap, i) => {
        const trilho = ap.truque ? 1 : circuloEfetivo(PM_BASE_DO_CIRCULO[magia.circulo] + (ap.pm || 0));
        const tf = !ap.truque ? tarifaDoTexto(ap.texto, magia) : null;
        const fora = tf && Math.abs((ap.pm || 0) - tf.pm) > 1;
        return (
          <div key={i} className="mb-2 grid items-start gap-2 rounded-lg border border-[#ded7c6] bg-[#fbf9f4] p-2 sm:grid-cols-[auto_70px_1fr_auto]" data-aprimoramento>
            <div className="flex flex-col"><button type="button" disabled={i === 0} onClick={() => mut((m) => { [m.aprimoramentos[i - 1], m.aprimoramentos[i]] = [m.aprimoramentos[i], m.aprimoramentos[i - 1]]; })} className="text-xs disabled:opacity-30" aria-label="Subir">▲</button><button type="button" disabled={i === magia.aprimoramentos.length - 1} onClick={() => mut((m) => { [m.aprimoramentos[i + 1], m.aprimoramentos[i]] = [m.aprimoramentos[i], m.aprimoramentos[i + 1]]; })} className="text-xs disabled:opacity-30" aria-label="Descer">▼</button></div>
            {ap.truque ? <b className="pt-2 text-sm text-[#b92b3a]">Truque</b> : <label className="block"><span className={lbl}>PM</span><input type="number" min={0} max={15} value={ap.pm} onChange={(e) => mut((m) => { m.aprimoramentos[i].pm = Number(e.target.value); })} className={inp} aria-label="PM do aprimoramento" /></label>}
            <div>
              <textarea rows={2} maxLength={500} value={ap.texto} onChange={(e) => mut((m) => { m.aprimoramentos[i].texto = e.target.value; })} className={inp} placeholder="o que o aprimoramento faz…" aria-label="Texto do aprimoramento" />
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                <select value={ap.requerCirculo ?? ""} onChange={(e) => mut((m) => { m.aprimoramentos[i].requerCirculo = e.target.value ? Number(e.target.value) : null; })} className="rounded border border-[#ded7c6] bg-white p-1" aria-label="Círculo exigido"><option value="">requer: —</option>{[2, 3, 4, 5].map((c) => <option key={c} value={c}>requer {c}º</option>)}</select>
                {fora && tf && <span className="font-bold text-[#c2670a]">as oficiais cobram ~{tf.pm} PM ({tf.n}×)</span>}
                {!ap.requerCirculo && trilho > 1 && <span className="text-[#726859]">o PM sugere {trilho}º círculo</span>}
              </div>
            </div>
            <button type="button" onClick={() => mut((m) => { m.aprimoramentos.splice(i, 1); })} className="rounded border border-[#ded7c6] px-2 py-1 text-xs font-bold text-[#b92b3a]" aria-label="Remover aprimoramento">✕</button>
          </div>
        );
      })}
    </div>
  );

  const guardar = async () => {
    setErro(""); setMsg("");
    if (!magia.nome.trim()) { setErro("Dê um nome para a magia."); return; }
    if (!userId) return;
    const pronta = { ...magia, nome: magia.nome.trim() };
    const onde = await saveMySpell(userId, pronta);
    setWhere(onde);
    setMine((l) => [pronta, ...l.filter((s) => s.id !== pronta.id)]);
    setMsg(onde === "conta" ? "Magia guardada na sua conta." : "Magia guardada neste navegador, na sua conta local (a guarda na nuvem ainda não está ligada).");
  };
  const baixar = () => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([JSON.stringify(magia, null, 2)], { type: "application/json" }));
    link.download = `${magia.nome || "magia"}.json`; link.click(); URL.revokeObjectURL(link.href);
  };

  const corpo: Record<string, React.ReactNode> = { basico: passoBasico, efeitos: passoEfeitos, config: passoConfig, alvo: passoAlvo, tempo: passoTempo, resistencia: passoResistencia, descricao: passoDescricao, aprimoramentos: passoAprimoramentos };
  const pct = Math.min(100, (Math.max(0, r.total) / r.orcamento) * 100);
  const idx = visiveis.indexOf(atual);

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-[#f5f2eb]" role="dialog" aria-modal="true" aria-label="Criador de magias" data-spell-creator>
      <div className="mx-auto max-w-[1200px] p-3 sm:p-6">
        <button onClick={onClose} className="mb-3 rounded border border-[#ded7c6] bg-white px-3 py-1.5 text-xs font-bold text-[#726859] hover:bg-[#eae4d5]">← Voltar ao Homebrew</button>
        <div className="mb-3 border-b-4 border-[#b92b3a] pb-2">
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#9c9180]">Homebrew</div>
          <h1 className="font-serif text-3xl font-black text-[#2b261f]">Criador de magias</h1>
          <p className="mt-1 text-xs text-[#726859]">As magias que você criar aqui são <b>só suas</b>: ficam guardadas na sua conta e ninguém mais vê, nem aparecem no grimório ou no compêndio. O balanceamento por pontos é uma <b>estimativa da comunidade</b>, calibrada contra as magias oficiais; não é regra oficial de Tormenta 20.</p>
        </div>

        <div className="mb-3 rounded-full border border-[#ded7c6] bg-white p-1" aria-label="Pontos gastos">
          <div className={`rounded-full px-3 py-1 text-center text-xs font-black text-white ${r.valido ? "bg-[#2f7d32]" : r.precisaAval ? "bg-[#c2670a]" : "bg-[#b92b3a]"}`} style={{ width: `${Math.max(pct, 14)}%` }} data-meter>{r.total} / {r.orcamento} pontos</div>
        </div>

        <nav className="mb-3 flex flex-wrap gap-1.5" aria-label="Passos">
          {visiveis.map((p, i) => <button key={p.id} type="button" onClick={() => setPasso(i)} aria-current={i === idx} className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase ${i === idx ? "border-[#b92b3a] bg-[#b92b3a] text-white" : i < idx ? "border-[#2f7d32] text-[#2f7d32]" : "border-[#ded7c6] bg-white text-[#726859]"}`}>{p.titulo}</button>)}
        </nav>

        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <section className="rounded-lg border border-[#ded7c6] bg-white p-4 shadow-sm" data-spell-step={atual.id}>
            <h2 className="mb-3 font-serif text-xl font-black text-[#2b261f]">{atual.pergunta}</h2>
            {atual.id === "revisao" ? (
              <div className="space-y-3">
                <MagiaCard m={magia} r={r} />
                {!r.valido && <p className="rounded border border-[#b92b3a] bg-[#fbebee] p-2 text-xs font-semibold text-[#b92b3a]">{r.bloqueada ? "Esta combinação não existe nas magias oficiais — veja os avisos e ajuste." : "A magia estourou o orçamento — volte e ajuste, ou combine o extra com o mestre."}</p>}
                {erro && <p className="rounded border border-[#b92b3a] bg-[#fbebee] p-2 text-xs font-semibold text-[#b92b3a]">{erro}</p>}
                {msg && <p role="status" className="rounded border border-[#2b8a3e] bg-[#ebfbee] p-2 text-xs font-bold text-[#2b8a3e]">{msg}</p>}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void guardar()} className="rounded bg-[#b92b3a] px-6 py-2.5 text-xs font-black uppercase text-white shadow hover:bg-[#9c1f2d]" data-save-spell>Guardar magia</button>
                  <CopyButton text={textoPlano(magia, r)} label="📋 Copiar texto" className="rounded border border-[#ded7c6] bg-white px-4 py-2.5 text-xs font-bold text-[#726859] hover:bg-[#eae4d5]" />
                  {published.has(magia.id)
                    ? <>
                        <CopyButton text={spellLink(userId, magia.id)} label="🔗 Copiar link da magia" className="rounded border border-[#ded7c6] bg-white px-4 py-2.5 text-xs font-bold text-[#726859] hover:bg-[#eae4d5]" />
                        <button type="button" onClick={() => void unpublishSpell(userId, magia.id).then((ok) => { if (ok) setPublished((s) => { const n = new Set(s); n.delete(magia.id); return n; }); })} className="rounded border border-[#ded7c6] px-4 py-2.5 text-xs font-black uppercase text-[#b92b3a]" data-unpublish>Despublicar</button>
                      </>
                    : <button type="button" disabled={!publishingAvailable() || r.bloqueada} title={r.bloqueada ? "Esta combinação não existe nas magias oficiais: ajuste antes de publicar." : "Mostrar esta magia na página Homebrew, com o seu perfil"} onClick={() => { if (!magia.nome.trim()) { setErro("Dê um nome para a magia antes de publicar."); return; } void guardar().then(() => setPublishing(true)); }} className="rounded border border-[#1c5fb5] bg-white px-4 py-2.5 text-xs font-black uppercase text-[#1c5fb5] disabled:opacity-50" data-publish>Publicar no Homebrew</button>}
                  <button type="button" disabled title="Em breve: as sugestões vão vir do agente do site" className="rounded border border-[#ded7c6] px-4 py-2.5 text-xs font-black uppercase text-[#9c9180] opacity-70" data-ai-suggestions>⚡ Sugestões da IA (em breve)</button>
                  <button type="button" onClick={baixar} className="rounded border border-[#ded7c6] px-4 py-2.5 text-xs font-black uppercase text-[#726859]">Baixar .json</button>
                  <button type="button" onClick={() => { setMagia(novaMagia()); setPasso(0); setErro(""); setMsg(""); }} className="rounded border border-[#ded7c6] px-4 py-2.5 text-xs font-black uppercase text-[#726859]">Nova magia</button>
                </div>
              </div>
            ) : corpo[atual.id]}
            <div className="mt-5 flex justify-between">
              <button type="button" disabled={idx === 0} onClick={() => setPasso(idx - 1)} className="rounded border border-[#ded7c6] px-4 py-2 text-xs font-black uppercase text-[#726859] disabled:opacity-40">← Voltar</button>
              {idx < visiveis.length - 1 && <button type="button" onClick={() => setPasso(idx + 1)} className="rounded bg-[#b92b3a] px-6 py-2 text-xs font-black uppercase text-white hover:bg-[#9c1f2d]" data-next-step>Continuar →</button>}
            </div>
          </section>

          <aside className="space-y-3">
            {atual.id !== "revisao" && <MagiaCard m={magia} r={r} />}
            <div className="rounded-lg border border-[#ded7c6] bg-white p-3 text-xs shadow-sm">
              <div className="mb-1 text-[10px] font-black uppercase text-[#9c9180]">De onde vem o custo</div>
              <ul className="space-y-0.5" data-cost-parts>{Object.entries(r.partes).filter(([, v]) => v !== 0).map(([k, v]) => <li key={k} className="flex justify-between"><span>{k}</span><b className={v > 0 ? "text-[#b92b3a]" : "text-[#2f7d32]"}>{money(v)}</b></li>)}</ul>
              {r.avisos.length > 0 && <div className="mt-2 space-y-1 border-t border-[#ded7c6] pt-2 text-[11px] text-[#7a5200]" data-cost-warnings>{r.avisos.map((av) => <div key={av}>⚠ {av}</div>)}</div>}
            </div>
            <CopyButton text={textoPlano(magia, r)} label="📋 Copiar texto da magia" className="w-full rounded border border-[#ded7c6] bg-white py-2 text-xs font-bold text-[#726859] hover:bg-[#eae4d5]" />
          </aside>
        </div>

        <section className="mt-6 rounded-lg border border-[#ded7c6] bg-white p-4 shadow-sm" data-my-spells>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-serif text-xl font-black text-[#2b261f]">Minhas magias ({mine.length})</h2>
            <span className="text-[11px] text-[#9c9180]">{where === "conta" ? "Guardadas na sua conta" : "Guardadas neste navegador, na sua conta local"} · só você vê</span>
          </div>
          {mine.length === 0 ? <p className="text-xs text-[#726859]">Nenhuma magia ainda.</p> : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {mine.map((s) => {
                const rs = calcular(s);
                return (
                  <li key={s.id} className="rounded border border-[#ded7c6] bg-[#fbf9f4] p-3">
                    <div className="font-serif text-base font-black text-[#b92b3a]">{s.nome}</div>
                    <div className="text-[10px] font-bold uppercase text-[#9c9180]">{s.escola} ({s.tipo}) · {s.circulo}º círculo · {rs.total}/{rs.orcamento} pts{published.has(s.id) ? " · publicada" : ""}</div>
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={() => { setMagia(s); setPasso(0); setMsg(""); setErro(""); window.scrollTo({ top: 0 }); }} className="rounded border border-[#ded7c6] px-2.5 py-1 text-[11px] font-black uppercase text-[#726859]">Editar</button>
                      <button type="button" onClick={() => { const copia = { ...structuredClone(s), id: novoId(), nome: `${s.nome} (cópia)` }; setMagia(copia); setPasso(0); window.scrollTo({ top: 0 }); }} className="rounded border border-[#ded7c6] px-2.5 py-1 text-[11px] font-black uppercase text-[#726859]">Duplicar</button>
                      <button type="button" onClick={() => { if (confirm(`Apagar "${s.nome}"?`)) { void deleteMySpell(userId, s.id); setMine((l) => l.filter((x) => x.id !== s.id)); } }} className="rounded border border-[#ded7c6] px-2.5 py-1 text-[11px] font-black uppercase text-[#b92b3a]">Apagar</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        {publishing && <PublishSpellDialog magia={magia} onClose={() => setPublishing(false)} onPublished={() => { setPublishing(false); setPublished((s) => new Set(s).add(magia.id)); setMsg("Magia publicada no Homebrew."); }} />}
        <p className="mt-4 text-center text-[10px] text-[#9c9180]">Motor de custo e textos adaptados do Criador de Magias T20 de RaymundoJMSN (hub-t20).</p>
      </div>
    </div>
  );
};
