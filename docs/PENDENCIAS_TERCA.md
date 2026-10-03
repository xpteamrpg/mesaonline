# Pendências para terça-feira (03/10/2026 em diante)

Combinado com o usuário em 02/10: depois do playtest, só correção se for extremamente necessária; o resto fica aqui.

## Ficha e personagem na Mesa
- Perícias que exigem treinamento ficam bloqueadas para quem não é treinado (a ficha do Portal já faz; trazer para o painel).
- Habilidades **raciais** separadas dos **poderes** (poder racial é outra coisa: a habilidade vem da própria raça na criação).
- Usar poderes que concedem magia (ex.: Sombras Profanas dá Escuridão): hoje a ficha lista, mas o poder não vira ação.
- Penalidade de armadura −5 da sobrecarga: só mostrada, não aplicada aos testes.
- Poderes que mudam o limite de itens (ex.: Estilo de Duas Armas) não entram.
- PM máximo por magia: nível da classe; somar o atributo de conjuração só com poder específico (regra do usuário; não implementado).
- Abrir o editor de ajustes do Mestre clicando no token do mapa (hoje só pelo Elenco).

## Magias
- Automáticas faltando: Primor Atlético (+9 m, Atletismo +10), Caminhos da Natureza, Queda Suave, Disfarce Ilusório, Escuridão.
- Instante Estoico: RD "/mágico" já separa dano de magia; conferir arma mágica de monstro.
- Campo de Força reação só no próprio turno (caixa Agir).

## Site e contas
- Teste real: login em outro computador, Google, convite entre duas contas, Editar perfil, reenvio de confirmação.
- SMTP próprio (limite de 2 e-mails por hora) e e-mail de confirmação em português.
- Texto do cenário (provisório em "O que é o ModernRPG?").
- Link da calculadora de ND (menu do Portal ou Ferramenta de mestre).
- Imagens do bestiário (234 MB): decidir reduzir.
- Refazer os zips (desatualizados); apagar testes temporários `DIAG` (aguarda "sim").

## Mesa
- Regras de clima (névoa, chuva, neve, tempestade) — o usuário traz as regras.
- Agente de atendimento no site (dragonete ou Samar, voz, enxerga a tela) com os MD dos suplementos.
- Mapa: o usuário está criando.
- Pausa residual de ~0,2 s ao clicar para mover o token.

---
## Lista do usuário de 03/10/2026 (manhã) — registrada como veio

### Mesa online (Portal)
- Capa da mesa: ainda pequena e na horizontal; "arrastar para focar" não funciona. Capa padrão 16:9, imagem inteira.
- Faixa etária: 10 e 12 anos contam como "livre"; só de 14 anos para cima faz diferença.
- Divisão legal one-shot / campanha, gratuita, livre (como no print de referência).
- Seção redundante: "Campanhas/one-shots em que eu participo" não faz sentido separada. "Minhas campanhas" e "Meus one-shots" devem listar **todas** as mesas, com o símbolo de **mestre** (criei) ou **jogador** (participo). Só para mim. Tirar a seção de baixo.
- No cartão da campanha: **Jogadores / personagens na mesa** (miniatura, nome) não aparece; "nenhum jogador ainda".
- Falta como **adicionar personagem**: aceitar o que solicitou, convidar, ou **adicionar personagem pronto** (qualquer mestre pode).
- Página de detalhe da mesa (referência: prints do usuário; "Escolher como entrar", "Copiar anúncio", plataforma, perfil do mestre e dos jogadores) — precisa de migração do Supabase.

### Imagens do site
- "Cenário/O que é o ModernRPG?" reaproveita a imagem de Raças e está muito próxima/cortada.
- Raças de Arton: refazer a imagem com mais representantes e agrupados por origem; a criatura branca de orelhão (parece Halfling) está errada; a Elfa normal está com cara esquisita. Elfo de Lenda de Ruff não entra quando se escolhe "todas as fontes".
- Ícone da aba: d20 miniatura (feito 03/10).

### Projetos futuros
- **Manual do Caçador** (companion de ameaças só de parceiros): na página Parceiros, "Criar/adicionar parceiro" vira uma mesa com animação de abrir um livro (só os braços), páginas esquerda/direita, um parceiro por página, índice para localizar. O usuário está escrevendo o manual à parte e vai pedir ajuda.
- **Agente de atendimento** no site (avatar editável, padrão Samar feito no ChatGPT; vê a tela; voz); ajuda a montar a ficha. Começa na terça quando os créditos resetarem; o usuário passa os MD dos suplementos.

### Mesa — correções pedidas "agora"
- **Jukebox**: áudio por link do YouTube não funciona (ex.: https://youtu.be/LCfEqudu4pc?si=S0Ky4MR3zfRkB-dM).
- **Cursor** do mapa: cruz em vez da seta.

### Mesa — pedidos de funções
- **Menu de botão direito no token**: ver pela visão daquele token (inclusive ameaça), mudar cor da borda, personalizar, e as demais funções de token sem procurar em outro canto.
- **PV e PM ao lado do token** (duas colunas pequenas) na exploração.
- **Perícias**: só mostrar as que a pessoa pode usar; as que exigem treino e ela não tem não devem aparecer.

### Mesa — regressões e erros relatados (investigar a causa antes de corrigir)
1. **Investida**: custa ação completa, move até o **dobro** do deslocamento e ataca; hoje limita a 9 m.
2. **Mover na exploração voltou a exigir "clicar de novo para confirmar"**: deve ser como no início (depois de selecionar o token, o mouse passando calcula o destino; um clique leva). Pode ser só um X/brilho piscando no destino.
3. **Botões gastos**: mover, agir, magia, item, conjuração, condição e espera ficam escuros (gastos) quando a ação foi usada ou não há o que usar; parou de funcionar.
4. **Abrir ficha completa** de uma **ameaça** vai para "Meus personagens"; deveria abrir a ameaça no bestiário (Monstros e ameaças).
5. **Ataques da ameaça** (ex.: Gnoll Capanga: espada curta +9 e mordida +9): são **dois ataques diferentes**; hoje rola um só juntando os dois e só aparecem "espada curta" e "bote" em Agir, com descrição errada. Só com o poder Bote os dois acontecem juntos, contra a mesma criatura.
6. **Token novo colocado no mapa** não rola iniciativa, não entra na lista, não seleciona; só funciona depois de reiniciar o combate. Deve entrar com iniciativa na hora.
7. **Combate → clicar no token → Agir → atacar** abre uma janela; deveria só pedir a área/alvo do ataque (como antes). A janela só vale para Ficha e Inventário. Na aba Poderes não dá para selecionar o poder para aparecer em Agir (Bote, ação completa).
