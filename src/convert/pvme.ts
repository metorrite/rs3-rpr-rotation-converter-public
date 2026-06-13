import type { OverlayAnchor, SourceBody } from "../types/overlay.js";

export interface PvmeOverlayAction {
    tick: number;
    rawName: string;
    pvmeName: string;
    title?: string;
    itemType: string;
    sameTick: boolean;
    delayFromAnchor: number;
    sourceBody: SourceBody;
}

export interface PvmeOverlayAnchor {
    tick: number;
    anchor: {
        rawName: string;
        pvmeName: string;
        sourceBody: "A";
    };
    sameTickOverlays: PvmeOverlayAction[];
    delayedOverlays: PvmeOverlayAction[];
}

const KEY_TO_PVME: Record<string, string> = {
    "soulfire": "soulfire",
    "roar of awakening": "roarofawakening",
    "adrenaline renewal potion": "adrenrenewal",
    "greater ricochet": "grico",
    "greater death's swiftness": "gdeathsswift",
    "imbue shadows": "imbueshadows",
    "balance by force": "balancebyforce",
    "galeshot": "galeshot",
    "rapid fire": "rapid",
    "deadshot": "deadshot",
    "igneous_deadshot": "igneousdeadshot",
    "shadowfall": "shadowfall",
    "crystal rain": "crystalrain",
    "snap shot": "snapshot",
    "piercing shot": "piercingshot",
    "snipe": "snipe",
    "undead slayer ability": "undeadslayer",

    "conjure phantom guardian": "conjurephantom",
    "command phantom guardian": "commandphantom",
    "split soul necro": "splitsoul",
    "spectral scythe 1": "spectralscythe",
    "ranged auto": "ranged_basic",
    "bombardment": "bombard",
    "melee auto": "melee_basic",
    "magic auto": "magic_basic",
    "smash": "rend",
    "igneous cleave": "igneouscleave",
    "sonic wave": "sonicwave",
    "greater sonic wave": "greatersonicwave",
    "concentrated blast": "conc",
    "greater concentrated blast": "gconc",
    "greater chain": "gchain",
    "magma tempest": "magmatempest",
    "anticipation": "anti",
    "death grasp": "deathgrasp",
    "slice & dice": "slicendice",

    "bow of the last guardian": "bolg",
    "bow of the last guardian [im]": "bolg",
    "jas arrows": "jasarrows",
    "essence of finality amulet (or)": "eof",
    "salve amulet (e)": "salveamulet"
};

function toPvmeName(rawName: string): string {
    const normalized = rawName.toLowerCase().trim();
    if (KEY_TO_PVME[normalized]) {
        return KEY_TO_PVME[normalized];
    }

    return normalized
        .replace(/\s+/g, "")
        .replace(/'/g, "")
        .replace(/_/g, "");
}

export function normalizeOverlayToPvme(entries: OverlayAnchor[]): PvmeOverlayAnchor[] {
    return entries.map((entry) => ({
        tick: entry.tick,
        anchor: {
            rawName: entry.anchor,
            pvmeName: toPvmeName(entry.anchor),
            sourceBody: "A"
        },
        sameTickOverlays: entry.sameTickOverlays.map((overlay) => ({
            tick: overlay.tick,
            rawName: overlay.rawName,
            pvmeName: toPvmeName(overlay.rawName),
            title: overlay.title,
            itemType: overlay.itemType,
            sameTick: overlay.sameTick,
            delayFromAnchor: overlay.delayFromAnchor,
            sourceBody: overlay.sourceBody
        })),
        delayedOverlays: entry.delayedOverlays.map((overlay) => ({
            tick: overlay.tick,
            rawName: overlay.rawName,
            pvmeName: toPvmeName(overlay.rawName),
            title: overlay.title,
            itemType: overlay.itemType,
            sameTick: overlay.sameTick,
            delayFromAnchor: overlay.delayFromAnchor,
            sourceBody: overlay.sourceBody
        }))
    }));
}