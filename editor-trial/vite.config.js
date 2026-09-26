import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@tiptap/react": resolve(import.meta.dirname, "../node_modules/@tiptap/react"),
      "@tiptap/core": resolve(import.meta.dirname, "../node_modules/@tiptap/core"),
      "@tiptap/pm": resolve(import.meta.dirname, "../node_modules/@tiptap/pm"),
      "@tiptap/starter-kit": resolve(import.meta.dirname, "../node_modules/@tiptap/starter-kit"),
    },
    dedupe: ["react", "react-dom", "@tiptap/react", "@tiptap/core", "@tiptap/pm"],
  },
  build: {
    rollupOptions: {
      input: {
        editor: resolve(import.meta.dirname, "index.html"),
        productionAdapter: resolve(import.meta.dirname, "production.html"),
        reader: resolve(import.meta.dirname, "reader.html"),
        lexical: resolve(import.meta.dirname, "lexical.html"),
      },
    },
  },
});
