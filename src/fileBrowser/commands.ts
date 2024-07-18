import * as OS from "os";
import * as PathLib from "path";
import { Consult } from "../consult";
import { EnumContext, setContext } from "../utils/context";
import { FileBrowser, genItemsForCurDir, OnAcceptItem, onChangeValue, selectShowableItems, setItemVisibility } from "./fileBrowser";


export const fileBrowser = new FileBrowser();


export function showFileBrowser() {
    setContext(new Map([
        [EnumContext.inConsultFileBrowser, true],
        [EnumContext.consultFileBrowserEmpty, true],
    ]));

    fileBrowser.createQuickPick({
        itemGenerator: genItemsForCurDir,
        itemModifiers: [
            setItemVisibility
        ],
        itemSelectors: [
            selectShowableItems
        ],
        onChangeValue: [
            onChangeValue
        ],
        onAcceptItems: [
            OnAcceptItem
        ],
        onHide: [
            () => {
                setContext(new Map([
                    [EnumContext.inConsultFileBrowser, false],
                    [EnumContext.consultFileBrowserEmpty, true],
                ]));
            }
        ]
    });
}


export function goUpDir() {
    fileBrowser.curDir = PathLib.dirname(fileBrowser.curDir!);
    fileBrowser.update({
        itemGenerator: genItemsForCurDir,
        itemModifiers: [
            setItemVisibility
        ],
        itemSelectors: [
            selectShowableItems
        ]
    });
}


export function toggleHidden() {
    Consult.hideDotFiles = !Consult.hideDotFiles;
    fileBrowser.update({
        itemModifiers: [
            setItemVisibility
        ],
        itemSelectors: [
            selectShowableItems
        ]
    });
}


export function toggleFilter() {
    Consult.filterFiles = !Consult.filterFiles;
    fileBrowser.update({
        itemModifiers: [
            setItemVisibility
        ],
        itemSelectors: [
            selectShowableItems
        ]
    });
}


export function goToHome() {
    fileBrowser.curDir = OS.homedir();
    fileBrowser.update({
        itemGenerator: genItemsForCurDir,
        itemModifiers: [
            setItemVisibility
        ],
        itemSelectors: [
            selectShowableItems
        ]
    });
}


export function goToRoot() {
    fileBrowser.curDir = "/";
    fileBrowser.update({
        itemGenerator: genItemsForCurDir,
        itemModifiers: [
            setItemVisibility
        ],
        itemSelectors: [
            selectShowableItems
        ]
    });
}