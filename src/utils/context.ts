import { commands } from "vscode";

export enum EnumContext {
    // setting these to true means that actions from file browser
    // are allowed, e.g., `goUp`, `goHome`
    inConsultFileBrowser = "inConsultFileBrowser",
    consultFileBrowserEmpty = "consultFileBrowserEmpty",

    // setting this to true means that actions from project manager
    // are allowed, e.g., `confirmAddProject`
    inConsultProjMgr = "inConsultProjMgr",
}


export function setContext(context: Map<EnumContext, boolean>) {
    context.forEach((value, key) => {
        commands.executeCommand("setContext", key, value);
    });
}