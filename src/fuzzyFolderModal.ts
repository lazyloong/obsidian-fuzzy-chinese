import { TFile, App, TAbstractFile, TFolder } from "obsidian";
import { FuzzyModal, PinyinIndex as PI, Item, MatchData, Pinyin } from "./fuzzyModal";
import Fuzyy_chinese from "./main";

export class FuzzyFolderModal extends FuzzyModal<Item> {
    constructor(app: App, plugin: Fuzyy_chinese) {
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
    async onChooseSuggestion(matchData: MatchData<Item>, evt: MouseEvent | KeyboardEvent): Promise<void> {
        if (matchData.score == -1) await app.vault.createFolder(matchData.item.name);
        let file = app.workspace.getActiveFile();
        app.vault.rename(file, matchData.item.name + "/" + file.name);
    }
}

class PinyinIndex extends PI<Item> {
    constructor(app: App, plugin: Fuzyy_chinese) {
        super(app, plugin);
    }
    initIndex() {
        if (this.plugin.settings.devMode && globalThis.FuzzyChineseIndex?.folder) {
            this.items = globalThis.FuzzyChineseIndex.folder;
            console.log("Fuzzy Chinese Pinyin: Use old folder index");
            return;
        }
        let root = app.vault.getRoot();
        let iterate = (node: TFolder, nodePinyin: Pinyin<Item>) => {
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
        this.registerEvent(this.vault.on("rename", (folder, oldPath) => this.update("rename", folder, { oldPath })));
        this.registerEvent(this.vault.on("create", (folder) => this.update("create", folder)));
        this.registerEvent(this.vault.on("delete", (folder) => this.update("delete", folder)));
    }
    update(type: string, f: TAbstractFile, data?: { oldPath: string }) {
        if (f instanceof TFile) return;
        let folder = f as TFolder;
        switch (type) {
            case "create":
                this.items.push({ name: folder.path, pinyin: new Pinyin(folder.path, this.plugin) });
                break;
            case "delete":
                this.items = this.items.filter((item) => item.name == folder.path);
                break;
            case "rename":
                this.items = this.items.filter((item) => item.name == data.oldPath);
                this.items.push({ name: folder.path, pinyin: new Pinyin(folder.path, this.plugin) });
                break;
        }
    }
}
