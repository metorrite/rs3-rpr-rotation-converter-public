// PVME guide (.txt) -> extracted rotations.
//
// PVME guides are a custom editor format: markdown-ish headings, `.tag:` anchors,
// `.img:` lines, `{ … } .embed:json` blocks, `⬥ • ⬩` prose bullets, and — the part
// we want — rotation lines built from <:name:ID> emoji tokens joined by → + /.
//
// This module splits a guide into sections, finds the rotation lines, groups the
// sections into distinct rotations (T90 vs T95, Top Path vs Bottom Path, …), and
// hands each rotation's text to parsePvme().

import type { Catalog } from "../core/catalog.js";
import type { SequenceIR } from "../core/ir.js";
import { ConversionReport } from "../core/report.js";
import { parsePvme } from "./pvme.js";

const EMOJI = /<?:[a-zA-Z0-9_]+:\d*>?/g;
const INVISIBLE = /[​‌‍⁠﻿‎‏]/g;
const NBSP = / /g;

// ---------------------------------------------------------------------------
// document model
// ---------------------------------------------------------------------------

export interface GuideSection {
    level: number; // 1 | 2 | 3
    title: string;
    tag?: string;
    lines: string[];
}

export interface GuideDocument {
    title: string;
    sections: GuideSection[];
}

function cleanHeading(raw: string): string {
    return raw
        .replace(/^#+\s*/, "")
        .replace(/__/g, "")
        .replace(EMOJI, "")
        .replace(/[*`]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

export function parseGuideDocument(text: string): GuideDocument {
    const lines = text.split(/\r?\n/);
    const sections: GuideSection[] = [{ level: 0, title: "", lines: [] }];
    let braceDepth = 0;

    for (const raw of lines) {
        const line = raw.replace(NBSP, " ").replace(INVISIBLE, "");
        const trimmed = line.trim();
        const current = sections[sections.length - 1]!;

        if (braceDepth > 0) {
            braceDepth +=
                (trimmed.match(/\{/g)?.length ?? 0) - (trimmed.match(/\}/g)?.length ?? 0);
            continue;
        }
        if (/^\{\s*$/.test(trimmed)) {
            braceDepth = 1;
            continue;
        }
        if (trimmed === "." || trimmed === "") continue;
        if (/^\.(img|pin|embed|tag):/.test(trimmed)) {
            if (trimmed.startsWith(".tag:")) current.tag = trimmed.slice(5).trim();
            continue;
        }
        const h = trimmed.match(/^(#{1,3})\s+(.*)$/);
        if (h) {
            sections.push({ level: h[1]!.length, title: cleanHeading(h[2]!), lines: [] });
            continue;
        }
        current.lines.push(line);
    }

    return {
        title:
            sections.find((s) => s.level === 1)?.title ||
            sections[1]?.title ||
            "Rotation",
        sections: sections.filter((s) => s.level > 0),
    };
}

// ---------------------------------------------------------------------------
// rotation-line detection
// ---------------------------------------------------------------------------

const PROSE_LEAD = /^(optimal|use|keep|bring|apply|note|if\b|when\b|for\b|you\b|the\b|this\b|after\b|before\b|during\b|once\b|avoid|ensure|make sure|recommended|do not|don't)/i;
const STAT_LINE = /(per hour|\/km|~\?|xp\/|kills\/|k hp|kills per|approx\.|recommended abilities)/i;
const BULLET = /^[\s]*[⬥⬦◦•⬩⬖▸▪·‣-]+\s*/;

/** Rotation lines are dense tick sequences; some guides prefix them with a bullet. */
export function isRotationLine(line: string): boolean {
    const t = line.replace(BULLET, "").trim();
    if (!t) return false;
    if (STAT_LINE.test(t)) return false;

    const tokens = t.match(EMOJI) ?? [];
    const words = t
        .replace(EMOJI, "")
        .replace(/[→+/()*~:]/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    const hasArrow = /→/.test(t);

    // dense sequence with arrows -> a rotation even if it has a prose lead-in
    if (hasArrow && tokens.length >= 3 && words.length <= tokens.length * 2 + 4) return true;

    if (tokens.length < 2) {
        return /^(\(tc\)|s<:|r<:)/.test(t) && /→|\+/.test(t);
    }
    if (!hasArrow) return false;
    if (PROSE_LEAD.test(t)) return false;
    return words.length <= tokens.length + 4;
}

// ---------------------------------------------------------------------------
// grouping
// ---------------------------------------------------------------------------

type Role = "variant" | "section" | "shared" | "container";

function headerRole(title: string): Role {
    const t = title.toLowerCase();
    if (/\b(all paths|shared|any path|every path|all styles)\b/.test(t)) return "shared";
    if (/^(rotations?|the fight|dps|rotation overview|kill|openers?)$/.test(t)) return "container";
    if (
        /\bt\d{2,3}\b/.test(t) ||
        /\b(nm|hm|hardmode|normal mode|story mode|entry mode|duo|trio|solo|\dman|\d-?s|group)\b/.test(t) ||
        /\b(magic|mage|ranged|range|melee|necromancy|necro|hybrid)\b/.test(t) ||
        /\b(top|middle|bottom|left|right|north|south|east|west)\s+(path|lane|side)\b/.test(t) ||
        /\brotation\b/.test(t) ||
        /\b(equilibrium|eof|zerk|berserk|glacor)\b/.test(t)
    ) {
        return "variant";
    }
    return "section";
}

export interface ExtractedRotation {
    name: string;
    sectionPath: string[];
    source: string;
    sequence: SequenceIR;
    report: ConversionReport;
}

interface Group {
    name: string;
    path: string[];
    parentH2: string;
    blocks: string[];
}

export function extractRotations(text: string, catalog: Catalog): ExtractedRotation[] {
    const doc = parseGuideDocument(text);
    const groups: Group[] = [];
    let currentGroup: Group | null = null;
    let h2 = doc.title;
    const shared: { parentH2: string; blocks: string[] }[] = [];

    for (const section of doc.sections) {
        if (section.level === 2) h2 = section.title;

        const rotLines = section.lines
            .filter(isRotationLine)
            .map((l) => l.replace(BULLET, "").trim());
        const role = headerRole(section.title);

        if (role === "shared") {
            if (rotLines.length) shared.push({ parentH2: h2, blocks: rotLines });
            continue;
        }
        if (rotLines.length === 0 && role !== "variant") continue;

        const startNew =
            role === "variant" || currentGroup === null || (section.level === 2 && role !== "section");

        if (startNew && (rotLines.length > 0 || role === "variant")) {
            currentGroup = {
                name: section.title || h2 || doc.title,
                path: section.level === 3 ? [h2, section.title] : [section.title],
                parentH2: h2,
                blocks: [],
            };
            groups.push(currentGroup);
        }
        if (currentGroup && rotLines.length) {
            currentGroup.blocks.push(rotLines.join("\n"));
        }
    }

    for (const s of shared) {
        const targets = groups.filter((g) => g.parentH2 === s.parentH2);
        for (const g of targets.length ? targets : groups) g.blocks.push(s.blocks.join("\n"));
    }

    // merge consecutive groups that ended up with the same name (over-split phases)
    const merged: Group[] = [];
    for (const g of groups) {
        const prev = merged[merged.length - 1];
        if (prev && prev.name === g.name && prev.parentH2 === g.parentH2) {
            prev.blocks.push(...g.blocks);
        } else {
            merged.push(g);
        }
    }

    return merged
        .filter((g) => g.blocks.length > 0)
        .map((g) => {
            const source = g.blocks.join("\n");
            const report = new ConversionReport("pvme", "pvme");
            const sequence = parsePvme(source, catalog, report);
            sequence.name = dedupeName(doc.title, g.name);
            return { name: sequence.name, sectionPath: g.path, source, sequence, report };
        });
}

function dedupeName(guideTitle: string, groupName: string): string {
    const g = groupName.trim();
    if (!g || g.toLowerCase() === guideTitle.toLowerCase()) return guideTitle;
    return `${guideTitle} — ${g}`;
}
