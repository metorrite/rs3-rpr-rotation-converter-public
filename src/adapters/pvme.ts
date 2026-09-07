// PVME-guide rotation notation <-> SequenceIR.
//
// Guides write rotations as Discord emoji tokens joined by separators:
//   <:grico:787...> → <:gdeathsswift:994...> + <:vulnbomb:655...> → *2t* <:snipe:...>
// RotationMaster ships its own parser for the single-colon form (:grico:); this
// supports both <:name:id> and :name: and is adapted from upstream
// src/abilitiesLookup.ts.

import type { Catalog } from "../core/catalog.js";
import type { ActionRef, SequenceIR, Step } from "../core/ir.js";
import type { ConversionReport } from "../core/report.js";
import { entryForOutput, toActionRef } from "../core/resolve.js";

const EMOJI_TOKEN = /<?:([a-zA-Z0-9_]+):(\d+)?>?/g;
const SEP_SPLIT = /\s*(→|\+|\/|>|\n|↵)\s*/;
const TICK_NOTE = /\*\s*(\d+)\s*t\s*\*/i;

interface Token {
    sep: string;
    text: string;
}

function tokenize(input: string): Token[] {
    const cleaned = input.replace(/[()]/g, " ").trim();
    const parts = cleaned.split(SEP_SPLIT).filter((p) => p != null && p.trim() !== "");
    const tokens: Token[] = [];
    let sep = "→";
    for (const part of parts) {
        if (["→", "+", "/", ">", "\n", "↵"].includes(part)) {
            sep = part === ">" ? "→" : part === "\n" ? "↵" : part;
            continue;
        }
        tokens.push({ sep, text: part.trim() });
        sep = "→";
    }
    return tokens;
}

function emojiRefs(text: string): { name: string; emojiId?: string }[] {
    const out: { name: string; emojiId?: string }[] = [];
    for (const m of text.matchAll(EMOJI_TOKEN)) {
        out.push({ name: m[1]!, emojiId: m[2] });
    }
    return out;
}

// ---------------------------------------------------------------------------
// parse: guide string -> SequenceIR
// ---------------------------------------------------------------------------

export function parsePvme(
    input: string,
    catalog: Catalog,
    report?: ConversionReport,
): SequenceIR {
    const tokens = tokenize(input);
    const steps: Step[] = [];
    let at = 0;

    for (const token of tokens) {
        const refs = emojiRefs(token.text);
        const tick = token.text.match(TICK_NOTE);
        const freeText = token.text.replace(EMOJI_TOKEN, "").replace(TICK_NOTE, "").replace(/[*_]/g, "").trim();

        if (refs.length === 0) {
            // pure annotation: attach as a note/marker on the previous step
            if (freeText && steps.length > 0) {
                const prev = steps[steps.length - 1]!;
                prev.note = prev.note ? `${prev.note}; ${freeText}` : freeText;
            } else if (freeText) {
                steps.push({ primary: { canonicalId: null, rawName: freeText, display: freeText, kind: "marker" }, sameTick: [], delayTicks: null });
            }
            continue;
        }

        const [head, ...rest] = refs;
        const primary = toActionRef(catalog, head!.name, { report, at, emojiId: head!.emojiId });

        if (token.sep === "+" && steps.length > 0) {
            steps[steps.length - 1]!.sameTick.push(primary, ...rest.map((r) => toActionRef(catalog, r.name, { report, at, emojiId: r.emojiId })));
            continue;
        }
        if (token.sep === "/" && steps.length > 0) {
            const prev = steps[steps.length - 1]!;
            if (prev.primary) {
                (prev.primary.ambiguousWith ??= []).push(primary.canonicalId ?? primary.rawName);
            }
            continue;
        }

        steps.push({
            primary,
            sameTick: rest.map((r) => toActionRef(catalog, r.name, { report, at, emojiId: r.emojiId })),
            delayTicks: tick ? Number.parseInt(tick[1]!, 10) : null,
            lineBreakBefore: token.sep === "↵",
            note: freeText || undefined,
        });
        at++;
    }

    return { kind: "sequence", name: "PVME rotation", source: "pvme", steps };
}

// ---------------------------------------------------------------------------
// serialize: SequenceIR -> guide string
// ---------------------------------------------------------------------------

function tokenFor(catalog: Catalog, ref: ActionRef): string {
    if (ref.kind === "marker") return `*${ref.display}*`;
    const entry = ref.canonicalId ? entryForOutput(catalog, ref.canonicalId) : null;
    const id = entry?.id ?? ref.canonicalId ?? ref.rawName;
    const emojiId = entry?.emojiId || ref.emojiId || "";
    return `<:${id}:${emojiId}>`;
}

export function serializePvme(
    seq: SequenceIR,
    catalog: Catalog,
    _report?: ConversionReport,
): string {
    const out: string[] = [];

    for (const step of seq.steps) {
        if (!step.primary) continue;
        let piece = "";
        if (step.lineBreakBefore) piece += "\n";
        else if (out.length > 0) piece += " → ";
        if (step.delayTicks != null) piece += `*${step.delayTicks}t* `;

        if (step.primary.kind === "spec" && step.primary.weaponId) {
            piece += `${tokenFor(catalog, { canonicalId: step.primary.weaponId, rawName: step.primary.weaponId, display: step.primary.weaponId, kind: "gear" })} <:spec:>`;
        } else {
            piece += tokenFor(catalog, step.primary);
            for (const alt of step.primary.ambiguousWith ?? []) {
                piece += ` / ${tokenFor(catalog, toActionRef(catalog, alt))}`;
            }
        }
        for (const member of step.sameTick) piece += ` + ${tokenFor(catalog, member)}`;
        if (step.note) piece += ` *${step.note}*`;
        out.push(piece);
    }

    return out.join("").trim();
}
