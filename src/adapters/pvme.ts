// PVME-guide rotation notation <-> SequenceIR.
//
// Notation (from pvme-guides editor-resources/editor-references/style-guide.txt):
//   <:name:ID>   emoji token (ID is the Discord snowflake — the reliable key)
//   →            next tick / GCD
//   +            same tick
//   /            "pick one"
//   ↵ / newline  line break
//   ( … )        annotation: (tc) (auto) (2t) (3 hit) (DW) (2H) (<:autocast:>)
//   s… / r…      stall / release prefix on an ability
//   <:wpn:> <:spec:>      weapon special (space-joined, no operator)
//   <:wpn:> <:eofspec:>   EoF special
//   *text* / *(text)* / *Note: …* / *improv* / ~20s   free-text annotations

import type { Catalog } from "../core/catalog.js";
import type { ActionRef, SequenceIR, Step } from "../core/ir.js";
import type { ConversionReport } from "../core/report.js";
import { entryForOutput, toActionRef } from "../core/resolve.js";
import { findWeaponSpecRule } from "../core/weapon-specs.js";

const EMOJI_TOKEN = /<?:([a-zA-Z0-9_]+):(\d+)?>?/g;
const SPEC_NAMES = new Set(["spec", "specialattack", "eofspec"]);

function stripInvisible(s: string): string {
    return s.replace(/[​-‏﻿]/g, "").replace(/ /g, " ");
}

// ---------------------------------------------------------------------------
// atom / segment model
// ---------------------------------------------------------------------------

interface Ref {
    name: string;
    emojiId?: string;
}
interface Atom {
    op: "first" | "+" | "/";
    refs: Ref[];
    /** emoji refs that appeared inside ( … ) — optional / conditional actions */
    optionalRefs: Ref[];
    delayTicks: number | null;
    stall: boolean;
    release: boolean;
    notes: string[];
}

const emojiRefs = (s: string): Ref[] =>
    [...s.matchAll(EMOJI_TOKEN)].map((m) => ({ name: m[1]!, emojiId: m[2] }));

const NOTE_STOPWORDS = new Set([
    "or", "if", "on", "the", "a", "an", "to", "and", "do", "of", "in", "at",
    "is", "are", "be", "for", "as", "s", "r", "tc",
]);

/** Strip every emoji token / stray bracket-colon debris from free text. */
function cleanNote(s: string): string {
    const t = s
        .replace(EMOJI_TOKEN, " ")
        .replace(/<[^>]*>/g, " ")
        .replace(/:[a-z0-9_]+:/gi, " ")
        .replace(/[<>()]/g, " ")
        .replace(/\bakh:\d+\b/gi, " ")
        .replace(/\b\d{6,}\b/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^[:;,.+/\-\s]+|[:;,.+/\-\s]+$/g, "")
        .trim();
    if (t.length <= 1) return "";
    // drop fragments that are only filler words ("or", "if 53% after", …)
    const words = t.toLowerCase().split(/\s+/);
    if (words.every((w) => NOTE_STOPWORDS.has(w) || /^\d+%?$/.test(w))) return "";
    return t;
}

function classifyParen(inner: string): {
    delayTicks?: number;
    note?: string;
    optionalRefs?: Ref[];
} {
    const t = inner.trim();
    const refs = emojiRefs(t);
    const tick = t.match(/^(\d+)\s*t$/i);
    if (tick) return { delayTicks: Number.parseInt(tick[1]!, 10) };
    if (/^tc\b/i.test(t)) {
        return { note: refs.length ? "target cycle" : "target cycle", optionalRefs: [] };
    }
    if (/^(dw|2h)$/i.test(t)) return { note: t.toUpperCase() };
    if (/hits?\b/i.test(t) && !refs.length) return { note: `channel: ${t}` };
    // ( <:emoji:> … ) -> an optional / conditional action. Keep the refs, keep any
    // real words as a short note, but never the raw ids.
    if (refs.length) return { optionalRefs: refs, note: cleanNote(t) || undefined };
    const n = cleanNote(t);
    return n ? { note: n } : {};
}

function parseAtom(raw: string, op: Atom["op"]): Atom {
    let text = stripInvisible(raw).trim();
    const notes: string[] = [];
    const optionalRefs: Ref[] = [];
    let delayTicks: number | null = null;

    // ( … ) annotations
    text = text.replace(/\(([^()]*)\)/g, (_m, inner: string) => {
        const c = classifyParen(inner);
        if (c.delayTicks != null) delayTicks = c.delayTicks;
        if (c.note) notes.push(c.note);
        if (c.optionalRefs) optionalRefs.push(...c.optionalRefs);
        return " ";
    });
    // * … * annotations (incl. *(…)*)
    text = text.replace(/\*+([^*]+)\*+/g, (_m, inner: string) => {
        const tick = inner.match(/^\(?\s*(\d+)\s*t\s*\)?$/i);
        if (tick) {
            delayTicks = Number.parseInt(tick[1]!, 10);
        } else {
            const n = cleanNote(inner.replace(/^Note:\s*/i, ""));
            if (n) notes.push(n);
        }
        return " ";
    });
    // ~20s / ~1:45 timing hints
    text = text.replace(/~\s*[\d:]+\s*s?/gi, (m) => {
        notes.push(m.trim());
        return " ";
    });

    // s / r stall-release prefix — structural, not a note
    const stall = /(?:^|\s)s(?=<:)/.test(text) || /^\s*s\s*$/.test(text);
    const release = /(?:^|\s)r(?=<:)/.test(text) || /^\s*r\s*$/.test(text);

    const refs = emojiRefs(text);

    // any remaining prose fragment
    const leftover = cleanNote(text.replace(/(?:^|\s)[sr](?=<:|\s|$)/g, " "));
    if (leftover) notes.push(leftover);

    return { op, refs, optionalRefs, delayTicks, stall, release, notes };
}

function splitSegments(input: string): { text: string; lineBreak: boolean }[] {
    const segs: { text: string; lineBreak: boolean }[] = [];
    // newlines first (line breaks), then → within each line
    for (const [i, line] of stripInvisible(input).split(/\r?\n|↵/).entries()) {
        const parts = line.split(/\s*→\s*|\s+>\s+/);
        parts.forEach((p, j) => {
            if (p.trim()) segs.push({ text: p, lineBreak: i > 0 && j === 0 });
        });
    }
    return segs;
}

function splitAtoms(segmentText: string): Atom[] {
    const atoms: Atom[] = [];
    const parts = segmentText.split(/\s*([+/])\s*/);
    atoms.push(parseAtom(parts[0] ?? "", "first"));
    for (let i = 1; i < parts.length; i += 2) {
        atoms.push(parseAtom(parts[i + 1] ?? "", parts[i] === "/" ? "/" : "+"));
    }
    return atoms;
}

// ---------------------------------------------------------------------------
// parse: guide string -> SequenceIR
// ---------------------------------------------------------------------------

export function parsePvme(
    input: string,
    catalog: Catalog,
    report?: ConversionReport,
): SequenceIR {
    const steps: Step[] = [];
    let at = 0;

    const ref = (r: Ref): ActionRef =>
        toActionRef(catalog, r.name, { report, at, emojiId: r.emojiId });

    for (const seg of splitSegments(input)) {
        const atoms = splitAtoms(seg.text);
        const segNotes = atoms.flatMap((a) => a.notes);
        const segDelay = atoms.find((a) => a.delayTicks != null)?.delayTicks ?? null;

        // the primary is the first atom that actually carries an ability token
        const headIdx = atoms.findIndex((a) => a.refs.length > 0);
        if (headIdx === -1) {
            // pure annotation segment -> hang notes on the previous step
            const note = segNotes.join("; ");
            if (note && steps.length > 0) {
                const prev = steps[steps.length - 1]!;
                prev.note = prev.note ? `${prev.note}; ${note}` : note;
            } else if (note) {
                steps.push({ primary: { canonicalId: null, rawName: note, display: note, kind: "marker" }, sameTick: [], delayTicks: null });
            }
            continue;
        }
        const head = atoms[headIdx]!;
        const rest = atoms.slice(headIdx + 1);

        // primary from the head atom; detect space-joined weapon + spec
        let primary: ActionRef;
        const firstRefs = head.refs.map(ref);
        if (firstRefs.length >= 2 && SPEC_NAMES.has(firstRefs[firstRefs.length - 1]!.canonicalId ?? firstRefs[firstRefs.length - 1]!.rawName.toLowerCase())) {
            const weapon = firstRefs[0]!;
            const rule = findWeaponSpecRule(weapon.rawName, weapon.canonicalId ?? "");
            primary = {
                canonicalId: "spec",
                rawName: rule?.rsaActionName ?? `${weapon.display} spec`,
                display: rule?.rsaActionName ?? `${weapon.display} special`,
                kind: "spec",
                weaponId: weapon.canonicalId ?? undefined,
            };
            if (rule) report?.weaponSpec(primary.display, rule.weaponDisplayName, at);
        } else {
            // In "swap swap ability" groups the action is the ability token, not
            // the leading ammo/weapon swap. Match RM's pickPrimary heuristic so the
            // two adapters agree on a round trip.
            const idx = firstRefs.findIndex((r) => r.kind === "ability" || r.kind === "spec");
            primary = firstRefs[idx >= 0 ? idx : 0]!;
        }

        // ammo-swap / off-style tokens grouped with the primary land on the same tick
        const sameTick: ActionRef[] =
            primary.kind === "spec" ? [] : firstRefs.filter((r) => r !== primary);
        for (const atom of rest) {
            const arefs = atom.refs.map(ref);
            if (atom.op === "/") {
                primary.ambiguousWith = [
                    ...(primary.ambiguousWith ?? []),
                    ...arefs.map((r) => r.canonicalId ?? r.rawName),
                ];
                if (arefs.length) {
                    report?.ambiguous(primary.display, [primary.canonicalId ?? primary.display, ...(primary.ambiguousWith ?? [])], at);
                }
            } else {
                sameTick.push(...arefs);
            }
        }

        const optional = atoms.flatMap((a) => a.optionalRefs).map(ref);
        const stall = atoms.some((a) => a.stall);
        const release = atoms.some((a) => a.release);

        steps.push({
            primary,
            sameTick,
            delayTicks: segDelay,
            lineBreakBefore: seg.lineBreak || undefined,
            stall: stall || undefined,
            release: release || undefined,
            optional: optional.length ? optional : undefined,
            note: segNotes.length ? segNotes.join("; ") : undefined,
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
            const specName = step.primary.rawName.toLowerCase().includes("eof") ? "eofspec" : "spec";
            piece += `${tokenFor(catalog, { canonicalId: step.primary.weaponId, rawName: step.primary.weaponId, display: step.primary.weaponId, kind: "gear" })} <:${specName}:>`;
        } else {
            piece += tokenFor(catalog, step.primary);
            for (const alt of step.primary.ambiguousWith ?? []) {
                piece += ` / ${tokenFor(catalog, toActionRef(catalog, alt))}`;
            }
        }
        for (const member of step.sameTick) piece += ` + ${tokenFor(catalog, member)}`;
        if (step.note) piece += ` *(${step.note})*`;
        out.push(piece);
    }

    return out.join("").trim();
}
