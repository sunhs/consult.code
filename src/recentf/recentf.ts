import { commands, FileType, Uri, window } from "vscode";
import { Consult } from "../consult";
import { FilePathItem } from "../fileBrowser/item";
import { recentFileCache } from "../utils/cache";


export class RecentF extends Consult<FilePathItem> { }


export async function genItems(this: RecentF) {
    let items: FilePathItem[] = [];
    let compareActiveDoc = true;
    let doc = window.activeTextEditor?.document;
    if (doc === undefined || doc.isUntitled) {
        compareActiveDoc = false;
    }

    recentFileCache.files.arr.slice().reverse().map(
        (filepath) => {
            if (compareActiveDoc && doc!.uri.fsPath === filepath) {
                compareActiveDoc = false;
                return;
            }
            items.push(new FilePathItem(filepath, FileType.File, true));
        }
    );

    return items;
}


export function onChangeValue(this: RecentF, oldValue: string, newValue: string) {
    oldValue = oldValue.trim().toLowerCase();
    newValue = newValue.trim().toLowerCase();

    if (newValue === oldValue)
        return;

    if (newValue === "") {
        this.update({
            itemSelectors: [],
        });
    } else {
        let pattern = newValue.split(new RegExp("\\s+")).join(".*");
        let regex = new RegExp(pattern);
        this.update({
            itemSelectors: [
                () => this.items.filter(
                    (item: FilePathItem) => regex.test(item.absPath.toLowerCase())
                ),
            ],
        });
    }
}


export function OnAcceptItem(this: RecentF) {
    let item = this.quickPick!.selectedItems[0] as FilePathItem;
    let acceptedPath = item.absPath!;
    commands.executeCommand("vscode.open", Uri.file(acceptedPath));
    this.quickPick!.hide();
}