export interface RsaExtraEntry {
    type: string;
    value: string;
    title?: string;
    icon?: string;
    slot?: string;
}

export interface RsaData {
    a: string[];
    e: Array<Array<RsaExtraEntry | string>>;
    n?: boolean[];
    t?: string[];
    s?: Record<string, unknown>;
}

export interface RsaExport {
    name: string;
    timestamp?: number;
    data: RsaData;
}