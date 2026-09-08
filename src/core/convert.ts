import { parsePvme, serializePvme } from "../adapters/pvme.js";
import { extractRotations, type ExtractedRotation } from "../adapters/pvme-guide.js";
import { parseRm, serializeRm } from "../adapters/rm.js";
import { parseRsa, serializeRsa } from "../adapters/rsa.js";
import { isRmRotationSet } from "../formats/rm.types.js";
import { isRsaExport } from "../formats/rsa.types.js";
import { loadCatalog, type Catalog } from "./catalog.js";
import type { FormatId, RotationIR, SequenceIR, TimelineIR } from "./ir.js";
import { ConversionReport } from "./report.js";
import { type ConversionSettings, resolveSettings } from "./settings.js";
import { sequenceToTimeline, timelineToSequence } from "./timing.js";

export type { FormatId };

export interface ConvertOptions {
    from?: FormatId;
    to?: FormatId;
    catalog?: Catalog;
    settings?: Partial<ConversionSettings>;
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
    settings: ConversionSettings,
): RotationIR {
    switch (from) {
        case "rsa":
            return parseRsa(input as never, catalog, report);
        case "rm":
            return parseRm(input as never, catalog, report, settings);
        case "pvme":
            return parsePvme(String(input), catalog, report);
    }
}

function serialize(
    ir: RotationIR,
    to: FormatId,
    catalog: Catalog,
    report: ConversionReport,
    settings: ConversionSettings,
    blocks?: { name: string; startStep: number }[],
): unknown {
    const asTimeline = (): TimelineIR =>
        ir.kind === "timeline" ? ir : sequenceToTimeline(ir, report, settings);
    const asSequence = (): SequenceIR =>
        ir.kind === "sequence" ? ir : timelineToSequence(ir, report);

    switch (to) {
        case "rsa":
            return serializeRsa(asTimeline(), catalog, report, settings);
        case "rm":
            return serializeRm(
                asSequence(),
                catalog,
                report,
                settings.rmPhaseBlocks ? blocks : undefined,
            );
        case "pvme":
            return serializePvme(asSequence(), catalog, report);
    }
}

export interface GuideRotationResult {
    name: string;
    sectionPath: string[];
    source: string;
    to: FormatId;
    output: unknown;
    report: ConversionReport;
}

/** Extract every distinct rotation from a PVME guide file and convert each. */
export function convertGuide(
    text: string,
    options: { to: FormatId; catalog?: Catalog; settings?: Partial<ConversionSettings> } = { to: "rm" },
): { rotations: GuideRotationResult[]; extracted: ExtractedRotation[] } {
    const catalog = options.catalog ?? loadCatalog();
    const settings = resolveSettings(options.settings);
    const extracted = extractRotations(text, catalog);
    const rotations = extracted.map((r) => {
        const report = r.report;
        report.to = options.to;
        const output = serialize(r.sequence, options.to, catalog, report, settings, r.blocks);
        return { name: r.name, sectionPath: r.sectionPath, source: r.source, to: options.to, output, report };
    });
    return { rotations, extracted };
}

export function convert(input: unknown, options: ConvertOptions = {}): ConvertResult {
    const catalog = options.catalog ?? loadCatalog();
    const settings = resolveSettings(options.settings);
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
    const ir = parse(input, from, catalog, report, settings);
    const output = serialize(ir, to, catalog, report, settings);
    return { from, to, output, report, ir };
}
