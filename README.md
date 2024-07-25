# Consult

Moving from Emacs, I miss how it enables me to browses through files, projects and search among them, ***with only the keyboard***, and in a unified UI.

In VSCode, I encountered several problems.
- These involves lots of mouse operation.
- Cannot automatically discover projects.
- The default `cmd+P`/`ctrl+P` doesn't have a "project" concept, so when you work on multiple projects, the experience could be a mess.
- The default searching behavior in the QuickPick is not enough. It doesn't support Regex, and the query cannot be divided by spaces. Why is the latter one important? Because it's more intuitive, convenient with regex, and easier to modify if you're familiar with the `Alt-b`, `Alt-f`, `Alt-d` keybindings.
- VSCode heavily relies on `Workspace`, but when you add a project to the workspace, a UI reload may happen, which is annoying. Sometimes I just want to quickly switch to a file in another project for a glance, so I don't want those heavy workflows.

This extension is named `Consult`, as a salute to one of my favorite Emacs package [Consult](https://github.com/minad/consult?tab=readme-ov-file). Of course, Emacs itself or its [completing-read](https://www.gnu.org/software/emacs/manual/html_node/elisp/Minibuffer-Completion.html) functionalities are the hero behind the scene.

Note that I didn't dig into how Emacs `Consult` work. I just create this extension to mimic some of the behaviors, based on my observations. Performance or behavior gaps are expected.


## Commands and Features

- `consult.showFileBrowser` reveal the file browser (`⇧+⌥+p f f`). Use `⌫` to to up directory, `~` to go to home directory, `/` to go to root directory. Use `⌃+h` to toggle hidden files, `⌃+f` to toggle glob filter files.
- `consult.addProject` choose a directory and save to the project list (`⇧+⌥+p p a`)
- `consult.openProject` open a saved project, bring it to the workspace (`⇧+⌥+p p o`)
- `consult.findFileFromAllProjects` choose a project from the saved project list and find a file in it (`⇧+⌥+p p p`)
- `consult.findFileFromWSProjects` choose a project from workspace and find a file in it (`⇧+⌥+p p w`)
- `consult.findFileFromCurrentProject` find a file in the inferred current project (`⇧+⌥+p p f`)
- `consult.deleteWSProject` remove a project from the workspace (`⇧+⌥+p p d`)
- `consult.recentf` switch to a recently opened file (`⇧+⌥+p b b`)
- `consult.grepProject` perform a grep in the inferred current project (`⇧+⌥+p p g`)
- `consult.grepDir` perform a grep in a chosen directory (`⇧+⌥+p d g`)

When you add a folder to the workspace or open a new document, Consult will try to discover the project and save it for later use.

Note that `<TAB>` is used to enter a directory, when you're doing `consult.showFileBrowser`, `consult.addProject` or `consult.grepDir`.

### Project Discovery
![Demo](demo/project_discover.gif)

### Open/Remove Project
![Demo](demo/open_project.gif)
![Demo](demo/delete_project.gif)

### Grep
![Demo](demo/grep.gif)

### FileBrowser and Regex Search
![Demo](demo/filebrowser_regex_search.gif)

## Configuration

- `consult.filterGlobPatterns` A list of glob patterns to filter out search results.
- `consult.projectConfFiles` A list of filenames (e.g., `.git`) indicating that the directory containing one or more of them is a project.
- `consult.projectDotIgnoreFiles` A list of filenames (e.g., `.gitignore`) that will be used to extend `consult.filterGlobPatterns` when searching in a project.
- `consult.excludeAsProject` directories that shouldn't be considered a project.

## Limitation and Known Issues

- Only tested on Mac and Linux.
- Not tested with large projects. So finding files and grepping will encounter performance issues.
- Issues with grep (currently have no idea how to make it better with available VSCode APIs):
  - Grep will show previews, and cleanup the preview editors once it's done. But under some circumstances, Consult won't be able to do the cleanup, and thus the preview editors remain shown. Turning ***ON*** `Workbench > Editor: Enable Preview` is recommended to avoid this problem.
  - The preview may be shielded by the quick pick UI.
  - Previewed files may show up in `recentf`.
  - Although the grep results are grouped by file, but when displayed with quick pick, they're still messed up.
- Quick pick highlighting on matched patterns are not implemented. There isn't a good way to do it with VSCode API for now.