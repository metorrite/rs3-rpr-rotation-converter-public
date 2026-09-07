// Special-attack rules.
//
// RS Analysis writes a special attack as a single action name in `data.a`
// (e.g. "balance by force"). RotationMaster writes it as two adjacent selections:
// a weapon swap followed by :spec:. These rules bridge the two representations.
//
// Ported from the old resolve/rmAbilities.ts WEAPON_SPEC_RULES, with
// `assetExistsInRm` re-checked against the refreshed catalog.

import { slug } from "./normalize.js";

export interface WeaponSpecRule {
    /** action name as it appears in an RSA file */
    rsaActionName: string;
    /** weapon whose special this is */
    weaponId: string;
    weaponDisplayName: string;
    /** false when RM still ships no icon for the weapon (falls back to a placeholder) */
    assetExistsInRm: boolean;
    /** normalized names that should trigger this rule */
    triggerKeys: string[];
}

export const WEAPON_SPEC_RULES: WeaponSpecRule[] = [
    { rsaActionName: "balance by force", weaponId: "bolg", weaponDisplayName: "Bow of the Last Guardian", assetExistsInRm: true, triggerKeys: ["balancebyforce", "bowofthelastguardian", "bolg"] },
    { rsaActionName: "death grasp", weaponId: "deathguard90", weaponDisplayName: "Deathguard", assetExistsInRm: true, triggerKeys: ["deathgrasp", "deathguard", "deathguard90"] },
    { rsaActionName: "instability", weaponId: "fsoa", weaponDisplayName: "Fractured Staff of Armadyl", assetExistsInRm: true, triggerKeys: ["instability", "fracturedstaffofarmadyl", "fsoa"] },
    { rsaActionName: "impale", weaponId: "runeclaws", weaponDisplayName: "Rune claws", assetExistsInRm: false, triggerKeys: ["impale", "runeclaws"] },
    { rsaActionName: "tempest of armadyl", weaponId: "armadylbattlestaff", weaponDisplayName: "Armadyl battlestaff", assetExistsInRm: true, triggerKeys: ["tempestofarmadyl", "armadylbattlestaff"] },
    { rsaActionName: "split soul ecb", weaponId: "ecb", weaponDisplayName: "Eldritch crossbow", assetExistsInRm: true, triggerKeys: ["splitsoulecb", "eldritchcrossbow", "ecb"] },
    { rsaActionName: "crystal rain", weaponId: "sgb", weaponDisplayName: "Seren godbow", assetExistsInRm: true, triggerKeys: ["crystalrain", "serengodbow", "sgb"] },
    { rsaActionName: "destructive shot", weaponId: "zammybow", weaponDisplayName: "Zamorak bow", assetExistsInRm: true, triggerKeys: ["destructiveshot", "zamorakbow", "zammybow"] },
    { rsaActionName: "balanced shot", weaponId: "guthixbow", weaponDisplayName: "Guthix bow", assetExistsInRm: false, triggerKeys: ["balancedshot", "guthixbow"] },
    { rsaActionName: "aimed shot", weaponId: "handcannon", weaponDisplayName: "Hand cannon", assetExistsInRm: true, triggerKeys: ["aimedshot", "handcannon"] },
    { rsaActionName: "restorative shot", weaponId: "saradominbow", weaponDisplayName: "Saradomin bow", assetExistsInRm: true, triggerKeys: ["restorativeshot", "saradominbow"] },
    { rsaActionName: "deep burn", weaponId: "strykebow", weaponDisplayName: "Strykebow", assetExistsInRm: true, triggerKeys: ["deepburn", "strykebow"] },
    { rsaActionName: "soul shot", weaponId: "seercull", weaponDisplayName: "Seercull", assetExistsInRm: true, triggerKeys: ["soulshot", "seercull"] },
    { rsaActionName: "twin shot", weaponId: "quickbow", weaponDisplayName: "Quickbow", assetExistsInRm: false, triggerKeys: ["twinshot", "quickbow"] },
    { rsaActionName: "slice & dice", weaponId: "dragonclaw", weaponDisplayName: "Dragon claw", assetExistsInRm: true, triggerKeys: ["slice&dice", "slicendice", "dragonclaws", "dragonclaw"] },
    { rsaActionName: "shadowfall", weaponId: "gloomfirebow", weaponDisplayName: "Gloomfire bow", assetExistsInRm: true, triggerKeys: ["shadowfall", "gloomfirebow"] },
    { rsaActionName: "soulfire", weaponId: "roarofawakening", weaponDisplayName: "Roar of Awakening", assetExistsInRm: true, triggerKeys: ["soulfire", "roarofawakening"] },
];

const byTrigger = new Map<string, WeaponSpecRule>();
for (const rule of WEAPON_SPEC_RULES) {
    for (const key of rule.triggerKeys) byTrigger.set(slug(key), rule);
    byTrigger.set(slug(rule.rsaActionName), rule);
    byTrigger.set(slug(rule.weaponId), rule);
}

export function findWeaponSpecRule(...names: string[]): WeaponSpecRule | null {
    for (const n of names) {
        const hit = byTrigger.get(slug(n));
        if (hit) return hit;
    }
    return null;
}
