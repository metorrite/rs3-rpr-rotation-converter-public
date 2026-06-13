const { ipcRenderer } = require("electron");

const inputFileEl = document.getElementById("inputFile");
const outputFolderEl = document.getElementById("outputFolder");
const browseInputBtn = document.getElementById("browseInputBtn");
const browseOutputBtn = document.getElementById("browseOutputBtn");
const convertBtn = document.getElementById("convertBtn");
const statusEl = document.getElementById("status");

browseInputBtn.addEventListener("click", async () => {
    try {
        const filePath = await ipcRenderer.invoke("browse-input-file");
        if (filePath) {
            inputFileEl.value = filePath;
            statusEl.textContent = `Selected input:\n${filePath}`;
        }
    } catch (error) {
        statusEl.textContent = `Browse input failed:\n${String(error)}`;
    }
});

browseOutputBtn.addEventListener("click", async () => {
    try {
        const folderPath = await ipcRenderer.invoke("browse-output-folder");
        if (folderPath) {
            outputFolderEl.value = folderPath;
            statusEl.textContent = `Selected output folder:\n${folderPath}`;
        }
    } catch (error) {
        statusEl.textContent = `Browse output failed:\n${String(error)}`;
    }
});

convertBtn.addEventListener("click", async () => {
    const inputPath = inputFileEl.value.trim();
    const outputFolder = outputFolderEl.value.trim();

    if (!inputPath) {
        statusEl.textContent = "Please select an input JSON file.";
        return;
    }

    if (!outputFolder) {
        statusEl.textContent = "Please select an output folder.";
        return;
    }

    statusEl.textContent = "Converting...";

    try {
        const response = await ipcRenderer.invoke("convert-rsa-to-rm", inputPath, outputFolder);

        if (response.ok) {
            statusEl.textContent =
                `Conversion complete.\n\nSaved file:\n${response.result.outputPath}`;
        } else {
            statusEl.textContent = `Conversion failed:\n${response.error}`;
        }
    } catch (error) {
        statusEl.textContent = `Conversion failed:\n${String(error)}`;
    }
});