import * as fs from "fs";
import * as OS from "os";
import * as PathLib from "path";
import { Md5 } from "ts-md5";
import { commands, Uri, window, workspace } from "vscode";
import { Consult } from "../consult";
import { ConfigFileRootDir, getConfigExcludeAsProject, getConfigFilterGlobPatterns, getConfigProjectDotIgnoreFiles } from "../utils/conf";
import { LruMap } from "../utils/datastructs";
import * as fsUtils from "../utils/fs";
import { getFileItemFromCache, loadRecentHistoryLog, ProjectFileItem, ProjectItem, saveRecentHistorLog, updateRecentHistoryLog } from "./item";


export enum Messages {
    selectProject = "select project",
    selectWorkspaceProject = "select project from workspace",
    deleteWorkspaceProject = "delete project from workspace",
    projectAdded = "project added"
}


export class ProjectManager extends Consult<ProjectItem | ProjectFileItem> {
    projectListFile: string = PathLib.join(ConfigFileRootDir, "projects.json");
    projectListFileLastMTimeMs: number = 0;
    lastProjectListFileHash: string | undefined;
    projects: LruMap<string, string> = new LruMap<string, string>(100);
    recentHistoryLog: string = PathLib.join(ConfigFileRootDir, "rank.json");
    fileConsideredProject: Set<string> = new Set<string>();

    constructor() {
        super();

        if (!fs.existsSync(ConfigFileRootDir)) {
            fs.mkdirSync(ConfigFileRootDir);
        }

        this.readProjectListIfNewer();

        if (!fs.existsSync(this.recentHistoryLog)) {
            fs.writeFileSync(this.recentHistoryLog, "{}");
        }
        loadRecentHistoryLog(this.recentHistoryLog);

        this.registerListener();
    }

    readProjectListIfNewer() {
        if (!fs.existsSync(this.projectListFile)) {
            fs.writeFileSync(this.projectListFile, "{}");
        }

        let stat = fs.statSync(this.projectListFile);
        if (stat.mtimeMs > this.projectListFileLastMTimeMs) {
            let content = fs.readFileSync(this.projectListFile, "utf8");
            let parsed: { [key: string]: string } = JSON.parse(content);
            this.projects.clear();
            // In the list file, entries are listed from newer to older.
            Object.entries(parsed).reverse().forEach(
                ([k, v]) => {
                    this.projects.set(k, v);
                }
            );
            this.projectListFileLastMTimeMs = stat.mtimeMs;
        }
    }


    buildExcludeGlobPattern(projectRoot: string) {
        let extendedPatterns: string[] = [];
        getConfigProjectDotIgnoreFiles().forEach(
            (ignoreFile) => {
                let ignoreFilePath = PathLib.join(projectRoot, ignoreFile);
                if (fs.existsSync(ignoreFilePath)) {
                    String(fs.readFileSync(ignoreFilePath)).split("\n").forEach(
                        (line) => {
                            line = line.trim();
                            if (!line.startsWith("#")) {
                                extendedPatterns.push(line);
                            }
                        }
                    );
                }
            }
        );

        let patternSet: Set<string> = new Set<string>(
            getConfigFilterGlobPatterns().concat(extendedPatterns)
        );

        // `projectRoot` already contains a trailing /
        return `${projectRoot}{${Array.from(patternSet).join(",")}}`
    }

    registerListener() {
        workspace.onDidChangeWorkspaceFolders(
            (e) => {
                if (e.added.length === 0) {
                    return;
                }
                for (let folder of e.added) {
                    this.tryAddProject(folder.uri.path);
                }
            }
        );

        window.onDidChangeVisibleTextEditors(
            (editors) => {
                if (editors.length === 0) {
                    return;
                }

                let editor = window.activeTextEditor!;
                if (editor.document.isUntitled || editor.document.uri.path === this.projectListFile || editor.document.uri.path === this.recentHistoryLog) {
                    return;
                } this.tryAddProject(editor.document.uri.path).then(
                    (projectRoot) => {
                        if (projectRoot) {
                            updateRecentHistoryLog(PathLib.basename(projectRoot!), editor.document.uri.path);
                            saveRecentHistorLog(this.recentHistoryLog);
                        }
                    }
                );
            }
        );

        // let watcher = workspace.createFileSystemWatcher(this.projectListFile, true, false, true);
        // watcher.onDidChange(
        //     (uri) => {
        //         let availableProjects: Set<string> = new Set<string>();
        //         this.projects.forEach(
        //             (_, k) => {
        //                 availableProjects.add(k);
        //             }
        //         );
        //         loadRecentHistoryLog(this.recentHistoryLog, availableProjects);
        //         saveRecentHistorLog(this.recentHistoryLog);
        //     }
        // );
    }

    async tryAddProject(filePath: string): Promise<string | undefined> {
        let projectRoot = await this.tryResolveProjectRoot(filePath);

        if (projectRoot) {
            // No matter whether the projectName already exists, update it.
            // So that the same projectName for different projects won't be occupied by
            // one project permanently.
            this.projects.set(PathLib.basename(projectRoot), projectRoot);
            this.saveProjects();
            return projectRoot;
        }

        console.log(`failed to detect a project for ${filePath}`);
    }

    async tryResolveProjectRoot(filePath: string): Promise<string | undefined> {
        // 1. try file item cache
        let cachedFileItem = getFileItemFromCache(filePath);
        if (cachedFileItem) {
            return cachedFileItem.projectRoots.values().next().value;
        }

        // 2. try workspace folder
        let workspaceFolder = workspace.getWorkspaceFolder(Uri.file(filePath));
        if (workspaceFolder) {
            return workspaceFolder!.uri.path;
        }

        // 3. try saved project list
        for (let projectPath of this.projects.values()) {
            // Avoid the condition where
            // filePath: /path/to/dir_xxx/file
            // projectPath: /path/to/dir
            if (!projectPath.endsWith("/")) {
                projectPath = projectPath + "/";
            }
            if (filePath.startsWith(projectPath)) {
                return projectPath;
            }
        }

        // 4. guess project list
        let isDir = await fsUtils.isDir(filePath);
        let dir = isDir ? filePath : PathLib.dirname(filePath);

        while (true) {
            if (dir === "/" || dir === OS.homedir() || getConfigExcludeAsProject().includes(dir)) {
                break;
            }

            let files = await workspace.fs.readDirectory(Uri.file(dir));
            let fileNames = files.map(([fileName, _]) => fileName);
            let intersection = [...fileNames].filter(
                fileName => this.fileConsideredProject.has(fileName)
            );
            if (intersection.length !== 0) {
                return dir;
            }
            dir = PathLib.dirname(dir);
        }

        return undefined;
    }

    saveProjects() {
        for (let [projName, projPath] of this.projects.entries()) {
            if (!fs.existsSync(projPath) || !PathLib.isAbsolute(projPath)) {
                console.log(`remove project ${projPath}`);
                this.projects.delete(projName);
            }
        }
        let jsonObj: { [key: string]: string } = {};
        this.projects.entries().forEach(
            ([k, v], _) => {
                jsonObj[k] = v;
            }
        );
        let content = JSON.stringify(jsonObj, null, 4);
        let hash = Md5.hashStr(content);
        if (hash !== this.lastProjectListFileHash) {
            fs.writeFileSync(this.projectListFile, content);
        }
    }
}

export function genAllProjectItems(this: ProjectManager) {
    this.quickPick!.title = Messages.selectProject;
    return this.projects.values().map(
        (v, _) => new ProjectItem(v)
    );
}

export function genWSProjectItems(this: ProjectManager) {
    this.quickPick!.title = Messages.selectWorkspaceProject;
    return workspace.workspaceFolders ?
        workspace.workspaceFolders.map(
            (folder, index, arr) => new ProjectItem(folder.uri.path)
        ) : [];
}


export function onAcceptOpenProject(this: ProjectManager) {
    let selected = this.quickPick!.selectedItems[0] as ProjectItem;
    selected.intoWorkspace();
    this.projects.set(selected.label, selected.absProjectRoot);
    this.saveProjects();
    this.quickPick!.hide();
}


export function onAcceptSearchProject(this: ProjectManager) {
    this.update({
        itemGenerator: genProjectFileItemsFromSelectedProject,
        itemSelectors: [],
        onAcceptItems: [
            onAcceptOpenProjectFile
        ]
    });
}


export function onAcceptOpenProjectFile(this: ProjectManager) {
    let selected = this.quickPick!.selectedItems[0] as ProjectFileItem;
    let filePath = selected.absPath;
    commands.executeCommand("vscode.open", Uri.file(filePath));
    this.quickPick!.hide();
}


export async function genProjectFileItemsFromProjectItem(this: ProjectManager, projectItem: ProjectItem) {
    this.projects.set(projectItem.label, projectItem.absProjectRoot);
    this.saveProjects();

    this.quickPick!.title = PathLib.basename(projectItem.label);

    return await projectItem.getFileItems(
        this.buildExcludeGlobPattern(projectItem.absProjectRoot)
    ) || [];
}


export async function genProjectFileItemsFromSelectedProject(this: ProjectManager) {
    let projectItem = this.quickPick!.selectedItems[0] as ProjectItem;
    return genProjectFileItemsFromProjectItem.call(this, projectItem);
}


export function onAcceptDeleteWSProject(this: ProjectManager) {
    let projectItem = this.quickPick!.selectedItems[0] as ProjectItem;
    projectItem.removeFromWorkspace();
    this.quickPick!.hide();
}
