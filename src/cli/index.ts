#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import {
    convert,
    convertGuide,
    detectFormat,
    extractRotations,
    loadCatalog,
    type FormatId,
} from "../core/index.js";

const FORMATS: FormatId[] = ["rsa", "rm", "pvme"];
const program = new Command();

program
    .name("rs3rot")
    .description("Convert RS3 rotations between RS Analysis, RotationMaster and PVME notation.");

function readInput(file: string): { value: unknown; text: string } {
    const text = readFileSync(file, "utf8");
    if (path.extname(file).toLowerCase() === ".txt") return { value: text, text };
    try {
        return { value: JSON.parse(text), text };
    } catch {
        return { value: text, text };
    }
}

function outPath(input: string, to: FormatId, outDir?: string): string {
    const dir = outDir ?? path.dirname(input);
    const base = path.basename(input, path.extname(input));
    const ext = to === "pvme" ? "txt" : "json";
    return path.join(dir, `${base} - (${to.toUpperCase()}_converted).${ext}`);
}

program
    .command("convert")
    .argument("<input>", "path to an RSA/RM .json or a PVME .txt rotation")
    .option("--from <format>", `input format (${FORMATS.join(" | ")}) — auto-detected if omitted`)
    .option("--to <format>", `output format (${FORMATS.join(" | ")})`)
    .option("-o, --out <dir>", "output directory (default: alongside the input)")
    .option("--report", "print the conversion report", false)
    .option("--json", "print the output to stdout as JSON instead of writing a file", false)
    .action((input: string, opts: { from?: string; to?: string; out?: string; report: boolean; json: boolean }) => {
        const { value } = readInput(input);
        const from = (opts.from as FormatId) ?? detectFormat(value) ?? undefined;
        const result = convert(value, { from, to: opts.to as FormatId | undefined });

        const serialized =
            typeof result.output === "string"
                ? result.output
                : JSON.stringify(result.output, null, 2) + "\n";

        if (opts.json) {
            process.stdout.write(serialized.endsWith("\n") ? serialized : serialized + "\n");
        } else {
            const dest = outPath(input, result.to, opts.out);
            writeFileSync(dest, serialized);
            console.log(`${result.from.toUpperCase()} -> ${result.to.toUpperCase()}  ${dest}`);
        }

        if (opts.report || !result.report.ok) {
            console.error("\n" + result.report.format());
        }
        if (!result.report.ok) process.exitCode = 1;
    });

function safeName(s: string): string {
    return s.replace(/[^\w .()—-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

program
    .command("extract")
    .argument("<guide>", "path to a PVME guide .txt file")
    .option("--to <format>", `output format (rsa | rm | pvme)`, "rm")
    .option("-o, --out <dir>", "output directory (default: alongside the guide)")
    .option("--list", "list the rotations found, convert nothing", false)
    .option("--section <name>", "only rotations whose name/section contains this text")
    .action((guide: string, opts: { to: string; out?: string; list: boolean; section?: string }) => {
        const text = readFileSync(guide, "utf8");
        const catalog = loadCatalog();

        if (opts.list) {
            const found = extractRotations(text, catalog);
            if (!found.length) return console.log("No rotations detected.");
            for (const r of found) {
                const ids = r.sequence.steps.filter((s) => s.primary).length;
                console.log(`• ${r.name}`);
                console.log(`    path: ${r.sectionPath.join(" › ")}   steps: ${ids}`);
                const unresolved = r.report.entries.filter((e) => e.code === "unresolved").length;
                if (unresolved) console.log(`    ${unresolved} unresolved token(s)`);
            }
            return;
        }

        const to = opts.to as FormatId;
        const { rotations } = convertGuide(text, { to, catalog });
        let list = rotations;
        if (opts.section) {
            const q = opts.section.toLowerCase();
            list = rotations.filter(
                (r) => r.name.toLowerCase().includes(q) || r.sectionPath.join(" ").toLowerCase().includes(q),
            );
        }
        if (!list.length) return console.log("No matching rotations.");

        const dir = opts.out ?? path.dirname(guide);
        const ext = to === "pvme" ? "txt" : "json";
        let bad = 0;
        for (const r of list) {
            const dest = path.join(dir, `${safeName(r.name)} - (${to.toUpperCase()}).${ext}`);
            const body =
                typeof r.output === "string" ? r.output : JSON.stringify(r.output, null, 2) + "\n";
            writeFileSync(dest, body);
            const u = r.report.entries.filter((e) => e.code === "unresolved").length;
            console.log(`${dest}${u ? `   (${u} unresolved)` : ""}`);
            if (!r.report.ok) bad++;
        }
        if (bad) process.exitCode = 1;
    });

program
    .command("inspect")
    .argument("<input>", "rotation file to analyse")
    .description("parse the input and print the resolution report without converting")
    .action((input: string) => {
        const { value } = readInput(input);
        const from = detectFormat(value);
        if (!from) throw new Error("Could not detect the input format.");
        // convert to the paired format purely to exercise the resolver
        const result = convert(value, { from });
        const steps = result.ir.kind === "sequence" ? result.ir.steps.length : result.ir.events.length;
        console.log(`format: ${from}`);
        console.log(`name:   ${result.ir.name}`);
        console.log(`${result.ir.kind === "sequence" ? "steps" : "events"}: ${steps}`);
        console.log("\n" + result.report.format());
    });

program
    .command("update-assets")
    .description("refresh the vendored RotationMaster data (wraps scripts/update-assets.mjs)")
    .allowUnknownOption(true)
    .helpOption(false)
    .action(() => {
        const here = path.dirname(fileURLToPath(import.meta.url));
        const script = path.resolve(here, "../../scripts/update-assets.mjs");
        const passthrough = process.argv.slice(process.argv.indexOf("update-assets") + 1);
        const r = spawnSync(process.execPath, [script, ...passthrough], { stdio: "inherit" });
        process.exitCode = r.status ?? 0;
    });

program
    .command("corpus-report")
    .description("run every vendored PVME guide through the converter and summarise")
    .option("--to <format>", "target format for the run (rm | rsa)", "rm")
    .option("--dir <path>", "corpus directory", "test/corpus/pvme-guides")
    .action((opts: { to: string; dir: string }) => {
        const walk = (d: string): string[] =>
            readdirSync(d).flatMap((f) => {
                const p = path.join(d, f);
                return statSync(p).isDirectory() ? walk(p) : p.endsWith(".txt") ? [p] : [];
            });

        const files = walk(opts.dir);
        const catalog = loadCatalog();
        const to = opts.to as FormatId;

        let guides = 0,
            withRotations = 0,
            rotations = 0,
            selections = 0,
            unresolved = 0,
            errors = 0,
            timingEst = 0;
        const missHist = new Map<string, { count: number; guide: string }>();

        for (const f of files) {
            guides++;
            let result;
            try {
                result = convertGuide(readFileSync(f, "utf8"), { to, catalog });
            } catch (err) {
                errors++;
                console.error(`ERR ${f}: ${err instanceof Error ? err.message : err}`);
                continue;
            }
            if (result.rotations.length) withRotations++;
            result.extracted.forEach((ex, i) => {
                rotations++;
                selections += ex.sequence.steps.filter((s) => s.primary).length;
                const r = result.rotations[i]!;
                for (const e of r.report.entries) {
                    if (e.code === "unresolved") {
                        unresolved++;
                        const key = e.name ?? "?";
                        const cur = missHist.get(key);
                        if (cur) cur.count++;
                        else missHist.set(key, { count: 1, guide: path.relative(opts.dir, f) });
                    }
                    if (e.code === "estimated-timing") timingEst++;
                }
            });
        }

        const rate = selections ? (100 * (1 - unresolved / selections)).toFixed(2) : "n/a";
        const top = [...missHist.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 40);
        const md = [
            `# PVME corpus report`,
            ``,
            `Target format: ${to}`,
            `Generated: ${new Date().toISOString()}`,
            ``,
            `| metric | value |`,
            `| --- | --- |`,
            `| guide files | ${files.length} |`,
            `| guides with a detected rotation | ${withRotations} |`,
            `| rotations extracted | ${rotations} |`,
            `| ability selections emitted | ${selections} |`,
            `| unresolved tokens | ${unresolved} |`,
            `| **ability resolution** | **${rate}%** |`,
            `| conversions using estimated timing | ${timingEst} |`,
            `| parse errors | ${errors} |`,
            ``,
            `## Top unresolved tokens`,
            ``,
            top.length ? `| token | count | example guide |\n| --- | --- | --- |` : `_none_`,
            ...top.map(([name, v]) => `| \`${name}\` | ${v.count} | ${v.guide} |`),
            ``,
        ].join("\n");

        writeFileSync("test/corpus-report.md", md);
        console.log(md);
        console.log("\nwritten to test/corpus-report.md");
    });

program
    .command("catalog-info")
    .description("show the vendored data version")
    .action(() => {
        const m = loadCatalog().manifest;
        if (!m) return console.log("No ASSETS_MANIFEST.json found.");
        console.log(`RotationMaster: ${m.rotationMaster.repo}@${m.rotationMaster.commit} (v${m.rotationMaster.rmVersion ?? "?"})`);
        if (m.pvmeSettings) console.log(`pvme-settings:  ${m.pvmeSettings.repo}@${m.pvmeSettings.commit}`);
        console.log(`fetched:       ${m.fetchedAt}`);
        console.log(`abilities:     ${m.abilityCount}`);
    });

program.parseAsync().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
