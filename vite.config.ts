import { resolve } from "node:path";
import { defineConfig } from "vite";

// Two pages: the editor, and a plain guide that search engines can read without running the app.
export default defineConfig({
  build: {
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        guide: resolve(import.meta.dirname, "guide/index.html"),
      },
    },
  },
});
