import React from "react";

interface Props {
  image: string;
  /** imagem em formato bem largo (21:9): o banner usa a mesma proporção, para a arte aparecer inteira */
  wide?: boolean;
  /** foco do enquadramento (CSS object-position), para não cortar o assunto da arte */
  position?: string;
  title: string;
  /** rótulo pequeno no canto superior esquerdo (trilha) */
  crumb?: string;
  /** contador exibido ao lado do botão (ex.: "7") */
  count?: React.ReactNode;
  action?: { label: string; icon?: string; onClick: () => void };
  children?: React.ReactNode;
}

/** Faixa de topo das páginas "Meus ..." — imagem de fundo, título e botão principal. */
export const PageBanner: React.FC<Props> = ({ image, wide, position = "50% 30%", title, crumb, count, action, children }) => (
  <section className={`relative mb-4 ${wide ? "aspect-[21/9]" : "aspect-[8/3]"} min-h-[220px] overflow-hidden rounded-lg border-b-4 border-[#b92b3a] bg-[#2b261f] shadow-sm`}>
    <img src={image} alt="" style={{ objectPosition: position }} className="absolute inset-0 h-full w-full object-cover" />
    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
    <div className="relative flex h-full flex-col justify-between p-3 sm:p-4">
      <div>{crumb && <span className="inline-flex items-center gap-1.5 rounded bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-[#726859]"><span className="text-[#b92b3a]">◆</span>{crumb}</span>}</div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-serif text-2xl font-black text-white drop-shadow sm:text-4xl">{title}</h1>
        <div className="flex items-center gap-3">
          {count !== undefined && <span className="font-serif text-lg font-black text-white drop-shadow">{count}</span>}
          {action && <button onClick={action.onClick} className="rounded bg-[#b92b3a] px-4 py-2 text-xs font-bold text-white shadow hover:bg-[#9c1f2d]">{action.icon ? `${action.icon} ` : ""}{action.label}</button>}
        </div>
      </div>
    </div>
    {children}
  </section>
);
