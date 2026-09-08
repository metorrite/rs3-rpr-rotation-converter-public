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

// The `rsaActionName` values below are verified against RS Analysis's own
// special-attack table (each RSA spec action carries the weapon's icon, so the
// weapon<->action link is exact).
export const WEAPON_SPEC_RULES: WeaponSpecRule[] = [
    // ---- Ranged ----
    { rsaActionName: "balance by force", weaponId: "bolg", weaponDisplayName: "Bow of the Last Guardian", assetExistsInRm: true, triggerKeys: ["balancebyforce", "bowofthelastguardian", "bolg"] },
    { rsaActionName: "crystal rain", weaponId: "sgb", weaponDisplayName: "Seren godbow", assetExistsInRm: true, triggerKeys: ["crystalrain", "serengodbow", "sgb"] },
    { rsaActionName: "destructive shot", weaponId: "zammybow", weaponDisplayName: "Zamorak bow", assetExistsInRm: true, triggerKeys: ["destructiveshot", "zamorakbow", "zammybow"] },
    { rsaActionName: "descent of darkness", weaponId: "dbow", weaponDisplayName: "Dark bow", assetExistsInRm: true, triggerKeys: ["descentofdarkness", "darkbow", "dbow"] },
    { rsaActionName: "balanced shot", weaponId: "guthixbow", weaponDisplayName: "Guthix bow", assetExistsInRm: false, triggerKeys: ["balancedshot", "guthixbow"] },
    { rsaActionName: "restorative shot", weaponId: "saradominbow", weaponDisplayName: "Saradomin bow", assetExistsInRm: true, triggerKeys: ["restorativeshot", "saradominbow"] },
    { rsaActionName: "aimed shot", weaponId: "handcannon", weaponDisplayName: "Hand cannon", assetExistsInRm: true, triggerKeys: ["aimedshot", "handcannon"] },
    { rsaActionName: "deep burn", weaponId: "strykebow", weaponDisplayName: "Strykebow", assetExistsInRm: true, triggerKeys: ["deepburn", "strykebow"] },
    { rsaActionName: "soul shot", weaponId: "seercull", weaponDisplayName: "Seercull", assetExistsInRm: true, triggerKeys: ["soulshot", "seercull"] },
    { rsaActionName: "power shot", weaponId: "magicshieldbow", weaponDisplayName: "Magic shieldbow", assetExistsInRm: true, triggerKeys: ["powershot", "magicshieldbow"] },
    { rsaActionName: "twin shot", weaponId: "quickbow", weaponDisplayName: "Quickbow", assetExistsInRm: false, triggerKeys: ["twinshot", "quickbow"] },
    { rsaActionName: "twin fang", weaponId: "msb", weaponDisplayName: "Magic shortbow", assetExistsInRm: false, triggerKeys: ["twinfang", "magicshortbow", "msb"] },
    { rsaActionName: "phantom strike", weaponId: "morrigansjavelin", weaponDisplayName: "Morrigan's javelin", assetExistsInRm: false, triggerKeys: ["phantomstrike", "morrigansjavelin"] },
    { rsaActionName: "chain hit", weaponId: "runethrowingaxe", weaponDisplayName: "Rune throwing axe", assetExistsInRm: false, triggerKeys: ["chainhit", "runethrowingaxe"] },
    { rsaActionName: "split soul ecb", weaponId: "ecb", weaponDisplayName: "Eldritch crossbow", assetExistsInRm: true, triggerKeys: ["splitsoulecb", "eldritchcrossbow", "ecb"] },
    { rsaActionName: "shadowfall", weaponId: "gloomfirebow", weaponDisplayName: "Gloomfire bow", assetExistsInRm: true, triggerKeys: ["shadowfall", "gloomfirebow"] },
    // ---- Magic ----
    { rsaActionName: "instability", weaponId: "fsoa", weaponDisplayName: "Fractured Staff of Armadyl", assetExistsInRm: true, triggerKeys: ["instability", "fracturedstaffofarmadyl", "fsoa"] },
    { rsaActionName: "tempest of armadyl", weaponId: "armadylbattlestaff", weaponDisplayName: "Armadyl battlestaff", assetExistsInRm: true, triggerKeys: ["tempestofarmadyl", "armadylbattlestaff"] },
    { rsaActionName: "soulfire", weaponId: "roarofawakening", weaponDisplayName: "Roar of Awakening", assetExistsInRm: true, triggerKeys: ["soulfire", "roarofawakening"] },
    { rsaActionName: "iban blast", weaponId: "ibansstaff", weaponDisplayName: "Iban's staff", assetExistsInRm: true, triggerKeys: ["ibanblast", "ibansstaff", "ibanstaff"] },
    { rsaActionName: "claws of guthix", weaponId: "guthixstaff", weaponDisplayName: "Guthix staff", assetExistsInRm: false, triggerKeys: ["clawsofguthix", "guthixstaff"] },
    { rsaActionName: "flames of zamorak", weaponId: "zamorakstaff", weaponDisplayName: "Zamorak staff", assetExistsInRm: true, triggerKeys: ["flamesofzamorak", "zamorakstaff"] },
    { rsaActionName: "saradomin strike", weaponId: "saradominstaff", weaponDisplayName: "Saradomin staff", assetExistsInRm: false, triggerKeys: ["saradominstrike", "saradominstaff"] },
    { rsaActionName: "miasmic barrage", weaponId: "zurielsstaff", weaponDisplayName: "Zuriel's staff", assetExistsInRm: true, triggerKeys: ["miasmicbarrage", "zurielsstaff"] },
    { rsaActionName: "from the shadows", weaponId: "staffofsliske", weaponDisplayName: "Staff of Sliske", assetExistsInRm: false, triggerKeys: ["fromtheshadows", "staffofsliske"] },
    { rsaActionName: "rune flame", weaponId: "mindspike", weaponDisplayName: "Mindspike", assetExistsInRm: false, triggerKeys: ["runeflame", "mindspike"] },
    { rsaActionName: "the last command", weaponId: "legatusemberstaff", weaponDisplayName: "Legatus's Emberstaff", assetExistsInRm: true, triggerKeys: ["thelastcommand", "legatusemberstaff", "emberstaff"] },
    // ---- Melee ----
    { rsaActionName: "slice & dice", weaponId: "dragonclaw", weaponDisplayName: "Dragon claw", assetExistsInRm: true, triggerKeys: ["slice&dice", "slicendice", "dragonclaws", "dragonclaw"] },
    { rsaActionName: "quick smash", weaponId: "gmaul", weaponDisplayName: "Granite maul", assetExistsInRm: true, triggerKeys: ["quicksmash", "granitemaul", "gmaul"] },
    { rsaActionName: "icy tempest", weaponId: "lengmh", weaponDisplayName: "Dark Shard of Leng", assetExistsInRm: true, triggerKeys: ["icytempest", "darkshardofleng", "lengmh", "leng"] },
    { rsaActionName: "igneous showdown", weaponId: "ezk", weaponDisplayName: "Ek-ZekKil", assetExistsInRm: true, triggerKeys: ["igneousshowdown", "ekzekkil", "ezk"] },
    { rsaActionName: "armadyls judgement", weaponId: "ags", weaponDisplayName: "Armadyl godsword", assetExistsInRm: false, triggerKeys: ["armadylsjudgement", "armadylgodsword", "ags"] },
    { rsaActionName: "healing blade", weaponId: "saradomingodsword", weaponDisplayName: "Saradomin godsword", assetExistsInRm: false, triggerKeys: ["healingblade", "saradomingodsword", "sgs"] },
    { rsaActionName: "ice cleave", weaponId: "zamorakgodsword", weaponDisplayName: "Zamorak godsword", assetExistsInRm: true, triggerKeys: ["icecleave", "zamorakgodsword", "zgs"] },
    { rsaActionName: "saradomins lightning", weaponId: "saradominsword", weaponDisplayName: "Saradomin sword", assetExistsInRm: true, triggerKeys: ["saradominslightning", "saradominsword"] },
    { rsaActionName: "spear wall", weaponId: "vestasspear", weaponDisplayName: "Vesta's spear", assetExistsInRm: false, triggerKeys: ["spearwall", "vestasspear"] },
    { rsaActionName: "weaken special attack", weaponId: "darklight", weaponDisplayName: "Darklight", assetExistsInRm: true, triggerKeys: ["weakenspecialattack", "darklight"] },
    { rsaActionName: "draconic slash", weaponId: "dragonscimitar", weaponDisplayName: "Dragon scimitar", assetExistsInRm: true, triggerKeys: ["draconicslash", "dragonscimitar"] },
    { rsaActionName: "draconic cleave", weaponId: "dlong", weaponDisplayName: "Dragon longsword", assetExistsInRm: false, triggerKeys: ["draconiccleave", "dragonlongsword", "dlong"] },
    { rsaActionName: "draconic puncture", weaponId: "dds", weaponDisplayName: "Dragon dagger", assetExistsInRm: false, triggerKeys: ["draconicpuncture", "dragondagger", "dds"] },
    { rsaActionName: "draconic blow", weaponId: "dmace", weaponDisplayName: "Dragon mace", assetExistsInRm: false, triggerKeys: ["draconicblow", "dragonmace", "dmace"] },
    { rsaActionName: "aimed strike", weaponId: "keenblade", weaponDisplayName: "Keenblade", assetExistsInRm: false, triggerKeys: ["aimedstrike", "keenblade"] },
    { rsaActionName: "impale", weaponId: "runeclaws", weaponDisplayName: "Rune claws", assetExistsInRm: false, triggerKeys: ["impale", "runeclaws"] },
    { rsaActionName: "rampage", weaponId: "dba", weaponDisplayName: "Dragon battleaxe", assetExistsInRm: true, triggerKeys: ["rampage", "dragonbattleaxe", "dba"] },
    { rsaActionName: "gravitate", weaponId: "annihilation", weaponDisplayName: "Annihilation", assetExistsInRm: true, triggerKeys: ["gravitate", "annihilation"] },
    // ---- Necromancy ----
    { rsaActionName: "death grasp", weaponId: "deathguard90", weaponDisplayName: "Deathguard", assetExistsInRm: true, triggerKeys: ["deathgrasp", "deathguard", "deathguard90"] },
    { rsaActionName: "death essence", weaponId: "omniguard", weaponDisplayName: "Omni guard", assetExistsInRm: true, triggerKeys: ["deathessence", "omniguard"] },
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
