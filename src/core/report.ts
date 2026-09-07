// Per-conversion report. Every assumption, gap, or lossy decision the converter
// makes lands here so the user knows exactly what to eyeball in the output.

import type { FormatId } from "./ir.js";

export interface ReportEntry {
    /** short machine tag */
    code:
        | "unresolved"
        | "ambiguous"
        | "estimated-timing"
        | "weapon-spec"
        | "missing-rm-asset"
        | "dropped"
        | "note";
    message: string;
    /** source name that triggered it, when applicable */
    name?: string;
    /** tick / step index in the source, when applicable */
    at?: number;
}

export class ConversionReport {
    from: FormatId;
    to: FormatId;
    entries: ReportEntry[] = [];

    constructor(from: FormatId, to: FormatId) {
        this.from = from;
        this.to = to;
    }

    add(entry: ReportEntry): void {
        this.entries.push(entry);
    }

    unresolved(name: string, at?: number): void {
        this.add({ code: "unresolved", name, at, message: `No catalog match for "${name}" — left as a placeholder for manual fixup.` });
    }

    ambiguous(name: string, options: string[], at?: number): void {
        this.add({ code: "ambiguous", name, at, message: `"${name}" is ambiguous; emitted choice ${options.join(" / ")}.` });
    }

    estimatedTiming(message: string, at?: number): void {
        this.add({ code: "estimated-timing", at, message });
    }

    weaponSpec(name: string, weapon: string, at?: number): void {
        this.add({ code: "weapon-spec", name, at, message: `"${name}" expanded to a ${weapon} swap + special attack.` });
    }

    missingRmAsset(name: string, at?: number): void {
        this.add({ code: "missing-rm-asset", name, at, message: `RotationMaster has no icon for "${name}" yet; used a placeholder.` });
    }

    dropped(what: string, at?: number): void {
        this.add({ code: "dropped", at, message: `Dropped: ${what} (no representation in the target format).` });
    }

    note(message: string): void {
        this.add({ code: "note", message });
    }

    get counts(): Record<string, number> {
        const c: Record<string, number> = {};
        for (const e of this.entries) c[e.code] = (c[e.code] ?? 0) + 1;
        return c;
    }

    get ok(): boolean {
        return !this.entries.some(
            (e) => e.code === "unresolved" || e.code === "dropped",
        );
    }

    format(): string {
        if (this.entries.length === 0) {
            return `${this.from.toUpperCase()} -> ${this.to.toUpperCase()}: clean conversion, nothing to review.`;
        }
        const lines = [
            `${this.from.toUpperCase()} -> ${this.to.toUpperCase()} — ${this.entries.length} item(s) to review:`,
        ];
        for (const e of this.entries) {
            const loc = e.at != null ? ` [@${e.at}]` : "";
            lines.push(`  • (${e.code})${loc} ${e.message}`);
        }
        return lines.join("\n");
    }
}
