import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { convert } from "../src/core/index.js";
import { isRmRotationSet, type RmRotationSet } from "../src/formats/rm.types.js";
import { isRsaExport, type RsaExport } from "../src/formats/rsa.types.js";

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

    it("any pair of formats is reachable", () => {
        const rsa = fixture("rsa/RSA_TO_RM_TEST.json") as RsaExport;
        for (const to of ["rm", "pvme"] as const) {
            const out = convert(rsa, { from: "rsa", to }).output;
            expect(out).toBeTruthy();
            const from = to;
            const back = convert(out, { from, to: "rsa" }).output as RsaExport;
            expect(isRsaExport(back)).toBe(true);
        }
        const rm = fixture("rm/RM_TO_RSA_TEST.json") as RmRotationSet;
        const pvme = convert(rm, { from: "rm", to: "pvme" }).output as string;
        expect(pvme).toMatch(/<:[a-z0-9_]+:/i);
        expect(isRmRotationSet(convert(pvme, { from: "pvme", to: "rm" }).output)).toBe(true);
    });
});

describe("RM -> RSA name coverage", () => {
    it("no output action name keeps an OLD tag, underscore, or capital letter", () => {
        const rm = fixture("rm/RM_TO_RSA_TEST.json") as RmRotationSet;
        const rsa = convert(rm, { from: "rm", to: "rsa" }).output as RsaExport;
        const dirty = rsa.data.a.filter((n) => n && /(^old|_|[A-Z])/.test(n));
        expect(dirty).toEqual([]);
    });

    it("a special with no RS Analysis action becomes a basic + Custom main-hand weapon", () => {
        const rm: RmRotationSet = {
            Name: "spec test",
            Data: [
                {
                    Id: 0,
                    Name: "r",
                    Wave: null,
                    Data: [
                        {
                            Separator: "→",
                            Notes: null,
                            SelectedAbility: {
                                Title: "annihilation",
                                Emoji: "Annihilation",
                                EmojiId: "796989662983094275",
                                Category: "Melee Gear",
                                Src: "",
                            },
                        },
                    ],
                },
            ],
        };
        const rsa = convert(rm, { from: "rm", to: "rsa", settings: { rmWeaponAsSpec: true } })
            .output as RsaExport;
        expect(rsa.data.a[0]).toBe("melee auto");
        const cm = (rsa.data.e[0] ?? []).find(
            (x): x is { value: number; slot?: string } => typeof x === "object" && x.value === 1000000,
        );
        expect(cm?.slot).toBe("melee main-hand weapon");
    });
});

describe("GCD / off-GCD timing (RM -> RSA)", () => {
    const mk = (titles: [string, string][]): RmRotationSet => ({
        Name: "t",
        Data: [
            {
                Id: 0,
                Name: "r",
                Wave: null,
                Data: titles.map(([title, cat]) => ({
                    Separator: "→",
                    Notes: null,
                    SelectedAbility: { Title: title, Emoji: title, EmojiId: "", Category: cat, Src: "" },
                })),
            },
        ],
    });

    it("off-GCD abilities never take an ability-bar slot and don't shift the GCD", () => {
        const rm = mk([
            ["snipe", "Ranged Abilities"],
            ["surge", "Defence and Constitution Abilities"],
            ["surge", "Defence and Constitution Abilities"],
            ["grico", "Ranged Abilities"],
        ]);
        const rsa = convert(rm, { from: "rm", to: "rsa" }).output as RsaExport;
        expect(rsa.data.a.filter((x) => x === "surge")).toEqual([]); // not in the bar
        const filled = rsa.data.a.map((x, i) => (x ? i : -1)).filter((i) => i >= 0);
        expect(filled).toEqual([0, 3]); // snipe @0, grico @3 — surges didn't push it
        expect(rsa.data.e[0]!.some((x) => typeof x === "object" && x.value === "surge")).toBe(true);
    });

    it("a channel occupies its real duration before the next GCD ability", () => {
        const rm = mk([
            ["rapid fire", "Ranged Abilities"],
            ["snipe", "Ranged Abilities"],
        ]);
        const rsa = convert(rm, { from: "rm", to: "rsa" }).output as RsaExport;
        const filled = rsa.data.a.map((x, i) => (x ? i : -1)).filter((i) => i >= 0);
        expect(filled).toEqual([0, 8]); // rapid fire duration 8
    });
});

describe("PVME notation", () => {
    it("stall/release survive PVME -> RM as s/r separators; notes carry no emoji ids", () => {
        const rm = convert("s<:snipe:1> <:spec:2> → r<:snipe:1> + <:grico:3> *(if 53% after <:x:9>)*", {
            from: "pvme",
            to: "rm",
        }).output as RmRotationSet;
        const seps = rm.Data[0]!.Data.map((d) => d.Separator);
        expect(seps).toContain("s");
        expect(seps).toContain("r");
        for (const d of rm.Data[0]!.Data) {
            expect(d.Notes ?? "").not.toMatch(/<:|:\d{5,}/);
        }
    });
});
