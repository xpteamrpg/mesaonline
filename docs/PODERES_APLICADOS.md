# Poderes com efeito aplicado no jogo (06/10/2026)

Fonte do texto: catálogo `ficha-modernrpg/t20/vtt/poderes.json` (e a cópia em `src/portal/lib/t20/vtt/`). Código: `src/game/powerEffects.ts`
(efeitos `poder:` do token, recalculados em `boardTokenFromCharacter` / `refreshTokenFromSheet`). Teste: `tests/poderesPassivos.test.ts`.

## Reconhecimento na importação
`findPowerByName` (nas duas cópias das regras) tenta o nome como está e depois sem parênteses, sem bônus no fim ("+1 sab") e as partes de
"X: Y" (a última, depois a primeira). Ex.: "Caminho do arcanista:sentinela" → Sentinela; "Poder: Pernas do Mar" → Pernas do Mar.
Continuam sem catálogo (ficam só com o texto da ficha): homebrew e nomes que não existem no catálogo ("Voto da probleza", "Mestre do Tridente"...).

## Aplicados (classe, até o 5º nível, sem condição no texto)
Necrologia (Cura +2, Fortitude), Instinto Selvagem (dano, Percepção, Reflexos), Resiliência Primal (RD 3 no 5º), Fúria da Savana, Soldado de
Infantaria, Mais Alto e Mais Rápido e Demônio de Areia: Raposa (deslocamento +3 m), Pele de Ferro (+4 Defesa, não vale com armadura pesada),
Tanga de Peles (Con na Defesa sem armadura), Casca Grossa (Con até o nível, sem armadura pesada), Pernas do Mar, Rastreador, Gatuno, Pajem,
Voz Poderosa, Análise Tática, Tradição Oral, Visão Noturna, Olhar Assustador (bônus em perícia), Discrição Divina, Tranquilidade dos Lagos,
Coração de Trovão, Herói do Povo (resistências/Defesa), Fortalecimento Arcano (CD das magias). Também antes: poderes que somam PV/PM
(`powerVitals`), Espírito Inquebrável, Magia Ilimitada, descanso e carga.

## Ainda só texto (dependem de situação, escolha, custo em PM ou de modelagem nova)
Armas específicas (Armas da Cavalaria, Lanceiro, Pistoleiro, Arsenal do Deserto), "contra X" (Valentão, Impiedoso, Executor), uma vez por cena/
rodada, gastar PM, margem de ameaça e multiplicador de crítico (não há modificador de crítico em `TacticalEffect.mods`), RD por tipo
(Aspecto do Inverno), aumentos de atributo (Frade: Aumento de Atributo), poderes de parceiro/mascote, magias e CDs de habilidades específicas
(Afinidade Concentrada), custo reduzido de PM, e todos os poderes gerais, de raça e de nível acima de 5.
