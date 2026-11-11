import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// Einzige Versionsquelle für Web und Tauri: src-tauri/tauri.conf.json
const tauriConfig = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "src-tauri/tauri.conf.json"), "utf-8"),
) as { version: string };

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(tauriConfig.version),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mcpPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Eine einzige React-Instanz – verhindert "null (reading 'useRef')" nach Paket-Installationen.
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
}));
