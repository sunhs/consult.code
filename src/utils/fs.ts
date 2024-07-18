import { FileType, Uri, workspace } from "vscode";


export async function isDir(filePath: string): Promise<boolean> {
    let stat = await workspace.fs.stat(Uri.file(filePath));
    return isDirType(stat.type);
}


export function isDirType(fileType: FileType): boolean {
    return (fileType & FileType.Directory) === FileType.Directory;
}