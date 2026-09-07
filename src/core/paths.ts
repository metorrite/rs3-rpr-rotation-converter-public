import path from "node:path";
import { fileURLToPath } from "node:url";

// This file lives at src/core/paths.ts in source and dist/core/paths.js after
// build. The data directory sits next to `core/` in both layouts
// (src/data, dist/data — the latter populated by scripts/copy-data.mjs).
const here = path.dirname(fileURLToPath(import.meta.url));

export const dataDir = path.resolve(here, "..", "data");

export const abilitiesPath = path.join(dataDir, "abilities.json");
export const pvmePath = path.join(dataDir, "pvme.json");
export const rsaBlankTemplatePath = path.join(dataDir, "RSA_BLANK_TEMPLATE.json");
export const assetsManifestPath = path.join(dataDir, "ASSETS_MANIFEST.json");
