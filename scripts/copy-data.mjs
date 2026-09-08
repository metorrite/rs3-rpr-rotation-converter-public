#!/usr/bin/env node
// tsc does not emit non-TS files. Copy the runtime assets that core/paths.ts
// resolves relative to the compiled files:
//   src/data/                  -> dist/data/    (ability + emoji data, templates)
//   test/corpus/pvme-guides/   -> dist/guides/  (PVME guide corpus for the library)

import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function copy(fromRel, toRel) {
    const from = path.join(root, fromRel);
    const to = path.join(root, toRel);
    if (!existsSync(from)) {
        console.warn(`skip ${fromRel} (missing)`);
        return;
    }
    await mkdir(to, { recursive: true });
    await cp(from, to, { recursive: true });
    console.log(`copied ${fromRel} -> ${toRel}`);
}

await copy("src/data", "dist/data");
await copy("test/corpus/pvme-guides", "dist/guides");
