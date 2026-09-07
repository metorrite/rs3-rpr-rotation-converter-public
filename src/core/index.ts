// Public API for the conversion engine. Pure — no filesystem walking beyond
// reading the vendored data files, no Electron, no network.

export { convert, detectFormat } from "./convert.js";
export type { ConvertOptions, ConvertResult, FormatId } from "./convert.js";
export { loadCatalog, makeCatalog, Catalog } from "./catalog.js";
export type { CatalogEntry, AssetsManifest } from "./catalog.js";
export { ConversionReport } from "./report.js";
export type { ReportEntry } from "./report.js";
export * as ir from "./ir.js";
export { ALIASES } from "./aliases.js";
export { WEAPON_SPEC_RULES } from "./weapon-specs.js";
