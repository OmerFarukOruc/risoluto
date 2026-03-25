import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  root: import.meta.dirname,
  resolve: {
    alias: {
      "@symphony/shared": resolve(import.meta.dirname, "../shared/src/index.ts"),
    },
  },
  build: {
    outDir: resolve(import.meta.dirname, "../../dist/frontend"),
    emptyOutDir: true,
  },
  server: {
    port: 4001,
    proxy: {
      "/api": "http://localhost:4000",
      "/metrics": "http://localhost:4000",
      "/openapi.json": "http://localhost:4000",
    },
  },
});
