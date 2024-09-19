import { TFile, App, TAbstractFile, TFolder } from "obsidian";
import {
    PinyinIndex as PI,
    Item as uItem,
    MatchData as uMatchData,
    Pinyin,
    HistoryMatchDataNode,
    SuggestionRenderer,
} from "@/utils";
import ThePlugin from "@/main";
import FuzzyModal from "./modal";

interface Item extends uItem {
    path: string;
    pinyinOfPath: Pinyin;
}

type MatchData = uMatchData<Item>;

export default class FolderModal extends FuzzyModal<Item> {
    toMoveFiles: TAbstractFile | TFile[];
    constructor(app: App, plugin: ThePlugin) {
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
            await app.vault.createFolder(this.inputEl.value);
            let file = app.workspace.getActiveFile();
            app.vault.rename(file, this.inputEl.value + "/" + file.name);
            this.close();
        });
        this.scope.register([], "Tab", (e) => {
            e.preventDefault();
            let item = this.getChoosenItem();
            if (item.path == "/") return;
            this.inputEl.value = item.path;
            this.onInput();
        });
        this.toMoveFiles = null;
    }
    getSuggestions(query: string): MatchData[] {
        if (query == "") {
            return this.getEmptyInputSuggestions();
        }

        let matchData: MatchData[] = [],
            matchData1: MatchData[] = [] /*使用文件夹名称搜索的数据*/,
            matchData2: MatchData[] = []; /*使用文件夹路径搜索的数据*/

        let node: HistoryMatchDataNode<Item> = this.historyMatchData,
            lastNode: HistoryMatchDataNode<Item>,
            index = 0,
            _f = true;
        for (let i of query) {
            if (node) {
                if (i != node.query) {
                    node.init(i);
                    _f = false;
                }
            } else {
                node = lastNode.push(i);
            }
            lastNode = node;
            node = node.next;
            if (_f) index++;
        }
        let smathCase = /[A-Z]/.test(query) && this.plugin.settings.global.autoCaseSensitivity,
            indexNode = this.historyMatchData.index(index - 1),
            toMatchData = indexNode.itemIndex.length == 0 ? this.index.items : indexNode.itemIndex;
        for (let p of toMatchData) {
            let d = p.pinyin.match(query, p, smathCase);
            if (!d) continue;
            const l = d.item.path.lastIndexOf("/") + 1;
            d.range = d.range.map((p) => p.map((q) => q + l)) as [number, number][];
            matchData1.push(d);
        }

        toMatchData =
            indexNode.itemIndexByPath.length == 0 ? this.index.items : indexNode.itemIndexByPath;
        for (let p of toMatchData.filter(
            (p) => !matchData1.map((p) => p.item.path).includes(p.path)
        )) {
            let d = p.pinyinOfPath.match(query, p, smathCase);
            if (d) matchData2.push(d);
        }

        matchData = matchData1.concat(matchData2);
        matchData = matchData.sort((a, b) => b.score - a.score);
        // 记录数据以便下次匹配可以使用
        if (!lastNode) lastNode = this.historyMatchData;
        lastNode.itemIndex = matchData1.map((p) => p.item);
        lastNode.itemIndexByPath = matchData2.map((p) => p.item);
        // 去除重复的笔记
        let result = matchData.reduce((acc, cur) => {
            let index = acc.findIndex((item) => item.item.path === cur.item.path);
            if (index !== -1) {
                if (cur.score > acc[index].score) {
                    acc[index] = cur;
                }
            } else {
                acc.push(cur);
            }
            return acc;
        }, []);
        return result;
    }

    getEmptyInputSuggestions(): MatchData[] {
        let root = app.vault.getRoot();
        let result: MatchData[] = [];
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
                    let item = this.index.items.find((item) => item.path == child.path);
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
    async onChooseSuggestion(matchData: MatchData, evt: MouseEvent | KeyboardEvent): Promise<void> {
        if (matchData.score == -1) await app.vault.createFolder(matchData.item.path);
        if (!this.toMoveFiles) this.toMoveFiles = app.workspace.getActiveFile();
        if (Array.isArray(this.toMoveFiles))
            this.toMoveFiles.forEach((file) =>
                app.vault.rename(file, matchData.item.path + "/" + file.name)
            );
        else app.vault.rename(this.toMoveFiles, matchData.item.path + "/" + this.toMoveFiles.name);
        this.toMoveFiles = null;
    }
    openWithFiles(files: TAbstractFile | TFile[]) {
        this.toMoveFiles = files;
        this.open();
    }
    renderSuggestion(matchData: MatchData, el: HTMLElement) {
        let renderer = new SuggestionRenderer(el);
        renderer.setTitle(matchData.item.path);
        renderer.render(matchData);
    }
}

class PinyinIndex extends PI<Item> {
    constructor(app: App, plugin: ThePlugin) {
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
                    let name = child.name;
                    let pinyinOfName = new Pinyin(name, this.plugin);
                    let pinyinOfPath =
                        node.path == "/"
                            ? pinyinOfName
                            : nodePinyin
                                  .concat(new Pinyin("/", this.plugin))
                                  .concat(new Pinyin(name, this.plugin));
                    this.items.push({
                        name,
                        pinyin: pinyinOfName,
                        path: child.path,
                        pinyinOfPath: pinyinOfPath,
                    });
                    iterate(child, pinyinOfPath);
                }
            }
        };
        this.items.push({
            name: "/",
            pinyin: new Pinyin("/", this.plugin),
            path: root.path,
            pinyinOfPath: new Pinyin(root.path, this.plugin),
        });
        iterate(root, new Pinyin("", this.plugin));
    }
    initEvent() {
        this.registerEvent(
            this.vault.on("rename", (folder, oldPath) => this.update("rename", folder, oldPath))
        );
        this.registerEvent(this.vault.on("create", (folder) => this.update("create", folder)));
        this.registerEvent(this.vault.on("delete", (folder) => this.update("delete", folder)));
    }
    update(type: "create", f: TAbstractFile): void;
    update(type: "delete", f: TAbstractFile): void;
    update(type: "rename", f: TAbstractFile, oldPath: string): void;
    update(type: string, f: TAbstractFile, oldPath?: string) {
        if (f instanceof TFile) return;
        let folder = f as TFolder;
        switch (type) {
            case "create":
                this.items.push({
                    name: folder.name,
                    pinyin: new Pinyin(folder.name, this.plugin),
                    path: folder.path,
                    pinyinOfPath: new Pinyin(folder.path, this.plugin),
                });
                break;
            case "delete":
                this.items = this.items.filter((item) => item.name != folder.path);
                break;
            case "rename":
                this.items = this.items.filter((item) => item.name != oldPath);
                this.items.push({
                    name: folder.name,
                    pinyin: new Pinyin(folder.name, this.plugin),
                    path: folder.path,
                    pinyinOfPath: new Pinyin(folder.path, this.plugin),
                });
                break;
        }
    }
}
