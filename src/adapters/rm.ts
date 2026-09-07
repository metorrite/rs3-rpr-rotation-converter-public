import { randomUUID } from "node:crypto";
import { classify, type Catalog, type CatalogEntry } from "../core/catalog.js";
import type { ActionRef, SequenceIR, Step } from "../core/ir.js";
import { slug } from "../core/normalize.js";
import type { ConversionReport } from "../core/report.js";
import { entryForOutput, resolveEntry, toActionRef } from "../core/resolve.js";
import { findWeaponSpecRule } from "../core/weapon-specs.js";
import type { RmAbility, RmAbilitySelection, RmRotationSet } from "../formats/rm.types.js";

const ANCHOR_SEPARATORS = new Set(["→", "↵", "tc", "s", "r", ""]);

function abilityLike(sel: RmAbilitySelection): string {
    return sel.SelectedAbility?.Title || sel.SelectedAbility?.Emoji || "";
}

function isSpec(sel: RmAbilitySelection | undefined): boolean {
    if (!sel?.SelectedAbility) return false;
    return ["spec", "specialattack"].includes(slug(sel.SelectedAbility.Title)) ||
        ["spec", "specialattack"].includes(slug(sel.SelectedAbility.Emoji));
}

function isEofSpec(sel: RmAbilitySelection | undefined): boolean {
    if (!sel?.SelectedAbility) return false;
    return slug(sel.SelectedAbility.Title) === "eofspec" ||
        slug(sel.SelectedAbility.Emoji) === "essenceoffinalityability";
}

function tickNote(notes: string | null | undefined): number | null {
    const m = notes?.trim().match(/^(\d+)\s*t$/i);
    return m ? Number.parseInt(m[1]!, 10) : null;
}

function leftoverNote(notes: string | null | undefined): string | undefined {
    if (!notes) return undefined;
    return tickNote(notes) != null ? undefined : notes.trim() || undefined;
}

// ---------------------------------------------------------------------------
// parse: RmRotationSet -> SequenceIR
// ---------------------------------------------------------------------------

export function parseRm(
    set: RmRotationSet,
    catalog: Catalog,
    report?: ConversionReport,
): SequenceIR {
    const selections: RmAbilitySelection[] = [];
    set.Data.forEach((rot, idx) => {
        if (idx > 0) report?.note(`joined rotation "${rot.Name}" after "${set.Data[0]?.Name}"`);
        selections.push(...rot.Data);
    });

    const steps: Step[] = [];
    let i = 0;
    let stepIndex = 0;

    while (i < selections.length) {
        const current = selections[i]!;
        const next = selections[i + 1];
        if (!current.SelectedAbility && !current.Notes) {
            i++;
            continue;
        }

        const lineBreakBefore = current.Separator === "↵";
        const delayTicks = tickNote(current.Notes);
        const note = leftoverNote(current.Notes);

        // weapon + "" + (spec | eofspec)  ->  a single spec step
        if (next && next.Separator === "" && (isSpec(next) || isEofSpec(next))) {
            const rule = findWeaponSpecRule(abilityLike(current));
            const weaponRef = toActionRef(catalog, abilityLike(current), { report, at: stepIndex, kindHint: "gear" });
            const primary: ActionRef = {
                canonicalId: "spec",
                rawName: rule?.rsaActionName ?? `${abilityLike(current)} spec`,
                display: rule?.rsaActionName ?? "special attack",
                kind: "spec",
                weaponId: weaponRef.canonicalId ?? undefined,
            };
            if (rule) report?.weaponSpec(primary.display, rule.weaponDisplayName, stepIndex);
            steps.push({ primary, sameTick: [], delayTicks, lineBreakBefore, note });
            i += 2;
            stepIndex++;
            continue;
        }

        // "+" / "/" group
        const group: RmAbilitySelection[] = [current];
        let j = i + 1;
        while (j < selections.length && (selections[j]!.Separator === "+" || selections[j]!.Separator === "/")) {
            group.push(selections[j]!);
            j++;
        }

        const plusMembers = group.filter((g, k) => k === 0 || g.Separator === "+");
        const slashMembers = group.filter((g) => g.Separator === "/");

        const primarySel = pickPrimary(plusMembers) ?? group[0]!;
        const primary = selectionToRef(catalog, primarySel, report, stepIndex);
        if (slashMembers.length > 0) {
            primary.ambiguousWith = slashMembers.map((s) => selectionToRef(catalog, s, report, stepIndex).canonicalId ?? abilityLike(s));
            report?.ambiguous(
                primary.display,
                [primary.canonicalId ?? primary.display, ...primary.ambiguousWith],
                stepIndex,
            );
        }
        const sameTick = plusMembers
            .filter((s) => s !== primarySel)
            .map((s) => selectionToRef(catalog, s, report, stepIndex));

        steps.push({
            primary,
            sameTick,
            delayTicks: delayTicks ?? tickNote(primarySel.Notes),
            lineBreakBefore,
            note: note ?? leftoverNote(primarySel.Notes),
        });
        i = j;
        stepIndex++;
    }

    return { kind: "sequence", name: set.Name || "Imported rotation", source: "rm", steps };
}

function pickPrimary(members: RmAbilitySelection[]): RmAbilitySelection | null {
    const isAbility = (s: RmAbilitySelection) => /abilit/i.test(s.SelectedAbility?.Category ?? "");
    return members.find(isAbility) ?? members.find((s) => !!s.SelectedAbility) ?? members[0] ?? null;
}

function selectionToRef(
    catalog: Catalog,
    sel: RmAbilitySelection,
    report: ConversionReport | undefined,
    at: number,
): ActionRef {
    const name = abilityLike(sel);
    if (!name) return { canonicalId: null, rawName: "", display: "(empty)", kind: "marker" };

    const emojiId = sel.SelectedAbility?.EmojiId;
    if (resolveEntry(catalog, name, { emojiId })) {
        return toActionRef(catalog, name, { report, at, emojiId });
    }

    // Not in our (possibly older) catalog — an RM export is self-describing, so
    // trust the embedded SelectedAbility instead of emitting a raw placeholder.
    if (sel.SelectedAbility) {
        const a = sel.SelectedAbility;
        return {
            canonicalId: slug(a.Title) || null,
            rawName: name,
            display: a.Emoji || a.Title,
            kind: classify(a.Category || ""),
            emojiId: a.EmojiId || undefined,
        };
    }
    return toActionRef(catalog, name, { report, at, emojiId });
}

// ---------------------------------------------------------------------------
// serialize: SequenceIR -> RmRotationSet
// ---------------------------------------------------------------------------

function toRmAbility(entry: CatalogEntry): RmAbility {
    return {
        Title: entry.id,
        Emoji: entry.display,
        EmojiId: entry.emojiId,
        Category: entry.category,
        Src: entry.src,
    };
}

function placeholderAbility(ref: ActionRef): RmAbility {
    return {
        Title: slug(ref.rawName) || "unresolved",
        Emoji: ref.display || ref.rawName,
        EmojiId: "",
        Category: "Unresolved",
        Src: "",
    };
}

function selectionFor(
    catalog: Catalog,
    ref: ActionRef,
    separator: string,
    notes: string | null,
): RmAbilitySelection {
    const entry = ref.canonicalId ? entryForOutput(catalog, ref.canonicalId) : null;
    return {
        Id: randomUUID(),
        Separator: separator,
        SelectedAbility: entry ? toRmAbility(entry) : placeholderAbility(ref),
        Notes: notes,
    };
}

export function serializeRm(
    seq: SequenceIR,
    catalog: Catalog,
    _report?: ConversionReport,
): RmRotationSet {
    const data: RmAbilitySelection[] = [];

    for (const step of seq.steps) {
        const firstSep = step.lineBreakBefore ? "↵" : "→";
        const notes = step.delayTicks != null ? `${step.delayTicks}T` : step.note ?? null;

        if (!step.primary) continue;

        if (step.primary.kind === "spec" && step.primary.weaponId) {
            const weapon = catalog.get(step.primary.weaponId);
            data.push(
                weapon
                    ? { Id: randomUUID(), Separator: firstSep, SelectedAbility: toRmAbility(weapon), Notes: notes }
                    : selectionFor(catalog, { ...step.primary, kind: "gear" }, firstSep, notes),
            );
            data.push(selectionFor(catalog, { canonicalId: "spec", rawName: "spec", display: "Special attack", kind: "spec" }, "", null));
        } else {
            data.push(selectionFor(catalog, step.primary, firstSep, notes));
            for (const alt of step.primary.ambiguousWith ?? []) {
                data.push(selectionFor(catalog, toActionRef(catalog, alt), "/", null));
            }
        }

        for (const member of step.sameTick) {
            data.push(selectionFor(catalog, member, "+", null));
        }
    }

    return {
        Name: seq.name,
        lineBreakSpacing: 0,
        Data: [{ Id: 0, Name: "Imported Rotation", Data: data, Wave: null }],
    };
}
