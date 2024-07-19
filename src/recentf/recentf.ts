import { commands, FileType, Uri } from "vscode";
import { Consult } from "../consult";
import { FilePathItem } from "../fileBrowser/item";
import { recentFileCache } from "../utils/cache";
import { EnumContext, setContext } from "../utils/context";


export class RecentF extends Consult<FilePathItem> { }


export async function genItems(this: RecentF) {
    return recentFileCache.files.arr.reverse().map(
        (filepath) => new FilePathItem(filepath, FileType.File)
    );
}


export function onChangeValue(this: RecentF, oldValue: string, newValue: string) {
    setContext(new Map([
        [EnumContext.consultFileBrowserEmpty, newValue === ""],
    ]));

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
                    (item: FilePathItem) => regex.test(item.label.toLowerCase())
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