/**
 * Ferimentos e morte — Tormenta20 Jogo do Ano v1.3, p.236: com 0 PV ou menos o personagem cai inconsciente e sangrando; morre ao chegar
 * a −10 PV ou a um número negativo igual à metade dos PV totais, o que for MAIS BAIXO (12 PV morre em −10; 30 PV morre em −15).
 */
export const deathLimit = (hpMax: number) => Math.max(10, Math.ceil(Math.max(0, hpMax) / 2));
export const isDead = (hp: number, hpMax: number) => hp <= -deathLimit(hpMax);
