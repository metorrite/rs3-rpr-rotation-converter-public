// Public API for the conversion engine. Pure — no filesystem walking beyond
// reading the vendored data files, no Electron, no network.

export { convert, convertGuide, detectFormat } from "./convert.js";
export type { ConvertOptions, ConvertResult, FormatId, GuideRotationResult } from "./convert.js";
export { extractRotations, parseGuideDocument, isRotationLine } from "../adapters/pvme-guide.js";
export type { ExtractedRotation, GuideDocument, GuideSection } from "../adapters/pvme-guide.js";
export { listGuides, guideRotations, libraryRotationFile } from "./guides.js";
export type { GuideSummary, LibraryRotation } from "./guides.js";
export { loadCatalog, makeCatalog, Catalog } from "./catalog.js";
export type { CatalogEntry, AssetsManifest } from "./catalog.js";
export { ConversionReport } from "./report.js";
export type { ReportEntry } from "./report.js";
export * as ir from "./ir.js";
export { ALIASES } from "./aliases.js";
export { WEAPON_SPEC_RULES } from "./weapon-specs.js";
