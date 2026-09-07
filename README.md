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

Requires Node 20.19+ (see `.nvmrc`).

## CLI

```bash
# auto-detect the input format, convert to the other side of an RSA/RM pair
npm run cli -- convert path/to/rotation.json -o out/

# explicit
npm run cli -- convert rot.json --from rm --to rsa --report

# inspect what the converter parsed and resolved, without writing anything
npm run cli -- inspect rot.json
```

## Desktop app

```bash
npm run gui          # build + launch Electron
npm run dist:win     # package a Windows installer + portable exe into release/
```

## Ability data

`src/data/abilities.json` and `src/data/pvme.json` are vendored copies of
RotationMaster's ability database, pinned to a known-good upstream commit recorded
in `src/data/ASSETS_MANIFEST.json`. The build and the packaged app never fetch
anything.

To pull the latest upstream data:

```bash
npm run update-assets -- --dry-run   # show what would change
npm run update-assets                # write the update + refresh the manifest
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
