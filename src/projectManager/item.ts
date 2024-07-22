import * as fg from "fast-glob";
import * as OS from "os";
import * as PathLib from "path";
import { QuickPickItem, Uri, window, workspace } from "vscode";
import { projectCache } from "../utils/cache";
import { FixSizedMap } from "../utils/datastructs";


export class ProjectItem implements QuickPickItem {
    label: string;
    description: string;
    alwaysShow = true;

    absProjectRoot: string;

    constructor(projectRoot: string) {
        this.label = PathLib.basename(projectRoot);
        this.description = projectRoot.replace(OS.homedir(), "~");
        this.absProjectRoot = projectRoot;
    }

    async getFileItems(excludeGlobPattern: string, filepathToProjectFileItem: FixSizedMap<string, ProjectFileItem>) {
        if (!this.absProjectRoot.endsWith("/")) {
            this.absProjectRoot = this.absProjectRoot + "/";
        }
        let includeGlobPattern = `${this.absProjectRoot}**`;

        return await fg(includeGlobPattern, { ignore: [excludeGlobPattern], onlyFiles: true }).then(
            (filepaths) => {
                if (filepaths.length === 0) {
                    return undefined;
                }

                let fileItems: ProjectFileItem[] = [];

                filepaths.forEach(
                    (filePath) => {
                        let document = window.activeTextEditor?.document;
                        if (document && document.uri.path === filePath) {
                            return;
                        }

                        if (filepathToProjectFileItem.has(filePath)) {
                            let fileItem = filepathToProjectFileItem.get(filePath)!;
                            fileItem.projectRoots.add(this.absProjectRoot);
                            fileItems.push(fileItem);
                        } else {
                            let fileItem = new ProjectFileItem(this.absProjectRoot, filePath);
                            filepathToProjectFileItem.set(filePath, fileItem);
                            fileItems.push(fileItem);
                        }
                    }
                );

                if (projectCache.projectFileWeightedCache.get(this.label)) {
                    fileItems.sort((item1, item2) => {
                        let weightedCache = projectCache.projectFileWeightedCache.get(this.label)!;
                        let rank1 = weightedCache.getWeight(item1.absPath);
                        let rank2 = weightedCache.getWeight(item2.absPath);
                        // the one with bigger rank is placed before the other
                        // return negative if item1 should be placed before item2
                        return rank2 - rank1;
                    });
                }

                return fileItems;
            }
        );
    }

    intoWorkspace(): boolean {
        let existedFolder = workspace.getWorkspaceFolder(Uri.file(this.absProjectRoot));
        if (!existedFolder || existedFolder.uri.path !== this.absProjectRoot) {
            let status = workspace.updateWorkspaceFolders(
                workspace.workspaceFolders ? workspace.workspaceFolders.length : 0,
                null,
                {
                    uri: Uri.file(this.absProjectRoot),
                    name: this.label
                }
            );
            if (status === false) {
                window.showErrorMessage(`fail to add ${this.absProjectRoot} to workspace`);
                return false;
            }
        }

        return true;
    }

    removeFromWorkspace() {
        let workspaceFolder = workspace.getWorkspaceFolder(Uri.file(this.absProjectRoot));
        if (workspaceFolder !== undefined) {
            workspace.updateWorkspaceFolders(workspaceFolder.index, 1);
        }
    }
}


export class ProjectFileItem implements QuickPickItem {
    label: string;
    description: string;
    alwaysShow = true;

    absPath: string;
    projectRoots: Set<string> = new Set<string>();  // indicating which projects have this file

    constructor(projectRoot: string, filePath: string) {
        this.label = PathLib.basename(filePath);
        this.absPath = filePath;
        this.projectRoots.add(projectRoot);
        let relPath = filePath.replace(projectRoot, "");
        if (relPath.startsWith("/")) {
            relPath = relPath.substring(1);
        }
        this.description = relPath;
    }
}