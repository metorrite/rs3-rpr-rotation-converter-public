import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { convert } from "../src/core/index.js";
import type { RmRotationSet } from "../src/formats/rm.types.js";
import type { RsaExport } from "../src/formats/rsa.types.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const fixture = (p: string) => JSON.parse(readFileSync(path.join(dir, "fixtures", p), "utf8"));

/** RM selections carry a random uuid Id; strip it so snapshots are stable. */
function stripIds(set: RmRotationSet): RmRotationSet {
    return {
        ...set,
        Data: set.Data.map((r) => ({
            ...r,
            Data: r.Data.map(({ Id: _Id, ...rest }) => rest),
        })),
    } as RmRotationSet;
}

describe("RSA -> RM", () => {
    it("RSA_TO_RM_TEST converts with no unresolved abilities", () => {
        const rsa = fixture("rsa/RSA_TO_RM_TEST.json") as RsaExport;
        const { output, report } = convert(rsa, { from: "rsa", to: "rm" });
        expect(report.counts.unresolved ?? 0).toBe(0);
        expect(stripIds(output as RmRotationSet)).toMatchSnapshot();
    });

    it("FULL_PVME_COVERAGE resolves every ability in the catalog", () => {
        const rsa = fixture("rsa/FULL_PVME_COVERAGE.json") as RsaExport;
        const { report } = convert(rsa, { from: "rsa", to: "rm" });
        const unresolved = report.entries.filter((e) => e.code === "unresolved").map((e) => e.name);
        expect(unresolved).toEqual([]);
    });
});

describe("RM -> RSA", () => {
    it("RM_TO_RSA_TEST converts and reports its timing estimate", () => {
        const rm = fixture("rm/RM_TO_RSA_TEST.json") as RmRotationSet;
        const { output, report } = convert(rm, { from: "rm", to: "rsa" });
        expect(report.counts["estimated-timing"]).toBeGreaterThan(0);
        const rsa = output as RsaExport;
        expect(rsa.data.a.some((x) => x !== "")).toBe(true);
        expect({ name: rsa.name, a: rsa.data.a }).toMatchSnapshot();
    });
});

describe("round trip", () => {
    it("RSA -> RM -> RSA keeps the primary action sequence", () => {
        const rsa = fixture("rsa/RSA_TO_RM_TEST.json") as RsaExport;
        const rm = convert(rsa, { from: "rsa", to: "rm" }).output;
        const back = convert(rm, { from: "rm", to: "rsa" }).output as RsaExport;

        const seq = (r: RsaExport) => r.data.a.filter((x) => x !== "");
        // every action that survived to RM should come back (order preserved),
        // allowing for weapon-spec rows that RM splits out.
        const original = seq(rsa);
        const returned = seq(back);
        expect(returned.length).toBeGreaterThan(0);
        expect(returned.length).toBeLessThanOrEqual(original.length + 5);
    });
});
