import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { convertRsaFileToRm } from "../core/convertRsaFile.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

function getRendererPath(): string {
    // dist/electron/main.js -> go up to app root, then into src/electron-ui
    return path.resolve(__dirname, "../../src/electron-ui/index.html");
}

function createWindow(): void {
    mainWindow = new BrowserWindow({
        width: 760,
        height: 460,
        resizable: false,
        backgroundColor: "#111827",
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            sandbox: false
        }
    });

    const rendererPath = getRendererPath();
    console.log("Loading renderer from:", rendererPath);

    mainWindow.loadFile(rendererPath);

    mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
        console.error("Renderer failed to load:", {
            errorCode,
            errorDescription,
            validatedURL
        });
    });

    mainWindow.webContents.on("did-finish-load", () => {
        console.log("Renderer finished loading");
    });

    // Uncomment this while debugging packaged builds
    // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();

    ipcMain.handle("browse-input-file", async () => {
        const result = await dialog.showOpenDialog({
            title: "Select RSAnalysis JSON export",
            properties: ["openFile"],
            filters: [{ name: "JSON Files", extensions: ["json"] }]
        });

        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }

        return result.filePaths[0];
    });

    ipcMain.handle("browse-output-folder", async () => {
        const result = await dialog.showOpenDialog({
            title: "Select output folder",
            properties: ["openDirectory", "createDirectory"]
        });

        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }

        return result.filePaths[0];
    });

    ipcMain.handle("convert-rsa-to-rm", async (_event, inputPath: string, outputFolder: string) => {
        try {
            return {
                ok: true,
                result: convertRsaFileToRm(inputPath, outputFolder)
            };
        } catch (error) {
            console.error("Conversion failed:", error);
            return {
                ok: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    });

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});