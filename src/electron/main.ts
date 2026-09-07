import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { convert, loadCatalog, type FormatId } from "../core/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

function rendererPath(): string {
    // dist/electron/main.js -> repo/src/electron-ui/index.html
    return path.resolve(__dirname, "../../src/electron-ui/index.html");
}

function createWindow(): void {
    mainWindow = new BrowserWindow({
        width: 820,
        height: 620,
        backgroundColor: "#111827",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });
    void mainWindow.loadFile(rendererPath());
}

app.whenReady().then(() => {
    createWindow();

    ipcMain.handle("catalog-info", () => loadCatalog().manifest);

    ipcMain.handle("browse-input", async () => {
        const r = await dialog.showOpenDialog({
            title: "Select a rotation file",
            properties: ["openFile"],
            filters: [
                { name: "Rotation files", extensions: ["json", "txt"] },
                { name: "All files", extensions: ["*"] },
            ],
        });
        return r.canceled ? null : (r.filePaths[0] ?? null);
    });

    ipcMain.handle("browse-output", async () => {
        const r = await dialog.showOpenDialog({
            title: "Select an output folder",
            properties: ["openDirectory", "createDirectory"],
        });
        return r.canceled ? null : (r.filePaths[0] ?? null);
    });

    ipcMain.handle(
        "convert",
        (_e, inputPath: string, outputDir: string, from: FormatId, to: FormatId) => {
            try {
                const raw = readFileSync(inputPath, "utf8");
                const input: unknown =
                    path.extname(inputPath).toLowerCase() === ".txt"
                        ? raw
                        : JSON.parse(raw);
                const result = convert(input, { from, to });

                const base = path.basename(inputPath, path.extname(inputPath));
                const ext = result.to === "pvme" ? "txt" : "json";
                const outputPath = path.join(
                    outputDir,
                    `${base} - (${result.to.toUpperCase()}_converted).${ext}`,
                );
                const body =
                    typeof result.output === "string"
                        ? result.output
                        : JSON.stringify(result.output, null, 2);
                writeFileSync(outputPath, body, "utf8");

                return {
                    ok: true as const,
                    outputPath,
                    report: result.report.entries,
                    reportText: result.report.format(),
                };
            } catch (error) {
                return {
                    ok: false as const,
                    error: error instanceof Error ? error.message : String(error),
                };
            }
        },
    );

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
