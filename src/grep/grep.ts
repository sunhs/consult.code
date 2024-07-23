import { exec } from "child_process";
import * as PathLib from "path";
import { promisify } from "util";
import { commands, window } from "vscode";
import { Consult } from "../consult";
import { projectManager } from "../projectManager/commands";
import { ProjectItem } from "../projectManager/item";
import { getConfigFilterGlobPatterns, getConfigProjectDotIgnoreFiles } from "../utils/conf";
import { GrepItem } from "./item";


export class Grep extends Consult<GrepItem> {
    previewOpened: boolean = false;
    lastChangeValueTimeMs: number = 0;
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
    let dirRegex = new RegExp(`^${dir}`),
        rootDirRegex = new RegExp(`^/`);

    await promisify(exec)(command, { maxBuffer: 1024 * 1024 * 10 }).then(({ stdout }) => {
        let lines = stdout.split("\n");
        for (let i = 0; i < lines.length - 1; ++i) {
            let [filePath, lineNum, colNum, ...content] = lines[i].split(":");
            let relFilePath = filePath.replace(dirRegex, "").replace(rootDirRegex, "");
            items.push(new GrepItem(filePath, relFilePath, Number(lineNum), Number(colNum), content.join(":")));
        }
    }).catch((err) => {
        window.showErrorMessage(err.message);
    });

    return items;
}


export function deferredOnChangeValue(this: Grep, { dir, projectItem }: { dir?: string, projectItem?: ProjectItem }, recordValue?: string) {
    // This is not a deferred call, but rather triggered by quickpick value change
    if (recordValue === undefined) {
        let nowMs = Date.now();
        let lastChangeValueTimeMs = this.lastChangeValueTimeMs;
        this.lastChangeValueTimeMs = nowMs;

        if (this.quickPick!.value === "" || this.quickPick!.value.length <= 2) {
            console.debug("Query too short, not grepping");
            return;
        }

        let intervalMs = 1000;
        let elapsed = nowMs - lastChangeValueTimeMs;

        // Not enough time has passed since the last value change, defer the call
        if (lastChangeValueTimeMs !== 0 && elapsed < intervalMs) {
            // Extract the value so that the closure won't get a changed value?
            let recordValue = this.quickPick!.value;
            setTimeout(() => deferredOnChangeValue.call(this, { dir, projectItem }, recordValue), intervalMs - elapsed);
            console.debug(`Not enough time passed. Deferred in ${intervalMs - elapsed}ms with query: ${recordValue}`);
            return;
        }
    }
    // This is a deferred call (and thus enough time passed), but the query has changed, and thus this deferred call is outdated
    else if (recordValue !== this.quickPick!.value) {
        console.debug(`Deferred callback outdated: ${recordValue} !== ${this.quickPick!.value}`);
        return;
    }

    // 1) Not a deferred call and enough time passed
    // 2) A deffered call and the query hasn't changed
    console.debug(`Do grep: ${this.quickPick!.value}`);
    this.update({
        itemGenerator: async () => {
            if (projectItem !== undefined) {
                return await genGrepItemsFromProject.call(this, this.quickPick!.value, projectItem);
            }
            else if (dir !== undefined) {
                return await genGrepItemsFromDir.call(this, this.quickPick!.value, dir);
            }
            return [];
        },
        itemSelectors: [],
    });
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

    this.lastChangeValueTimeMs = 0;
}