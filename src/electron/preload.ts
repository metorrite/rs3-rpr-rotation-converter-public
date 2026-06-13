import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("converterApi", {
    browseInputFile: () => ipcRenderer.invoke("browse-input-file"),
    browseOutputFolder: () => ipcRenderer.invoke("browse-output-folder"),
    convertRsaToRm: (inputPath: string, outputFolder: string) =>
        ipcRenderer.invoke("convert-rsa-to-rm", inputPath, outputFolder)
});