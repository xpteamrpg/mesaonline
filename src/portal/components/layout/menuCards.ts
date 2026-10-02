import type { View } from "../../types/view";
import imgLivros from "../../assets/menu/livros.jpg";
import imgPersonagens from "../../assets/menu/personagens.jpg";
import imgCampanhas from "../../assets/menu/campanhas.jpg";
import imgRacas from "../../assets/menu/racas.jpg";
import imgClasses from "../../assets/menu/classes.jpg";
import imgEquip from "../../assets/menu/equipamentos.jpg";
import imgMagias from "../../assets/menu/magias.jpg";
import imgMonstros from "../../assets/menu/monstros.jpg";
import imgOficina from "../../assets/menu/oficina.jpg";
import imgParceiros from "../../assets/menu/parceiros.jpg";
import imgLivrosNovo from "../../assets/menu/livros-novo.jpg";
import imgRacasNovo from "../../assets/menu/racas-novo.jpg";
import imgHomebrew from "../../assets/menu/homebrew.jpg";
import imgCompendio from "../../assets/menu/compendio.jpg";

export interface MenuCard {
  view: View;
  label: string;
  img: string;
}

/** Cards do menu "T20 Online" (mega menu da navbar). */
export const MENU_CARDS: MenuCard[] = [
  { view: "books", label: "Livros", img: imgLivrosNovo },
  { view: "characters", label: "Meus Personagens", img: imgPersonagens },
  { view: "companions", label: "Parceiros", img: imgParceiros },
  { view: "online", label: "Mesa online", img: imgCampanhas },
  { view: "races", label: "Raças", img: imgRacasNovo },
  { view: "classes", label: "Classes & Distinções", img: imgClasses },
  { view: "equipment", label: "Equipamentos", img: imgEquip },
  { view: "spells", label: "Magias (Grimório)", img: imgMagias },
  { view: "bestiary", label: "Monstros & Inimigos", img: imgMonstros },
  { view: "homebrew", label: "Homebrew", img: imgHomebrew },
];

/** Todos os destinos do site, em cards, para a página inicial. */
export const HOME_CARDS: MenuCard[] = [
  { view: "workshop", label: "Oficina de Heróis", img: imgOficina },
  { view: "characters", label: "Meus Personagens", img: imgPersonagens },
  { view: "online", label: "Mesa online", img: imgCampanhas },
  { view: "companions", label: "Parceiros", img: imgParceiros },
  { view: "books", label: "Livros", img: imgLivrosNovo },
  { view: "compendium", label: "Compêndio", img: imgCompendio },
  { view: "races", label: "Raças", img: imgRacasNovo },
  { view: "classes", label: "Classes & Distinções", img: imgClasses },
  { view: "equipment", label: "Equipamentos", img: imgEquip },
  { view: "spells", label: "Magias (Grimório)", img: imgMagias },
  { view: "bestiary", label: "Monstros & Inimigos", img: imgMonstros },
  { view: "homebrew", label: "Homebrew", img: imgHomebrew },
];
