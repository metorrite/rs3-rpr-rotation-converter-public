#!/usr/bin/env node
// tsc does not emit non-TS files. Copy the vendored data + templates that the
// runtime loads (core/paths.ts resolves them relative to the compiled file)
// from src/data/ into dist/data/.

import { cp, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const from = path.join(root, "src", "data");
const to = path.join(root, "dist", "data");

await mkdir(to, { recursive: true });
await cp(from, to, { recursive: true });
console.log(`copied ${path.relative(root, from)} -> ${path.relative(root, to)}`);
