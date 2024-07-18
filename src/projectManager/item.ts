import * as fg from "fast-glob";
import * as fs from "fs";
import * as OS from "os";
import * as PathLib from "path";
import { QuickPickItem, Uri, window, workspace } from "vscode";
import { FixSizedMap, WeightedLruCache } from "../utils/datastructs";


const FILE_CACHE_MAX_SIZE = 200;
const LRU_MAX_SIZE = 20;



// Map file path to ProjectFileItem, just to quickly find a ProjectFileItem from its absPath.
let FILE_ITEM_CACHE = new FixSizedMap<string, ProjectFileItem>(FILE_CACHE_MAX_SIZE);
// Map project name to LRU cache of project files.
// The WeightedLruCache is not really an LruCache, as it does nothing on visiting.
let PROJECT_FILE_LRU_CACHE = new Map<string, WeightedLruCache<string>>();


export function getFileItemFromCache(filePath: string): ProjectFileItem | undefined {
    return FILE_ITEM_CACHE.get(filePath);
}


export function loadRecentHistoryLog(logFile: string, availableProjects?: Set<string>) {
    let content = fs.readFileSync(logFile, "utf8");
    let log: { [key: string]: string[] } = JSON.parse(content);
    Object.entries(log).forEach(
        ([projectName, filePaths]) => {
            if (availableProjects! && !availableProjects.has(projectName)) {
                return;
            }

            let cache = new WeightedLruCache<string>(LRU_MAX_SIZE);
            for (let filePath of filePaths) {
                cache.put(filePath);
            }
            PROJECT_FILE_LRU_CACHE.set(projectName, cache);
        }
    );
}


export function saveRecentHistorLog(logFile: string) {
    let jsonObj: { [key: string]: string[] } = {};
    PROJECT_FILE_LRU_CACHE.forEach(
        (cache, projectName) => {
            jsonObj[projectName] = [];
            for (let filePath of cache.getData().keys()) {
                jsonObj[projectName].push(filePath);
            }
        }
    );
    fs.writeFileSync(logFile, JSON.stringify(jsonObj));
}


export function updateRecentHistoryLog(projectName: string, filePath: string) {
    if (!PROJECT_FILE_LRU_CACHE.has(projectName)) {
        PROJECT_FILE_LRU_CACHE.set(projectName, new WeightedLruCache<string>(LRU_MAX_SIZE));
    }
    PROJECT_FILE_LRU_CACHE.get(projectName)!.put(filePath);
}


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

    async getFileItems(excludeGlobPattern: string) {
        // `this.absProjectRoot` already contains a trailing /
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

                        if (FILE_ITEM_CACHE.has(filePath)) {
                            let fileItem = FILE_ITEM_CACHE.get(filePath)!;
                            fileItem.projectRoots.add(this.absProjectRoot);
                            fileItems.push(fileItem);
                        } else {
                            let fileItem = new ProjectFileItem(this.absProjectRoot, filePath);
                            FILE_ITEM_CACHE.set(filePath, fileItem);
                            fileItems.push(fileItem);
                        }
                    }
                );

                if (PROJECT_FILE_LRU_CACHE.get(this.label)) {
                    fileItems.sort(this.compFileItems.bind(this));
                }

                return fileItems;
            }
        );
    }

    // return negative if item1 should be placed before item2
    compFileItems(item1: ProjectFileItem, item2: ProjectFileItem): number {
        let lruCache = PROJECT_FILE_LRU_CACHE.get(this.label)!;
        // the one with bigger rank is placed before the other
        let rank1 = lruCache.get(item1.absPath);
        let rank2 = lruCache.get(item2.absPath);
        return rank2 - rank1;
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
        let relPath = filePath.replace(PathLib.dirname(projectRoot), "");
        if (relPath.startsWith("/")) {
            relPath = relPath.substr(1);
        }
        this.description = relPath;
    }
}