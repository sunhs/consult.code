import * as fs from "fs";
import * as PathLib from "path";
import { window } from "vscode";
import { ConfigFileRootDir } from "../utils/conf";
import { LruMap, WeightedCache } from "../utils/datastructs";


/**
 * Cache Timing:
 *  - when project added, set `projectsLRU` (via command)
 *  - when project opened, set `projectsLRU` (via listener)
 *  - when file opened, resolve project, set `projectsLRU` and `projectFileWeightedCache` (via listener)
 */
class ProjectCache {
    /**
     * map project name to project path
     */
    projectsLRU: LruMap<string, string>;
    projectListFile = PathLib.join(ConfigFileRootDir, "projects.json");
    projectLRUMaxSize = 100;

    /**
     * Map project name to LRU cache of project files.
     *
     * The main purpose is to assign each file a weight, so that we can sort files under a project.
     */
    projectFileWeightedCache: Map<string, WeightedCache<string>>;
    projectFileCacheFile = PathLib.join(ConfigFileRootDir, "projectfiles.json");
    projectFileCacheMaxSize = 50;

    constructor() {
        this.projectsLRU = new LruMap<string, string>(this.projectLRUMaxSize);
        this.projectFileWeightedCache = new Map<string, WeightedCache<string>>();

        this.loadProjectList();
        this.loadProjectFileCache();
    }

    loadProjectList() {
        this.projectsLRU.clear();

        if (!fs.existsSync(this.projectListFile)) {
            fs.writeFileSync(this.projectListFile, "{}");
        }

        let content = fs.readFileSync(this.projectListFile, "utf8");
        let parsed: { [key: string]: string } = JSON.parse(content);
        this.projectsLRU.clear();
        // In the list file, entries are listed from newer to older.
        Object.entries(parsed).reverse().forEach(
            ([k, v]) => {
                this.projectsLRU.set(k, v);
            }
        );

        this.revalidateProjects();
    }

    saveProjectList() {
        this.revalidateProjects();

        let jsonObj: { [key: string]: string } = {};
        // new to old
        this.projectsLRU.entries().forEach(
            ([k, v], _) => {
                jsonObj[k] = v;
            }
        );
        let content = JSON.stringify(jsonObj, null, 4);
        fs.writeFileSync(this.projectListFile, content);
    }

    loadProjectFileCache() {
        this.projectFileWeightedCache.clear();

        if (!fs.existsSync(this.projectFileCacheFile)) {
            fs.writeFileSync(this.projectFileCacheFile, "{}");
        }

        let content = fs.readFileSync(this.projectFileCacheFile, "utf8");
        let parsed: { [key: string]: string[] } = JSON.parse(content);
        this.projectFileWeightedCache.clear();
        Object.entries(parsed).forEach(
            ([projectName, filePaths]) => {
                let cache = new WeightedCache<string>(this.projectFileCacheMaxSize);
                // In the cache file, entries are listed from newer to older.
                for (let filePath of filePaths.reverse()) {
                    cache.put(filePath);
                }
                this.projectFileWeightedCache.set(projectName, cache);
            }
        );

        this.revalidateProjectFiles();
    }

    saveProjectFileCache() {
        this.revalidateProjectFiles();

        let jsonObj: { [key: string]: string[] } = {};
        this.projectFileWeightedCache.forEach(
            (cache, projectName) => {
                jsonObj[projectName] = [];
                // new to old
                for (let filePath of cache.arr.reverse()) {
                    jsonObj[projectName].push(filePath);
                }
            }
        );
        fs.writeFileSync(this.projectFileCacheFile, JSON.stringify(jsonObj, null, 4));
    }


    setProject(projectName: string, projectPath: string) {
        this.projectsLRU.set(projectName, projectPath);
    }


    getProject(projectName: string) {
        return this.projectsLRU.get(projectName);
    }


    getProjectNames() {
        return this.projectsLRU.keys();
    }


    getProjectPaths() {
        return this.projectsLRU.values();
    }


    putProjectFileCache(projectName: string, filePath: string) {
        if (!this.projectFileWeightedCache.has(projectName)) {
            this.projectFileWeightedCache.set(projectName, new WeightedCache<string>(this.projectFileCacheMaxSize));
        }
        this.projectFileWeightedCache.get(projectName)!.put(filePath);
    }


    revalidateProjects() {
        for (let [projectName, projectPath] of this.projectsLRU.entries()) {
            if (!fs.existsSync(projectPath) || !PathLib.isAbsolute(projectPath)) {
                window.showInformationMessage(`remove invalid project ${projectName} (${projectPath})`);
                this.projectsLRU.delete(projectPath);
            }
        }
    }

    revalidateProjectFiles() {
        for (let [projectName, cache] of this.projectFileWeightedCache) {
            if (!this.projectsLRU.has(projectName)) {
                window.showInformationMessage(`remove non-existent project ${projectName}`);
                this.projectFileWeightedCache.delete(projectName);
                continue;
            }

            let validateCache = new WeightedCache<string>(this.projectFileCacheMaxSize);
            for (let filePath of cache.arr) {
                if (!fs.existsSync(filePath) || !PathLib.isAbsolute(filePath)) {
                    window.showInformationMessage(`remove invalid file ${filePath} from project ${projectName}`);
                    continue;
                }
                validateCache.put(filePath);
            }
            this.projectFileWeightedCache.set(projectName, validateCache);
        }
    }
}


/**
 * Cache Timing:
 *  - when file opened, set `files` (via listener)
 */
class RecentFileCache {
    files: WeightedCache<string>;
    cacheFile = PathLib.join(ConfigFileRootDir, "recentf.json");
    cacheMaxSize = 200;

    constructor() {
        this.files = new WeightedCache<string>(this.cacheMaxSize);
        this.loadCache();
    }

    loadCache() {
        this.files.arr = [];

        if (!fs.existsSync(this.cacheFile)) {
            fs.writeFileSync(this.cacheFile, "[]");
        }

        let content = fs.readFileSync(this.cacheFile, "utf8");
        let parsed: string[] = JSON.parse(content);
        // In the cache file, entries are listed from newer to older.
        for (let file of parsed.reverse()) {
            this.files.put(file);
        }

        this.revalidateFiles();
    }

    saveCache() {
        this.revalidateFiles();

        // new to old
        let jsonObj = this.files.arr.reverse();
        fs.writeFileSync(this.cacheFile, JSON.stringify(jsonObj, null, 4));
    }

    putFile(filePath: string) {
        this.files.put(filePath);
    }

    revalidateFiles() {
        let validateCache = new WeightedCache<string>(this.cacheMaxSize);
        for (let filePath of this.files.arr) {
            if (!fs.existsSync(filePath) || !PathLib.isAbsolute(filePath)) {
                window.showInformationMessage(`remove invalid file ${filePath} from recent files`);
                continue;
            }
            validateCache.put(filePath);
        }
        this.files = validateCache;
    }
}



if (!fs.existsSync(ConfigFileRootDir)) {
    fs.mkdirSync(ConfigFileRootDir);
}

export const projectCache = new ProjectCache();
export const recentFileCache = new RecentFileCache();

export const cacheFiles = [
    projectCache.projectListFile,
    projectCache.projectFileCacheFile,
    recentFileCache.cacheFile
]


export function loadAllCache() {
    projectCache.loadProjectList();
    projectCache.loadProjectFileCache();
    recentFileCache.loadCache();
}


export function saveAllCache() {
    projectCache.saveProjectList();
    projectCache.saveProjectFileCache();
    recentFileCache.saveCache();
}
