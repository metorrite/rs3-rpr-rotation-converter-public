import { aliasToCanonical, KNOWN_MISSING_RM_ASSETS, MISSING_RM_ASSET_FALLBACK, rsaNameFor } from "./aliases.js";
import type { Catalog, CatalogEntry } from "./catalog.js";
import type { ActionRef } from "./ir.js";
import type { ConversionReport } from "./report.js";

export interface ResolveOptions {
    /** Discord emoji id from the source, if any (PVME / RM). */
    emojiId?: string;
    /** kind hint from the source (RSA "gear" vs "ability"). */
    kindHint?: ActionRef["kind"];
    report?: ConversionReport;
    at?: number;
}

/**
 * Resolve an arbitrary ability name to a catalog entry, trying (in order):
 * curated alias table, then every catalog index (id / emoji id / emoji / pvme).
 */
export function resolveEntry(
    catalog: Catalog,
    name: string,
    opts: ResolveOptions = {},
): { entry: CatalogEntry; canonicalId: string } | null {
    const viaAlias = aliasToCanonical(name);
    if (viaAlias) {
        const entry = catalog.get(viaAlias);
        if (entry) return { entry, canonicalId: entry.id };
    }
    if (opts.emojiId) {
        const m = catalog.match(opts.emojiId);
        if (m) return { entry: m.entry, canonicalId: m.entry.id };
    }
    const m = catalog.match(name);
    if (m) return { entry: m.entry, canonicalId: m.entry.id };
    return null;
}

/** Build an ActionRef, logging an unresolved entry to the report on failure. */
export function toActionRef(
    catalog: Catalog,
    name: string,
    opts: ResolveOptions = {},
): ActionRef {
    const raw = name.trim();
    const hit = resolveEntry(catalog, raw, opts);
    if (!hit) {
        opts.report?.unresolved(raw, opts.at);
        return { canonicalId: null, rawName: raw, display: raw, kind: opts.kindHint ?? "unresolved" };
    }
    const { entry, canonicalId } = hit;
    if (KNOWN_MISSING_RM_ASSETS.has(canonicalId)) {
        opts.report?.missingRmAsset(entry.display, opts.at);
    }
    return {
        canonicalId,
        rawName: raw,
        display: entry.display,
        pvmeName: entry.pvmeName,
        kind: opts.kindHint ?? entry.kind,
        emojiId: entry.emojiId || opts.emojiId,
    };
}

/**
 * Tidy a catalog/RM label into an RS Analysis-style action name:
 * drop a leading "OLD" tag, turn underscores into spaces, lowercase.
 * "OLDChaos Roar" -> "chaos roar", "meteor_strike" -> "meteor strike".
 */
export function cleanRsaName(name: string): string {
    return name
        .replace(/^OLD/i, "")
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

/** Canonical id -> the CatalogEntry to write, substituting a placeholder when RM lacks the icon. */
export function entryForOutput(
    catalog: Catalog,
    canonicalId: string,
): CatalogEntry | null {
    if (KNOWN_MISSING_RM_ASSETS.has(canonicalId)) {
        return catalog.get(MISSING_RM_ASSET_FALLBACK) ?? catalog.get(canonicalId);
    }
    return catalog.get(canonicalId);
}

/** Preferred RSA action name for a resolved ActionRef. */
export function rsaDisplayName(ref: ActionRef): string {
    // A spec carries its RSA action name (e.g. "balance by force") in `display`.
    if (ref.kind === "spec") return cleanRsaName(ref.display || ref.rawName);
    if (!ref.canonicalId) return ref.rawName;
    const curated = rsaNameFor(ref.canonicalId);
    if (curated) return curated;
    // Prefer whichever label reads like a real name (has a word break) once cleaned.
    const fromRm = cleanRsaName(ref.display);
    const fromPvme = ref.pvmeName ? cleanRsaName(ref.pvmeName) : "";
    if (fromRm.includes(" ")) return fromRm;
    if (fromPvme.includes(" ")) return fromPvme;
    return fromRm || fromPvme || ref.rawName;
}
