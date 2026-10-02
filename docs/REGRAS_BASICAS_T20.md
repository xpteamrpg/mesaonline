# Regras básicas do T20 usadas pela Mesa

Fonte: o PDF `regrasbasicas.pdf` (livro básico, cap. 5 "Jogando", págs. 214–239, passado pelo usuário em 02/10/2026) e o texto do capítulo de Magia (págs. 170–173) colado pelo usuário. O PDF é imagem (sem texto) e pesa 39 MB; ele fica fora do Git. Esta página guarda só o que o código usa. Regra do projeto: regra de T20 só com fonte; o que for convenção nossa fica dito como tal.

## Habilidades (pág. 224)
- Custo variável: o máximo de PM gasto por uso é o **nível** na classe que dá a habilidade (para raça, origem e itens, o nível do personagem). O livro não soma o atributo-chave a esse limite (o atributo-chave afeta o total de PM e a CD). *O usuário citou "nível + atributo"; não confere com esta página — pendente de conferência.*
- Alcance: pessoal, toque, curto (9 m = 6 quadrados), médio (30 m = 20), longo (90 m = 60), ilimitado.
- A habilidade gasta os PM mesmo se falhar.

## Tipos de ação (pág. 233)
- No turno: uma padrão + uma de movimento, ou duas de movimento, ou uma completa. Ações livres e reações em qualquer número.
- Reação responde a outra coisa e pode acontecer fora do turno. Magia de reação só em reação àquilo contra o qual se aplica (pág. 172).
- Magia de ação livre: só uma por rodada (pág. 172).
- Redirecionar um efeito já lançado é uma ação padrão (pág. 225).

## Acumulando efeitos (pág. 226)
- Efeitos de habilidades e perícias acumulam entre si, exceto os da mesma habilidade ou perícia.
- Efeitos de **itens, magias, parceiros e ambiente** acumulam com os de outras fontes, mas **não entre si**: duas magias que dão +1 numa mesma coisa valem +1. (Código: `tactics/engine/effectBonuses.ts`.)
- Ordem: multiplicações e divisões antes de somas e subtrações; o teste de resistência é sempre o primeiro a ser aplicado; depois a RD.
- Crítico: multiplica os dados de dano; bônus numéricos (e dados extras, como ataque furtivo) não são multiplicados.

## Duração (pág. 227)
Instantânea, cena, sustentada (1 PM por turno, ação livre), definida (rodadas, horas, dias), permanente, descarregar. Efeito de duração em rodadas termina imediatamente antes da iniciativa do mesmo resultado, depois do número de rodadas (pág. 233).
Teste de resistência: CD = 10 + metade do nível + atributo-chave. Anula, parcial (efeito menor em quem passa), reduz à metade.

## Magia (págs. 170–173)
- Custo por círculo: 1º = 1 PM, 2º = 3, 3º = 6, 4º = 10, 5º = 15.
- Aprimoramento "aumenta": pode ser comprado várias vezes (Bola de Fogo, +2d6 por +2 PM; um arcanista de 11º nível gasta até 11 PM e causa 14d6).
- Aprimoramento "muda": a magia continua igual, exceto a parte mudada; mudanças na mesma característica nunca se acumulam.
- Truque: custo zero, não combina com outros aprimoramentos.
- Pré-requisito de círculo vale com a classe que usa a magia; magia de raça, poder ou item não cumpre.
- Armadura atrapalha magia arcana (teste de Misticismo CD 20 + custo). *Não implementado na Mesa.*
- Concentração: ser ferido ao lançar exige teste de Vontade. *Não implementado na Mesa.*

## Onde está no código
- Aprimoramentos lidos do texto do catálogo (`magias.json`): `tactics/interpretation/spellCasting.ts` (`parseAugmentEffects`: muda execução, aumenta cura/dano, muda alcance, todos os alvos, define RD). Aprimoramentos curados: `tactics/data/spellEnhancements.json`.
- Efeitos de magia: `tactics/engine/spellEffects.ts` (`SPELL_EFFECTS`, Amedrontar em `resolveFear`).
