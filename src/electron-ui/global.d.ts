export {};

declare global {
    interface Window {
        converterApi: {
            browseInputFile: () => Promise<string | null>;
            browseOutputFolder: () => Promise<string | null>;
            convertRsaToRm: (
                inputPath: string,
                outputFolder: string
            ) => Promise<
                | { ok: true; result: { outputPath: string; outputFileName: string } }
                | { ok: false; error: string }
            >;
        };
    }
}