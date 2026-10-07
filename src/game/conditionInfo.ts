/**
 * Descrição de cada condição (texto do catálogo do VTT legado, `CONDITION_INFO`).
 * Fonte só de texto: os efeitos numéricos estão em `conditionEffects.ts`.
 */
export const CONDITION_INFO: Record<string, string> = {
  "Abalado": "O personagem sofre -2 em testes de perícia. Se ficar abalado novamente, em vez disso fica apavorado. (Medo)",
  "Agarrado": "O personagem fica desprevenido e imóvel, sofre -2 em testes de ataque e só pode atacar com armas leves. Ataques à distância contra um alvo envolvido em uma manobra de agarrar têm 50% de chance de acertar o alvo errado. (Movimento)",
  "Alquebrado": "O custo em pontos de mana das habilidades do personagem aumenta em +1. (Mental)",
  "Apavorado": "O personagem sofre -5 em testes de perícia e não pode se aproximar voluntariamente da fonte do medo. (Medo)",
  "Atordoado": "O personagem fica desprevenido e não pode fazer ações. (Mental)",
  "Caído": "O personagem sofre –5 na Defesa contra ataques corpo a corpo e recebe +5 na Defesa contra ataques à distância (cumulativos com outras condições). Além disso, sofre –5 em ataques corpo a corpo e seu deslocamento é reduzido a 1,5m.",
  "Cego": "O personagem fica desprevenido e lento, não pode fazer testes de Percepção para observar e sofre -5 em testes de perícias baseadas em Força ou Destreza. Todos os alvos de seus ataques recebem camuflagem total. Você é considerado cego enquanto estiver em uma área de escuridão total, a menos que algo lhe permita perceber no escuro. (Sentidos)",
  "Confuso": "O personagem comporta-se de modo aleatório. Role 1d6 no início de seus turnos. 1) Movimenta-se em uma direção escolhida por uma rolagem de 1d8; 2-3) Não pode fazer ações, e fica balbuciando incoerentemente; 4-5) Usa a arma que estiver empunhando para atacar a criatura mais próxima, ou a si mesmo se estiver sozinho (nesse caso, apenas role o dano); 6) A condição termina e pode agir normalmente. (Mental)",
  "Debilitado": "O personagem sofre -5 em testes de Força, Destreza e Constituição e em testes de perícias baseadas nesses atributos. Se o personagem ficar debilitado novamente, em vez disso fica inconsciente.",
  "Desprevenido": "O personagem sofre -5 na Defesa e em Reflexos. Você fica desprevenido contra inimigos que não possa perceber.",
  "Doente": "Sob efeito de uma doença. (Metabolismo)",
  "Em Chamas": "O personagem está pegando fogo. No início de seus turnos, sofre 1d6 pontos de dano de fogo. O personagem pode gastar uma ação padrão para apagar o fogo com as mãos. Imersão em água também apaga as chamas.",
  "Enfeitiçado": "O personagem se torna prestativo em relação à fonte da condição. Ele não fica sob controle da fonte, mas percebe suas palavras e ações da maneira mais favorável possível. A fonte da condição recebe +10 em testes de Diplomacia com o personagem. (Mental)",
  "Enjoado": "O personagem só pode realizar uma ação padrão ou de movimento (não ambas) por rodada. Ele pode gastar uma ação padrão para fazer uma investida, mas pode avançar no máximo seu deslocamento (e não o dobro). (Metabolismo)",
  "Enredado": "O personagem fica lento, vulnerável e sofre -2 em testes de ataque. (Movimento)",
  "Envenenado": "O efeito desta condição varia de acordo com o veneno. Pode ser perda de vida recorrente ou outra condição (como fraco ou enjoado). Perda de vida recorrente por venenos é cumulativa. (Veneno)",
  "Esmorecido": "O personagem sofre -5 em testes de Inteligência, Sabedoria e Carisma e em testes de perícias baseadas nesses atributos. (Mental)",
  "Exausto": "O personagem fica debilitado, lento e vulnerável. Se ficar exausto novamente, em vez disso fica inconsciente. (Cansaço)",
  "Fascinado": "Com a atenção presa em alguma coisa. O personagem sofre -5 em Percepção e não pode fazer ações, exceto observar aquilo que o fascinou. Esta condição é anulada por ações hostis contra o personagem ou se o que o fascinou não estiver mais visível. Balançar uma criatura fascinada para tirá-la desse estado gasta uma ação padrão. (Mental).",
  "Fatigado": "O personagem fica fraco e vulnerável. Se ficar fatigado novamente, em vez disso fica exausto. (Cansaço)",
  "Fraco": "O personagem sofre -2 em testes de Força, Destreza e Constituição e em testes de perícias baseadas nesses atributos. Se ficar fraco novamente, em vez disso fica debilitado.",
  "Frustrado": "O personagem sofre -2 em testes de Inteligência, Sabedoria e Carisma e em testes de perícias baseadas nesses atributos. Se ficar frustrado novamente, em vez disso fica esmorecido. (Mental)",
  "Imóvel": "Todas as formas de deslocamento do personagem são reduzidas a 0 metros. (Movimento)",
  "Invisível": "O personagem não pode ser visto: quem tenta atacá-lo tem camuflagem total (50% de chance de errar). Não é uma condição do Livro Básico: vem do efeito da magia Invisibilidade e é usada pela mesa.",
  "Morto": "O personagem morreu. Marcada à mão pelo mestre; a morte por PV (−10 ou metade dos PV totais) continua automática. Não é uma condição do Livro Básico.",
  "Inconsciente": "O personagem fica indefeso e não pode fazer ações, incluindo reações (mas ainda pode fazer testes que sejam naturalmente feitos quando se está inconsciente, como testes de Constituição para estabilizar sangramento). Balançar uma criatura para acordá-la gasta uma ação padrão.",
  "Indefeso": "O personagem fica desprevenido, mas sofre -10 na Defesa, falha automaticamente em testes de Reflexos e pode sofrer golpes de misericórdia.",
  "Lento": "Todas as formas de deslocamento do personagem são reduzidas à metade (arredonde para baixo para o primeiro incremento de 1,5 metros) e ele não pode correr ou fazer investidas. (Movimento)",
  "Ofuscado": "O personagem sofre -2 em testes de ataque e de Percepção. (Sentidos)",
  "Paralisado": "Fica imóvel e indefeso e só pode realizar ações puramente mentais. (Movimento)",
  "Pasmo": "Não pode fazer ações. (Mental)",
  "Petrificado": "O personagem fica inconsciente e recebe redução de dano 8. (Metamorfose)",
  "Sangrando": "No início de seu turno, o personagem deve fazer um teste de Constituição (CD 15). Se falhar, perde 1d6 pontos de vida e continua sangrando. Se passar, remove essa condição. (Metabolismo)",
  "Sobrecarregado": "O personagem sofre penalidade de armadura -5 e seu deslocamento é reduzido em -3 metros. (Movimento)",
  "Surdo": "O personagem não pode fazer testes de Percepção para ouvir e sofre -5 em testes de Iniciativa. Além disso, é considerado em condição ruim para lançar magias. (Sentidos)",
  "Surpreendido": "O personagem fica desprevenido e não pode fazer ações.",
  "Vulnerável": "O personagem sofre -2 na Defesa.",
};

const norm = (name: string) => name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
const BY_KEY = new Map(Object.entries(CONDITION_INFO).map(([name, text]) => [norm(name), text]));

/** Descrição da condição pelo nome (ignora acento, caixa e espaços). */
export function conditionDescription(name: string): string | undefined {
  return BY_KEY.get(norm(name));
}

export const CONDITION_NAMES = Object.keys(CONDITION_INFO);
