import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import {
    convert,
    guideRotations,
    libraryRotationFile,
    listGuides,
    loadCatalog,
    type FormatId,
} from "../core/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

function rendererPath(): string {
    // dist/electron/main.js -> repo/src/electron-ui/index.html
    return path.resolve(__dirname, "../../src/electron-ui/index.html");
}

function createWindow(): void {
    mainWindow = new BrowserWindow({
        width: 860,
        height: 720,
        backgroundColor: "#111827",
        webPreferences: {
            // Local single-user tool loading only a bundled file with no remote
            // content — Node integration in the renderer keeps the IPC wiring
            // simple and avoids the ESM-preload footgun.
            nodeIntegration: true,
            contextIsolation: false,
        },
    });
    void mainWindow.loadFile(rendererPath());
}

app.whenReady().then(() => {
    createWindow();

    ipcMain.handle("catalog-info", () => loadCatalog().manifest);

    // ---- Convert tab -----------------------------------------------------

    ipcMain.handle("browse-input", async () => {
        const r = await dialog.showOpenDialog(mainWindow ?? undefined!, {
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
        const r = await dialog.showOpenDialog(mainWindow ?? undefined!, {
            title: "Select an output folder",
            properties: ["openDirectory", "createDirectory"],
        });
        return r.canceled ? null : (r.filePaths[0] ?? null);
    });

    ipcMain.handle(
        "convert",
        (_e, inputPath: string, outputDir: string, from: FormatId | null, to: FormatId) => {
            try {
                const raw = readFileSync(inputPath, "utf8");
                const input: unknown =
                    path.extname(inputPath).toLowerCase() === ".txt" ? raw : JSON.parse(raw);
                const result = convert(input, { from: from ?? undefined, to });

                const base = path.basename(inputPath, path.extname(inputPath));
                const ext = result.to === "pvme" ? "txt" : "json";
                const outputPath = path.join(
                    outputDir,
                    `${base} - (${result.to.toUpperCase()}_converted).${ext}`,
                );
                writeFileSync(
                    outputPath,
                    typeof result.output === "string"
                        ? result.output
                        : JSON.stringify(result.output, null, 2),
                    "utf8",
                );
                return {
                    ok: true as const,
                    outputPath,
                    reportText: result.report.format(),
                };
            } catch (error) {
                return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
            }
        },
    );

    // ---- Rotation library tab ------------------------------------------

    ipcMain.handle("library:list", () => listGuides());

    ipcMain.handle("library:rotations", (_e, guideId: string) => {
        try {
            return { ok: true as const, rotations: guideRotations(guideId) };
        } catch (error) {
            return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle(
        "library:save",
        async (_e, guideId: string, index: number, format: FormatId) => {
            try {
                const file = libraryRotationFile(guideId, index, format);
                const r = await dialog.showSaveDialog(mainWindow ?? undefined!, {
                    title: "Save rotation",
                    defaultPath: file.fileName,
                });
                if (r.canceled || !r.filePath) return { ok: false as const, error: "cancelled" };
                writeFileSync(r.filePath, file.body, "utf8");
                return { ok: true as const, savedPath: r.filePath, reportText: file.reportText };
            } catch (error) {
                return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
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
