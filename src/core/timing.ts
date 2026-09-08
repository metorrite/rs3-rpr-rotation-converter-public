// Sequence <-> Timeline conversion.
//
// RM / PVME describe a rotation as an ordered list of actions with only relative
// timing hints. RSA needs absolute game ticks. Going Sequence -> Timeline is
// therefore an *estimate*: we space anchors one global cooldown apart (3 ticks by
// default, with a small override table) and honour explicit "Nt" delays.
// Every estimate is recorded in the report.

import { gcdAdvance, isOffGcd } from "./ability-timing.js";
import type { ActionRef, SequenceIR, Step, TimelineEvent, TimelineIR } from "./ir.js";
import type { ConversionReport } from "./report.js";
import { DEFAULT_SETTINGS, type ConversionSettings } from "./settings.js";

function stepIsOffGcd(step: Step): boolean {
    const p = step.primary;
    if (!p) return true;
    if (p.kind === "gear" || p.kind === "marker") return true;
    return isOffGcd(p.canonicalId);
}

// ---------------------------------------------------------------------------
// Sequence -> Timeline   (RM / PVME  ->  RSA)
// ---------------------------------------------------------------------------

export function sequenceToTimeline(
    seq: SequenceIR,
    report?: ConversionReport,
    settings: ConversionSettings = DEFAULT_SETTINGS,
): TimelineIR {
    const events: TimelineEvent[] = [];
    let cursor = 0;
    let prevAnchor = 0; // tick of the previous step (GCD or explicit-delay)
    let lastGcdTick = 0; // tick of the most recent real GCD / channel action
    let estimates = 0;
    const eventByTick = new Map<number, TimelineEvent>();

    const overlayInto = (tick: number, refs: (ActionRef | null)[], note?: string) => {
        let ev = eventByTick.get(tick);
        if (!ev) {
            ev = { tick, primary: null, overlays: [], note };
            eventByTick.set(tick, ev);
            events.push(ev);
        }
        for (const r of refs) if (r) ev.overlays.push(r);
        if (note && !ev.note) ev.note = note;
    };

    for (const step of seq.steps) {
        const extras = [...step.swapBefore ?? [], ...step.sameTick, ...(step.optional ?? [])];

        if (stepIsOffGcd(step)) {
            // never takes an ability-bar slot; rides the previous GCD tick
            // (or an explicit Nt offset from it) and does not move the cursor
            const tick =
                step.delayTicks != null ? lastGcdTick + step.delayTicks : lastGcdTick;
            overlayInto(tick, [step.primary, ...extras], step.note);
            continue;
        }

        const landTick = step.delayTicks != null ? prevAnchor + step.delayTicks : cursor;
        if (step.delayTicks == null) estimates++;

        const ev: TimelineEvent = {
            tick: landTick,
            primary: step.primary,
            overlays: extras,
            note: step.note,
        };
        events.push(ev);
        eventByTick.set(landTick, ev);

        prevAnchor = landTick;
        lastGcdTick = landTick;
        cursor = landTick + Math.max(gcdAdvance(step.primary?.canonicalId, settings.gcdTicks), 1);
    }

    if (estimates > 0) {
        report?.estimatedTiming(
            `RM/PVME carries no absolute ticks — ${estimates} GCD action(s) were spaced ${settings.gcdTicks} ticks apart; channels use their real duration and off-GCD actions ride the previous tick. Verify against the source.`,
        );
    }

    events.sort((a, b) => a.tick - b.tick);
    return { kind: "timeline", name: seq.name, source: seq.source, events };
}

// ---------------------------------------------------------------------------
// Timeline -> Sequence   (RSA  ->  RM / PVME)
// ---------------------------------------------------------------------------

export function timelineToSequence(
    timeline: TimelineIR,
    report?: ConversionReport,
): SequenceIR {
    const steps: Step[] = [];
    const events = [...timeline.events].sort((a, b) => a.tick - b.tick);
    let lastAnchorTick = 0;

    for (const ev of events) {
        if (ev.primary) {
            steps.push({
                primary: ev.primary,
                sameTick: ev.overlays,
                delayTicks: null,
                note: ev.note,
            });
            lastAnchorTick = ev.tick;
        } else {
            // overlays with no anchor of their own: emit as delayed steps
            const delay = ev.tick - lastAnchorTick;
            for (const ov of ev.overlays) {
                steps.push({ primary: ov, sameTick: [], delayTicks: delay > 0 ? delay : null });
            }
            if (ev.note) {
                report?.note(`tick ${ev.tick} note "${ev.note}" kept on the following step`);
            }
        }
    }

    return { kind: "sequence", name: timeline.name, source: timeline.source, steps };
}
