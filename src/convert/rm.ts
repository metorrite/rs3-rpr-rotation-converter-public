import type { RmAbilitySelection, RmRotationSet } from "../types/rm.js";
import type { PvmeOverlayAnchor, PvmeOverlayAction } from "./pvme.js";
import { resolveContextualRmSequence } from "../resolve/rmAbilities.js";

function pushResolvedSequence(
    output: RmAbilitySelection[],
    sequence: ReturnType<typeof resolveContextualRmSequence>,
    firstSeparator: string,
    notes: string | null
): void {
    sequence.forEach((step, index) => {
        output.push({
            Separator: index === 0 ? firstSeparator : step.internalSeparator,
            SelectedAbility: step.ability,
            Notes: index === 0 ? notes : null
        });
    });
}

function appendOverlayAction(
    output: RmAbilitySelection[],
    overlay: PvmeOverlayAction,
    rmIndex: Map<string, any>,
    separator: string,
    notes: string | null
): void {
    const sequence = resolveContextualRmSequence(
        overlay.pvmeName,
        overlay.rawName,
        overlay.sourceBody,
        rmIndex,
        overlay.title ?? overlay.rawName
    );

    pushResolvedSequence(output, sequence, separator, notes);
}

export function convertPvmeOverlayToRm(
    rotationSetName: string,
    entries: PvmeOverlayAnchor[],
    rmIndex: Map<string, any>
): RmRotationSet {
    const data: RmAbilitySelection[] = [];

    for (const entry of entries) {
        const anchorSequence = resolveContextualRmSequence(
            entry.anchor.pvmeName,
            entry.anchor.rawName,
            entry.anchor.sourceBody,
            rmIndex,
            entry.anchor.rawName
        );

        pushResolvedSequence(data, anchorSequence, "→", null);

        for (const overlay of entry.sameTickOverlays) {
            appendOverlayAction(data, overlay, rmIndex, "+", null);
        }

        for (const overlay of entry.delayedOverlays) {
            appendOverlayAction(data, overlay, rmIndex, "→", `${overlay.delayFromAnchor}T`);
        }
    }

    return {
        Name: rotationSetName,
        Data: [
            {
                Id: 0,
                Name: "Imported Rotation",
                Data: data,
                Wave: null
            }
        ]
    };
}