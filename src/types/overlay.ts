export type SourceBody = "A" | "E";

export interface OverlayAction {
    tick: number;
    rawName: string;
    title?: string;
    itemType: string;
    sameTick: boolean;
    delayFromAnchor: number;
    sourceBody: SourceBody;
}

export interface OverlayAnchor {
    tick: number;
    anchor: string;
    sourceBody: "A";
    sameTickOverlays: OverlayAction[];
    delayedOverlays: OverlayAction[];
}