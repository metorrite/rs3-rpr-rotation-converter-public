export {};

type FormatId = "rsa" | "rm" | "pvme";

interface ConvertOk {
    ok: true;
    outputPath: string;
    report: { code: string; message: string; name?: string; at?: number }[];
    reportText: string;
}
interface ConvertErr {
    ok: false;
    error: string;
}

declare global {
    interface Window {
        converterApi: {
            browseInput: () => Promise<string | null>;
            browseOutput: () => Promise<string | null>;
            catalogInfo: () => Promise<{
                repo: string;
                commit: string;
                rmVersion: string | null;
                abilityCount: number | null;
            } | null>;
            convert: (
                inputPath: string,
                outputDir: string,
                from: FormatId,
                to: FormatId,
            ) => Promise<ConvertOk | ConvertErr>;
        };
    }
}
