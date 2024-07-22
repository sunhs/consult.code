import * as OS from "os";
import * as PathLib from "path";
import { CancellationError, FileType, QuickPickItem, ThemeIcon, Uri } from "vscode";


export class FilePathItem implements QuickPickItem {
    label: string;
    description?: string;
    iconPath?: Uri | { light: Uri; dark: Uri; } | ThemeIcon | undefined;
    alwaysShow = true;

    absPath: string;
    fileType: FileType;
    show: boolean = true;

    constructor(path: string, fileType: FileType, showFilePath?: boolean) {
        if (!PathLib.isAbsolute(path)) {
            let err = new CancellationError();
            err.message = `path ${path} is not absolute`;
            throw err;
        }

        this.absPath = path;
        this.label = PathLib.basename(path);
        this.fileType = fileType;
        switch (this.fileType) {
            case FileType.Directory:
                this.iconPath = ThemeIcon.Folder;
                break;
            case FileType.Directory | FileType.SymbolicLink:
                this.iconPath = new ThemeIcon("file-symlink-directory");
                break;
            case FileType.File | FileType.SymbolicLink:
                this.iconPath = new ThemeIcon("file-symlink-file");
            default:
                this.iconPath = ThemeIcon.File;
                // this.iconPath = new ThemeIcon("json");
                break;
        }

        if (showFilePath) {
            this.description = this.absPath.replace(OS.homedir(), "~");
        }
    }
}
