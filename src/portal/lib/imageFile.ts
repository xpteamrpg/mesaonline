/** Lê um arquivo de imagem e devolve um data URL JPEG reduzido (cabe no armazenamento local do navegador). */
export function imageFileToDataUrl(file: File, max = 640, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("Escolha um arquivo de imagem."));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler a imagem."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Imagem inválida."));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Não foi possível processar a imagem."));
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/** Recorta a imagem no enquadramento (aspect = largura/altura) e no ponto de foco "x% y%", devolvendo um data URL JPEG. */
export function cropImageToDataUrl(src: string, pos: string, aspect: number, outWidth = 640, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error("Imagem inválida."));
    img.onload = () => {
      const [px, py] = parsePos(pos);
      const w = outWidth;
      const h = Math.round(outWidth / aspect);
      const scale = Math.max(w / img.width, h / img.height);
      const rw = img.width * scale;
      const rh = img.height * scale;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Não foi possível processar a imagem."));
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, -(rw - w) * (px / 100), -(rh - h) * (py / 100), rw, rh);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = src;
  });
}

export function parsePos(pos?: string): [number, number] {
  const m = (pos ?? "").match(/(-?[\d.]+)%\s+(-?[\d.]+)%/);
  return m ? [Math.min(100, Math.max(0, Number(m[1]))), Math.min(100, Math.max(0, Number(m[2])))] : [50, 50];
}

/** Reduz uma imagem já em data URL (ex.: retrato de vários MB dentro de um JSON de ficha) para caber na ficha e na conta. */
export function shrinkDataUrl(dataUrl: string, max = 640, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onerror = () => resolve(dataUrl);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  });
}
