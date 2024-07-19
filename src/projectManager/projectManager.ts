import * as fs from "fs";
import * as OS from "os";
import * as PathLib from "path";
import { commands, Uri, workspace } from "vscode";
import { Consult } from "../consult";
import { projectCache } from "../utils/cache";
import { getConfigExcludeAsProject, getConfigFilterGlobPatterns, getConfigProjectConfFiles, getConfigProjectDotIgnoreFiles } from "../utils/conf";
import { FixSizedMap } from "../utils/datastructs";
import * as fsUtils from "../utils/fs";
import { ProjectFileItem, ProjectItem } from "./item";


export enum Messages {
    selectProject = "select project",
    selectWorkspaceProject = "select project from workspace",
    deleteWorkspaceProject = "delete project from workspace",
    projectAdded = "project added"
}


export class ProjectManager extends Consult<ProjectItem | ProjectFileItem> {
    /**
     * Map file path to ProjectFileItem, just to quickly find a ProjectFileItem from its absPath.
     */
    filepathToProjectFileItem: FixSizedMap<string, ProjectFileItem>;
    cacheSize = 200;

    constructor() {
        super();

        this.filepathToProjectFileItem = new FixSizedMap<string, ProjectFileItem>(this.cacheSize);
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

    async tryAddProject(filePath: string): Promise<string | undefined> {
        let projectRoot = await this.tryResolveProjectRoot(filePath);

        if (projectRoot) {
            // No matter whether the projectName already exists, update it.
            // So that the same projectName for different projects won't be occupied by
            // one project permanently.
            projectCache.setProject(PathLib.basename(projectRoot), projectRoot);
            return projectRoot;
        }

        console.log(`failed to detect a project for ${filePath}`);
    }

    async tryResolveProjectRoot(filePath: string): Promise<string | undefined> {
        // 1. try file item cache
        let cachedFileItem = this.filepathToProjectFileItem.get(filePath);
        if (cachedFileItem) {
            return cachedFileItem.projectRoots.values().next().value;
        }

        // 2. try workspace folder
        let workspaceFolder = workspace.getWorkspaceFolder(Uri.file(filePath));
        if (workspaceFolder) {
            return workspaceFolder!.uri.path;
        }

        // 3. try saved project list
        for (let projectPath of projectCache.getProjectPaths()) {
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
                fileName => getConfigProjectConfFiles().includes(fileName)
            );
            if (intersection.length !== 0) {
                return dir;
            }
            dir = PathLib.dirname(dir);
        }

        return undefined;
    }
}


export function genAllProjectItems(this: ProjectManager) {
    this.quickPick!.title = Messages.selectProject;
    return projectCache.getProjectPaths().map(
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
    this.quickPick!.hide();
}


export function onAcceptSearchProject(this: ProjectManager) {
    this.quickPick!.value = "";
    this.update({
        itemGenerator: genProjectFileItemsFromSelectedProject,
        itemSelectors: [],
        onChangeValue: [
            onChangeValue
        ],
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
    this.quickPick!.title = PathLib.basename(projectItem.label);

    return await projectItem.getFileItems(
        this.buildExcludeGlobPattern(projectItem.absProjectRoot), this.filepathToProjectFileItem
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


export function onChangeValue(this: ProjectManager, oldValue: string, newValue: string) {
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
                () => (this.items).filter(
                    (item) => regex.test(item.label.toLowerCase())
                ),
            ],
        });
    }
}