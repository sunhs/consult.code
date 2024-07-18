import * as PathLib from "path";
import { commands, Uri, window, workspace } from "vscode";
import { fileBrowser } from "../fileBrowser/commands";
import * as fbDefs from "../fileBrowser/fileBrowser";
import { EnumContext, setContext } from "../utils/context";
import { ProjectItem } from "./item";
import { genAllProjectItems, genProjectFileItemsFromProjectItem, genWSProjectItems, Messages, onAcceptDeleteWSProject, onAcceptOpenProject, onAcceptOpenProjectFile, onAcceptSearchProject, ProjectManager } from "./projectManager";


export const projectManager = new ProjectManager();


export function addProject() {
    setContext(new Map([
        [EnumContext.inConsultFileBrowser, true],
        [EnumContext.consultFileBrowserEmpty, true],
        [EnumContext.inConsultProjMgr, true]
    ]));
    projectManager.readProjectListIfNewer();

    fileBrowser.createQuickPick({
        itemGenerator: fbDefs.genItemsForCurDir,
        itemModifiers: [
            fbDefs.setItemVisibility
        ],
        itemSelectors: [
            fbDefs.selectShowableItems
        ],
        onChangeValue: [
            fbDefs.onChangeValue
        ],
        onAcceptItems: [
            fbDefs.OnAcceptItem
        ],
        onHide: [
            () => {
                setContext(new Map([
                    [EnumContext.inConsultFileBrowser, false],
                    [EnumContext.consultFileBrowserEmpty, true],
                    [EnumContext.inConsultProjMgr, false]
                ]));
            }
        ]
    });
}


export function openProject() {
    setContext(new Map([
        [EnumContext.inConsultProjMgr, true]
    ]));
    projectManager.readProjectListIfNewer();

    projectManager.createQuickPick({
        itemGenerator: genAllProjectItems,
        itemSelectors: [],
        onAcceptItems: [
            onAcceptOpenProject
        ],
        onHide: [
            () => {
                setContext(new Map([
                    [EnumContext.inConsultProjMgr, false]
                ]));
            }
        ]
    })
}


export function findFileFromAllProjects() {
    setContext(new Map([
        [EnumContext.inConsultProjMgr, true]
    ]));
    projectManager.readProjectListIfNewer();

    projectManager.createQuickPick({
        itemGenerator: genAllProjectItems,
        itemSelectors: [],
        onAcceptItems: [
            onAcceptSearchProject
        ],
        onHide: [
            () => {
                setContext(new Map([
                    [EnumContext.inConsultProjMgr, false]
                ]));
            }
        ]
    })
}


export function findFileFromWSProjects() {
    setContext(new Map([
        [EnumContext.inConsultProjMgr, true]
    ]));
    projectManager.readProjectListIfNewer();

    projectManager.createQuickPick({
        itemGenerator: genWSProjectItems,
        itemSelectors: [],
        onAcceptItems: [
            onAcceptSearchProject
        ],
        onHide: [
            () => {
                setContext(new Map([
                    [EnumContext.inConsultProjMgr, false]
                ]));
            }
        ]
    })
}

export async function findFileFromCurrentProject() {
    setContext(new Map([
        [EnumContext.inConsultProjMgr, true]
    ]));
    projectManager.readProjectListIfNewer();

    let projectItem: ProjectItem | undefined;

    let document = window.activeTextEditor?.document;
    if (document && !document.isUntitled) {
        let projectRoot = await projectManager.tryResolveProjectRoot(document.uri.path);
        if (projectRoot !== undefined) {
            projectItem = new ProjectItem(projectRoot);
        }
    }

    if (projectItem === undefined && workspace.workspaceFolders && workspace.workspaceFolders.length === 1) {
        projectItem = new ProjectItem(workspace.workspaceFolders[0].uri.path);
    }

    if (projectItem === undefined) {
        window.showErrorMessage("cannot infer current project, choose a project");
        findFileFromAllProjects();
    } else {
        projectManager.createQuickPick({
            itemGenerator: async function () {
                return await genProjectFileItemsFromProjectItem.call(projectManager, projectItem!);
            },
            itemSelectors: [],
            onAcceptItems: [
                onAcceptOpenProjectFile
            ],
            onHide: [
                () => {
                    setContext(new Map([
                        [EnumContext.inConsultProjMgr, false]
                    ]));
                }
            ]
        })
    }
}

export function deleteWSProject() {
    setContext(new Map([
        [EnumContext.inConsultProjMgr, true]
    ]));
    projectManager.readProjectListIfNewer();

    if (workspace.workspaceFolders === undefined || workspace.workspaceFolders.length === 0) {
        return;
    }

    projectManager.createQuickPick({
        itemGenerator: genWSProjectItems,
        itemSelectors: [],
        onAcceptItems: [
            onAcceptDeleteWSProject
        ],
        onHide: [
            () => {
                setContext(new Map([
                    [EnumContext.inConsultProjMgr, false]
                ]));
            }
        ]
    })
}

export function confirmAddProject() {
    if (fileBrowser.quickPick!.activeItems.length === 0) {
        return;
    }
    let dir = fileBrowser.quickPick!.activeItems[0].absPath!;
    // new ProjectItem(dir).intoWorkspace();
    projectManager.projects.set(PathLib.basename(dir), dir);
    projectManager.saveProjects();
    window.showInformationMessage(Messages.projectAdded);

    fileBrowser.quickPick!.hide();
}

export function editProjectList() {
    commands.executeCommand("vscode.open", Uri.file(projectManager.projectListFile));
}