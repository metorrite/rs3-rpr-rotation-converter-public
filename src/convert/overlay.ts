import type { OverlayAction, OverlayAnchor } from "../types/overlay.js";
import type { RsaExport, RsaExtraEntry } from "../types/rsa.js";

function isMeaningfulString(value: unknown): value is string {
    return typeof value === "string" && value.trim() !== "";
}

function extractExtras(entries: Array<RsaExtraEntry | string> | undefined): RsaExtraEntry[] {
    if (!entries) return [];

    return entries.filter((entry): entry is RsaExtraEntry => {
        return typeof entry === "object" && entry !== null && isMeaningfulString(entry.value);
    });
}

export function getLastMeaningfulTick(rsa: RsaExport): number {
    const maxLen = Math.max(rsa.data.a.length, rsa.data.e.length);

    for (let i = maxLen - 1; i >= 0; i--) {
        const aValue = rsa.data.a[i];
        const eValue = extractExtras(rsa.data.e[i]);

        if (isMeaningfulString(aValue) || eValue.length > 0) {
            return i;
        }
    }

    return -1;
}

export function overlayRsaTimeline(rsa: RsaExport): OverlayAnchor[] {
    const lastTick = getLastMeaningfulTick(rsa);
    if (lastTick < 0) return [];

    const result: OverlayAnchor[] = [];
    let currentAnchor: OverlayAnchor | null = null;

    for (let tick = 0; tick <= lastTick; tick++) {
        const aValue = rsa.data.a[tick];
        const extras = extractExtras(rsa.data.e[tick]);

        if (isMeaningfulString(aValue)) {
            currentAnchor = {
                tick,
                anchor: aValue,
                sourceBody: "A",
                sameTickOverlays: extras.map((entry): OverlayAction => ({
                    tick,
                    rawName: entry.value,
                    title: entry.title,
                    itemType: entry.type,
                    sameTick: true,
                    delayFromAnchor: 0,
                    sourceBody: "E"
                })),
                delayedOverlays: []
            };

            result.push(currentAnchor);
            continue;
        }

        if (extras.length > 0 && currentAnchor) {
            currentAnchor.delayedOverlays.push(
                ...extras.map((entry): OverlayAction => ({
                    tick,
                    rawName: entry.value,
                    title: entry.title,
                    itemType: entry.type,
                    sameTick: false,
                    delayFromAnchor: tick - currentAnchor!.tick,
                    sourceBody: "E"
                }))
            );
        }
    }

    return result;
}