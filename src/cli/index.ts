#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { convert, detectFormat, loadCatalog, type FormatId } from "../core/index.js";

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
    .command("catalog-info")
    .description("show the vendored data version")
    .action(() => {
        const m = loadCatalog().manifest;
        if (!m) return console.log("No ASSETS_MANIFEST.json found.");
        console.log(`repo:     ${m.repo}@${m.ref}`);
        console.log(`commit:   ${m.commit}`);
        console.log(`RM ver:   ${m.rmVersion ?? "?"}`);
        console.log(`fetched:  ${m.fetchedAt}`);
        console.log(`abilities:${m.abilityCount}`);
    });

program.parseAsync().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
