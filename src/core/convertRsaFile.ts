import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { overlayRsaTimeline } from "../convert/overlay.js";
import { normalizeOverlayToPvme } from "../convert/pvme.js";
import { convertPvmeOverlayToRm } from "../convert/rm.js";
import { buildRmAbilityIndex, loadRmAbilitiesFromPath } from "../resolve/rmAbilities.js";
import type { RsaExport } from "../types/rsa.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getAbilitiesPath(): string {
    return path.resolve(__dirname, "../../assets/data/abilities.json");
}

export interface ConvertRsaFileResult {
    inputPath: string;
    outputPath: string;
    inputFileName: string;
    outputFileName: string;
}

export function convertRsaFileToRm(inputPath: string, outputDirectory: string): ConvertRsaFileResult {
    const raw = fs.readFileSync(inputPath, "utf-8");
    const rsa = JSON.parse(raw) as RsaExport;

    const overlayResult = overlayRsaTimeline(rsa);
    const pvmeMiddleResult = normalizeOverlayToPvme(overlayResult);

    const rmAbilities = loadRmAbilitiesFromPath(getAbilitiesPath());
    const rmIndex = buildRmAbilityIndex(rmAbilities);

    const rmResult = convertPvmeOverlayToRm(rsa.name, pvmeMiddleResult, rmIndex);

    const inputFileName = path.basename(inputPath, path.extname(inputPath));
    const outputFileName = `${inputFileName} - (RSM_converted).json`;
    const outputPath = path.join(outputDirectory, outputFileName);

    fs.writeFileSync(outputPath, JSON.stringify(rmResult, null, 2), "utf-8");

    return {
        inputPath,
        outputPath,
        inputFileName,
        outputFileName
    };
}