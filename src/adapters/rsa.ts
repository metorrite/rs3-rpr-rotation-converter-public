import { readFileSync } from "node:fs";
import type { Catalog } from "../core/catalog.js";
import type { ActionRef, TimelineEvent, TimelineIR } from "../core/ir.js";
import { slug } from "../core/normalize.js";
import { rsaBlankTemplatePath } from "../core/paths.js";
import type { ConversionReport } from "../core/report.js";
import { rsaDisplayName, toActionRef } from "../core/resolve.js";
import { findWeaponSpecRule } from "../core/weapon-specs.js";
import type { RsaExport, RsaExtraCell, RsaExtraEntry } from "../formats/rsa.types.js";

const JAS_ARROWS = { primary: "jasdemonbanearrow", alt: "jasdragonbanearrow" };

function isMeaningful(v: unknown): v is string {
    return typeof v === "string" && v.trim() !== "";
}

function extras(cell: RsaExtraCell | undefined): RsaExtraEntry[] {
    if (!cell) return [];
    return cell.filter(
        (e): e is RsaExtraEntry =>
            typeof e === "object" && e !== null && isMeaningful(e.value),
    );
}

function kindFromExtraType(type: string): ActionRef["kind"] {
    const t = type.toLowerCase();
    if (t === "gear" || t === "item") return "gear";
    if (t === "consumable") return "consumable";
    if (t === "ability") return "ability";
    return "ability";
}

function resolveRsaAction(
    catalog: Catalog,
    name: string,
    body: "a" | "e",
    report: ConversionReport | undefined,
    at: number,
    kindHint?: ActionRef["kind"],
): ActionRef {
    if (slug(name) === "jasarrows") {
        report?.ambiguous(name, [JAS_ARROWS.primary, JAS_ARROWS.alt], at);
        const ref = toActionRef(catalog, JAS_ARROWS.primary, { report, at });
        ref.rawName = name;
        ref.ambiguousWith = [JAS_ARROWS.alt];
        return ref;
    }

    const rule = findWeaponSpecRule(name);
    if (rule) {
        if (body === "a") {
            report?.weaponSpec(name, rule.weaponDisplayName, at);
            if (!rule.assetExistsInRm) report?.missingRmAsset(rule.weaponDisplayName, at);
            const spec = toActionRef(catalog, "spec", { report, at });
            return {
                ...spec,
                rawName: name,
                display: rule.rsaActionName,
                kind: "spec",
                weaponId: rule.weaponId,
            };
        }
        // in the E body, a spec weapon name is just a weapon swap
        return toActionRef(catalog, rule.weaponId, { report, at, kindHint: "gear" });
    }

    return toActionRef(catalog, name, { report, at, kindHint });
}

// ---------------------------------------------------------------------------
// parse: RsaExport -> TimelineIR
// ---------------------------------------------------------------------------

export function parseRsa(
    rsa: RsaExport,
    catalog: Catalog,
    report?: ConversionReport,
): TimelineIR {
    const a = rsa.data.a ?? [];
    const e = rsa.data.e ?? [];
    const t = rsa.data.t ?? [];
    const maxLen = Math.max(a.length, e.length);

    const events = new Map<number, TimelineEvent>();
    const eventAt = (tick: number): TimelineEvent => {
        let ev = events.get(tick);
        if (!ev) {
            ev = { tick, primary: null, overlays: [] };
            events.set(tick, ev);
        }
        return ev;
    };

    for (let tick = 0; tick < maxLen; tick++) {
        const aVal = a[tick];
        if (isMeaningful(aVal)) {
            eventAt(tick).primary = resolveRsaAction(catalog, aVal, "a", report, tick);
        }
        for (const extra of extras(e[tick])) {
            eventAt(tick).overlays.push(
                resolveRsaAction(catalog, extra.value, "e", report, tick, kindFromExtraType(extra.type)),
            );
        }
        const note = t[tick];
        if (isMeaningful(note)) eventAt(tick).note = note;
    }

    const ordered = [...events.values()]
        .filter((ev) => ev.primary || ev.overlays.length > 0 || ev.note)
        .sort((x, y) => x.tick - y.tick);

    return {
        kind: "timeline",
        name: rsa.name || "Imported rotation",
        source: "rsa",
        events: ordered,
        carrier: rsa,
    };
}

// ---------------------------------------------------------------------------
// serialize: TimelineIR -> RsaExport
// ---------------------------------------------------------------------------

let templateCache: RsaExport | null = null;
function blankTemplate(): RsaExport {
    if (!templateCache) {
        templateCache = JSON.parse(readFileSync(rsaBlankTemplatePath, "utf8")) as RsaExport;
    }
    return structuredClone(templateCache);
}

function extraEntry(ref: ActionRef): RsaExtraEntry {
    const type = ref.kind === "gear" ? "gear" : ref.kind === "consumable" ? "consumable" : "ability";
    const value = rsaDisplayName(ref);
    return { type, value, title: value };
}

export function serializeRsa(
    timeline: TimelineIR,
    _catalog: Catalog,
    report?: ConversionReport,
): RsaExport {
    const base =
        timeline.carrier && typeof timeline.carrier === "object"
            ? (structuredClone(timeline.carrier) as RsaExport)
            : blankTemplate();

    const templateLen = base.data.a?.length ?? 300;
    const maxTick = timeline.events.reduce((m, ev) => Math.max(m, ev.tick), 0);
    // grow the grid to fit long rotations instead of dropping their tail
    const len = Math.max(templateLen, maxTick + 6);
    if (len > templateLen) {
        report?.note(`extended the RS Analysis grid to ${len} ticks (template is ${templateLen})`);
    }

    base.name = timeline.name;
    base.timestamp = Date.now();
    base.data.a = new Array<string>(len).fill("");
    base.data.e = Array.from({ length: len }, () => [] as RsaExtraCell);
    if (base.data.n) base.data.n = new Array<boolean>(len).fill(false);
    if (base.data.t) base.data.t = new Array<string>(len).fill("");

    for (const ev of timeline.events) {
        if (ev.tick < 0 || ev.tick >= len) {
            report?.dropped(`event at tick ${ev.tick} (outside the ${len}-tick grid)`, ev.tick);
            continue;
        }
        if (ev.primary) {
            base.data.a[ev.tick] = rsaDisplayName(ev.primary);
            if (ev.primary.kind === "spec" && ev.primary.weaponId) {
                base.data.e[ev.tick]!.push({
                    type: "gear",
                    value: ev.primary.weaponId,
                    title: ev.primary.weaponId,
                });
            }
        }
        for (const ov of ev.overlays) {
            base.data.e[ev.tick]!.push(extraEntry(ov));
        }
        if (ev.note && base.data.t) base.data.t[ev.tick] = ev.note;
    }

    return base;
}
