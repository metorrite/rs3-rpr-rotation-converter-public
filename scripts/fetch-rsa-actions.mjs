#!/usr/bin/env node
// Refresh src/data/rsa-actions.json — the set of action names RS Analysis's
// damage calculator understands. Any name in a converted RSA file's `data.a` /
// `data.t` that is NOT in this set makes RS Analysis throw on import.
//
// RS Analysis has no data API, so this scrapes the live app bundle:
//   tools.runescape.wiki/rs-rot  ->  biggest JS chunk  ->  `const p={ … }` keys
//
// Usage: node scripts/fetch-rsa-actions.mjs [--dry-run]

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const BASE = "https://tools.runescape.wiki/rs-rot";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "src", "data", "rsa-actions.json");
const extrasOut = path.join(root, "src", "data", "rsa-extra-actions.json");
const dryRun = process.argv.includes("--dry-run");

/** value -> {title,icon} for the utility abilities RS Analysis draws in the extras row */
function extractExtraActions(js) {
    const enums = {};
    for (const m of js.matchAll(/\b([A-Z_]{3,})=\s*"([a-z0-9 &()'-]+)"/g)) enums[m[1]] = m[2];
    const actions = {};
    for (const m of js.matchAll(/\[[a-z]\.([A-Z_]{3,})\]:\{title:"([^"]+)",icon:"([^"]+)"\}/g)) {
        const key = enums[m[1]];
        if (key) actions[key] = { title: m[2], icon: m[3] };
    }
    return Object.keys(actions).length ? actions : null;
}

async function text(url) {
    const r = await fetch(url, { headers: { "User-Agent": "rs3-rpr-rotation-converter" } });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
    return r.text();
}

function extractPKeys(js) {
    const marker = js.indexOf("const p={");
    if (marker < 0) return null;
    let i = js.indexOf("{", marker);
    let depth = 0;
    const start = i;
    for (; i < js.length; i++) {
        if (js[i] === "{") depth++;
        else if (js[i] === "}" && --depth === 0) break;
    }
    const obj = js.slice(start, i + 1);
    const keys = new Set();
    const re = /(?:"([^"]+)"|([A-Za-z_$][\w$ &'-]*?))\s*:\s*\{/g;
    let m;
    while ((m = re.exec(obj))) {
        const seg = obj.slice(0, m.index);
        const d = (seg.match(/\{/g)?.length ?? 0) - (seg.match(/\}/g)?.length ?? 0);
        if (d === 1) keys.add((m[1] ?? m[2] ?? "").trim());
    }
    return [...keys].filter(Boolean).sort();
}

async function main() {
    const html = await text(`${BASE}/rotation_builder`);
    const chunks = [...html.matchAll(/_app\/immutable\/[\w/.-]+\.js/g)].map((m) => m[0]);
    let best = null;
    let extras = null;
    for (const c of chunks) {
        const js = await text(`${BASE}/${c}`);
        const keys = extractPKeys(js);
        if (keys && keys.length > (best?.keys.length ?? 0)) best = { chunk: c, keys, js };
        const ex = extractExtraActions(js);
        if (ex && Object.keys(ex).length > Object.keys(extras ?? {}).length) extras = ex;
    }
    if (!best) throw new Error("could not locate the ability map in any chunk");

    console.log(`found ${best.keys.length} actions in ${best.chunk}`);
    const payload = {
        source: `${BASE} (${best.chunk})`,
        fetchedAt: new Date().toISOString(),
        count: best.keys.length,
        actions: best.keys,
    };
    if (dryRun) {
        console.log(best.keys.slice(0, 20).join(", "), "…");
        console.log(`extra-action meta: ${Object.keys(extras ?? {}).length}`);
        return;
    }
    await writeFile(out, JSON.stringify(payload, null, 1) + "\n");
    console.log(`wrote ${path.relative(root, out)}`);
    if (extras) {
        await writeFile(
            extrasOut,
            JSON.stringify(
                {
                    source: `${BASE}`,
                    fetchedAt: new Date().toISOString(),
                    note: "value -> {title,icon} for data.e extra-action abilities",
                    actions: extras,
                },
                null,
                2,
            ) + "\n",
        );
        console.log(`wrote ${path.relative(root, extrasOut)} (${Object.keys(extras).length})`);
    }
}

main().catch((e) => {
    console.error(`fetch-rsa-actions failed: ${e.message}`);
    process.exit(1);
});
