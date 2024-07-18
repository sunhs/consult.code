import * as OS from "os";
import * as PathLib from "path";
import { workspace } from "vscode";


const ConfigSection = "consult"

export function getConfigFilterGlobPatterns(): string[] {
    return workspace.getConfiguration(ConfigSection).get("filterGlobPatterns")!;
}


export function getConfigProjectConfFiles(): string[] {
    return workspace.getConfiguration(ConfigSection).get("projectConfFiles")!;
}

export function getConfigProjectDotIgnoreFiles(): string[] {
    return workspace.getConfiguration(ConfigSection).get("projectDotIgnoreFiles")!;
}

export function getConfigExcludeAsProject(): string[] {
    return workspace.getConfiguration(ConfigSection).get("excludeAsProject")!;
}

export const ConfigFileRootDir = PathLib.join(OS.homedir(), ".consult");