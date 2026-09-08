import { describe, expect, it } from "vitest";
import { sameName, slug } from "../src/core/normalize.js";

describe("slug", () => {
    it("lowercases and strips punctuation/whitespace", () => {
        expect(slug("Greater Death's Swiftness")).toBe("greaterdeathsswiftness");
        expect(slug("slice & dice")).toBe("slicedice");
        expect(slug("igneous_deadshot")).toBe("igneousdeadshot");
        expect(slug("Bow of the Last Guardian [im]")).toBe("bowofthelastguardianim");
    });

    it("keeps digits", () => {
        expect(slug("spectral scythe 1")).toBe("spectralscythe1");
    });

    it("sameName compares normalized", () => {
        expect(sameName("Snap Shot", "snap  shot")).toBe(true);
        expect(sameName("snipe", "snap shot")).toBe(false);
    });
});
