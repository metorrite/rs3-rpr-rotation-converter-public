// Sequence <-> Timeline conversion.
//
// RM / PVME describe a rotation as an ordered list of actions with only relative
// timing hints. RSA needs absolute game ticks. Going Sequence -> Timeline is
// therefore an *estimate*: we space anchors one global cooldown apart (3 ticks by
// default, with a small override table) and honour explicit "Nt" delays.
// Every estimate is recorded in the report.

import type { ActionRef, SequenceIR, Step, TimelineEvent, TimelineIR } from "./ir.js";
import type { ConversionReport } from "./report.js";
import { DEFAULT_SETTINGS, type ConversionSettings } from "./settings.js";
import { CHANNEL_TICKS } from "./weapon-specs.js";

// Every ability that triggers the global cooldown occupies `settings.gcdTicks`
// ticks (3 = 1.8s) before the next is input. Channelled abilities run longer
// (CHANNEL_TICKS). Off-GCD actions (`+` groups in RM) don't advance the cursor
// and are handled as same-tick overlays, not here.
export function gcdTicks(ref: ActionRef | null, base = 3): number {
    if (ref?.canonicalId && ref.canonicalId in CHANNEL_TICKS) {
        return CHANNEL_TICKS[ref.canonicalId]!;
    }
    return base;
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
    let prevAnchor = 0;
    let estimates = 0;

    for (let i = 0; i < seq.steps.length; i++) {
        const step = seq.steps[i]!;
        const landTick =
            step.delayTicks != null ? prevAnchor + step.delayTicks : cursor;

        if (step.delayTicks == null) estimates++;

        events.push({
            tick: landTick,
            primary: step.primary,
            // optional/conditional off-GCD items ride the same tick as extras
            overlays: [...step.sameTick, ...(step.optional ?? [])],
            note: step.note,
        });

        prevAnchor = landTick;
        cursor =
            landTick +
            Math.max(gcdTicks(step.primary, settings.gcdTicks), step.delayTicks != null ? 0 : 1);
    }

    if (estimates > 0) {
        report?.estimatedTiming(
            `RM/PVME carries no absolute ticks — ${estimates} action(s) were spaced ${settings.gcdTicks} ticks apart (channels use their real duration). Verify against the source.`,
        );
    }

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
