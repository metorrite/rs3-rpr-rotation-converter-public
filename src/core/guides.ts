// Browsing the vendored PVME guide corpus — used by the desktop "rotation
// library" and anything else that wants to enumerate ready-made rotations.

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { convertGuide, type FormatId } from "./convert.js";
import { loadCatalog } from "./catalog.js";
import { guidesDir } from "./paths.js";
import type { ConversionSettings } from "./settings.js";
import { parseGuideDocument } from "../adapters/pvme-guide.js";

export interface GuideSummary {
    id: string; // relative path, e.g. "rs3-full-boss-guides/rasial.txt"
    title: string; // guide H1
    category: string; // top-level folder
}

export interface LibraryRotation {
    index: number;
    name: string;
    sectionPath: string[];
    steps: number;
    unresolved: number;
}

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((f) => {
        const p = path.join(dir, f);
        return statSync(p).isDirectory() ? walk(p) : p.endsWith(".txt") ? [p] : [];
    });
}

let cache: GuideSummary[] | null = null;

export function listGuides(): GuideSummary[] {
    if (cache) return cache;
    const files = walk(guidesDir);
    cache = files
        .map((abs) => {
            const id = path.relative(guidesDir, abs).replace(/\\/g, "/");
            const doc = parseGuideDocument(readFileSync(abs, "utf8"));
            return { id, title: doc.title, category: id.split("/")[0] ?? "" };
        })
        .sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));
    return cache;
}

function resolveId(id: string): string {
    const abs = path.join(guidesDir, id);
    if (!abs.startsWith(guidesDir)) throw new Error("invalid guide id");
    return abs;
}

/** Rotations available in one guide, before conversion. */
export function guideRotations(id: string): LibraryRotation[] {
    const text = readFileSync(resolveId(id), "utf8");
    const { extracted } = convertGuide(text, { to: "rm", catalog: loadCatalog() });
    return extracted.map((r, index) => ({
        index,
        name: r.name,
        sectionPath: r.sectionPath,
        steps: r.sequence.steps.filter((s) => s.primary).length,
        unresolved: r.report.entries.filter((e) => e.code === "unresolved").length,
    }));
}

/** Convert one rotation of one guide to a target format; returns file body + a suggested name. */
export function libraryRotationFile(
    id: string,
    index: number,
    to: FormatId,
    settings?: Partial<ConversionSettings>,
): { fileName: string; body: string; reportText: string } {
    const text = readFileSync(resolveId(id), "utf8");
    const { rotations } = convertGuide(text, { to, catalog: loadCatalog(), settings });
    const r = rotations[index];
    if (!r) throw new Error(`rotation ${index} not found in ${id}`);
    const ext = to === "pvme" ? "txt" : "json";
    const safe = r.name.replace(/[^\w .()—-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
    return {
        fileName: `${safe} - (${to.toUpperCase()}).${ext}`,
        body: typeof r.output === "string" ? r.output : JSON.stringify(r.output, null, 2),
        reportText: r.report.format(),
    };
}
