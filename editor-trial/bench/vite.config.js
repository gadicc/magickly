import { resolve } from "node:path";
import { defineConfig } from "vite";

const engine = process.env.EDITOR_BENCH;
if (!["react", "slate", "lexical", "tiptap"].includes(engine)) throw new Error("Set EDITOR_BENCH to react, slate, lexical, or tiptap");

export default defineConfig({
  build: {
    outDir: `/tmp/magickli-editor-bench-${engine}`,
    emptyOutDir: true,
    rollupOptions: { input: resolve(import.meta.dirname, `${engine}.html`) },
  },
});
