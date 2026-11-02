import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// One self-contained HTML file: that's what a Claude artifact publishes.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { target: "es2020", cssCodeSplit: false, assetsInlineLimit: 100_000_000 },
  test: { environment: "jsdom", setupFiles: ["./src/test/setup.ts"] },
});
