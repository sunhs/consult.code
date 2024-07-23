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
        // When preview, in order not to mess up recentf list, the preview should not be in an active editor group.
        // Thus, we use `ViewColumn.Beside` to put it in the column currently not activated, and preserve the focus.
        // However, `ViewColumn.Beside` doesn't necessarily create a new column, so `Grep.previewCreated` will record the situation.
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