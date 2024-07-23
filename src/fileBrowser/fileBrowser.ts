import * as micromatch from "micromatch";
import * as OS from "os";
import * as PathLib from "path";
import { commands, Uri, window, workspace } from "vscode";
import { Consult } from "../consult";
import { getConfigFilterGlobPatterns } from "../utils/conf";
import { EnumContext, setContext } from "../utils/context";
import * as fsutils from "../utils/fs";
import { FilePathItem } from "./item";


export class FileBrowser extends Consult<FilePathItem> { }


export async function genItemsForCurDir(this: FileBrowser) {
    if (!this.curDir) {
        let document = window.activeTextEditor?.document;
        if (document && !document.isUntitled) {
            this.curDir = PathLib.dirname(document.uri.path);
        } else {
            this.curDir = OS.homedir();
        }
    }

    if (!(PathLib.isAbsolute(this.curDir) && await fsutils.isDir(this.curDir))) {
        window.showErrorMessage(`${this.curDir} is not an absolute path to a directory`);
        this.quickPick!.hide();
    }

    this.quickPick!.title = this.curDir;

    let uri = Uri.file(this.curDir);
    let files = await workspace.fs.readDirectory(uri);
    let items = files.sort(
        ([fileName1, fileType1], [fileName2, fileType2]) => {
            if (
                (fsutils.isDirType(fileType1) && fsutils.isDirType(fileType2))
                || (!fsutils.isDirType(fileType1) && !fsutils.isDirType(fileType2))
            ) {
                if (
                    (fileName1.startsWith(".") && fileName2.startsWith("."))
                    || (!fileName1.startsWith(".") && !fileName2.startsWith("."))
                ) {
                    return fileName1 <= fileName2 ? -1 : 1;
                } else {
                    return fileName1.startsWith(".") ? -1 : 1;
                }
            } else {
                return fsutils.isDirType(fileType1) ? -1 : 1;
            }
        }
    ).map(
        ([fileName, fileType]) =>
            new FilePathItem(PathLib.join(this.curDir!, fileName), fileType)
    );

    return items;
}


export function setItemVisibility(this: FileBrowser, onlyDir: boolean = false, onlyFile: boolean = false) {
    return this.items.map(
        (filePathItem) => {
            let baseName = PathLib.basename(filePathItem.absPath);

            if (Consult.hideDotFiles && baseName.startsWith(".")) {
                filePathItem.show = false;
                return filePathItem;
            }

            if (Consult.filterFiles) {
                for (let pattern of getConfigFilterGlobPatterns()) {
                    if (micromatch.isMatch(baseName, pattern)) {
                        filePathItem.show = false;
                        return filePathItem;
                    }
                }
            }

            if (onlyDir && !fsutils.isDirType(filePathItem.fileType)) {
                filePathItem.show = false;
                return filePathItem;
            }

            if (onlyFile && fsutils.isDirType(filePathItem.fileType)) {
                filePathItem.show = false;
                return filePathItem;
            }

            filePathItem.show = true;
            return filePathItem;
        }
    );
}


export function selectShowableItems(this: FileBrowser) {
    return this.items.filter(item => item.show);
}


export function onChangeValue(this: FileBrowser, oldValue: string, newValue: string) {
    setContext(new Map([
        [EnumContext.consultFileBrowserEmpty, newValue === ""],
    ]));

    oldValue = oldValue.trim().toLowerCase();
    newValue = newValue.trim().toLowerCase();

    if (newValue === oldValue)
        return;

    if (newValue === "") {
        this.update({
            itemSelectors: [selectShowableItems],
        });
        // } else if (new RegExp(`^`).test(newValue)) {
        //     let incPattern = newValue.substring(oldValue.length).split(new RegExp("\\s+")).join(".*");
        //     let regex = new RegExp(incPattern);
        //     this.update({
        //         itemSelectors: [
        //             () => this.quickPick!.items.filter(
        //                 (item: FilePathItem) => regex.test(item.label)
        //             )
        //         ],
        //     });
    } else {
        let pattern = newValue.split(new RegExp("\\s+")).join(".*");
        let regex = new RegExp(pattern);
        this.update({
            itemSelectors: [
                selectShowableItems,
                () => this.quickPick!.items.filter(
                    (item: FilePathItem) => regex.test(item.label.toLowerCase())
                ),
            ],
        });
    }
}


export function OnAcceptItem(this: FileBrowser) {
    let item = this.quickPick!.selectedItems[0] as FilePathItem;
    let acceptedPath = item.absPath!;
    workspace.fs.stat(Uri.file(acceptedPath)).then(
        (stat) => {
            if (fsutils.isDirType(stat.type)) {
                this.curDir = acceptedPath;
                this.update({
                    itemGenerator: genItemsForCurDir,
                    itemModifiers: [setItemVisibility],
                    itemSelectors: [selectShowableItems],
                });
                this.quickPick!.value = "";
            } else {
                commands.executeCommand("vscode.open", Uri.file(acceptedPath));
                this.quickPick!.hide();
            }
        }
    );
}