#!/usr/bin/env node
// `mvn clean`-style reset. Removes build + package output and generated reports.
//   node scripts/clean.mjs          -> dist/, release/, reports, tsbuild info
//   node scripts/clean.mjs --all    -> also node_modules/ and package-lock is kept

import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const all = process.argv.includes("--all");

const targets = [
    "dist",
    "release",
    "coverage",
    ".tsbuildinfo",
    "tsconfig.tsbuildinfo",
    "test/corpus-report.md",
    "corpus-report.md",
    ...(all ? ["node_modules"] : []),
];

for (const t of targets) {
    await rm(path.join(root, t), { recursive: true, force: true });
    console.log(`removed ${t}`);
}
console.log(all ? "\nrun `npm ci` next." : "\ndone. `npm run build` to rebuild.");
