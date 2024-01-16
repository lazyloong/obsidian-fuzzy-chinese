import { TFile, App, TAbstractFile, TFolder } from "obsidian";
import FuzzyModal from "./fuzzyModal";
import { PinyinIndex as PI, Item, MatchData, Pinyin } from "./utils";
import FuzzyChinesePinyinPlugin from "./main";

export default class FuzzyFolderModal extends FuzzyModal<Item> {
    toMoveFiles: TAbstractFile | TFile[];
    constructor(app: App, plugin: FuzzyChinesePinyinPlugin) {
        super(app, plugin);
        this.useInput = true;
        this.index = this.plugin.addChild(new PinyinIndex(this.app, this.plugin));
        this.emptyStateText = "未找到相关文件夹。";
        this.setPlaceholder("输入文件夹名称");
        let prompt = [
            {
                command: "↑↓",
                purpose: "导航",
            },
            {
                command: "↵",
                purpose: "移动",
            },
            {
                command: "shift ↵",
                purpose: "创建",
            },
            {
                command: "esc",
                purpose: "退出",
            },
        ];
        this.setInstructions(prompt);
        this.scope.register(["Shift"], "Enter", async (e) => {
            app.vault.createFolder(this.getChoosenItem().name);
            let file = app.workspace.getActiveFile();
            app.vault.rename(file, this.getChoosenItem().item.name + "/" + file.name);
        });
        this.toMoveFiles = null;
    }
    getEmptyInputSuggestions(): MatchData<Item>[] {
        let root = app.vault.getRoot();
        let result: MatchData<Item>[] = [];
        let item = this.index.items.find((item) => item.name == "/");
        result.push({
            item: item,
            score: 0,
            range: null,
        });
        let quene: TFolder[] = [root];
        while (result.length < 20 && quene.length > 0) {
            let folder = quene.shift();
            for (let child of folder.children) {
                if (child instanceof TFolder) {
                    let item = this.index.items.find((item) => item.name == child.path);
                    result.push({
                        item: item,
                        score: 0,
                        range: null,
                    });
                    quene.push(child);
                }
            }
        }
        return result.slice(0, 20);
    }
    async onChooseSuggestion(
        matchData: MatchData<Item>,
        evt: MouseEvent | KeyboardEvent
    ): Promise<void> {
        if (matchData.score == -1) await app.vault.createFolder(matchData.item.name);
        if (!this.toMoveFiles) this.toMoveFiles = app.workspace.getActiveFile();
        if (Array.isArray(this.toMoveFiles))
            this.toMoveFiles.forEach((file) =>
                app.vault.rename(file, matchData.item.name + "/" + file.name)
            );
        else app.vault.rename(this.toMoveFiles, matchData.item.name + "/" + this.toMoveFiles.name);
        this.toMoveFiles = null;
    }
    openWithFiles(files: TAbstractFile | TFile[]) {
        this.toMoveFiles = files;
        this.open();
    }
}

class PinyinIndex extends PI<Item> {
    constructor(app: App, plugin: FuzzyChinesePinyinPlugin) {
        super(app, plugin);
        this.id = "folder";
    }
    initIndex() {
        this.items = [];
        let root = this.app.vault.getRoot();
        let iterate = (node: TFolder, nodePinyin: Pinyin) => {
            let children = node.children;
            for (let child of children) {
                if (child instanceof TFolder) {
                    let name = node.path == "/" ? child.name : "/" + child.name;
                    let pinyin = nodePinyin.concat(new Pinyin(name, this.plugin));
                    this.items.push({ name: child.path, pinyin: pinyin });
                    iterate(child, pinyin);
                }
            }
        };
        this.items.push({ name: root.path, pinyin: new Pinyin(root.path, this.plugin) });
        iterate(root, new Pinyin("", this.plugin));
    }
    initEvent() {
        this.registerEvent(
            this.vault.on("rename", (folder, oldPath) => this.update("rename", folder, oldPath))
        );
        this.registerEvent(this.vault.on("create", (folder) => this.update("create", folder)));
        this.registerEvent(this.vault.on("delete", (folder) => this.update("delete", folder)));
    }
    update(type: "create", f: TAbstractFile);
    update(type: "delete", f: TAbstractFile);
    update(type: "rename", f: TAbstractFile, oldPath: string);
    update(type: string, f: TAbstractFile, oldPath?: string) {
        if (f instanceof TFile) return;
        let folder = f as TFolder;
        switch (type) {
            case "create":
                this.items.push({
                    name: folder.path,
                    pinyin: new Pinyin(folder.path, this.plugin),
                });
                break;
            case "delete":
                this.items = this.items.filter((item) => item.name == folder.path);
                break;
            case "rename":
                this.items = this.items.filter((item) => item.name == oldPath);
                this.items.push({
                    name: folder.path,
                    pinyin: new Pinyin(folder.path, this.plugin),
                });
                break;
        }
    }
}
