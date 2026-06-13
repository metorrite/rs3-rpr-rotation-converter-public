import fs from "node:fs";
import path from "node:path";
import { overlayRsaTimeline } from "./convert/overlay.js";
import { normalizeOverlayToPvme } from "./convert/pvme.js";
import { convertPvmeOverlayToRm } from "./convert/rm.js";
import { convertRmToTentativeRsa } from "./convert/rsaReverse.js";
import { buildRmAbilityIndex, loadRmAbilities } from "./resolve/rmAbilities.js";
import type { RsaExport } from "./types/rsa.js";
import type { RmRotationSet } from "./types/rm.js";

type Direction = "RSA_TO_RM" | "RM_TO_RSA";

function ensureDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function getMonthAbbrev(monthIndex: number): string {
    const months = [
        "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
        "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
    ];
    return months[monthIndex] ?? "UNK";
}

function getTimeZoneAbbrev(): string {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZoneName: "short"
    }).formatToParts(new Date());

    const tzPart = parts.find((part) => part.type === "timeZoneName");
    if (!tzPart) return "LOCAL";

    return tzPart.value.replace(/\s+/g, "").toUpperCase();
}

function pad2(value: number): string {
    return value.toString().padStart(2, "0");
}

function buildDtgStamp(date: Date = new Date()): string {
    const day = pad2(date.getDate());
    const month = getMonthAbbrev(date.getMonth());
    const year = date.getFullYear().toString().slice(-2);
    const tz = getTimeZoneAbbrev();
    const hh = pad2(date.getHours());
    const mm = pad2(date.getMinutes());
    const ss = pad2(date.getSeconds());

    return `${day}${month}${year}-${tz}-${hh}${mm}_${ss}`;
}

function buildOutputFileName(prefix: Direction | "PVME_MIDDLE", extension = "json"): string {
    return `${prefix}_${buildDtgStamp()}.${extension}`;
}

function writeJsonFile(outputDir: string, fileName: string, data: unknown): string {
    ensureDirectory(outputDir);
    const fullPath = path.join(outputDir, fileName);
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), "utf-8");
    return fullPath;
}

function runRsaToRmTest(rmIndex: Map<string, any>): void {
    const inputPath = path.resolve("./assets/test/json/input/RSA_TO_RM_TEST.json");
    const middleOutputDir = path.resolve("./assets/test/json/output/pvme-middle-conversion");
    const rsaToRmOutputDir = path.resolve("./assets/test/json/output/rsa-to-rm");

    const raw = fs.readFileSync(inputPath, "utf-8");
    const rsa = JSON.parse(raw) as RsaExport;

    const overlayResult = overlayRsaTimeline(rsa);
    const pvmeMiddleResult = normalizeOverlayToPvme(overlayResult);
    const rmResult = convertPvmeOverlayToRm(rsa.name, pvmeMiddleResult, rmIndex);

    const middleFilePath = writeJsonFile(
        middleOutputDir,
        buildOutputFileName("PVME_MIDDLE"),
        pvmeMiddleResult
    );

    const rsaToRmFilePath = writeJsonFile(
        rsaToRmOutputDir,
        buildOutputFileName("RSA_TO_RM"),
        rmResult
    );

    console.log(`PVME middle conversion output written to: ${middleFilePath}`);
    console.log(`RSA -> RM output written to: ${rsaToRmFilePath}`);
}

function runRmToRsaTest(): void {
    const inputPath = path.resolve("./assets/test/json/input/RM_TO_RSA_TEST.json");
    const rmToRsaOutputDir = path.resolve("./assets/test/json/output/rm-to-rsa");

    const raw = fs.readFileSync(inputPath, "utf-8");
    const rm = JSON.parse(raw) as RmRotationSet;

    const rsaResult = convertRmToTentativeRsa(rm);

    const rmToRsaFilePath = writeJsonFile(
        rmToRsaOutputDir,
        buildOutputFileName("RM_TO_RSA"),
        rsaResult
    );

    console.log(`RM -> RSA output written to: ${rmToRsaFilePath}`);
}

function main(): void {
    const rmAbilities = loadRmAbilities();
    const rmIndex = buildRmAbilityIndex(rmAbilities);

    runRsaToRmTest(rmIndex);
    runRmToRsaTest();
}

main();