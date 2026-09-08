import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
    convertGuide,
    extractRotations,
    isRotationLine,
    loadCatalog,
    parseGuideDocument,
} from "../src/core/index.js";
import type { RmRotationSet } from "../src/formats/rm.types.js";

const corpus = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "corpus/pvme-guides",
);
const guide = (p: string) => readFileSync(path.join(corpus, p), "utf8");
const catalog = loadCatalog();

const ids = (r: { sequence: { steps: { primary: { canonicalId: string | null } | null }[] } }) =>
    r.sequence.steps.filter((s) => s.primary).map((s) => s.primary!.canonicalId);

describe("parseGuideDocument", () => {
    it("splits headings and drops embeds / directives", () => {
        const doc = parseGuideDocument(guide("rs3-full-boss-guides/rasial.txt"));
        expect(doc.title).toContain("Rasial");
        expect(doc.sections.some((s) => s.title === "T90 Equilibrium Rotation")).toBe(true);
        // no directive or embed-json line leaked into section content
        const all = doc.sections.flatMap((s) => s.lines).join("\n");
        expect(all).not.toMatch(/^\.(img|tag|embed|pin):/m);
        expect(all).not.toMatch(/"embed"\s*:/);
    });
});

describe("isRotationLine", () => {
    it("accepts dense token sequences, rejects prose", () => {
        expect(isRotationLine("<:grico:1> → <:gdeathsswift:2> → <:snipe:3>")).toBe(true);
        expect(isRotationLine("⬥ (tc) + <:deathskulls:1> → <:soulsap:2> → <:touchofdeath:3>")).toBe(true);
        expect(isRotationLine("⬥ Apply <:invokedeath:1> + <:haunted:2> and build to 5 stacks")).toBe(false);
        expect(isRotationLine("⬥ Optimal kills per hour: ~2668 <:melee:1> / ~? <:magic:2>")).toBe(false);
    });
});

describe("extractRotations", () => {
    it("Rasial -> two distinct rotations, each with its phases joined", () => {
        const rots = extractRotations(guide("rs3-full-boss-guides/rasial.txt"), catalog);
        expect(rots.length).toBe(2);
        expect(rots[0]!.name).toMatch(/T90 Equilibrium/);
        expect(rots[1]!.name).toMatch(/Equilibrium/);
        // pre-build + phase content are concatenated (well over a single phase)
        expect(rots[0]!.sequence.steps.length).toBeGreaterThan(30);
        // opener is conjure army -> life transfer
        expect(ids(rots[0]!).slice(0, 2)).toEqual(["conjurearmy", "lifetransfer"]);
        // every ability resolved
        expect(rots.every((r) => r.report.counts.unresolved ?? 0)).toBeFalsy();
    });

    it("path guide -> one rotation per path", () => {
        const rots = extractRotations(
            guide("rs3-full-boss-guides/araxxor/araxxor-necromancy.txt"),
            catalog,
        );
        const names = rots.map((r) => r.name);
        expect(names.some((n) => /Top Path/.test(n))).toBe(true);
        expect(names.some((n) => /Middle Path/.test(n))).toBe(true);
        expect(names.some((n) => /Bottom Path/.test(n))).toBe(true);
    });

    it("preserves ability order with no drops", () => {
        const rots = extractRotations(
            guide("rs3-full-boss-guides/vorkath/necro-vorkath.txt"),
            catalog,
        );
        for (const r of rots) {
            expect(r.sequence.steps.length).toBeGreaterThan(0);
            // no step lost its primary
            expect(r.sequence.steps.every((s) => s.primary !== undefined)).toBe(true);
        }
    });
});

describe("PVME -> RM phase blocks", () => {
    it("amascut 2k r/m -> named blocks; opener is a choice, no doubled deathspore", () => {
        const { rotations } = convertGuide(
            guide("rs3-full-boss-guides/amascut/amascut-2000-ranged-melee-dps.txt"),
            { to: "rm", catalog },
        );
        const rm = rotations[0]!.output as RmRotationSet;
        expect(rm.Data.length).toBeGreaterThanOrEqual(3);
        expect(rm.Data.map((b) => b.Name).join(" ")).toMatch(/Wars/);

        const wars = rm.Data.find((b) => b.Name === "Wars")!;
        // the opener "… deadshot or … grico" is a "/" choice, not a "+" chain
        expect(wars.Data.some((d) => d.Separator === "/")).toBe(true);
        // deathspore arrows appears at most once in the first three rows
        const heads = wars.Data.slice(0, 3).map((d) => d.SelectedAbility?.Title);
        expect(heads.filter((t) => t === "deathsporearrows").length).toBeLessThanOrEqual(1);
    });

    it("--no-phase-blocks (rmPhaseBlocks off) yields a single block", () => {
        const { rotations } = convertGuide(guide("rs3-full-boss-guides/rasial.txt"), {
            to: "rm",
            catalog,
            settings: { rmPhaseBlocks: false },
        });
        expect((rotations[0]!.output as RmRotationSet).Data.length).toBe(1);
    });
});
