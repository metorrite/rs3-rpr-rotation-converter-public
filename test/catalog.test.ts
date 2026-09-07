import { describe, expect, it } from "vitest";
import { ALIASES } from "../src/core/aliases.js";
import { loadCatalog } from "../src/core/catalog.js";
import { KNOWN_MISSING_RM_ASSETS } from "../src/core/aliases.js";
import { resolveEntry } from "../src/core/resolve.js";
import { WEAPON_SPEC_RULES } from "../src/core/weapon-specs.js";

const catalog = loadCatalog();

describe("catalog", () => {
    it("loads the vendored ability data", () => {
        expect(catalog.entries.length).toBeGreaterThan(2000);
        expect(catalog.manifest?.rotationMaster.repo).toBe("Ellamental2/RotationMaster");
    });

    it("every alias canonical id exists in the catalog", () => {
        const missing = ALIASES.filter((a) => !catalog.has(a.canonical)).map((a) => a.canonical);
        expect(missing).toEqual([]);
    });

    it("every alias name resolves back to its canonical id", () => {
        const broken: string[] = [];
        for (const entry of ALIASES) {
            for (const name of entry.aliases) {
                const hit = resolveEntry(catalog, name);
                if (hit?.canonicalId !== entry.canonical) {
                    broken.push(`${name} -> ${hit?.canonicalId ?? "(none)"} (expected ${entry.canonical})`);
                }
            }
        }
        expect(broken).toEqual([]);
    });

    it("every weapon-spec weapon resolves unless flagged missing", () => {
        const broken: string[] = [];
        for (const rule of WEAPON_SPEC_RULES) {
            const exists = catalog.has(rule.weaponId);
            if (rule.assetExistsInRm && !exists) broken.push(`${rule.weaponId} (expected present)`);
            if (!rule.assetExistsInRm && exists && !KNOWN_MISSING_RM_ASSETS.has(rule.weaponId)) {
                broken.push(`${rule.weaponId} (now present — update assetExistsInRm)`);
            }
        }
        expect(broken).toEqual([]);
    });
});
