import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// This file lives at src/core/paths.ts in source and dist/core/paths.js after
// build. The data directory sits next to `core/` in both layouts
// (src/data, dist/data — the latter populated by scripts/copy-data.mjs).
const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "..", "..");

export const dataDir = path.resolve(here, "..", "data");

/**
 * Vendored PVME guide corpus. In a build it is copied to `dist/guides/`
 * (bundled with the Electron app); in the source tree it lives under
 * `test/corpus/pvme-guides/`.
 */
export const guidesDir = (() => {
    const bundled = path.join(here, "..", "guides");
    if (existsSync(bundled)) return bundled;
    return path.join(packageRoot, "test", "corpus", "pvme-guides");
})();

export const abilitiesPath = path.join(dataDir, "abilities.json");
export const pvmePath = path.join(dataDir, "pvme.json");
export const pvmeEmojisPath = path.join(dataDir, "pvme-emojis.json");
export const rsaBlankTemplatePath = path.join(dataDir, "RSA_BLANK_TEMPLATE.json");
export const rsaActionsPath = path.join(dataDir, "rsa-actions.json");
export const rsaExtraActionsPath = path.join(dataDir, "rsa-extra-actions.json");
export const assetsManifestPath = path.join(dataDir, "ASSETS_MANIFEST.json");
