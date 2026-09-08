# PVME notation — what the converter understands

PVME guides live at [github.com/pvme/pvme-guides](https://github.com/pvme/pvme-guides).
Rotations are written in the notation documented in that repo's
`editor-resources/editor-references/style-guide.txt` (§ Rotations). This is the
subset the converter parses.

## Tokens

| Notation | Meaning | Handling |
| --- | --- | --- |
| `<:name:1234567890>` | ability / gear / item — the number is the Discord emoji id | Resolved by emoji id first (≈100% hit rate against the vendored RotationMaster catalog), then by name / alias. |
| `:name:` | short form, no id | Resolved by name / alias via `pvme-settings/emojis.json`. |
| `→` | next tick / GCD | new step |
| `+` | same tick as the previous action | added to the step's same-tick group |
| `/` | "pick one" | alternatives recorded on the step; RM output emits `X / Y`, RSA keeps the first |
| `↵` or a newline | line break | `lineBreakBefore` on the next step |
| `<:weapon:> <:spec:>` | weapon special attack (space-joined) | one spec step; RSA writes the special's action name, RM writes `[weapon, :spec:]` |
| `<:weapon:> <:eofspec:>` | EoF special | same, as an EoF spec |
| `<:ammo:> <:weapon:> <:eofspec:>` | ammo swap before a special | ammo + weapon on the same tick |
| `s<:ability:>` / `r<:ability:>` | stall / release | emitted as RM's `s` / `r` separator on that action |
| `A or B`, `A / B`, `A, B` | pick one | RM `/` choice; the branches are not merged |
| `<:ammo:> <:ability:>` | ability uses that ammo (swap first) | RM: ammo row then ability row, both `""` (None) |
| `<:ability:> (<:ammo:>)` | swap *after* the ability | ammo rides the same tick, after |

## Annotations (never treated as abilities)

| Notation | Meaning |
| --- | --- |
| `(2t)` / `*2t*` | wait N ticks from the previous action → `delayTicks` |
| `(tc)` | target cycle → note |
| `(auto)` | auto attack → note |
| `(3 hit)` | channel duration → note |
| `(DW)` / `(2H)` | weapon type → note |
| `(<:emoji:>)` | autocast spell → note |
| `~20s`, `~1:45` | timing hint → note |
| `*(walk to tile…)*`, `*Note: …*`, `*improv*` | free text → note |

## Guide-file ingestion

`rs3rot extract <guide.txt>` reads a whole guide file:

1. **Parse the document** — split on `#`/`##`/`###` headings, drop `.img:`,
   `.tag:`, `{ … } .embed:json` blocks and `⬥ • ⬩` prose bullets.
2. **Find rotation lines** — dense token sequences containing `→`; a leading
   bullet is stripped, stat/description lines are rejected.
3. **Group into distinct rotations** — a heading that names a *variant*
   (`T90`, `HM`, `Necromancy`, `Top Path`, `… Rotation`, …) starts a new rotation;
   a heading that names a *section* (`Pre-build`, `Phase 2`, a boss name, …)
   appends to the current one. Trailing "All Paths" / "Shared" sections are
   appended to every sibling rotation. Consecutive same-named groups merge.
4. **Convert each rotation** independently to RM / RSA / PVME. For RM, each PVME
   section (Pre-build, Wars, Phase 1, …) becomes its own named RotationMaster
   block — turn off `rmPhaseBlocks` / pass `--no-phase-blocks` for one block.

## GCD timing (→ RSA)

RM / PVME carry no absolute ticks, so the converter lays actions on the RS
Analysis grid:

- a plain GCD ability advances the cursor **3 ticks** (`--gcd` to change);
- a **channel** (Rapid Fire, Asphyxiate, Greater Flurry, …) advances by its real
  duration — the next ability lands the tick the channel ends;
- an **off-GCD** action (movement, defensives, adren items, slayer codex, vuln
  bomb, …) never takes an ability-bar slot and never moves the cursor — it rides
  the previous GCD action's tick in the extras row (or an explicit `Nt` offset
  from it).

## Known limitations

- Rotations written **inside `.embed:json` fields** (a handful of `*-basic.txt`
  guides, e.g. `tzkal-zuk-basic`) are skipped — the embed block is dropped whole.
- Grouping is heuristic. It can over- or under-split variants (e.g. NM/HM
  sub-rotations under one "Method" heading). The **ability list and its order
  within each emitted rotation are always faithful**; only the split points and
  names are approximate. Use `--list` to see what was detected and `--section` to
  pull a specific one.
- **RM → RSA / PVME → RSA tick spacing is estimated** (3-tick default, with a
  small override table). Every such conversion says so in its report. `(Nt)`
  notes from the guide are honoured exactly.
- Prose instructions ("tank the first explosion") are not converted; when they
  sit on a rotation line they are kept as a step note.
