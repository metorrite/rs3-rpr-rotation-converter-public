import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { guideRotations, libraryRotationFile, listGuides } from "../src/core/index.js";
import { isRmRotationSet } from "../src/formats/rm.types.js";
import { isRsaExport } from "../src/formats/rsa.types.js";

const corpus = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "corpus/pvme-guides",
);

describe.skipIf(!existsSync(corpus))("rotation library", () => {
    it("lists the bundled guides with a title and category", () => {
        const guides = listGuides();
        expect(guides.length).toBeGreaterThan(100);
        expect(guides.every((g) => g.id.endsWith(".txt") && g.title && g.category)).toBe(true);
    });

    it("enumerates a guide's rotations", () => {
        const rasial = listGuides().find((g) => g.id.endsWith("rasial.txt"))!;
        const rots = guideRotations(rasial.id);
        expect(rots.length).toBe(2);
        expect(rots[0]!.steps).toBeGreaterThan(30);
        expect(rots[0]!.unresolved).toBe(0);
    });

    it("produces a valid file in each format", () => {
        const rasial = listGuides().find((g) => g.id.endsWith("rasial.txt"))!;
        const rm = libraryRotationFile(rasial.id, 0, "rm");
        expect(rm.fileName).toMatch(/\(RM\)\.json$/);
        expect(isRmRotationSet(JSON.parse(rm.body))).toBe(true);

        const rsa = libraryRotationFile(rasial.id, 0, "rsa");
        expect(isRsaExport(JSON.parse(rsa.body))).toBe(true);

        const pvme = libraryRotationFile(rasial.id, 0, "pvme");
        expect(pvme.fileName).toMatch(/\(PVME\)\.txt$/);
        expect(pvme.body).toMatch(/<:[a-z0-9_]+:/i);
    });

    it("rejects a path-traversal guide id", () => {
        expect(() => guideRotations("../../../etc/passwd")).toThrow();
    });
});
