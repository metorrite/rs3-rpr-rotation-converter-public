import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { convert, convertGuide, loadCatalog } from "../src/core/index.js";
import { isRmRotationSet } from "../src/formats/rm.types.js";
import { isRsaExport } from "../src/formats/rsa.types.js";

const corpusDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "corpus/pvme-guides",
);

function walk(d: string): string[] {
    return readdirSync(d).flatMap((f) => {
        const p = path.join(d, f);
        return statSync(p).isDirectory() ? walk(p) : p.endsWith(".txt") ? [p] : [];
    });
}

// The strict fidelity bar is on *abilities* (and specials). Gear swaps, consumables,
// and NPC/phase marker icons are secondary and allowed to shift on a round trip.
const ABILITY_KINDS = new Set(["ability", "spec"]);
const abilityIds = (seq: {
    steps: { primary: { canonicalId: string | null; kind: string } | null; sameTick: { canonicalId: string | null; kind: string }[] }[];
}) =>
    seq.steps.flatMap((s) =>
        [s.primary, ...s.sameTick]
            .filter((a): a is { canonicalId: string | null; kind: string } => !!a && ABILITY_KINDS.has(a.kind) && !!a.canonicalId)
            .map((a) => a.canonicalId as string),
    );

// The whole point of this suite is fidelity, not a coverage percentage — it only
// FAILS on exceptions or output that the target format can't read. Resolution
// stats are printed, never asserted.
describe.skipIf(!existsSync(corpusDir))("PVME guide corpus", () => {
    const catalog = loadCatalog();
    const files = existsSync(corpusDir) ? walk(corpusDir) : [];

    it("every guide converts to RM without throwing, and the output re-parses", () => {
        let rotations = 0;
        for (const f of files) {
            const text = readFileSync(f, "utf8");
            const { rotations: rots } = convertGuide(text, { to: "rm", catalog });
            for (const r of rots) {
                rotations++;
                expect(isRmRotationSet(r.output), `${f} :: ${r.name}`).toBe(true);
                // round-trips back through the parser
                expect(() => convert(r.output, { from: "rm", to: "pvme" })).not.toThrow();
            }
        }
        expect(rotations).toBeGreaterThan(100);
    });

    it("every guide converts to RSA without throwing, and the output is a valid export", () => {
        for (const f of files) {
            const { rotations: rots } = convertGuide(readFileSync(f, "utf8"), { to: "rsa", catalog });
            for (const r of rots) {
                expect(isRsaExport(r.output), `${f} :: ${r.name}`).toBe(true);
                const rsa = r.output as { data: { a: string[] } };
                expect(rsa.data.a.some((x) => x !== "")).toBe(true);
            }
        }
    });

    it("PVME -> RM -> PVME keeps every resolved ability, in order", () => {
        for (const f of files) {
            const { rotations, extracted } = convertGuide(readFileSync(f, "utf8"), { to: "rm", catalog });
            extracted.forEach((r, i) => {
                const before = abilityIds(r.sequence);
                const back = convert(rotations[i]!.output, { from: "rm", to: "pvme" }).ir;
                const after = abilityIds(back as never);

                // weapon-spec steps expand to [weapon, spec] and back, so `after`
                // may gain a "spec"; every original id must still appear, in order.
                let j = 0;
                for (const id of before) {
                    const found = after.indexOf(id, j);
                    expect(
                        found,
                        `${path.basename(f)} :: ${r.name} :: lost "${id}"`,
                    ).toBeGreaterThanOrEqual(j);
                    j = found + 1;
                }
            });
        }
    });

    it("reports corpus metrics (informational)", () => {
        let guides = 0,
            withRot = 0,
            rotations = 0,
            selections = 0,
            unresolved = 0;
        const miss = new Map<string, number>();
        for (const f of files) {
            guides++;
            const { rotations: rots } = convertGuide(readFileSync(f, "utf8"), { to: "rm", catalog });
            if (rots.length) withRot++;
            for (const r of rots) {
                rotations++;
                selections += (r.output as { Data: { Data: unknown[] }[] }).Data[0]!.Data.length;
                for (const e of r.report.entries) {
                    if (e.code === "unresolved") {
                        unresolved++;
                        miss.set(e.name ?? "?", (miss.get(e.name ?? "?") ?? 0) + 1);
                    }
                }
            }
        }
        const rate = selections ? (100 * (1 - unresolved / selections)).toFixed(2) : "n/a";
        const top = [...miss.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
        // eslint-disable-next-line no-console
        console.log(
            `\n[corpus] ${guides} guides, ${withRot} with rotations, ${rotations} rotations, ` +
                `${selections} selections, ${unresolved} unresolved (${rate}% resolved)` +
                (top.length ? `\n  top unresolved: ${top.map(([n, c]) => `${n}×${c}`).join(", ")}` : ""),
        );
        expect(true).toBe(true);
    });
});
