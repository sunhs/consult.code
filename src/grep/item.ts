import * as OS from "os";
import { QuickPickItem, Selection, Uri, ViewColumn, window } from "vscode";


export class GrepItem implements QuickPickItem {
    label: string;
    detail: string;
    alwaysShow = true;

    filePath: string;
    lineNum: number;
    colNum: number;

    constructor(filePath: string, relFilePath: string, lineNumber: number, colNumber: number, lineContent: string) {
        this.label = lineContent;
        this.detail = `${relFilePath}:${lineNumber}:${colNumber}`.replace(OS.homedir(), "~");

        this.filePath = filePath;
        this.lineNum = lineNumber - 1;
        this.colNum = colNumber - 1;
    }

    async open(preview: boolean = false) {
        return await window.showTextDocument(
            Uri.file(this.filePath),
            {
                selection: new Selection(this.lineNum, this.colNum, this.lineNum, this.colNum),
                preview: preview,
                preserveFocus: preview,
                viewColumn: preview ? ViewColumn.Beside : ViewColumn.Active
            }
        );
    }
}