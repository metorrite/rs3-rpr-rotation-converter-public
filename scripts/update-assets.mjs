#!/usr/bin/env node
// Refresh the vendored ability / emoji data.
//
// Sources:
//   - RotationMaster (Ellamental2/RotationMaster): abilities.json + pvme.json
//   - PVME settings (pvme/pvme-settings): emojis/emojis.json -> pvme-emojis.json
//       (authoritative emoji_name + guide-shorthand aliases)
//
// Writes into src/data/ and records both commits in src/data/ASSETS_MANIFEST.json
// so builds stay reproducible and offline.
//
// Usage:
//   node scripts/update-assets.mjs [--ref <branch|sha|tag>] [--dry-run]
//     --ref applies to the RotationMaster repo; pvme-settings always tracks master.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const RM_REPO = "Ellamental2/RotationMaster";
const RM_FILES = [
    { upstream: "src/assets/abilities.json", local: "abilities.json" },
    { upstream: "src/assets/pvme.json", local: "pvme.json" },
];
const PVME_REPO = "pvme/pvme-settings";
const PVME_FILE = { upstream: "emojis/emojis.json", local: "pvme-emojis.json" };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "src", "data");
const manifestPath = path.join(dataDir, "ASSETS_MANIFEST.json");

function parseArgs(argv) {
    const args = { ref: "master", dryRun: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--dry-run") args.dryRun = true;
        else if (a === "--ref") args.ref = argv[++i];
        else if (a.startsWith("--ref=")) args.ref = a.slice("--ref=".length);
        else {
            console.error(`Unknown argument: ${a}`);
            process.exit(2);
        }
    }
    if (!args.ref) {
        console.error("--ref requires a value");
        process.exit(2);
    }
    return args;
}

const headers = {
    "User-Agent": "rs3-rpr-rotation-converter-update-assets",
    ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
};

async function ghJson(url) {
    const res = await fetch(url, { headers: { ...headers, Accept: "application/vnd.github+json" } });
    if (!res.ok) throw new Error(`GitHub API ${res.status} ${res.statusText} for ${url}`);
    return res.json();
}

async function fetchText(url) {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    return res.text();
}

async function readJsonIfExists(file) {
    try {
        return JSON.parse(await readFile(file, "utf8"));
    } catch {
        return null;
    }
}

const abilitySlugs = (json) =>
    new Set((Array.isArray(json) ? json : []).map((a) => a?.Title).filter((t) => typeof t === "string"));

async function resolveCommit(repo, ref) {
    const commit = await ghJson(
        `https://api.github.com/repos/${repo}/commits/${encodeURIComponent(ref)}`,
    );
    return { sha: commit.sha, date: commit.commit?.committer?.date ?? null, message: commit.commit?.message?.split("\n")[0] ?? "" };
}

async function download(repo, sha, file) {
    process.stdout.write(`Fetching ${repo}/${file.upstream} ... `);
    const text = await fetchText(`https://raw.githubusercontent.com/${repo}/${sha}/${file.upstream}`);
    const json = JSON.parse(text); // validate
    console.log("ok");
    return { ...file, json, pretty: JSON.stringify(json, null, 2) + "\n" };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const prevManifest = await readJsonIfExists(manifestPath);
    const prevAbilities = await readJsonIfExists(path.join(dataDir, "abilities.json"));

    console.log(`Resolving ${RM_REPO}@${args.ref} ...`);
    const rm = await resolveCommit(RM_REPO, args.ref);
    console.log(`  ${rm.sha} (${rm.date})  ${rm.message}`);
    console.log(`Resolving ${PVME_REPO}@master ...`);
    const pvme = await resolveCommit(PVME_REPO, "master");
    console.log(`  ${pvme.sha} (${pvme.date})`);

    let rmVersion = null;
    try {
        rmVersion = JSON.parse(
            await fetchText(`https://raw.githubusercontent.com/${RM_REPO}/${rm.sha}/package.json`),
        ).version ?? null;
    } catch {
        /* non-fatal */
    }

    const downloaded = [];
    for (const f of RM_FILES) downloaded.push(await download(RM_REPO, rm.sha, f));
    downloaded.push(await download(PVME_REPO, pvme.sha, PVME_FILE));

    const newAbilities = downloaded.find((d) => d.local === "abilities.json")?.json;
    const before = abilitySlugs(prevAbilities);
    const after = abilitySlugs(newAbilities);
    const added = [...after].filter((s) => !before.has(s)).sort();
    const removed = [...before].filter((s) => !after.has(s)).sort();

    console.log("");
    console.log(`RotationMaster : ${prevManifest?.rotationMaster?.commit ?? prevManifest?.commit ?? "(none)"} -> ${rm.sha}`);
    console.log(`pvme-settings  : ${prevManifest?.pvmeSettings?.commit ?? "(none)"} -> ${pvme.sha}`);
    console.log(`Ability count  : ${prevAbilities?.length ?? 0} -> ${newAbilities?.length ?? 0}`);
    console.log(`Added   (${added.length}): ${added.join(", ") || "-"}`);
    console.log(`Removed (${removed.length}): ${removed.join(", ") || "-"}`);

    if (args.dryRun) {
        console.log("\n--dry-run: no files written.");
        return;
    }

    const manifest = {
        rotationMaster: { repo: RM_REPO, ref: args.ref, commit: rm.sha, committedAt: rm.date, rmVersion },
        pvmeSettings: { repo: PVME_REPO, ref: "master", commit: pvme.sha, committedAt: pvme.date },
        fetchedAt: new Date().toISOString(),
        files: downloaded.map((d) => d.local),
        abilityCount: newAbilities?.length ?? null,
    };

    for (const d of downloaded) await writeFile(path.join(dataDir, d.local), d.pretty);
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

    console.log(`\nWrote ${downloaded.length} file(s) + ASSETS_MANIFEST.json`);
    console.log("Review the diff, run `npm test`, then commit.");
}

main().catch((err) => {
    console.error(`\nupdate-assets failed: ${err.message}`);
    process.exit(1);
});
