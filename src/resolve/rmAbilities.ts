import fs from "node:fs";
import path from "node:path";
import type { RmAbility } from "../types/rm.js";
import type { SourceBody } from "../types/overlay.js";

export interface RmResolvedStep {
    ability: RmAbility;
    internalSeparator: string;
}

export interface WeaponSpecRule {
    rsaActionName: string;
    rsaWeaponSwapName: string;
    weaponAssetKey: string;
    weaponDisplayName: string;
    assetExistsInRm: boolean;
    triggerKeys: string[];
}

function normalizeKey(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "")
        .replace(/'/g, "")
        .replace(/_/g, "")
        .replace(/[()[\]&-]/g, "");
}

export function loadRmAbilitiesFromPath(filePath: string): RmAbility[] {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as RmAbility[];
}

export function loadRmAbilities(): RmAbility[] {
    const filePath = path.resolve("./assets/data/abilities.json");
    return loadRmAbilitiesFromPath(filePath);
}

export function buildRmAbilityIndex(abilities: RmAbility[]): Map<string, RmAbility> {
    const index = new Map<string, RmAbility>();

    for (const ability of abilities) {
        index.set(normalizeKey(ability.Title), ability);
        index.set(normalizeKey(ability.Emoji), ability);
    }

    const aliases: Array<[string, string]> = [
        ["adrenrenewal", "adrenrenewal"],
        ["roarofawakening", "roarofawakening"],
        ["soulfire", "roarofawakening"],
        ["gloomfirebow", "gloomfirebow"],
        ["piercingshot", "piercing_shot"],
        ["imbueshadows", "imbue_shadows"],
        ["snapshot", "snapshot"],
        ["grico", "grico"],
        ["rapid", "rapid"],
        ["gdeathsswift", "gdeathsswift"],
        ["undeadslayer", "undeadslayer"],
        ["vulnerabilitybomb", "vulnbomb"],
        ["vulnbomb", "vulnbomb"],
        ["eof", "eof"],
        ["salveamulet", "salveamulet"],
        ["bolg", "bolg"],
        ["specialattack", "spec"],
        ["spec", "spec"],
        ["jasarrows", "jasarrows"],

        ["conjurephantom", "conjurephantom"],
        ["commandphantom", "commandphantom"],
        ["splitsoul", "splitsoul"],
        ["spectralscythe", "spectralscythe"],
        ["rangedbasic", "ranged_basic"],
        ["rangedbasic", "ranged_basic"],
        ["rangedbasic", "ranged_basic"],
        ["rangedbasic", "ranged_basic"],
        ["rangedbasic", "ranged_basic"],
        ["rangedbasic", "ranged_basic"],
        ["rangedbasic", "ranged_basic"],
        ["rangedbasic", "ranged_basic"],
        ["rangedbasic", "ranged_basic"],
        ["rangedbasic", "ranged_basic"],
        ["rangedbasic", "ranged_basic"],
        ["ranged_basic", "ranged_basic"],
        ["bombard", "bombard"],
        ["igneousdeadshot", "OLDdeadshotigneous"],
        ["meleebasic", "melee_basic"],
        ["melee_basic", "melee_basic"],
        ["rend", "rend"],
        ["igneouscleave", "adaptive_strike"],
        ["sonicwave", "OLDsonicwave"],
        ["greatersonicwave", "OLDgsonicwave"],
        ["conc", "conc"],
        ["gconc", "gconc"],
        ["gchain", "gchain"],
        ["magmatempest", "OLDmagmatempest"],
        ["anti", "anti"],
        ["deathgrasp", "deathguard90"],
        ["slicendice", "dragonclaw"],

        ["deathguard", "deathguard90"],
        ["deathguard90", "deathguard90"],
        ["fsoa", "fsoa"],
        ["fracturedstaffofarmadyl", "fsoa"],
        ["runeclaws", "queueing"],
        ["armadylbattlestaff", "armadylbattlestaff"],
        ["ecb", "ecb"],
        ["eldritchcrossbow", "ecb"],
        ["sgb", "sgb"],
        ["serengodbow", "sgb"],
        ["zamorakbow", "zamorakbow"],
        ["guthixbow", "queueing"],
        ["handcannon", "handcannon"],
        ["saradominbow", "queueing"],
        ["strykebow", "strykebow"],
        ["seercull", "seercull"],
        ["quickbow", "queueing"],
        ["dragonclaw", "dragonclaw"],
        ["magic_basic", "magic_basic"]
    ];

    for (const [alias, target] of aliases) {
        const resolved = index.get(normalizeKey(target));
        if (resolved) {
            index.set(normalizeKey(alias), resolved);
        }
    }

    return index;
}

export function resolveRmAbility(
    key: string,
    index: Map<string, RmAbility>
): RmAbility | null {
    return index.get(normalizeKey(key)) ?? null;
}

export function buildPlaceholderAbility(rawName: string, titleOverride?: string): RmAbility {
    return {
        Title: rawName.toLowerCase().replace(/\s+/g, ""),
        Emoji: titleOverride ?? rawName,
        EmojiId: "",
        Category: "Unresolved",
        Src: ""
    };
}

function resolveOrPlaceholder(
    key: string,
    rawName: string,
    rmIndex: Map<string, RmAbility>,
    titleOverride?: string
): RmAbility {
    return resolveRmAbility(key, rmIndex) ?? buildPlaceholderAbility(rawName, titleOverride);
}

export const WEAPON_SPEC_RULES: WeaponSpecRule[] = [
    {
        rsaActionName: "balance by force",
        rsaWeaponSwapName: "bow of the last guardian",
        weaponAssetKey: "bolg",
        weaponDisplayName: "Bow of the Last Guardian",
        assetExistsInRm: true,
        triggerKeys: ["balancebyforce", "bowofthelastguardian", "bolg"]
    },
    {
        rsaActionName: "death grasp",
        rsaWeaponSwapName: "deathguard",
        weaponAssetKey: "deathguard90",
        weaponDisplayName: "Deathguard",
        assetExistsInRm: true,
        triggerKeys: ["deathgrasp", "deathguard", "deathguard90"]
    },
    {
        rsaActionName: "instability",
        rsaWeaponSwapName: "fractured staff of armadyl",
        weaponAssetKey: "fsoa",
        weaponDisplayName: "Fractured Staff of Armadyl",
        assetExistsInRm: true,
        triggerKeys: ["instability", "fracturedstaffofarmadyl", "fsoa"]
    },
    {
        rsaActionName: "impale",
        rsaWeaponSwapName: "rune claws",
        weaponAssetKey: "queueing",
        weaponDisplayName: "Rune claws",
        assetExistsInRm: false,
        triggerKeys: ["impale", "runeclaws"]
    },
    {
        rsaActionName: "tempest of armadyl",
        rsaWeaponSwapName: "armadyl battlestaff",
        weaponAssetKey: "armadylbattlestaff",
        weaponDisplayName: "Armadyl battlestaff",
        assetExistsInRm: true,
        triggerKeys: ["tempestofarmadyl", "armadylbattlestaff"]
    },
    {
        rsaActionName: "split soul ecb",
        rsaWeaponSwapName: "eldritch crossbow",
        weaponAssetKey: "ecb",
        weaponDisplayName: "Eldritch crossbow",
        assetExistsInRm: true,
        triggerKeys: ["splitsoulecb", "eldritchcrossbow", "ecb"]
    },
    {
        rsaActionName: "crystal rain",
        rsaWeaponSwapName: "seren godbow",
        weaponAssetKey: "sgb",
        weaponDisplayName: "Seren godbow",
        assetExistsInRm: true,
        triggerKeys: ["crystalrain", "serengodbow", "sgb"]
    },
    {
        rsaActionName: "destructive shot",
        rsaWeaponSwapName: "zamorak bow",
        weaponAssetKey: "zamorakbow",
        weaponDisplayName: "Zamorak bow",
        assetExistsInRm: true,
        triggerKeys: ["destructiveshot", "zamorakbow"]
    },
    {
        rsaActionName: "balanced shot",
        rsaWeaponSwapName: "guthix bow",
        weaponAssetKey: "queueing",
        weaponDisplayName: "Guthix bow",
        assetExistsInRm: false,
        triggerKeys: ["balancedshot", "guthixbow"]
    },
    {
        rsaActionName: "aimed shot",
        rsaWeaponSwapName: "hand cannon",
        weaponAssetKey: "handcannon",
        weaponDisplayName: "Hand cannon",
        assetExistsInRm: true,
        triggerKeys: ["aimedshot", "handcannon"]
    },
    {
        rsaActionName: "restorative shot",
        rsaWeaponSwapName: "saradomin bow",
        weaponAssetKey: "queueing",
        weaponDisplayName: "Saradomin bow",
        assetExistsInRm: false,
        triggerKeys: ["restorativeshot", "saradominbow"]
    },
    {
        rsaActionName: "deep burn",
        rsaWeaponSwapName: "strykebow",
        weaponAssetKey: "strykebow",
        weaponDisplayName: "Strykebow",
        assetExistsInRm: true,
        triggerKeys: ["deepburn", "strykebow"]
    },
    {
        rsaActionName: "soul shot",
        rsaWeaponSwapName: "seercull",
        weaponAssetKey: "seercull",
        weaponDisplayName: "Seercull",
        assetExistsInRm: true,
        triggerKeys: ["soulshot", "seercull"]
    },
    {
        rsaActionName: "twin shot",
        rsaWeaponSwapName: "quickbow",
        weaponAssetKey: "queueing",
        weaponDisplayName: "Quickbow",
        assetExistsInRm: false,
        triggerKeys: ["twinshot", "quickbow"]
    },
    {
        rsaActionName: "slice & dice",
        rsaWeaponSwapName: "dragon claws",
        weaponAssetKey: "dragonclaw",
        weaponDisplayName: "Dragon claw",
        assetExistsInRm: true,
        triggerKeys: ["slice&dice", "slicendice", "dragonclaws", "dragonclaw"]
    },
    {
        rsaActionName: "shadowfall",
        rsaWeaponSwapName: "gloomfire bow",
        weaponAssetKey: "gloomfirebow",
        weaponDisplayName: "Gloomfire bow",
        assetExistsInRm: true,
        triggerKeys: ["shadowfall", "gloomfirebow"]
    },
    {
        rsaActionName: "soulfire",
        rsaWeaponSwapName: "roar of awakening",
        weaponAssetKey: "roarofawakening",
        weaponDisplayName: "Roar of Awakening",
        assetExistsInRm: true,
        triggerKeys: ["soulfire", "roarofawakening"]
    }
];

function findWeaponSpecRule(pvmeName: string, rawName: string): WeaponSpecRule | undefined {
    const normalized = normalizeKey(pvmeName);
    const rawNormalized = normalizeKey(rawName);

    return WEAPON_SPEC_RULES.find((rule) =>
        rule.triggerKeys.some((key) => key === normalized || key === rawNormalized)
    );
}

export function findWeaponSpecRuleByAbilityLike(
    abilityLike: string
): WeaponSpecRule | undefined {
    const normalized = normalizeKey(abilityLike);
    return WEAPON_SPEC_RULES.find((rule) =>
        rule.triggerKeys.some((key) => key === normalized) ||
        normalizeKey(rule.weaponAssetKey) === normalized
    );
}

export function resolveContextualRmSequence(
    pvmeName: string,
    rawName: string,
    sourceBody: SourceBody,
    rmIndex: Map<string, RmAbility>,
    titleOverride?: string
): RmResolvedStep[] {
    const normalizedPvme = normalizeKey(pvmeName);
    const normalizedRaw = normalizeKey(rawName);

    // Jas arrows are ambiguous in RSA:
    // RSA only says "jas arrows", while RM has both demonbane and dragonbane variants.
    // Emit both with "/" so the user can choose the appropriate one.
    if (normalizedPvme === "jasarrows" || normalizedRaw === "jasarrows") {
        return [
            {
                ability: resolveOrPlaceholder(
                    "jasdemonbanearrow",
                    "jasdemonbanearrow",
                    rmIndex,
                    "Jas demonbane arrow"
                ),
                internalSeparator: ""
            },
            {
                ability: resolveOrPlaceholder(
                    "jasdragonbanearrow",
                    "jasdragonbanearrow",
                    rmIndex,
                    "Jas dragonbane arrow"
                ),
                internalSeparator: "/"
            }
        ];
    }

    const weaponSpecRule = findWeaponSpecRule(pvmeName, rawName);

    if (weaponSpecRule) {
        const weaponAsset = resolveOrPlaceholder(
            weaponSpecRule.weaponAssetKey,
            weaponSpecRule.weaponAssetKey,
            rmIndex,
            weaponSpecRule.weaponDisplayName
        );

        if (sourceBody === "A") {
            return [
                {
                    ability: weaponAsset,
                    internalSeparator: ""
                },
                {
                    ability: resolveOrPlaceholder("spec", "spec", rmIndex, "Special attack"),
                    internalSeparator: ""
                }
            ];
        }

        if (sourceBody === "E") {
            return [
                {
                    ability: weaponAsset,
                    internalSeparator: ""
                }
            ];
        }
    }

    return [
        {
            ability: resolveOrPlaceholder(pvmeName, rawName, rmIndex, titleOverride),
            internalSeparator: ""
        }
    ];
}