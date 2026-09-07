const { converterApi } = window;

const inputFileEl = document.getElementById("inputFile");
const outputFolderEl = document.getElementById("outputFolder");
const fromFormatEl = document.getElementById("fromFormat");
const toFormatEl = document.getElementById("toFormat");
const browseInputBtn = document.getElementById("browseInputBtn");
const browseOutputBtn = document.getElementById("browseOutputBtn");
const convertBtn = document.getElementById("convertBtn");
const statusEl = document.getElementById("status");
const reportEl = document.getElementById("report");
const dataVersionEl = document.getElementById("dataVersion");

browseInputBtn.addEventListener("click", async () => {
    const p = await converterApi.browseInput();
    if (p) {
        inputFileEl.value = p;
        statusEl.textContent = `Input: ${p}`;
    }
});

browseOutputBtn.addEventListener("click", async () => {
    const p = await converterApi.browseOutput();
    if (p) {
        outputFolderEl.value = p;
        statusEl.textContent = `Output folder: ${p}`;
    }
});

convertBtn.addEventListener("click", async () => {
    const input = inputFileEl.value.trim();
    const outDir = outputFolderEl.value.trim();
    reportEl.hidden = true;

    if (!input) return (statusEl.textContent = "Choose an input file.");
    if (!outDir) return (statusEl.textContent = "Choose an output folder.");

    const from = fromFormatEl.value === "auto" ? null : fromFormatEl.value;
    const to = toFormatEl.value;
    if (from === to) return (statusEl.textContent = "Source and target formats must differ.");

    statusEl.textContent = "Converting…";
    const res = await converterApi.convert(input, outDir, from, to);

    if (res.ok) {
        statusEl.textContent = `Saved: ${res.outputPath}`;
        reportEl.textContent = res.reportText;
        reportEl.hidden = false;
    } else {
        statusEl.textContent = `Conversion failed: ${res.error}`;
    }
});

converterApi.catalogInfo().then((m) => {
    if (m) {
        const rm = m.rotationMaster ?? {};
        const commit = (rm.commit ?? "").slice(0, 7);
        dataVersionEl.textContent = `Ability data: RotationMaster ${rm.rmVersion ?? "?"} — ${m.abilityCount ?? "?"} abilities (${commit})`;
    }
});
