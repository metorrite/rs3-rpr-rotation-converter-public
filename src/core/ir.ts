// Intermediate representation that every format converts to and from.
//
// Two shapes of the same rotation:
//   - SequenceIR: ordered steps with relative timing hints (natural for RM / PVME)
//   - TimelineIR: absolute tick-indexed events         (natural for RSA)
// core/timing.ts converts between them.

export type FormatId = "rsa" | "rm" | "pvme";

export type ActionKind =
    | "ability"
    | "gear"
    | "consumable"
    | "spec"
    | "marker" // non-ability annotation kept for the reader, e.g. "enter instance"
    | "unresolved";

export interface ActionRef {
    /** canonical ability slug (RM Title), or null when unresolved */
    canonicalId: string | null;
    /** verbatim text from the source */
    rawName: string;
    /** human-facing label */
    display: string;
    kind: ActionKind;
    /** Discord emoji id when known (PVME source / RM export) */
    emojiId?: string;
    /** PVME display name when known (from the emoji tables) */
    pvmeName?: string;
    /**
     * For kind "spec": the weapon that must be equipped for this special attack.
     * RSA encodes "special attack with weapon X" as a single action name; RM
     * encodes it as [weapon-swap, spec]. This carries the link across the seam.
     */
    weaponId?: string;
    /** Mutually-exclusive alternatives the source left open (RM "/" groups). */
    ambiguousWith?: string[];
}

export interface Step {
    /** the GCD action that defines this step's tick, or null for a pure marker */
    primary: ActionRef | null;
    /** actions that happen on the same tick as `primary` (RM "+" group) */
    sameTick: ActionRef[];
    /**
     * ticks after this step's anchor that `primary` actually lands on.
     * null = "one step after the previous action" (the default cadence).
     */
    delayTicks: number | null;
    /** render a line break before this step (RM "↵") */
    lineBreakBefore?: boolean;
    /** this action is stalled (RM "s" separator / PVME "s" prefix) */
    stall?: boolean;
    /** this action is a release of a stalled action (RM "r" separator) */
    release?: boolean;
    /** off-GCD extras / gear that land this tick but are truly optional/conditional */
    optional?: ActionRef[];
    /** leftover free text (RM Notes that were not a tick count) */
    note?: string;
}

export interface SequenceIR {
    kind: "sequence";
    name: string;
    source: FormatId;
    steps: Step[];
}

export interface TimelineEvent {
    tick: number;
    primary: ActionRef | null;
    overlays: ActionRef[];
    note?: string;
}

export interface TimelineIR {
    kind: "timeline";
    name: string;
    source: FormatId;
    events: TimelineEvent[];
    /** original RSA export, kept so settings (`data.s`) survive a round trip */
    carrier?: unknown;
}

export type RotationIR = SequenceIR | TimelineIR;

export function emptyStep(primary: ActionRef | null = null): Step {
    return { primary, sameTick: [], delayTicks: null };
}

export function unresolvedAction(raw: string): ActionRef {
    return { canonicalId: null, rawName: raw, display: raw, kind: "unresolved" };
}

export function markerAction(text: string): ActionRef {
    return { canonicalId: null, rawName: text, display: text, kind: "marker" };
}
