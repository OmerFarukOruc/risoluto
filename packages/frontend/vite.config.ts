import { resolve } from "node:path";

import { defineConfig } from "vite";

const frontendRoot = import.meta.dirname;
const repoRoot = resolve(frontendRoot, "../..");

export default defineConfig({
  root: frontendRoot,
  css: {
    modules: {
      localsConvention: "camelCaseOnly",
    },
  },
  resolve: {
    alias: {
      "@symphony/shared": resolve(frontendRoot, "../shared/src/index.ts"),
    },
  },
  build: {
    outDir: resolve(repoRoot, "dist/frontend"),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(frontendRoot, "index.html"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 4001,
    proxy: {
      "/api/v1": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
