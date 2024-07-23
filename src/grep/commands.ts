import { window, workspace } from "vscode";
import { fileBrowser } from "../fileBrowser/commands";
import * as fbDefs from "../fileBrowser/fileBrowser";
import { projectManager } from "../projectManager/commands";
import { ProjectItem } from "../projectManager/item";
import { EnumContext, setContext } from "../utils/context";
import { genGrepItemsFromDir, genGrepItemsFromProject, Grep, onAcceptItem, onChangeActive, onHide } from "./grep";


let grep = new Grep();


export async function grepProject() {
    let projectItem: ProjectItem | undefined;

    let doc = window.activeTextEditor?.document;
    if (doc && !doc.isUntitled) {
        let projectRoot = await projectManager.tryResolveProjectRoot(doc.uri.path);
        if (projectRoot !== undefined) {
            projectItem = new ProjectItem(projectRoot);
        }
    }

    if (projectItem === undefined && workspace.workspaceFolders && workspace.workspaceFolders.length === 1) {
        projectItem = new ProjectItem(workspace.workspaceFolders[0].uri.path);
    }

    if (projectItem === undefined) {
        window.showErrorMessage("cannot infer current project");
        return;
    } else {
        grep.createQuickPick({
            onChangeValue: [
                function (this: Grep, _: string, newValue: string) {
                    this.update({
                        itemGenerator: async () => {
                            return await genGrepItemsFromProject.call(this, newValue, projectItem!);
                        },
                        itemSelectors: [],
                    })
                },
            ],
            onChangeActive: [
                onChangeActive
            ],
            onAcceptItems: [
                onAcceptItem
            ],
            onHide: [
                onHide
            ]
        })
    }
}


export async function grepDir() {
    setContext(new Map([
        [EnumContext.inConsultFileBrowser, true],
        [EnumContext.consultFileBrowserEmpty, true],
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
            function (this: fbDefs.FileBrowser) {
                let dir = this.quickPick!.selectedItems[0].absPath!;

                grep.createQuickPick({
                    onChangeValue: [
                        function (this: Grep, _: string, newValue: string) {
                            this.update({
                                itemGenerator: async () => {
                                    return await genGrepItemsFromDir.call(this, newValue, dir);
                                },
                                itemSelectors: [],
                            })
                        },
                    ],
                    onChangeActive: [
                        onChangeActive
                    ],
                    onAcceptItems: [
                        onAcceptItem
                    ],
                    onHide: [
                        onHide
                    ]
                })
            }
        ],
        onHide: [
            () => {
                setContext(new Map([
                    [EnumContext.inConsultFileBrowser, false],
                    [EnumContext.consultFileBrowserEmpty, true],
                ]));
            }
        ]
    });
}
