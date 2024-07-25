# Consult

从 Emacs 转到 VSCode 后，我怀念通过 Emacs 浏览文件、项目并在它们之间搜索的能力。完成这些操作只需要键盘，并且在统一的 UI 中。

在 VSCode 中，我遇到了几个问题。
- 涉及到大量的鼠标操作。
- 没法自动“发现”项目。
- 默认的 `cmd+P`/`ctrl+P` 没有“项目”概念，所以当你在多个项目上工作时，体验可能会很混乱。
- QuickPick 中的默认搜索行为不够用。它不支持正则表达式，查询不能通过空格分隔。为什么后者重要？因为它更直观、方便，并且如果你熟悉 `Alt-b`、`Alt-f`、`Alt-d` 快捷键，修改查询会更容易。
- VSCode 严重依赖于 `Workspace` 的概念，但当你将一个项目添加到工作区时，可能会发生 UI 重载，这很烦人。有时我只是想快速切换到另一个项目中的文件看一眼，所以我不想要那些繁重的工作流。

这个扩展被命名为 `Consult`，以致敬我最喜欢的 Emacs 包之一 [Consult](https://github.com/minad/consult?tab=readme-ov-file) 。当然，背后的英雄是 Emacs 本身或其 [completing-read](https://www.gnu.org/software/emacs/manual/html_node/elisp/Minibuffer-Completion.html) 功能。

注意，我没有深入研究 Emacs `Consult` 的实现原理。我只是基于我的观察创建这个扩展来模仿一些行为。预期会有性能或行为上的差距。

## 命令和特性

- `consult.showFileBrowser` 显示文件浏览器（`⇧+⌥+p f f`）。使用 `⌫` 返回上一级目录，`~` 去 Home 目录，`/` 去根目录。使用 `⌃+h` 切换隐藏文件，`⌃+f` 切换 glob 过滤文件。
- `consult.addProject` 选择一个目录并保存到项目列表（`⇧+⌥+p p a`）
- `consult.openProject` 打开一个已保存的项目，将其带入工作区（`⇧+⌥+p p o`）
- `consult.findFileFromAllProjects` 从已保存的项目列表中选择一个项目并在其中查找文件（`⇧+⌥+p p p`）
- `consult.findFileFromWSProjects` 从工作区中选择一个项目并在其中查找文件（`⇧+⌥+p p w`）
- `consult.findFileFromCurrentProject` 在推断的当前项目中查找文件（`⇧+⌥+p p f`）
- `consult.deleteWSProject` 从工作区中移除一个项目（`⇧+⌥+p p d`）
- `consult.recentf` 切换到最近打开的文件（`⇧+⌥+p b b`）
- `consult.grepProject` 在推断的当前项目中执行 grep（`⇧+⌥+p p g`）
- `consult.grepDir` 在选择的目录中执行 grep（`⇧+⌥+p d g`）

当你添加一个文件夹到工作区或打开一个新文档时，Consult 将尝试发现其所属的项目，并保存它，以便之后使用。

注意，当你在 `consult.showFileBrowser`、`consult.addProject` 或 `consult.grepDir` 时，使用 `<TAB>` 进入目录。

### Project 发现
![Demo](demo/project_discover.gif)

### 打开/移除 Project
![Demo](demo/open_project.gif)
![Demo](demo/delete_project.gif)

### Grep
![Demo](demo/grep.gif)

### 文件浏览器和 Regex 搜索
![Demo](demo/filebrowser_regex_search.gif)

## 配置

- `consult.filterGlobPatterns` 用于过滤搜索结果的 glob pattern。
- `consult.projectConfFiles` 文件名列表（例如，`.git`），用以指示包含该文件的目录是一个项目。
- `consult.projectDotIgnoreFiles` 文件名列表（例如，`.gitignore`），在搜索项目文件时过滤结果。
- `consult.excludeAsProject` 不应被视为项目的目录。

## 限制和已知问题

- 仅在 Mac 和 Linux 上测试。
- 没有在大型项目上测试。因此，查找文件和执行 grep 可能遇到性能问题。
- Grep 将显示预览，并在完成后清理预览。但在某些情况下，Consult 无法进行清理，因此预览仍然会显示。此外，预览可能会出现在 `recentf` 中。
- 尚未实现 Quick pick 中匹配模式的高亮显示。目前 VSCode API 还没法很好支持。