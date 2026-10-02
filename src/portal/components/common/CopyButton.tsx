import React, { useState } from "react";

/** Copia para a área de transferência: usa a API moderna e, se o navegador recusar, o jeito antigo (campo de texto escondido). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* cai no jeito antigo */ }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/** Botão "Copiar" que avisa na hora: vira "Copiado!" (ou "Não deu" se o navegador bloquear). */
export const CopyButton: React.FC<{ text: string; className?: string; label?: string }> = ({ text, className = "", label = "Copiar" }) => {
  const [state, setState] = useState<"" | "ok" | "erro">("");
  const click = async () => {
    setState((await copyText(text)) ? "ok" : "erro");
    window.setTimeout(() => setState(""), 1800);
  };
  return <button type="button" onClick={() => void click()} className={className}>{state === "ok" ? "Copiado!" : state === "erro" ? "Não deu" : label}</button>;
};
