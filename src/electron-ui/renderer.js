"use strict";
const { ipcRenderer } = require("electron");

const $ = (id) => document.getElementById(id);

// ---------- settings ----------
const SETTINGS_KEY = "rs3rot.settings";
let settings = {};
let defaultSettings = {
    rmWeaponAsSpec: true,
    gcdTicks: 3,
    keepNotesInName: false,
    rmPhaseBlocks: true,
};

function loadSettings() {
    try {
        settings = { ...defaultSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
    } catch {
        settings = { ...defaultSettings };
    }
}
function saveSettings() {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
        /* private mode etc. */
    }
    renderSettings();
}
function renderSettings() {
    $("setWeaponSpec").checked = settings.rmWeaponAsSpec;
    $("setGcd").value = settings.gcdTicks;
    $("setKeepNotes").checked = settings.keepNotesInName;
    $("setPhaseBlocks").checked = settings.rmPhaseBlocks;
}

ipcRenderer.invoke("default-settings").then((d) => {
    if (d) defaultSettings = d;
    loadSettings();
    renderSettings();
});
loadSettings();

$("setWeaponSpec").addEventListener("change", (e) => {
    settings.rmWeaponAsSpec = e.target.checked;
    saveSettings();
});
$("setGcd").addEventListener("change", (e) => {
    settings.gcdTicks = Math.min(10, Math.max(1, Number(e.target.value) || 3));
    saveSettings();
});
$("setKeepNotes").addEventListener("change", (e) => {
    settings.keepNotesInName = e.target.checked;
    saveSettings();
});
$("setPhaseBlocks").addEventListener("change", (e) => {
    settings.rmPhaseBlocks = e.target.checked;
    saveSettings();
});
$("resetSettingsBtn").addEventListener("click", () => {
    settings = { ...defaultSettings };
    saveSettings();
    $("settingsStatus").textContent = "Reset to defaults.";
});

// ---------- tabs ----------
for (const tab of document.querySelectorAll(".tab")) {
    tab.addEventListener("click", () => {
        for (const t of document.querySelectorAll(".tab")) t.classList.remove("active");
        for (const p of document.querySelectorAll(".tab-panel")) p.classList.remove("active");
        tab.classList.add("active");
        $(`tab-${tab.dataset.tab}`).classList.add("active");
    });
}

// ---------- convert tab ----------
$("browseInputBtn").addEventListener("click", async () => {
    const p = await ipcRenderer.invoke("browse-input");
    if (p) {
        $("inputFile").value = p;
        $("status").textContent = `Input: ${p}`;
    }
});

$("browseOutputBtn").addEventListener("click", async () => {
    const p = await ipcRenderer.invoke("browse-output");
    if (p) {
        $("outputFolder").value = p;
        $("status").textContent = `Output folder: ${p}`;
    }
});

$("convertBtn").addEventListener("click", async () => {
    const input = $("inputFile").value.trim();
    const outDir = $("outputFolder").value.trim();
    $("report").hidden = true;
    if (!input) return ($("status").textContent = "Choose an input file.");
    if (!outDir) return ($("status").textContent = "Choose an output folder.");

    const from = $("fromFormat").value === "auto" ? null : $("fromFormat").value;
    const to = $("toFormat").value;
    if (from === to) return ($("status").textContent = "Source and target formats must differ.");

    $("status").textContent = "Converting…";
    const res = await ipcRenderer.invoke("convert", input, outDir, from, to, settings);
    if (res.ok) {
        $("status").textContent = `Saved: ${res.outputPath}`;
        $("report").textContent = res.reportText;
        $("report").hidden = false;
    } else {
        $("status").textContent = `Conversion failed: ${res.error}`;
    }
});

// ---------- library tab ----------
let guides = [];

async function loadGuides() {
    guides = await ipcRenderer.invoke("library:list");
    const sel = $("guideSelect");
    sel.innerHTML = "";
    let group = null;
    for (const g of guides) {
        if (g.category !== group) {
            group = g.category;
            const og = document.createElement("optgroup");
            og.label = group;
            sel.appendChild(og);
        }
        const o = document.createElement("option");
        o.value = g.id;
        o.textContent = g.title;
        sel.lastChild.appendChild(o);
    }
    sel.selectedIndex = 0;
    await loadRotations();
}

async function loadRotations() {
    const guideId = $("guideSelect").value;
    const rotSel = $("rotationSelect");
    rotSel.innerHTML = "";
    rotSel.disabled = true;
    $("saveRotationBtn").disabled = true;
    $("libStatus").textContent = "Reading guide…";
    $("libReport").hidden = true;

    const res = await ipcRenderer.invoke("library:rotations", guideId);
    if (!res.ok) {
        $("libStatus").textContent = `Could not read guide: ${res.error}`;
        return;
    }
    if (res.rotations.length === 0) {
        $("libStatus").textContent = "This guide has no detectable rotation.";
        return;
    }
    for (const r of res.rotations) {
        const o = document.createElement("option");
        o.value = String(r.index);
        o.textContent =
            `${r.name}  —  ${r.steps} steps` + (r.unresolved ? `  (${r.unresolved} unresolved)` : "");
        rotSel.appendChild(o);
    }
    rotSel.disabled = false;
    $("saveRotationBtn").disabled = false;
    $("libStatus").textContent = `${res.rotations.length} rotation(s) found.`;
}

$("guideSelect").addEventListener("change", loadRotations);

$("saveRotationBtn").addEventListener("click", async () => {
    const guideId = $("guideSelect").value;
    const index = Number($("rotationSelect").value);
    const format = $("libFormat").value;
    $("libStatus").textContent = "Saving…";
    $("libReport").hidden = true;

    const res = await ipcRenderer.invoke("library:save", guideId, index, format, settings);
    if (res.ok) {
        $("libStatus").textContent = `Saved: ${res.savedPath}`;
        $("libReport").textContent = res.reportText;
        $("libReport").hidden = false;
    } else if (res.error !== "cancelled") {
        $("libStatus").textContent = `Save failed: ${res.error}`;
    } else {
        $("libStatus").textContent = "";
    }
});

// ---------- footer ----------
ipcRenderer.invoke("catalog-info").then((m) => {
    if (m && m.rotationMaster) {
        $("dataVersion").textContent =
            `Ability data: RotationMaster ${m.rotationMaster.rmVersion ?? "?"} — ` +
            `${m.abilityCount ?? "?"} abilities (${(m.rotationMaster.commit ?? "").slice(0, 7)})`;
    }
});

loadGuides().catch((e) => ($("libStatus").textContent = `Failed to load guides: ${e.message}`));
