import fs from "node:fs";
import path from "node:path";

const pkgPath = path.resolve("package.json");
const outPath = path.resolve("src/version.js");

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const version = `v${pkg.version}`;

fs.writeFileSync(
  outPath,
  `export const ENGINE_VERSION = ${JSON.stringify(version)};\n`,
  "utf8",
);

console.log(`Wrote ${outPath} with version ${version}`);