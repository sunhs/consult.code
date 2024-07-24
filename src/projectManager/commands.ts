import * as PathLib from "path";
import { commands, Uri, window, workspace } from "vscode";
import { fileBrowser } from "../fileBrowser/commands";
import * as fbDefs from "../fileBrowser/fileBrowser";
import { projectCache } from "../utils/cache";
import { EnumContext, setContext } from "../utils/context";
import { ProjectItem } from "./item";
import { genAllProjectItems, genProjectFileItemsFromProjectItem, genWSProjectItems, Messages, onAcceptDeleteWSProject, onAcceptOpenProject, onAcceptOpenProjectFile, onAcceptSearchProject, onChangeValue, ProjectManager } from "./projectManager";


export const projectManager = new ProjectManager();


export function addProject() {
    setContext(new Map([
        [EnumContext.inConsultFileBrowser, true],
        [EnumContext.consultFileBrowserEmpty, true],
        [EnumContext.inConsultProjMgr, true]
    ]));

    fileBrowser.createQuickPick({
        itemGenerator: fbDefs.genItemsForCurDir,
        itemModifiers: [
            function (this: fbDefs.FileBrowser) {
                return fbDefs.setItemVisibility.call(this, true);
            }
        ],
        itemSelectors: [
            fbDefs.selectShowableItems
        ],
        onChangeValue: [
            fbDefs.onChangeValue
        ],
        onAcceptItems: [
            function () {
                let dir = fileBrowser.quickPick!.selectedItems[0].absPath!;
                projectCache.setProject(PathLib.basename(dir), dir);
                window.showInformationMessage(Messages.projectAdded);

                fileBrowser.quickPick!.hide();
            }
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

    projectManager.createQuickPick({
        itemGenerator: genAllProjectItems,
        itemSelectors: [],
        onChangeValue: [
            onChangeValue
        ],
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

    projectManager.createQuickPick({
        itemGenerator: genAllProjectItems,
        itemSelectors: [],
        onChangeValue: [
            onChangeValue
        ],
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

    projectManager.createQuickPick({
        itemGenerator: genWSProjectItems,
        itemSelectors: [],
        onChangeValue: [
            onChangeValue
        ],
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
            onChangeValue: [
                onChangeValue
            ],
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

    if (workspace.workspaceFolders === undefined || workspace.workspaceFolders.length === 0) {
        return;
    }

    projectManager.createQuickPick({
        itemGenerator: genWSProjectItems,
        itemSelectors: [],
        onChangeValue: [
            onChangeValue
        ],
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
