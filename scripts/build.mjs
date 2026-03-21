import { build } from "esbuild";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));

const banner = `/*!
 * ${pkg.name} v${pkg.version}
 * (c) ${new Date().getFullYear()} ${pkg.author}
 * MIT License
 */`;

const entry = "src/index.js";

// ESM build
await build({
  entryPoints: [entry],
  outfile: "dist/uss-xsd-engine.esm.js",
  bundle: true,
  format: "esm",
  sourcemap: true,
  minify: false,
  banner: {
    js: banner
  }
});

// Standalone browser build
await build({
  entryPoints: [entry],
  outfile: "dist/uss-xsd-engine.standalone.js",
  bundle: true,
  format: "iife",
  globalName: "UssXsdEngine",
  sourcemap: true,
  minify: false,
  banner: {
    js: banner
  }
});

console.log("✅ Build complete");