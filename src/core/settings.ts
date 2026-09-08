// Conversion settings — tunable behaviour for the grey areas where the three
// formats don't map 1:1. Threaded through convert() and exposed in the GUI's
// Settings tab and the CLI. Add a field here + a default + a control and it flows
// everywhere.

export interface ConversionSettings {
    /**
     * RM → RSA: a weapon in a RotationMaster rotation is almost always there to
     * use its special attack (RS Analysis has no "swap weapon" action), so treat
     * a lone weapon as that weapon's special even when the `:spec:` ability isn't
     * written after it. Weapons with no known special are still emitted as a swap.
     */
    rmWeaponAsSpec: boolean;

    /**
     * RM / PVME → RSA: ticks to leave between successive GCD actions when the
     * source has no absolute timing. 3 = one global cooldown (1.8s). Channelled
     * abilities always use their real duration regardless of this.
     */
    gcdTicks: number;

    /**
     * RM → RSA: RS Analysis has no per-tick text field. When on, dropped notes
     * ("Portal", "Instance", …) are appended to the rotation name so they aren't
     * lost entirely.
     */
    keepNotesInName: boolean;

    /**
     * PVME → RM: emit one RotationMaster block per PVME section (Pre-build,
     * Phase 1, Wars, …) when the guide has them. Off = everything in one block.
     */
    rmPhaseBlocks: boolean;
}

export const DEFAULT_SETTINGS: ConversionSettings = {
    rmWeaponAsSpec: true,
    gcdTicks: 3,
    keepNotesInName: false,
    rmPhaseBlocks: true,
};

export function resolveSettings(partial?: Partial<ConversionSettings>): ConversionSettings {
    return { ...DEFAULT_SETTINGS, ...partial };
}
