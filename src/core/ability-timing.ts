// How long an action holds the tick cursor when RM / PVME (no absolute ticks)
// is laid onto the RS Analysis tick grid.
//
//   off-GCD  -> 0 ticks: never takes an ability-bar slot, rides the previous
//               GCD action's tick in the extras row
//   channel  -> its real duration (RS Analysis's own `duration` field)
//   regular  -> one global cooldown (3 ticks / 1.8s), overridable per conversion

import { slug } from "./normalize.js";

/**
 * Canonical ids of abilities / items that do NOT trigger the global cooldown.
 * Small and curated on purpose — add ids here as they come up.
 */
export const OFF_GCD = new Set<string>(
    [
        // movement
        "surge", "escape", "dive", "bladeddive", "bd",
        // defensives / utility (don't trigger the GCD)
        "anticipation", "anti", "freedom", "preparation", "prep", "resonance",
        "devotion", "devo", "debilitate", "debil", "reflect", "reprisal",
        "barricade", "immortality", "disruptionshield", "naturalinstinct",
        "ingenuityofthehumans", "limitless", "transfigure", "sacrifice",
        // prayer / curse flicks
        "deflectmelee", "deflectranged", "deflectmagic", "deflectnecromancy",
        "protectfrommelee", "protectfromranged", "protectfrommagic", "soulsplit",
        // consumables / pocket-slot
        "vulnerabilitybomb", "vulnbomb", "adrenalinerenewalpotion", "adrenrenewal",
        "adrenalinepotion", "powerburstofvitality", "powerburstofacceleration",
        "elderoverload", "weaponpoison", "dominionmine", "dommine",
        "enhancedexcalibur", "excalibur", "guthixrest", "sixthsage",
        "powerburst", "brew", "saradonbrew",
        // codex abilities / sigils
        "undeadslayer", "undeadslayerability", "dragonslayer", "dragonslayerability",
        "demonslayer", "demonslayerability", "slayersigil", "sigilofconsumption",
        // thrown / niche off-GCD weapons and items
        "ballista", "chinchompa", "redchinchompa", "explosivepotion", "throwingchinchompa",
        "bakriminel", "kwuarm", "orb", "salveamulet", "jasarrows", "wenarrows",
    ].map(slug),
);

/**
 * Channelled / bound abilities that occupy more than one GCD. Values are game
 * ticks and mirror RS Analysis's own `duration` field where known.
 */
export const CHANNEL_TICKS: Record<string, number> = {
    rapid: 8, // Rapid Fire
    rapidfire: 8,
    gflurry: 8,
    greaterflurry: 8,
    flurry: 8,
    bloodsiphon: 8,
    smoketendrils: 7,
    smoketend: 7,
    shadowtend: 7,
    asphyxiate: 7,
    asphyx: 7,
    gasphyxiate: 7,
    tumekenasphyxiate: 8,
    assault: 7,
    endlessassault: 7,
    aimedshot: 5,
    tempestofarmadyl: 5,
    metamorphosis: 6,
    metamorph: 6,
    unload: 5,
    frenzy: 8,
    gfrenzy: 8,
    greaterfrenzy: 8,
    icytempest: 3,
    seismicdetonation: 0,
};

export function isOffGcd(canonicalId: string | null | undefined): boolean {
    return !!canonicalId && OFF_GCD.has(slug(canonicalId));
}

export function channelTicks(canonicalId: string | null | undefined): number | null {
    if (!canonicalId) return null;
    const v = CHANNEL_TICKS[slug(canonicalId)];
    return v ?? null;
}

/** Ticks the cursor advances after this action. base = the GCD length setting. */
export function gcdAdvance(canonicalId: string | null | undefined, base: number): number {
    if (isOffGcd(canonicalId)) return 0;
    return channelTicks(canonicalId) ?? base;
}
