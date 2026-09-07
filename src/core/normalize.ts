// The single name normalizer used everywhere a human-typed ability name,
// PVME emoji id, or RM Title/Emoji needs to be compared or looked up.
//
// Replaces the three near-duplicate normalizers in the old codebase
// (convert/pvme.ts toPvmeName, resolve/rmAbilities.ts normalizeKey,
//  convert/rsaReverse.ts normalize).

/** Lowercase, strip punctuation/whitespace, keep [a-z0-9]. */
export function slug(value: string): string {
    return value
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]/g, "");
}

/** True when two names refer to the same thing after normalization. */
export function sameName(a: string, b: string): boolean {
    return slug(a) === slug(b);
}
