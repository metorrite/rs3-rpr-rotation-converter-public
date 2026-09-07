import { readFileSync } from "node:fs";
import type { ActionKind } from "./ir.js";
import { slug } from "./normalize.js";
import { abilitiesPath, assetsManifestPath, pvmePath } from "./paths.js";
import type { RmAbility } from "../formats/rm.types.js";

// ---------------------------------------------------------------------------
// Raw file shapes
// ---------------------------------------------------------------------------

interface PvmeEmoji {
    name: string;
    id: string;
    emoji_id: string;
    emoji_server?: string;
    id_aliases?: string[];
    preset_type?: string;
    image?: string;
}
interface PvmeFile {
    servers: unknown[];
    categories: { name: string; emojis: PvmeEmoji[] }[];
}

export interface AssetsManifest {
    repo: string;
    ref: string;
    commit: string;
    committedAt: string | null;
    fetchedAt: string;
    rmVersion: string | null;
    abilityCount: number | null;
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export interface CatalogEntry {
    id: string; // canonical slug == RM Title
    display: string; // RM Emoji (human label)
    category: string;
    emojiId: string;
    src: string;
    kind: ActionKind;
}

export type MatchedBy = "id" | "emoji" | "emojiId" | "pvme" | "pvmeAlias";

function classify(category: string): ActionKind {
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
        pvme: PvmeFile | null,
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
            if (e.emojiId && !this.byEmojiId.has(e.emojiId)) {
                this.byEmojiId.set(e.emojiId, e);
            }
        }

        // PVME emoji table: map guide ids / emoji_ids / display names onto entries.
        for (const cat of pvme?.categories ?? []) {
            for (const em of cat.emojis) {
                const target =
                    this.byId.get(slug(em.id)) ??
                    this.byEmojiId.get(em.emoji_id) ??
                    this.byEmoji.get(slug(em.name));
                if (!target) continue;
                for (const key of [em.id, em.name, ...(em.id_aliases ?? [])]) {
                    if (key) this.byPvme.set(slug(key), target);
                }
                if (em.emoji_id) this.byEmojiId.set(em.emoji_id, target);
            }
        }
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

export function loadCatalog(): Catalog {
    if (cached) return cached;
    const abilities = JSON.parse(readFileSync(abilitiesPath, "utf8")) as RmAbility[];
    let pvme: PvmeFile | null = null;
    let manifest: AssetsManifest | null = null;
    try {
        pvme = JSON.parse(readFileSync(pvmePath, "utf8")) as PvmeFile;
    } catch {
        /* optional */
    }
    try {
        manifest = JSON.parse(
            readFileSync(assetsManifestPath, "utf8"),
        ) as AssetsManifest;
    } catch {
        /* optional */
    }
    cached = new Catalog(abilities, pvme, manifest);
    return cached;
}

/** Test / advanced use: build a catalog from explicit data. */
export function makeCatalog(
    abilities: RmAbility[],
    pvme: PvmeFile | null = null,
): Catalog {
    return new Catalog(abilities, pvme, null);
}
