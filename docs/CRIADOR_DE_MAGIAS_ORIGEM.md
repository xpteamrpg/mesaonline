# Criador de magias — de onde veio (registro de origem)

O Criador de magias (Homebrew → "Criar magia") foi **adaptado do Criador de Magias T20 do `hub-t20`** (RaymundoJMSN,
https://github.com/RaymundoJMSN/hub-t20), por autorização do usuário do site (06–07/10/2026). **O repositório de origem não declara
licença**; o crédito está na própria tela ("Motor de custo e textos adaptados do Criador de Magias T20 de RaymundoJMSN") e aqui.

## O que foi copiado ou portado
| Daqui | De lá |
|---|---|
| `src/portal/lib/homebrew/tabela-custos.json` | `data/tabela-custos.json` (cópia, sem alterações): orçamento por círculo (10/18/25/34/45), preços por execução, alcance, duração, resistência, alvo, dano, cura, bônus, condições por tier, travas por círculo, perfil das escolas |
| `src/portal/lib/homebrew/tarifas-pm.json` | `data/tarifas-pm.json` (cópia): PM que as magias oficiais cobram por tipo de aprimoramento |
| `src/portal/lib/homebrew/spellCost.ts` | `static/custo.mjs` portado para TypeScript (`calcular`, `circuloEfetivo`, `tarifaDoTexto`) |
| `src/portal/lib/homebrew/spellText.ts` | `static/carta.mjs` (rótulos, textos, códigos `{dano}` `{alvo}`…) e `static/pocao.mjs` (poção, óleo ou granada) |
| `src/portal/components/views/SpellCreator.tsx` | o passo a passo de `static/app.js` (A magia, Efeitos, Detalhes, Alvo, Tempo, Resistência, Descrição, Aprimoramentos, Pronto), refeito em React |

## O que NÃO veio
Sugestões de aprimoramentos do servidor deles, revisão por IA (API da Anthropic), publicar/compartilhar magias, galeria de referências
oficiais, contas e login do hub. Aqui as magias são **privadas**: só quem criou, logado, vê.

## Cuidados
- **Não é regra oficial de Tormenta 20.** Os preços são uma estimativa da comunidade, calibrada contra as magias oficiais (principalmente
  as de 1º círculo). A tela avisa isso.
- O trilho de PM dos aprimoramentos usa a Tabela 4-1 do Livro Básico (p.170): 1º círculo 1 PM, 2º 3 PM, 3º 6 PM, 4º 10 PM, 5º 15 PM.
- Guarda: tabela `mrpg_my_spells` (`db/supabase-homebrew-magias.sql`, aplicada em 07/10/2026; desfazer: `-rollback.sql`), com acesso só do dono.
