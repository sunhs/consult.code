import { genItems, OnAcceptItem, onChangeValue, RecentF } from "./recentf";


export const recentf = new RecentF();


export function showRecentFiles() {
    recentf.createQuickPick({
        itemGenerator: genItems,
        itemSelectors: [],
        onChangeValue: [
            onChangeValue
        ],
        onAcceptItems: [
            OnAcceptItem
        ],
    });
}
