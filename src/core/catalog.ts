import { readFileSync } from "node:fs";
import type { ActionKind } from "./ir.js";
import { slug } from "./normalize.js";
import { abilitiesPath, assetsManifestPath, pvmeEmojisPath, pvmePath } from "./paths.js";
import type { RmAbility } from "../formats/rm.types.js";

// ---------------------------------------------------------------------------
// Raw file shapes
// ---------------------------------------------------------------------------

/** RotationMaster src/assets/pvme.json (a.k.a. pvme-settings emojis_v2.json) */
interface PvmeV2Emoji {
    name: string;
    id: string;
    emoji_id: string;
    id_aliases?: string[];
    preset_type?: string;
}
interface PvmeV2File {
    categories: { name: string; emojis: PvmeV2Emoji[] }[];
}

/** pvme-settings emojis/emojis.json — authoritative names + guide aliases */
interface PvmeEmoji {
    name: string;
    emoji_name: string;
    emoji_id: string;
    aliases?: string[];
}
interface PvmeEmojisFile {
    categories: { name: string; emojis: PvmeEmoji[] }[];
    uncategorized?: PvmeEmoji[];
}

interface RepoRef {
    repo: string;
    ref: string;
    commit: string;
    committedAt: string | null;
    rmVersion?: string | null;
}
export interface AssetsManifest {
    rotationMaster: RepoRef;
    pvmeSettings?: RepoRef;
    fetchedAt: string;
    files: string[];
    abilityCount: number | null;
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export interface CatalogEntry {
    id: string; // canonical slug == RM Title
    display: string; // RM Emoji (human label)
    /** PVME display name, when known — the cleanest source for RSA action names */
    pvmeName?: string;
    category: string;
    emojiId: string;
    src: string;
    kind: ActionKind;
}

export type MatchedBy = "id" | "emoji" | "emojiId" | "pvme" | "pvmeAlias";

export function classify(category: string): ActionKind {
    const c = category.toLowerCase();
    if (c.includes("abilit")) return "ability";
    if (c.includes("consumable") || c.includes("currenc")) return "consumable";
    if (
        c.includes("gear") ||
        c.includes("jewellery") ||
        c.includes("aura") ||
        c.includes("pocket") ||
        c.includes("prayer") ||
        c.includes("relic") ||
        c.includes("summoning") ||
        c.includes("familiar")
    ) {
        return "gear";
    }
    // NPC / drop / cosmetic / cursor icons that show up in guides as labels, not actions.
    // (Keep "Miscellaneous" / "Uncategorised" out of this — real abilities land there.)
    if (
        c.includes("boss") ||
        c === "npcs" ||
        c.includes("npc") ||
        c.includes(" pet") ||
        c.includes("pets") ||
        c.includes("drop") ||
        c.includes("creature") ||
        c.includes("slayer creature") ||
        c.includes("teleport") ||
        c.includes("clue") ||
        c === "ability targetting" ||
        c.includes("invention perk") ||
        c.includes("invention component") ||
        c.includes("gizmo")
    ) {
        return "marker";
    }
    return "ability";
}

export class Catalog {
    readonly entries: CatalogEntry[];
    readonly manifest: AssetsManifest | null;

    private readonly byId = new Map<string, CatalogEntry>();
    private readonly byEmoji = new Map<string, CatalogEntry>();
    private readonly byEmojiId = new Map<string, CatalogEntry>();
    private readonly byPvme = new Map<string, CatalogEntry>();

    constructor(
        abilities: RmAbility[],
        pvmeV2: PvmeV2File | null,
        pvmeEmojis: PvmeEmojisFile | null,
        manifest: AssetsManifest | null,
    ) {
        this.manifest = manifest;
        this.entries = abilities.map((a) => ({
            id: a.Title,
            display: a.Emoji || a.Title,
            category: a.Category,
            emojiId: a.EmojiId,
            src: a.Src,
            kind: classify(a.Category),
        }));

        for (const e of this.entries) {
            this.byId.set(slug(e.id), e);
            if (!this.byEmoji.has(slug(e.display))) this.byEmoji.set(slug(e.display), e);
            if (e.emojiId && !this.byEmojiId.has(e.emojiId)) this.byEmojiId.set(e.emojiId, e);
        }

        // pvme.json (v2): ids / display names -> entries; also attach the pvme name.
        for (const cat of pvmeV2?.categories ?? []) {
            for (const em of cat.emojis) {
                const target = this.resolveSeed(em.id, em.emoji_id, em.name);
                if (!target) continue;
                target.pvmeName ??= em.name;
                for (const key of [em.id, em.name, ...(em.id_aliases ?? [])]) {
                    if (key) this.byPvme.set(slug(key), target);
                }
                if (em.emoji_id) this.byEmojiId.set(em.emoji_id, target);
            }
        }

        // pvme-settings emojis.json: authoritative emoji_name + guide-shorthand aliases.
        const allEmojis = [
            ...(pvmeEmojis?.categories ?? []).flatMap((c) => c.emojis),
            ...(pvmeEmojis?.uncategorized ?? []),
        ];
        for (const em of allEmojis) {
            const target = this.resolveSeed(em.emoji_name, em.emoji_id, em.name);
            if (!target) continue;
            target.pvmeName ??= em.name;
            for (const key of [em.emoji_name, em.name, ...(em.aliases ?? [])]) {
                if (key && !this.byPvme.has(slug(key))) this.byPvme.set(slug(key), target);
            }
            if (em.emoji_id && !this.byEmojiId.has(em.emoji_id)) this.byEmojiId.set(em.emoji_id, target);
        }
    }

    private resolveSeed(id: string, emojiId: string, name: string): CatalogEntry | null {
        return (
            this.byId.get(slug(id)) ??
            this.byEmojiId.get(emojiId) ??
            this.byEmoji.get(slug(name)) ??
            null
        );
    }

    get(id: string): CatalogEntry | null {
        return this.byId.get(slug(id)) ?? null;
    }

    /** Look a name/emoji/id up through every index, in priority order. */
    match(name: string): { entry: CatalogEntry; by: MatchedBy } | null {
        const s = slug(name);
        const byId = this.byId.get(s);
        if (byId) return { entry: byId, by: "id" };
        const byEmojiId = this.byEmojiId.get(name.trim());
        if (byEmojiId) return { entry: byEmojiId, by: "emojiId" };
        const byEmoji = this.byEmoji.get(s);
        if (byEmoji) return { entry: byEmoji, by: "emoji" };
        const byPvme = this.byPvme.get(s);
        if (byPvme) return { entry: byPvme, by: "pvme" };
        return null;
    }

    has(id: string): boolean {
        return this.byId.has(slug(id));
    }
}

// ---------------------------------------------------------------------------
// Loading (cached)
// ---------------------------------------------------------------------------

let cached: Catalog | null = null;

function readJson<T>(p: string): T | null {
    try {
        return JSON.parse(readFileSync(p, "utf8")) as T;
    } catch {
        return null;
    }
}

export function loadCatalog(): Catalog {
    if (cached) return cached;
    const abilities = JSON.parse(readFileSync(abilitiesPath, "utf8")) as RmAbility[];
    cached = new Catalog(
        abilities,
        readJson<PvmeV2File>(pvmePath),
        readJson<PvmeEmojisFile>(pvmeEmojisPath),
        readJson<AssetsManifest>(assetsManifestPath),
    );
    return cached;
}

/** Test / advanced use: build a catalog from explicit data. */
export function makeCatalog(
    abilities: RmAbility[],
    pvmeV2: PvmeV2File | null = null,
    pvmeEmojis: PvmeEmojisFile | null = null,
): Catalog {
    return new Catalog(abilities, pvmeV2, pvmeEmojis, null);
}
