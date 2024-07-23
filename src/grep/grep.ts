import { exec } from "child_process";
import * as PathLib from "path";
import { promisify } from "util";
import { commands } from "vscode";
import { Consult } from "../consult";
import { projectManager } from "../projectManager/commands";
import { ProjectItem } from "../projectManager/item";
import { getConfigFilterGlobPatterns, getConfigProjectDotIgnoreFiles } from "../utils/conf";
import { GrepItem } from "./item";


export class Grep extends Consult<GrepItem> {
    previewOpened: boolean = false;
}


export async function genGrepItemsFromProject(this: Grep, query: string, projectItem: ProjectItem) {
    this.quickPick!.title = projectItem.label;

    let dotIgnoreFilePaths = [];
    for (let dotIgnoreFile of getConfigProjectDotIgnoreFiles()) {
        dotIgnoreFilePaths.push(PathLib.join(projectItem.absProjectRoot, dotIgnoreFile));
    }

    return await genGrepItems.call(this, query, projectItem.absProjectRoot, dotIgnoreFilePaths);
}


export async function genGrepItemsFromDir(this: Grep, query: string, dir: string) {
    let projectRoot = await projectManager.tryResolveProjectRoot(dir);
    if (projectRoot !== undefined) {
        return await genGrepItemsFromProject.call(this, query, new ProjectItem(projectRoot));
    }

    this.quickPick!.title = dir;
    return await genGrepItems.call(this, query, dir);
}


export async function genGrepItems(this: Grep, query: string, dir: string, dotIgnoreFilePaths: string[] = []) {
    if (query === "") {
        return [];
    }

    let command = "rg -i --pretty --color=never --no-heading --column --hidden";

    for (let ignoreGlob of getConfigFilterGlobPatterns()) {
        command += ` --glob '!${ignoreGlob}'`;
    }
    for (let ignoreFile of dotIgnoreFilePaths) {
        command += ` --ignore-file ${ignoreFile}`;
    }

    command += ` '${query}' ${dir}`;
    console.debug(`rg command: ${command}`)

    let items: GrepItem[] = [];
    let dirRegex = new RegExp(`^${dir}`);
    await promisify(exec)(command).then(({ stdout }) => {
        let lines = stdout.split("\n");
        for (let i = 0; i < lines.length - 1; ++i) {
            let [filePath, lineNum, colNum, ...content] = lines[i].split(":");
            let relFilePath = filePath.replace(dirRegex, "");
            items.push(new GrepItem(filePath, relFilePath, Number(lineNum), Number(colNum), content.join(":")));
        }
    }).catch((err) => {
        window.showErrorMessage(err.message);
    });

    return items;
}


export function onChangeActive(this: Grep, e: Readonly<GrepItem[]>) {
    if (e.length === 0) {
        return;
    }

    e[0].open(true);
    this.previewOpened = true;
}


export function onAcceptItem(this: Grep) {
    let accepted = this.quickPick!.selectedItems[0];
    accepted.open();
    this.quickPick!.hide();
}


export function onHide(this: Grep) {
    if (this.previewOpened) {
        // FIXME: This will make the last preview editor focused, and thus adding the file to recentf.
        commands.executeCommand("workbench.action.focusRightGroup");
        commands.executeCommand("workbench.action.closeEditorsAndGroup");
        this.previewOpened = false;
    }
}