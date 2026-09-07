#!/usr/bin/env node
// Vendor the rotation-bearing PVME guides as a pinned test corpus.
//
// Pulls a fixed set of directories from github.com/pvme/pvme-guides at a resolved
// commit into test/corpus/pvme-guides/, and records the commit in
// test/corpus/CORPUS_MANIFEST.json so the corpus test is offline + reproducible.
//
// Usage:
//   node scripts/fetch-guides.mjs [--ref <branch|sha|tag>] [--dry-run]

import { mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const REPO = "pvme/pvme-guides";
const DIRS = [
    "rs3-full-boss-guides",
    "slayer",
    "basic-guides",
    "combat-achievements",
    "one-tick-guides",
    "dpm-advice",
    "new-to-bossing",
    "new-to-pvm",
];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const corpusDir = path.join(root, "test", "corpus");
const guidesDir = path.join(corpusDir, "pvme-guides");
const manifestPath = path.join(corpusDir, "CORPUS_MANIFEST.json");

function parseArgs(argv) {
    const args = { ref: "master", dryRun: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--dry-run") args.dryRun = true;
        else if (a === "--ref") args.ref = argv[++i];
        else if (a.startsWith("--ref=")) args.ref = a.slice(6);
        else {
            console.error(`Unknown argument: ${a}`);
            process.exit(2);
        }
    }
    return args;
}

const headers = {
    "User-Agent": "rs3-rpr-rotation-converter-fetch-guides",
    ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
};

async function ghJson(url) {
    const res = await fetch(url, { headers: { ...headers, Accept: "application/vnd.github+json" } });
    if (!res.ok) throw new Error(`GitHub API ${res.status} ${res.statusText} for ${url}`);
    return res.json();
}

async function fetchText(url) {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.text();
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    console.log(`Resolving ${REPO}@${args.ref} ...`);
    const commit = await ghJson(
        `https://api.github.com/repos/${REPO}/commits/${encodeURIComponent(args.ref)}`,
    );
    const sha = commit.sha;
    console.log(`  commit ${sha} (${commit.commit?.committer?.date})`);

    const tree = await ghJson(
        `https://api.github.com/repos/${REPO}/git/trees/${sha}?recursive=1`,
    );
    if (tree.truncated) throw new Error("upstream tree response was truncated");

    const wanted = tree.tree.filter(
        (n) =>
            n.type === "blob" &&
            n.path.endsWith(".txt") &&
            DIRS.some((d) => n.path === d || n.path.startsWith(`${d}/`)),
    );
    console.log(`  ${wanted.length} guide files across ${DIRS.length} directories`);

    if (args.dryRun) {
        console.log("\n--dry-run: nothing written.");
        return;
    }

    await rm(guidesDir, { recursive: true, force: true });
    await mkdir(guidesDir, { recursive: true });

    let done = 0;
    const CONCURRENCY = 12;
    const queue = [...wanted];
    async function worker() {
        for (let job = queue.pop(); job; job = queue.pop()) {
            const text = await fetchText(
                `https://raw.githubusercontent.com/${REPO}/${sha}/${job.path}`,
            );
            const dest = path.join(guidesDir, job.path);
            await mkdir(path.dirname(dest), { recursive: true });
            await writeFile(dest, text);
            if (++done % 25 === 0 || done === wanted.length) {
                process.stdout.write(`\r  downloaded ${done}/${wanted.length}`);
            }
        }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    process.stdout.write("\n");

    const manifest = {
        repo: REPO,
        ref: args.ref,
        commit: sha,
        committedAt: commit.commit?.committer?.date ?? null,
        fetchedAt: new Date().toISOString(),
        directories: DIRS,
        fileCount: wanted.length,
        files: wanted.map((n) => n.path).sort(),
    };
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    console.log(`Wrote ${wanted.length} files + CORPUS_MANIFEST.json`);
}

main().catch((err) => {
    console.error(`\nfetch-guides failed: ${err.message}`);
    process.exit(1);
});
