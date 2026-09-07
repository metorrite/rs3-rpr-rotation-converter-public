#!/usr/bin/env node
// Refresh the vendored RotationMaster ability data.
//
// Pulls src/assets/{abilities,pvme}.json from the upstream RotationMaster repo at
// a resolved commit, writes them into src/data/, and records the exact commit in
// src/data/ASSETS_MANIFEST.json so builds stay reproducible and offline.
//
// Usage:
//   node scripts/update-assets.mjs [--ref <branch|sha|tag>] [--dry-run]
//
//   --ref       upstream ref to pull from (default: master)
//   --dry-run   fetch and report the diff, but do not write any files

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const REPO = "Ellamental2/RotationMaster";
const FILES = [
  { upstream: "src/assets/abilities.json", local: "abilities.json" },
  { upstream: "src/assets/pvme.json", local: "pvme.json" },
];

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

async function ghJson(url) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "rs3-rpr-rotation-converter-update-assets",
      ...(process.env.GITHUB_TOKEN
        ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
        : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} ${res.statusText} for ${url}`);
  }
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "rs3-rpr-rotation-converter-update-assets" },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  }
  return res.text();
}

async function readJsonIfExists(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

function abilitySlugs(json) {
  if (!Array.isArray(json)) return new Set();
  return new Set(json.map((a) => a?.Title).filter((t) => typeof t === "string"));
}

function diffSlugs(before, after) {
  const added = [...after].filter((s) => !before.has(s)).sort();
  const removed = [...before].filter((s) => !after.has(s)).sort();
  return { added, removed };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log(`Resolving ${REPO}@${args.ref} ...`);
  const commit = await ghJson(
    `https://api.github.com/repos/${REPO}/commits/${encodeURIComponent(args.ref)}`,
  );
  const sha = commit.sha;
  const committedAt = commit.commit?.committer?.date ?? null;
  console.log(`  commit ${sha} (${committedAt})`);
  console.log(`  ${commit.commit?.message?.split("\n")[0] ?? ""}`);

  // Upstream RotationMaster version, best-effort.
  let rmVersion = null;
  try {
    const pkg = JSON.parse(
      await fetchText(
        `https://raw.githubusercontent.com/${REPO}/${sha}/package.json`,
      ),
    );
    rmVersion = pkg.version ?? null;
  } catch {
    /* non-fatal */
  }

  const prevManifest = await readJsonIfExists(manifestPath);
  const prevAbilities = await readJsonIfExists(path.join(dataDir, "abilities.json"));

  const downloaded = [];
  for (const f of FILES) {
    const url = `https://raw.githubusercontent.com/${REPO}/${sha}/${f.upstream}`;
    process.stdout.write(`Fetching ${f.upstream} ... `);
    const text = await fetchText(url);
    const json = JSON.parse(text); // validate
    const pretty = JSON.stringify(json, null, 2) + "\n";
    downloaded.push({ ...f, json, pretty });
    console.log("ok");
  }

  const newAbilities = downloaded.find((d) => d.local === "abilities.json")?.json;
  const { added, removed } = diffSlugs(
    abilitySlugs(prevAbilities),
    abilitySlugs(newAbilities),
  );

  console.log("");
  console.log(`Previous commit : ${prevManifest?.commit ?? "(none)"}`);
  console.log(`New commit      : ${sha}`);
  console.log(`Ability count   : ${prevAbilities?.length ?? 0} -> ${newAbilities?.length ?? 0}`);
  console.log(`Added abilities  (${added.length}): ${added.join(", ") || "-"}`);
  console.log(`Removed abilities (${removed.length}): ${removed.join(", ") || "-"}`);

  if (args.dryRun) {
    console.log("\n--dry-run: no files written.");
    return;
  }

  const manifest = {
    repo: REPO,
    ref: args.ref,
    commit: sha,
    committedAt,
    fetchedAt: new Date().toISOString(),
    rmVersion,
    files: FILES.map((f) => f.local),
    abilityCount: newAbilities?.length ?? null,
  };

  for (const d of downloaded) {
    await writeFile(path.join(dataDir, d.local), d.pretty);
  }
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

  console.log(`\nWrote ${downloaded.length} file(s) + ASSETS_MANIFEST.json`);
  console.log("Review the diff, run `npm test`, then commit.");
}

main().catch((err) => {
  console.error(`\nupdate-assets failed: ${err.message}`);
  process.exit(1);
});
