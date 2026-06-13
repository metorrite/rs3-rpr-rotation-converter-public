import fs from "node:fs";
import path from "node:path";
import type { RmRotationSet, RmAbilitySelection } from "../types/rm.js";
import type { RsaExport, RsaExtraEntry } from "../types/rsa.js";
import { findWeaponSpecRuleByAbilityLike } from "../resolve/rmAbilities.js";

interface ReverseOverlayAction {
    rawName: string;
    rsaName: string;
    type: "ability" | "gear";
    sameTick: boolean;
    delayFromAnchor: number;
}

interface ReverseOverlayAnchor {
    rsaName: string;
    sameTickOverlays: ReverseOverlayAction[];
    delayedOverlays: ReverseOverlayAction[];
    tickSpan: number; // how many ticks until next anchor
}

function normalize(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "")
        .replace(/'/g, "")
        .replace(/_/g, "")
        .replace(/[()[\]&-]/g, "");
}

function getAbilityLikeName(selection: RmAbilitySelection): string {
    if (!selection.SelectedAbility) return "";
    return selection.SelectedAbility.Title || selection.SelectedAbility.Emoji || "";
}

function makeGearEntry(value: string, title?: string): RsaExtraEntry {
    return {
        type: "gear",
        value,
        title: title ?? value
    };
}

function makeAbilityEntry(value: string, title?: string): RsaExtraEntry {
    return {
        type: "ability",
        value,
        title: title ?? value
    };
}

const RM_TO_RSA_NAME_MAP: Record<string, string> = {
    grico: "greater ricochet",
    gdeathsswift: "greater death's swiftness",
    imbueshadows: "imbue shadows",
    galeshot: "galeshot",
    rapid: "rapid fire",
    deadshot: "deadshot",
    olddeadshotigneous: "igneous_deadshot",
    deadshotigneous: "igneous_deadshot",
    snapshot: "snap shot",
    piercingshot: "piercing shot",
    piercingshot_alt: "piercing shot",
    piercing_shot: "piercing shot",
    snipe: "snipe",
    anti: "anticipation",
    surge: "surge",
    dive: "dive",
    eof: "essence of finality amulet (or)",
    eofspec: "eofspec",
    salveamulet: "salve amulet (e)",
    vulnbomb: "vulnerability bomb",
    undeadslayer: "undead slayer ability",
    wenarrows: "wen arrows",
    jasdemonbanearrow: "jas arrows",
    jasdragonbanearrow: "jas arrows",
    adrenrenewal: "adrenaline renewal potion",
    gloomfirebow: "gloomfire bow",
    ecb: "eldritch crossbow",
    dba: "dragon battleaxe"
};

const RM_GEAR_KEYS = new Set<string>([
    "bolg",
    "ecb",
    "sgb",
    "gloomfirebow",
    "deathguard90",
    "deathguard",
    "fsoa",
    "armadylbattlestaff",
    "handcannon",
    "strykebow",
    "seercull",
    "zamorakbow",
    "zammybow",
    "dragonclaw",
    "dclaws",
    "lengmh",
    "dba",
    "eof",
    "salveamulet",
    "wenarrows",
    "jasdemonbanearrow",
    "jasdragonbanearrow",
    "adrenrenewal",
    "dommine"
]);

function mapRmAbilityToRsaRaw(selection: RmAbilitySelection): string {
    const title = selection.SelectedAbility?.Title ?? "";
    const emoji = selection.SelectedAbility?.Emoji ?? "";
    const titleNorm = normalize(title);
    const emojiNorm = normalize(emoji);

    if (RM_TO_RSA_NAME_MAP[titleNorm]) return RM_TO_RSA_NAME_MAP[titleNorm];
    if (RM_TO_RSA_NAME_MAP[emojiNorm]) return RM_TO_RSA_NAME_MAP[emojiNorm];

    return (emoji || title).toLowerCase();
}

function isSpecSelection(selection: RmAbilitySelection | undefined): boolean {
    if (!selection?.SelectedAbility) return false;
    const titleNorm = normalize(selection.SelectedAbility.Title || "");
    const emojiNorm = normalize(selection.SelectedAbility.Emoji || "");
    return titleNorm === "spec" || emojiNorm === "specialattack" || emojiNorm === "spec";
}

function isEofSpecSelection(selection: RmAbilitySelection | undefined): boolean {
    if (!selection?.SelectedAbility) return false;
    const titleNorm = normalize(selection.SelectedAbility.Title || "");
    const emojiNorm = normalize(selection.SelectedAbility.Emoji || "");
    return titleNorm === "eofspec" || emojiNorm === "essenceoffinalityability";
}

function isLikelyGearSelection(selection: RmAbilitySelection | undefined): boolean {
    if (!selection?.SelectedAbility) return false;
    const titleNorm = normalize(selection.SelectedAbility.Title || "");
    const categoryNorm = normalize(selection.SelectedAbility.Category || "");
    return RM_GEAR_KEYS.has(titleNorm) || categoryNorm.includes("gear");
}

function isLikelyAbilitySelection(selection: RmAbilitySelection | undefined): boolean {
    if (!selection?.SelectedAbility) return false;
    if (isSpecSelection(selection) || isEofSpecSelection(selection)) return false;

    const titleNorm = normalize(selection.SelectedAbility.Title || "");
    if (RM_GEAR_KEYS.has(titleNorm)) return false;

    const category = selection.SelectedAbility.Category || "";
    return /abilities?/i.test(category);
}

function extractTickSpanFromNotes(note: string | null | undefined): number | null {
    if (!note) return null;
    const match = note.trim().match(/^(\d+)t$/i);
    if (!match) return null;
    return Number.parseInt(match[1], 10);
}

function getRsaActionNameFromWeaponOrEof(
    precedingSelection: RmAbilitySelection
): string | null {
    const precedingName = getAbilityLikeName(precedingSelection);
    const weaponRule = findWeaponSpecRuleByAbilityLike(precedingName);
    if (weaponRule) {
        return weaponRule.rsaActionName;
    }

    const norm = normalize(precedingName);

    // EOF-specific mappings
    if (norm === "ecb") return "split soul ecb";
    if (norm === "gloomfirebow") return "shadowfall";
    if (norm === "bolg") return "balance by force";
    if (norm === "dba") return "dragon battleaxe";

    return null;
}

function buildPlusGroup(
    selections: RmAbilitySelection[],
    startIndex: number
): { group: RmAbilitySelection[]; nextIndex: number } {
    const group: RmAbilitySelection[] = [selections[startIndex]];
    let i = startIndex + 1;

    while (i < selections.length) {
        const sep = selections[i].Separator;
        if (sep === "+" || sep === "/") {
            group.push(selections[i]);
            i++;
            continue;
        }
        break;
    }

    return { group, nextIndex: i - 1 };
}

function choosePrimaryFromGroup(group: RmAbilitySelection[]): RmAbilitySelection | null {
    const explicitAbility = group.find(isLikelyAbilitySelection);
    if (explicitAbility) return explicitAbility;

    const nonGear = group.find((s) => !isLikelyGearSelection(s));
    if (nonGear) return nonGear;

    return group[0] ?? null;
}

function convertGroupToAnchor(group: RmAbilitySelection[]): ReverseOverlayAnchor {
    const primary = choosePrimaryFromGroup(group);
    const primaryRsaName = primary ? mapRmAbilityToRsaRaw(primary) : "";

    const anchor: ReverseOverlayAnchor = {
        rsaName: primaryRsaName,
        sameTickOverlays: [],
        delayedOverlays: [],
        tickSpan: 3
    };

    for (const item of group) {
        if (item === primary) continue;

        const rsaName = mapRmAbilityToRsaRaw(item);

        if (isLikelyAbilitySelection(item)) {
            anchor.sameTickOverlays.push({
                rawName: getAbilityLikeName(item),
                rsaName,
                type: "ability",
                sameTick: true,
                delayFromAnchor: 0
            });
        } else {
            anchor.sameTickOverlays.push({
                rawName: getAbilityLikeName(item),
                rsaName,
                type: "gear",
                sameTick: true,
                delayFromAnchor: 0
            });
        }
    }

    const primaryTickSpan = primary ? extractTickSpanFromNotes(primary.Notes) : null;
    if (primaryTickSpan !== null) {
        anchor.tickSpan = primaryTickSpan;
    }

    return anchor;
}

function buildReverseOverlayFromRm(rotationSet: RmRotationSet): ReverseOverlayAnchor[] {
    const firstRotation = rotationSet.Data[0];
    const selections = firstRotation?.Data ?? [];

    const anchors: ReverseOverlayAnchor[] = [];
    let i = 0;

    while (i < selections.length) {
        const current = selections[i];
        const next = selections[i + 1];

        const startsAnchor = i === 0 || current.Separator === "→" || current.Separator === "↵";

        if (!startsAnchor) {
            i++;
            continue;
        }

        const currentName = getAbilityLikeName(current);

        // weapon + "" + spec  => weapon swap in E, special action in A
        if (next && next.Separator === "" && isSpecSelection(next)) {
            const rsaActionName = getRsaActionNameFromWeaponOrEof(current);
            const rsaWeaponSwap = mapRmAbilityToRsaRaw(current);

            const anchor: ReverseOverlayAnchor = {
                rsaName: rsaActionName ?? "",
                sameTickOverlays: [],
                delayedOverlays: [],
                tickSpan: extractTickSpanFromNotes(current.Notes) ?? 3
            };

            anchor.sameTickOverlays.push({
                rawName: currentName,
                rsaName: rsaWeaponSwap,
                type: "gear",
                sameTick: true,
                delayFromAnchor: 0
            });

            anchors.push(anchor);
            i += 2;
            continue;
        }

        // weapon + "" + eofspec => EOF in E, corresponding EOF action in A
        if (next && next.Separator === "" && isEofSpecSelection(next)) {
            const rsaActionName = getRsaActionNameFromWeaponOrEof(current);
            const anchor: ReverseOverlayAnchor = {
                rsaName: rsaActionName ?? "",
                sameTickOverlays: [],
                delayedOverlays: [],
                tickSpan: extractTickSpanFromNotes(current.Notes) ?? 3
            };

            anchor.sameTickOverlays.push({
                rawName: "eof",
                rsaName: "essence of finality amulet (or)",
                type: "gear",
                sameTick: true,
                delayFromAnchor: 0
            });

            anchors.push(anchor);
            i += 2;
            continue;
        }

        // plus/slash chain: choose actual ability as A, everything else to E
        const { group, nextIndex } = buildPlusGroup(selections, i);
        if (group.length > 1) {
            const anchor = convertGroupToAnchor(group);
            anchors.push(anchor);
            i = nextIndex + 1;
            continue;
        }

        // normal single-anchor ability
        const anchor: ReverseOverlayAnchor = {
            rsaName: mapRmAbilityToRsaRaw(current),
            sameTickOverlays: [],
            delayedOverlays: [],
            tickSpan: extractTickSpanFromNotes(current.Notes) ?? 3
        };

        anchors.push(anchor);
        i++;
    }

    return anchors;
}

function applyOverlayToRsaTemplate(
    template: RsaExport,
    overlay: ReverseOverlayAnchor[],
    outputName: string
): RsaExport {
    const result: RsaExport = JSON.parse(JSON.stringify(template)) as RsaExport;

    result.name = outputName;
    result.timestamp = Date.now();

    const a = result.data.a;
    const e = result.data.e;
    const n = result.data.n ?? [];
    const t = result.data.t ?? [];

    for (let i = 0; i < a.length; i++) {
        a[i] = "";
        e[i] = [];
        if (i < n.length) n[i] = false;
        if (i < t.length) t[i] = "";
    }

    let anchorTick = 0;

    for (const anchor of overlay) {
        if (anchorTick >= a.length) break;

        if (anchor.rsaName) {
            a[anchorTick] = anchor.rsaName;
        }

        for (const sameTick of anchor.sameTickOverlays) {
            if (sameTick.type === "ability") {
                e[anchorTick].push(makeAbilityEntry(sameTick.rsaName, sameTick.rsaName));
            } else {
                e[anchorTick].push(makeGearEntry(sameTick.rsaName, sameTick.rsaName));
            }
        }

        for (const delayed of anchor.delayedOverlays) {
            const delayedTick = anchorTick + delayed.delayFromAnchor;
            if (delayedTick >= 0 && delayedTick < e.length) {
                if (delayed.type === "ability") {
                    e[delayedTick].push(makeAbilityEntry(delayed.rsaName, delayed.rsaName));
                } else {
                    e[delayedTick].push(makeGearEntry(delayed.rsaName, delayed.rsaName));
                }
            }
        }

        anchorTick += Math.max(anchor.tickSpan, 1);
    }

    return result;
}

export function convertRmToTentativeRsa(rotationSet: RmRotationSet): RsaExport {
    const templatePath = path.resolve("./assets/test/json/input/RSA_BLANK_TEMPLATE.json");
    const templateRaw = fs.readFileSync(templatePath, "utf-8");
    const template = JSON.parse(templateRaw) as RsaExport;

    const reverseOverlay = buildReverseOverlayFromRm(rotationSet);

    return applyOverlayToRsaTemplate(
        template,
        reverseOverlay,
        `${rotationSet.Name} Reverse Test`
    );
}