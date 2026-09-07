import { parsePvme, serializePvme } from "../adapters/pvme.js";
import { parseRm, serializeRm } from "../adapters/rm.js";
import { parseRsa, serializeRsa } from "../adapters/rsa.js";
import { isRmRotationSet } from "../formats/rm.types.js";
import { isRsaExport } from "../formats/rsa.types.js";
import { loadCatalog, type Catalog } from "./catalog.js";
import type { FormatId, RotationIR, SequenceIR, TimelineIR } from "./ir.js";
import { ConversionReport } from "./report.js";
import { sequenceToTimeline, timelineToSequence } from "./timing.js";

export type { FormatId };

export interface ConvertOptions {
    from?: FormatId;
    to?: FormatId;
    catalog?: Catalog;
}

export interface ConvertResult {
    from: FormatId;
    to: FormatId;
    /** RsaExport | RmRotationSet for json targets, string for pvme */
    output: unknown;
    report: ConversionReport;
    ir: RotationIR;
}

export function detectFormat(input: unknown): FormatId | null {
    if (typeof input === "string") {
        return /<?:[a-zA-Z0-9_]+:\d*>?/.test(input) || /[→↵]/.test(input) ? "pvme" : null;
    }
    if (isRsaExport(input)) return "rsa";
    if (isRmRotationSet(input)) return "rm";
    return null;
}

const OTHER: Record<FormatId, FormatId> = { rsa: "rm", rm: "rsa", pvme: "rm" };

function parse(
    input: unknown,
    from: FormatId,
    catalog: Catalog,
    report: ConversionReport,
): RotationIR {
    switch (from) {
        case "rsa":
            return parseRsa(input as never, catalog, report);
        case "rm":
            return parseRm(input as never, catalog, report);
        case "pvme":
            return parsePvme(String(input), catalog, report);
    }
}

function asTimeline(ir: RotationIR, report: ConversionReport): TimelineIR {
    return ir.kind === "timeline" ? ir : sequenceToTimeline(ir, report);
}
function asSequence(ir: RotationIR, report: ConversionReport): SequenceIR {
    return ir.kind === "sequence" ? ir : timelineToSequence(ir, report);
}

function serialize(
    ir: RotationIR,
    to: FormatId,
    catalog: Catalog,
    report: ConversionReport,
): unknown {
    switch (to) {
        case "rsa":
            return serializeRsa(asTimeline(ir, report), catalog, report);
        case "rm":
            return serializeRm(asSequence(ir, report), catalog, report);
        case "pvme":
            return serializePvme(asSequence(ir, report), catalog, report);
    }
}

export function convert(input: unknown, options: ConvertOptions = {}): ConvertResult {
    const catalog = options.catalog ?? loadCatalog();
    const from = options.from ?? detectFormat(input);
    if (!from) {
        throw new Error(
            "Could not detect the input format. Pass { from: 'rsa' | 'rm' | 'pvme' }.",
        );
    }
    const to = options.to ?? OTHER[from];
    if (to === from) {
        throw new Error(`Source and target format are both "${from}".`);
    }

    const report = new ConversionReport(from, to);
    const ir = parse(input, from, catalog, report);
    const output = serialize(ir, to, catalog, report);
    return { from, to, output, report, ir };
}
