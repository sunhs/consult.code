// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { goToHome, goToRoot, goUpDir, intoDir, showFileBrowser, toggleFilter, toggleHidden } from './fileBrowser/commands';
import { registerListeners } from './listeners/register';
import { addProject, deleteWSProject, editProjectList, findFileFromAllProjects, findFileFromCurrentProject, findFileFromWSProjects, openProject } from './projectManager/commands';
import { showRecentFiles } from './recentf/commands';
import { saveAllCache } from './utils/cache';


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	registerListeners();

	context.subscriptions.push(
		vscode.commands.registerCommand("consult.showFileBrowser", () => {
			showFileBrowser();
		}),
		vscode.commands.registerCommand("consult.intoDir", () => {
			intoDir();
		}),
		vscode.commands.registerCommand("consult.goUpDir", () => {
			goUpDir();
		}),
		vscode.commands.registerCommand("consult.toggleHidden", () => {
			toggleHidden();
		}),
		vscode.commands.registerCommand("consult.toggleFilter", () => {
			toggleFilter();
		}),
		vscode.commands.registerCommand("consult.goToHome", () => {
			goToHome();
		}),
		vscode.commands.registerCommand("consult.goToRoot", () => {
			goToRoot();
		}),
		vscode.commands.registerCommand("consult.addProject", () => {
			addProject();
		}),
		vscode.commands.registerCommand("consult.openProject", () => {
			openProject();
		}),
		vscode.commands.registerCommand("consult.findFileFromAllProjects", () => {
			findFileFromAllProjects();
		}),
		vscode.commands.registerCommand("consult.findFileFromWSProjects", () => {
			findFileFromWSProjects();
		}),
		vscode.commands.registerCommand("consult.findFileFromCurrentProject", () => {
			findFileFromCurrentProject();
		}),
		vscode.commands.registerCommand("consult.deleteWSProject", () => {
			deleteWSProject();
		}),
		vscode.commands.registerCommand("consult.editProjectList", () => {
			editProjectList();
		}),
		vscode.commands.registerCommand("consult.recentf", () => {
			showRecentFiles();
		}),
	);
}

// this method is called when your extension is deactivated
export function deactivate() {
	saveAllCache();
}
