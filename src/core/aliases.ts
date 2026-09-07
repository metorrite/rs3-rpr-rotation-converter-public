// One consolidated alias table, replacing the three separate maps in the old code
// (convert/pvme.ts KEY_TO_PVME, resolve/rmAbilities.ts aliases[],
//  convert/rsaReverse.ts RM_TO_RSA_NAME_MAP).
//
// Each entry links a canonical RM ability id to the other names it is known by:
//   - `aliases`  : names/slugs seen in RSA exports or PVME guides
//   - `rsaName`  : the human name to write when emitting an RSA file (optional;
//                  defaults to the catalog display name)
//
// Coverage gaps are expected and are surfaced by the conversion report rather
// than guessed at here.

import { slug } from "./normalize.js";

export interface AliasEntry {
    canonical: string;
    aliases: string[];
    rsaName?: string;
    note?: string;
}

export const ALIASES: AliasEntry[] = [
    // ---- Ranged ------------------------------------------------------------
    { canonical: "grico", aliases: ["greater ricochet"], rsaName: "greater ricochet" },
    { canonical: "ricochet", aliases: ["ricochet"] },
    { canonical: "gdeathsswift", aliases: ["greater death's swiftness", "gds"], rsaName: "greater death's swiftness" },
    { canonical: "deaths_swiftness", aliases: ["death's swiftness", "deaths swiftness"], rsaName: "death's swiftness" },
    { canonical: "rapid", aliases: ["rapid fire", "rapidfire"], rsaName: "rapid fire" },
    { canonical: "snapshot", aliases: ["snap shot"], rsaName: "snap shot" },
    { canonical: "piercing_shot", aliases: ["piercing shot", "piercingshot"], rsaName: "piercing shot" },
    { canonical: "deadshot", aliases: ["deadshot"] },
    { canonical: "deadshotigneous", aliases: ["igneous_deadshot", "igneous deadshot", "igneousdeadshot"], rsaName: "igneous_deadshot", note: "was OLDdeadshotigneous before RM 3.2.0" },
    { canonical: "snipe", aliases: ["snipe"] },
    { canonical: "galeshot", aliases: ["galeshot", "gale shot"] },
    { canonical: "bombard", aliases: ["bombardment"], rsaName: "bombardment" },
    { canonical: "ranged_basic", aliases: ["ranged auto", "ranged basic", "rangedbasic", "ranged autoattack"], rsaName: "ranged auto" },
    { canonical: "wenarrows", aliases: ["wen arrows"], rsaName: "wen arrows" },
    { canonical: "jasdemonbanearrow", aliases: ["jas demonbane arrow"], rsaName: "jas arrows" },
    { canonical: "jasdragonbanearrow", aliases: ["jas dragonbane arrow"], rsaName: "jas arrows" },
    { canonical: "corruptshot", aliases: ["corruption shot", "corruptionshot"], rsaName: "corruption shot" },

    // ---- Magic -----------------------------------------------------------
    { canonical: "conc", aliases: ["concentrated blast", "concentratedblast", "cblast"], rsaName: "concentrated blast" },
    { canonical: "gconc", aliases: ["greater concentrated blast", "greaterconcentratedblast", "gcblast"], rsaName: "greater concentrated blast" },
    { canonical: "sonic", aliases: ["sonic wave", "sonicwave"], rsaName: "sonic wave", note: "canonical id changed from OLDsonicwave in RM 3.2.0" },
    { canonical: "gsonic", aliases: ["greater sonic wave", "greatersonicwave"], rsaName: "greater sonic wave", note: "canonical id changed from OLDgsonicwave in RM 3.2.0" },
    { canonical: "chain", aliases: ["chain"], note: "canonical id changed from OLDchain in RM 3.2.0" },
    { canonical: "gchain", aliases: ["greater chain", "greaterchain"], rsaName: "greater chain" },
    { canonical: "magmatempestcodex", aliases: ["magma tempest", "magmatempest"], rsaName: "magma tempest", note: "RM has no plain 'magma tempest' ability entry; codex icon is the closest" },
    { canonical: "wrackandruin", aliases: ["wrack and ruin"] },
    { canonical: "dbreath", aliases: ["dragon breath", "dragonbreath"], rsaName: "dragon breath" },
    { canonical: "magic_basic", aliases: ["magic auto", "magic basic", "magicbasic"], rsaName: "magic auto" },
    { canonical: "imbue_shadows", aliases: ["imbue shadows", "imbueshadows"], rsaName: "imbue shadows" },

    // ---- Melee ----------------------------------------------------------
    { canonical: "rend", aliases: ["smash"], rsaName: "smash", note: "RSA 'smash' maps to RM 'rend'" },
    { canonical: "adaptive_strike", aliases: ["adaptive strike"], rsaName: "adaptive strike" },
    { canonical: "cleave", aliases: ["igneous cleave", "igneouscleave"], rsaName: "igneous cleave", note: "RM has no igneous Cleave entry; plain Cleave is the closest icon" },
    { canonical: "melee_basic", aliases: ["melee auto", "melee basic", "meleebasic"], rsaName: "melee auto" },
    { canonical: "gbarge", aliases: ["greater barge"] },
    { canonical: "gflurry", aliases: ["greater flurry"] },
    { canonical: "gfury", aliases: ["greater fury"] },

    // ---- Necromancy ----------------------------------------------------
    { canonical: "necrobasic", aliases: ["necromancy auto", "necro auto", "necro basic", "necrobasicattack"], rsaName: "necromancy auto" },
    { canonical: "splitsoul", aliases: ["split soul necro", "split soul"], rsaName: "split soul necro" },
    { canonical: "conjurephantom", aliases: ["conjure phantom guardian"], rsaName: "conjure phantom guardian" },
    { canonical: "commandphantom", aliases: ["command phantom guardian"], rsaName: "command phantom guardian" },
    { canonical: "spectralscythe", aliases: ["spectral scythe 1", "spectral scythe 2", "spectral scythe 3", "spectral scythe"], rsaName: "spectral scythe 1" },
    { canonical: "undeadslayer", aliases: ["undead slayer ability", "undead slayer"], rsaName: "undead slayer ability" },

    // ---- Weapons / gear / consumables --------------------------------
    { canonical: "bolg", aliases: ["bow of the last guardian", "bow of the last guardian [im]", "bolg"] },
    { canonical: "eof", aliases: ["essence of finality amulet (or)", "essence of finality", "eof"], rsaName: "essence of finality amulet (or)" },
    { canonical: "salveamulet", aliases: ["salve amulet (e)", "salve amulet"], rsaName: "salve amulet (e)" },
    { canonical: "vulnbomb", aliases: ["vulnerability bomb", "vuln bomb", "vbomb"], rsaName: "vulnerability bomb" },
    { canonical: "adrenrenewal", aliases: ["adrenaline renewal potion", "adren renewal", "adrenaline renewal"], rsaName: "adrenaline renewal potion" },
    { canonical: "roarofawakening", aliases: ["roar of awakening", "soulfire"], note: "RSA 'soulfire' is the roar-of-awakening special" },
    { canonical: "gloomfirebow", aliases: ["gloomfire bow"], rsaName: "gloomfire bow" },
    { canonical: "ecb", aliases: ["eldritch crossbow"], rsaName: "eldritch crossbow" },
    { canonical: "dba", aliases: ["dragon battleaxe"], rsaName: "dragon battleaxe" },
    { canonical: "saradominbow", aliases: ["saradomin bow"], rsaName: "saradomin bow", note: "added to RM in 3.2.0; no longer a placeholder" },

    // ---- Utility / shared --------------------------------------------
    { canonical: "anti", aliases: ["anticipation"], rsaName: "anticipation" },
    { canonical: "surge", aliases: ["surge"] },
    { canonical: "dive", aliases: ["dive"] },
    { canonical: "spec", aliases: ["special attack", "spec"], rsaName: "spec" },
    { canonical: "eofspec", aliases: ["eof spec", "essence of finality ability"] },
];

// Placeholder fallbacks for weapons RM still has no icon for.
export const MISSING_RM_ASSET_FALLBACK = "queueing";
export const KNOWN_MISSING_RM_ASSETS = new Set(["guthixbow", "quickbow", "runeclaws"]);

// name -> canonical id
const forward = new Map<string, string>();
// canonical id -> preferred RSA display name
const rsaNames = new Map<string, string>();

for (const entry of ALIASES) {
    rsaNames.set(entry.canonical, entry.rsaName ?? entry.canonical);
    forward.set(slug(entry.canonical), entry.canonical);
    for (const a of entry.aliases) forward.set(slug(a), entry.canonical);
}

/** Resolve an arbitrary name to a canonical RM ability id via the alias table. */
export function aliasToCanonical(name: string): string | null {
    return forward.get(slug(name)) ?? null;
}

/** Preferred human name to write into an RSA file for a canonical id. */
export function rsaNameFor(canonicalId: string): string | null {
    return rsaNames.get(canonicalId) ?? null;
}
