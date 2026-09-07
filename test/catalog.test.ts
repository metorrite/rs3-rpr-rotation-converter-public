import { describe, expect, it } from "vitest";
import { ALIASES } from "../src/core/aliases.js";
import { loadCatalog } from "../src/core/catalog.js";
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

    it("every weapon-spec weapon flagged present actually resolves", () => {
        const broken = WEAPON_SPEC_RULES.filter(
            (rule) => rule.assetExistsInRm && !catalog.has(rule.weaponId),
        ).map((rule) => `${rule.weaponId} (${rule.rsaActionName})`);
        expect(broken).toEqual([]);
    });
});
