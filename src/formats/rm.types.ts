// Shape of a RotationMaster (https://github.com/Ellamental2/RotationMaster) export.
// Mirrors upstream src/models.ts as of RM v3.2.0. Parsing is tolerant of older
// files that lack `Id` / `lineBreakSpacing`.

export interface RmAbility {
    Title: string;
    Emoji: string;
    EmojiId: string;
    Category: string;
    Src: string;
}

export interface RmAbilitySelection {
    /** present in v3.2.0+ exports; generated on parse when absent */
    Id?: string;
    /** "→" next | "+" same tick | "/" choice | "↵" line break | "tc" tick-continue | "" grouped */
    Separator: string;
    SelectedAbility: RmAbility | null;
    Notes: string | null;
}

export interface RmRotation {
    Id: number;
    Name: string;
    Data: RmAbilitySelection[];
    Wave: number | null;
}

export interface RmRotationSet {
    Name: string;
    Data: RmRotation[];
    /** v3.2.0+ layout hint; 0 when absent */
    lineBreakSpacing?: number;
}

export function isRmRotationSet(value: unknown): value is RmRotationSet {
    if (typeof value !== "object" || value === null) return false;
    const v = value as Record<string, unknown>;
    if (!Array.isArray(v.Data)) return false;
    return v.Data.every(
        (r) =>
            typeof r === "object" &&
            r !== null &&
            Array.isArray((r as Record<string, unknown>).Data),
    );
}
