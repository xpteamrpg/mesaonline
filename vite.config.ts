import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";

// Portal, ficha oficial, exploração e Tactics são publicados pela mesma entrada.
// Isso mantém o storage oficial e o runtime da mesa no mesmo origin.
// GitHub Pages publica em /mesaonline/: o fluxo de publicação define VITE_BASE; em desenvolvimento a base é "/".
export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react(), tailwindcss()],
  server: { host: true, allowedHosts: true },
  preview: { host: true, port: 4173, allowedHosts: true },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      // Portal em / e Mesa em /mesa/ — páginas separadas, cada uma com o seu CSS.
      input: { portal: resolve(__dirname, "index.html"), mesa: resolve(__dirname, "mesa/index.html") },
      output: {
        manualChunks(id) {
          if (id.includes("/vtt/ameacas")) return "catalog-bestiary";
          if (id.includes("/vtt/magias.json")) return "catalog-spells";
          if (id.includes("/vtt/poderes.json")) return "catalog-powers";
          if (id.includes("/vtt/itens.json")) return "catalog-items";
          if (id.includes("pdfjs-dist")) return "vendor-pdf";
          if (id.includes("peerjs")) return "vendor-peer";
          if (id.includes("framer-motion") || id.includes("lucide-react")) return "vendor-ui";
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) return "vendor-react";
          return undefined;
        },
      },
    },
  },
});
