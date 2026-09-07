// Shape of an RS Analysis (https://tools.runescape.wiki/rs-rot) save/export file.
// Reproduced by observation of real exports; the tool has no published schema.

export interface RsaExtraEntry {
    /** "ability" | "gear" | "consumable" | ... (free-form in the wild) */
    type: string;
    value: string;
    title?: string;
    icon?: string;
    slot?: string;
}

/** A cell in `data.e` is a list of extras; empty/blank entries show up as "". */
export type RsaExtraCell = Array<RsaExtraEntry | string>;

export interface RsaData {
    /** primary action per game tick; "" means idle */
    a: string[];
    /** per-tick overlays (gear swaps, consumables, off-GCD abilities) */
    e: RsaExtraCell[];
    /** per-tick boolean flags (meaning is tool-internal) */
    n?: boolean[];
    /** per-tick free text notes */
    t?: string[];
    /** calculator settings blob — opaque, preserved verbatim on round-trip */
    s?: Record<string, unknown>;
}

export interface RsaExport {
    name: string;
    timestamp?: number;
    data: RsaData;
}

export function isRsaExport(value: unknown): value is RsaExport {
    if (typeof value !== "object" || value === null) return false;
    const v = value as Record<string, unknown>;
    if (typeof v.data !== "object" || v.data === null) return false;
    const d = v.data as Record<string, unknown>;
    return Array.isArray(d.a) && Array.isArray(d.e);
}
