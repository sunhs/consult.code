import * as PathLib from "path";
import { window, workspace } from "vscode";
import { projectManager } from "../projectManager/commands";
import { cacheFiles, projectCache, recentFileCache } from "../utils/cache";


export function registerListeners() {
    workspace.onDidChangeWorkspaceFolders(
        (e) => {
            if (e.added.length === 0) {
                return;
            }
            for (let folder of e.added) {
                projectManager.tryAddProject(folder.uri.path);
            }
        }
    );

    window.onDidChangeVisibleTextEditors(
        (editors) => {
            if (editors.length === 0) {
                return;
            }

            let editor = window.activeTextEditor!;
            if (editor.document.isUntitled) {
                return;
            }

            recentFileCache.putFile(editor.document.uri.path);

            if (!cacheFiles.includes(editor.document.uri.path)) {
                projectManager.tryAddProject(editor.document.uri.path).then(
                    (projectRoot) => {
                        if (projectRoot) {
                            projectCache.putProjectFileCache(PathLib.basename(projectRoot!), editor.document.uri.path);
                        }
                    }
                );
            }
        }
    );
}