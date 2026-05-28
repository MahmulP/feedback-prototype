import { defineConfig } from "tsup";

export default defineConfig([
  // Core: ESM + CJS + types
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "es2020",
    treeshake: true,
    // html2canvas-pro is loaded via dynamic import only when a pin is created.
    // Keep it out of every static bundle — ESM splits it into its own chunk,
    // CJS/IIFE consumers either bundle their own (CJS) or ship the bundled
    // version baked in (IIFE — see below).
    external: ["html2canvas-pro"],
  },
  // Mock transport: ESM + CJS + types
  {
    entry: { mock: "src/mock.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: false,
    target: "es2020",
    treeshake: true,
  },
  // Svelte adapter: ESM + types only (peer dep, no CJS needed)
  {
    entry: { svelte: "src/svelte.ts" },
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: false,
    target: "es2020",
    treeshake: true,
    external: ["svelte", "svelte/store", "html2canvas-pro"],
  },
  // CDN / IIFE bundle (single self-contained file, html2canvas inlined)
  {
    entry: { index: "src/global.ts" },
    format: ["iife"],
    globalName: "FeedbackSDK",
    dts: false,
    sourcemap: true,
    clean: false,
    target: "es2020",
    minify: true,
    treeshake: true,
    outExtension() {
      return { js: ".global.js" };
    },
  },
]);
