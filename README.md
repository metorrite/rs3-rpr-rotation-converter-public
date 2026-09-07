# rs3-rpr-rotation-converter

Convert RuneScape 3 PvM ability rotations between the formats the community uses:

| Format | What it is | Notation |
| --- | --- | --- |
| **RSA** — [RS Analysis](https://tools.runescape.wiki/rs-rot) | Tick-grid rotation / DPM analyser | JSON save file: `data.a[]` (one action per game tick), `data.e[]` (per-tick gear / consumable / off-GCD overlays) |
| **RM** — [RotationMaster](https://github.com/Ellamental2/RotationMaster) | Alt1 on-screen rotation overlay | JSON export: ordered `{Separator, SelectedAbility, Notes}` steps; `→` next, `+` same tick, `/` choice, `Notes: "2T"` = tick delay |
| **PVME** — [pvme-guides](https://github.com/pvme/pvme-guides) | Written boss-guide rotations | `<:emojiname:discordId>` tokens joined by `→ + /`, with `*Nt*` / `(tc)` annotations |

Everything converts through a shared tick-aware intermediate representation, so any
pair of formats is reachable. `RSA → RM` is high fidelity; `RM → RSA` is
best-effort (RM does not record absolute ticks) and every assumption is listed in
the conversion report.

## Install

```bash
npm ci
npm run build
```

**Requires Node 22.12+** (see `.nvmrc`). Electron 44's install script `require()`s
an ESM module, which only works on Node ≥ 22.12 (the 22 LTS line). On Node 22.11
`npm install` fails with `ERR_REQUIRE_ESM` from `@electron/get`; either upgrade
Node, or run the install once as
`NODE_OPTIONS=--experimental-require-module npm install`. The CLI, library and
tests don't use Electron and run on older Node fine.

## CLI

```bash
# auto-detect the input format, convert to the other side of an RSA/RM pair
npm run cli -- convert path/to/rotation.json -o out/

# explicit
npm run cli -- convert rot.json --from rm --to rsa --report

# inspect what the converter parsed and resolved, without writing anything
npm run cli -- inspect rot.json
```

### Ingesting PVME boss guides

```bash
# what rotations does this guide contain?
npm run cli -- extract path/to/rasial.txt --list

# convert every rotation in the guide to RotationMaster JSON (one file each)
npm run cli -- extract path/to/rasial.txt --to rm -o out/

# just one of them
npm run cli -- extract path/to/rasial.txt --to rsa --section "T90"
```

A guide's distinct rotations (e.g. *T90 Equilibrium* vs *Equilibrium*, or
*Top Path* vs *Bottom Path*) each become their own file, with their pre-build and
phase sections concatenated in order. See [docs/pvme-notation.md](docs/pvme-notation.md)
for the notation and grouping rules, and the known limitations.

```bash
# run the whole vendored guide corpus and write test/corpus-report.md
npm run cli -- corpus-report --to rm
```

## Desktop app

```bash
npm run gui          # build + launch Electron
npm run dist:win     # package a Windows installer + portable exe into release/
```

## Running in an IDE (WebStorm / IntelliJ)

Shared run configurations live in `.idea/runConfigurations/` and appear in the
Run/Debug dropdown, grouped:

| Group | Config | Runs |
| --- | --- | --- |
| Build & Test | **build** | `tsc` + copy data into `dist/` |
| | **rebuild (clean + build + test)** | full reset then rebuild + test |
| | **test** / **test (watch)** | the Vitest suite (once / watch mode) |
| | **typecheck** | `tsc --noEmit` |
| | **clean** | remove `dist/`, `release/`, reports |
| App | **GUI (Electron)** | build + launch the desktop converter |
| | **Package Windows app** | `electron-builder` → `release/` |
| Convert | **CLI: convert (edit args)** | one file — edit the path + `--to` |
| | **CLI: extract Rasial guide** | pull rotations out of a PVME guide |
| | **CLI: corpus report** | run the whole guide corpus |
| | **Generate samples/** | every corpus rotation → `samples/` (RM+RSA+PVME) |
| Data | **Data: update ability data** | refresh `src/data/` from upstream |
| | **Data: fetch PVME guides** | re-download the guide corpus |

Any `package.json` script also runs directly from the **npm** tool window. The
build/rebuild/gui/samples configs handle their own compile step; `test` and the
CLI configs run the TypeScript directly via `tsx` / Vitest and need no build.

## Ability data

`src/data/` holds vendored, pinned copies of:

- `abilities.json`, `pvme.json` — RotationMaster's ability database
- `pvme-emojis.json` — `pvme/pvme-settings` emoji table (names + guide aliases)

Both upstream commits are recorded in `src/data/ASSETS_MANIFEST.json`. The build
and packaged app never fetch anything.

```bash
npm run update-assets -- --dry-run   # show what would change
npm run update-assets                # write the update + refresh the manifest
```

The PVME guide corpus used by the tests is vendored under `test/corpus/` and
pinned in `test/corpus/CORPUS_MANIFEST.json`:

```bash
npm run fetch-guides -- --dry-run
npm run fetch-guides
```

Review the diff, run `npm test`, then commit.

## Architecture

```
src/
  core/       pure conversion engine — IR, catalog, resolver, timing model, report
  adapters/   rsa | rm | pvme  <->  IR
  formats/    the three on-disk JSON/text shapes
  data/       vendored ability data + manifest + blank RSA template
  cli/        rs3rot command
  electron/   desktop shell (thin wrapper over core)
```

`core/` has no filesystem, Electron, or network dependency, so new front-ends
(HTTP API, Alt1 plugin, etc.) can sit on top of it.

## Tests

```bash
npm test
```

See [NOTICE](./NOTICE) for third-party data attribution.
