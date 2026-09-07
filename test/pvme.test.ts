import { describe, expect, it } from "vitest";
import { convert } from "../src/core/index.js";
import { loadCatalog } from "../src/core/catalog.js";
import { parsePvme, serializePvme } from "../src/adapters/pvme.js";

const catalog = loadCatalog();

// A short real-world style line (necro opener).
const ROTATION =
    "<:conjurearmy:1166094935066423348> → <:lifetransfer:1137809128136388819> → " +
    "<:invokedeath:1137809121983336548> + <:surge:535533810004262912> → " +
    "*2t* <:deathskulls:1159434663903899728>";

describe("PVME adapter", () => {
    it("parses emoji tokens, separators and tick notes", () => {
        const seq = parsePvme(ROTATION, catalog);
        expect(seq.steps.length).toBe(4);
        expect(seq.steps[1]?.primary?.canonicalId).toBeTruthy(); // life transfer
        expect(seq.steps[2]?.sameTick.map((s) => s.canonicalId)).toContain("surge");
        expect(seq.steps[3]?.delayTicks).toBe(2);
    });

    it("round-trips PVME -> RM -> PVME to an equivalent token list", () => {
        const rm = convert(ROTATION, { from: "pvme", to: "rm" }).output;
        const back = convert(rm, { from: "rm", to: "pvme" }).output as string;
        const ids = (s: string) => [...s.matchAll(/<:([a-z0-9_]+):/gi)].map((m) => m[1]);
        expect(ids(back)).toEqual(
            expect.arrayContaining(["lifetransfer", "invokedeath", "surge", "deathskulls"]),
        );
    });

    it("serializes a sequence back to guide notation", () => {
        const seq = parsePvme(ROTATION, catalog);
        const text = serializePvme(seq, catalog);
        expect(text).toContain("<:lifetransfer:");
        expect(text).toContain(" + <:surge:");
    });
});
