export interface RmAbility {
    Title: string;
    Emoji: string;
    EmojiId: string;
    Category: string;
    Src: string;
}

export interface RmAbilitySelection {
    Separator: string;
    SelectedAbility: RmAbility | null;
    Notes: string | null;
}

export interface RmRotation {
    Id: number;
    Name: string;
    Data: RmAbilitySelection[];
    Wave: number | null;
}

export interface RmRotationSet {
    Name: string;
    Data: RmRotation[];
}