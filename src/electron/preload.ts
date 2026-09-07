import { contextBridge, ipcRenderer } from "electron";

export type FormatId = "rsa" | "rm" | "pvme";

export interface ConvertOk {
    ok: true;
    outputPath: string;
    report: { code: string; message: string; name?: string; at?: number }[];
    reportText: string;
}
export interface ConvertErr {
    ok: false;
    error: string;
}

contextBridge.exposeInMainWorld("converterApi", {
    browseInput: (): Promise<string | null> => ipcRenderer.invoke("browse-input"),
    browseOutput: (): Promise<string | null> => ipcRenderer.invoke("browse-output"),
    catalogInfo: (): Promise<unknown> => ipcRenderer.invoke("catalog-info"),
    convert: (
        inputPath: string,
        outputDir: string,
        from: FormatId,
        to: FormatId,
    ): Promise<ConvertOk | ConvertErr> =>
        ipcRenderer.invoke("convert", inputPath, outputDir, from, to),
});
