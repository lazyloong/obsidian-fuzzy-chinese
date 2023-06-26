import {
    App,
    CachedMetadata,
    Component,
    MetadataCache,
    Plugin,
    PluginSettingTab,
    Setting,
    SuggestModal,
    TAbstractFile,
    TFile,
    Vault,
    WorkspaceLeaf,
} from "obsidian";
// 以下两个字典来源于：https://github.com/xmflswood/pinyin-match
import { SimplifiedDict } from "./simplified_dict";
import { TraditionalDict } from "./traditional_dict";

const DOCUMENT_EXTENSIONS = ["md", "canvas"]

let PinyinKeys: Array<string>;
let PinyinValues: Array<string>;

interface Fuzyy_chineseSettings {
    traditionalChineseSupport: boolean;
    showAllFileTypes: boolean;
    showAttachments: boolean;
    attachmentExtensions: Array<string>;
    usePathToSearch: boolean;
    showPath: boolean;
    showTags: boolean;
}

const DEFAULT_SETTINGS: Fuzyy_chineseSettings = {
    traditionalChineseSupport: false,
    showAttachments: false,
    showAllFileTypes: false,
    attachmentExtensions: ["bmp", "png", "jpg", "jpeg", "gif", "svg", "webp", "mp3", "wav", "m4a", "3gp", "flac", "ogg", "oga", "opus", "mp4", "webm", "ogv", "mov", "mkv", "pdf"],
    usePathToSearch: false,
    showPath: true,
    showTags: false,
};

export default class Fuzyy_chinese extends Plugin {
    settings: Fuzyy_chineseSettings;
    api = { pinyin: Pinyin, p: PinyinKeys, q: Query };
    index: PinyinIndex;
    async onload() {
        await this.loadSettings();

        PinyinKeys = this.settings.traditionalChineseSupport ? Object.keys(TraditionalDict) : Object.keys(SimplifiedDict);
        PinyinValues = this.settings.traditionalChineseSupport ? Object.values(TraditionalDict) : Object.values(SimplifiedDict);

        this.index = this.addChild(new PinyinIndex(this.app, this));

        this.addCommand({
            id: "open-search",
            name: "Open Search",
            checkCallback: (checking: boolean) => {
                let leaf = this.app.workspace.getMostRecentLeaf();
                if (leaf) {
                    if (!checking) {
                        new FuzzyModal(this.app, this).open();
                    }
                    return true;
                }
                return false;
            },
        });
        this.addRibbonIcon("search", "FuzzySearch", () => {
            let leaf = this.app.workspace.getMostRecentLeaf();
            if (leaf) {
                new FuzzyModal(this.app, this).open();
                return true;
            }
            return false;
        });
        this.addSettingTab(new FuzzySettingTab(this.app, this));
        if (!this.app.workspace.layoutReady) {
            this.app.workspace.onLayoutReady(async () => this.index.initIndex());
        } else {
            this.index.initIndex();
        }
    }
    onunload() { }
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }
    async saveSettings() {
        await this.saveData(this.settings);
    }
}

type Item = {
    file: TFile;
    type: "file" | "alias";
    name: string;
    pinyin: Pinyin;
    path: string;
    pinyinOfPath: Pinyin;
};

type MatchData = {
    item: Item;
    score: number;
    range: Array<[number, number]>;
    usePath?: boolean;
};

class FuzzyModal extends SuggestModal<MatchData> {
    historyMatchData: HistoryMatchDataNode;
    plugin: Fuzyy_chinese;
    chooser: any;
    items: Item[];
    constructor(app: App, plugin: Fuzyy_chinese) {
        super(app);
        this.plugin = plugin;
        this.items = this.plugin.index.items;
        let prompt = [
            {
                command: "ctrl ↵",
                purpose: "打开到新标签页",
            },
            {
                command: "ctrl alt ↵",
                purpose: "打开到新面板",
            },
            {
                command: "alt ↵",
                purpose: "打开到其他面板",
            },
            {
                command: "shift ↵",
                purpose: "创建新文件",
            },
            {
                command: "ctrl shift ↵",
                purpose: "创建新文件到新标签页",
            },
            {
                command: "shift alt ↵",
                purpose: "创建新文件到其他面板",
            },
        ];
        if (app.plugins.plugins["obsidian-hover-editor"])
            prompt.push({
                command: "ctrl p",
                purpose: "打开到新浮窗",
            });

        this.setInstructions(prompt);
        this.emptyStateText = "未发现该笔记，按下回车创建。";
        this.scope.register(["Mod"], "Enter", async (e) => {
            this.close();
            let file = await this.getChooseItemFile();
            app.workspace.getLeaf("tab").openFile(file);
        });
        this.scope.register(["Mod", "Alt"], "Enter", async (e) => {
            this.close();
            let file = await this.getChooseItemFile();
            app.workspace.getLeaf("split").openFile(file);
        });
        this.scope.register(["Shift"], "Enter", async (e) => {
            if (this.inputEl.value == "") return;
            this.close();
            let nf = await app.vault.create(app.fileManager.getNewFileParent("").path + "/" + this.inputEl.value + ".md", "");
            app.workspace.getMostRecentLeaf().openFile(nf);
        });
        this.scope.register(["Mod", "Shift"], "Enter", async (e) => {
            if (this.inputEl.value == "") return;
            this.close();
            let nf = await app.vault.create(app.fileManager.getNewFileParent("").path + "/" + this.inputEl.value + ".md", "");
            app.workspace.getLeaf("tab").openFile(nf);
        });
        this.scope.register(["Shift", "Alt"], "Enter", async (e) => {
            if (this.inputEl.value == "") return;
            this.close();
            let nf = await app.vault.create(app.fileManager.getNewFileParent("").path + "/" + this.inputEl.value + ".md", "");
            getNewOrAdjacentLeaf(app.workspace.getMostRecentLeaf()).openFile(nf);
        });
        this.scope.register(["Alt"], "Enter", async (e) => {
            this.close();
            let file = await this.getChooseItemFile();
            getNewOrAdjacentLeaf(app.workspace.getMostRecentLeaf()).openFile(file);
        });
        if (app.plugins.plugins["obsidian-hover-editor"])
            this.scope.register(["Mod"], "p", (event: KeyboardEvent) => {
                this.close();
                let item = this.chooser.values[this.chooser.selectedItem];
                const newLeaf = app.plugins.plugins["obsidian-hover-editor"].spawnPopover(undefined, () => this.app.workspace.setActiveLeaf(newLeaf));
                newLeaf.openFile(item.item.file);
            });
    }
    onOpen() {
        this.onInput(); // 无输入时触发历史记录
    }

    getSuggestions(query: string): MatchData[] {
        if (query == "") {
            this.historyMatchData = new HistoryMatchDataNode("\0");
            let items = this.items;
            let lastOpenFiles: MatchData[] = app.workspace
                .getLastOpenFiles()
                .map((p) => items.find((q) => q.type == "file" && q.path == p))
                .filter((p) => p)
                .map((p) => {
                    return {
                        item: p,
                        score: -1,
                        range: null,
                    };
                });
            return lastOpenFiles;
        }

        let matchData: MatchData[] = [],
            matchData1: MatchData[] = [] /*使用标题、别名搜索的数据*/,
            matchData2: MatchData[] = []; /*使用路径搜索的数据*/

        let node: HistoryMatchDataNode = this.historyMatchData,
            lastNode: HistoryMatchDataNode,
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
        let query_ = new Query(query.toLocaleLowerCase());
        let indexNode = this.historyMatchData.index(index - 1),
            toMatchData = indexNode.itemIndex.length == 0 ? this.items : indexNode.itemIndex;
        for (let p of toMatchData) {
            let d = p.pinyin.match(query_, p);
            if (d) matchData1.push(d);
        }

        if (this.plugin.settings.usePathToSearch && matchData1.length <= 10) {
            toMatchData = indexNode.itemIndexByPath.length == 0 ? this.items : indexNode.itemIndexByPath;
            for (let p of toMatchData.filter((p) => p.type == "file" && !matchData1.map((p) => p.item.path).includes(p.path))) {
                let d = p.pinyinOfPath.match(query_, p);
                if (d) matchData2.push(d);
            }
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

    renderSuggestion(matchData: MatchData, el: HTMLElement) {
        el.addClass("fz-item");
        let range = matchData.range,
            score = matchData.score,
            text: string,
            e_content = el.createEl("div", { cls: "fz-suggestion-content" }),
            e_title = e_content.createEl("div", { cls: "fz-suggestion-title" });

        switch (score) {
            case -1: {
                e_title.appendText(matchData.item.path);
                matchData.usePath = true;
                break;
            }
            case -2: {
                e_title.appendText(this.inputEl.value);
                return;
            }
            default: {
                text = matchData.usePath ? matchData.item.path : matchData.item.name;

                let index = 0;
                for (const r of range) {
                    e_title.appendText(text.slice(index, r[0]));
                    e_title.createSpan({ cls: "suggestion-highlight", text: text.slice(r[0], r[1] + 1) });
                    index = r[1] + 1;
                }
                e_title.appendText(text.slice(index));
                break;
            }
        }

        if (this.plugin.settings.showTags) {
            let tags: string | Array<string> =
                app.metadataCache.getFileCache(matchData.item.file)?.frontmatter?.tags ||
                app.metadataCache.getFileCache(matchData.item.file)?.frontmatter?.tag,
                tagArray: string[];
            if (tags) {
                tagArray = Array.isArray(tags) ? tags : String(tags).split(/, ?/);
                let tagEl = e_title.createDiv({ cls: "fz-suggestion-tags" });
                tagArray.forEach((p) => tagEl.createEl("a", { cls: "tag", text: p }));
            }
        }

        let e_note: HTMLDivElement = null;
        if (this.plugin.settings.showPath && !matchData.usePath)
            e_note = e_content.createEl("div", {
                cls: "fz-suggestion-note",
                text: matchData.item.path,
            });

        if (matchData.item.type == "alias") {
            let e_flair = el.createEl("span", {
                cls: "fz-suggestion-flair",
            });
            e_flair.innerHTML +=
                '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-forward"><polyline points="15 17 20 12 15 7"></polyline><path d="M4 18v-2a4 4 0 0 1 4-4h12"></path></svg>';
            if (!this.plugin.settings.showPath) e_flair.style.top = "9px";
            if (e_note) e_note.style.width = "calc(100% - 30px)";
        }
    }
    async onChooseSuggestion(matchData: MatchData, evt: MouseEvent | KeyboardEvent) {
        let file =
            matchData.score == -2
                ? await app.vault.create(app.fileManager.getNewFileParent("").path + "/" + this.inputEl.value + ".md", "")
                : matchData.item.file;
        if (evt.ctrlKey) {
            let nl = app.workspace.getLeaf("tab");
            nl.openFile(file);
        } else if (evt.altKey) {
            let nl = getNewOrAdjacentLeaf(app.workspace.getMostRecentLeaf());
            nl.openFile(file);
        } else {
            app.workspace.getMostRecentLeaf().openFile(file);
        }
    }
    onNoSuggestion(): void {
        this.chooser.setSuggestions([<MatchData>{ item: { type: "file" }, score: -2 }]);
        this.chooser.addMessage(this.emptyStateText);
    }
    async getChooseItemFile(): Promise<TFile> {
        let matchData = this.chooser.values[this.chooser.selectedItem];
        let file =
            matchData.score == -2
                ? await app.vault.create(app.fileManager.getNewFileParent("").path + "/" + this.inputEl.value + ".md", "")
                : matchData.item.file;
        return file;
    }
    onClose() {
        this.contentEl.empty();
    }
}

class FuzzySettingTab extends PluginSettingTab {
    plugin: Fuzyy_chinese;
    constructor(app: App, plugin: Fuzyy_chinese) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display(): void {
        let { containerEl } = this;
        containerEl.empty();
        containerEl.createEl("h2", { text: "设置" });
        new Setting(containerEl)
            .setName("显示附件")
            .setDesc("显示如图片、视频、PDF等附件文件。")
            .addToggle((text) =>
                text.setValue(this.plugin.settings.showAttachments).onChange(async (value) => {
                    this.plugin.settings.showAttachments = value;
                    await this.plugin.saveSettings();
                })
            );
        new Setting(containerEl)
            .setName("附件后缀").setDesc("只显示这些后缀的附件").addTextArea((text) => {
                text.inputEl.addClass('fuzzy-chinese-attachment-extensions')
                text.setValue(this.plugin.settings.attachmentExtensions.join('\n')).onChange(async (value) => {
                    this.plugin.settings.attachmentExtensions = value.trim().split('\n').map(x => x.trim())
                    await this.plugin.saveSettings()
                })
            })
        new Setting(containerEl).setName("显示所有类型文件").addToggle((text) =>
            text.setValue(this.plugin.settings.showAllFileTypes).onChange(async (value) => {
                this.plugin.settings.showAllFileTypes = value;
                await this.plugin.saveSettings();
            })
        );
        new Setting(containerEl)
            .setName("使用路径搜索")
            .setDesc("当搜索结果少于10个时搜索路径")
            .addToggle((text) =>
                text.setValue(this.plugin.settings.usePathToSearch).onChange(async (value) => {
                    this.plugin.settings.usePathToSearch = value;
                    await this.plugin.saveSettings();
                })
            );
        new Setting(containerEl).setName("显示路径").addToggle((text) =>
            text.setValue(this.plugin.settings.showPath).onChange(async (value) => {
                this.plugin.settings.showPath = value;
                await this.plugin.saveSettings();
            })
        );
        new Setting(containerEl).setName("显示 Tag").addToggle((text) =>
            text.setValue(this.plugin.settings.showTags).onChange(async (value) => {
                this.plugin.settings.showTags = value;
                await this.plugin.saveSettings();
            })
        );
        new Setting(containerEl).setName("繁体支持").addToggle((text) => {
            text.setValue(this.plugin.settings.traditionalChineseSupport).onChange(async (value) => {
                this.plugin.settings.traditionalChineseSupport = value;
                await this.plugin.saveSettings();
            });
        });
    }
}

// If there is only one leaf, create a new split and return it.
// If there are two or more, return a leaf that is not the currently displayed leaf.
// It means returning another leaf but don't create a new split.
// This code is based on the work of zsviczian (https://github.com/zsviczian).
// Original code: https://github.com/zsviczian/obsidian-excalidraw-plugin.
const getNewOrAdjacentLeaf = (leaf: WorkspaceLeaf): WorkspaceLeaf => {
    const layout = app.workspace.getLayout();
    const getLeaves = (l: any) =>
        l.children
            .filter((c: any) => c.type !== "leaf")
            .map((c: any) => getLeaves(c))
            .flat()
            .concat(l.children.filter((c: any) => c.type === "leaf").map((c: any) => c.id));

    const mainLeavesIds = getLeaves(layout.main);

    const getMainLeaf = (): WorkspaceLeaf => {
        let mainLeaf = app.workspace.getMostRecentLeaf();
        if (mainLeaf && mainLeaf !== leaf && mainLeaf.view?.containerEl.ownerDocument === document) {
            return mainLeaf;
        }

        mainLeavesIds.forEach((id: any) => {
            const l = app.workspace.getLeafById(id);
            if ((leaf.parent.id == l.parent.id && mainLeaf) || !l.view?.navigation || leaf === l) return;
            mainLeaf = l;
        });
        let newLeaf: WorkspaceLeaf;
        if (mainLeaf.parent.id == leaf.parent.id) newLeaf = app.workspace.getLeaf("split");
        else newLeaf = app.workspace.createLeafInTabGroup(mainLeaf.parent);
        return newLeaf;
    };

    const ml = getMainLeaf();
    return ml ?? app.workspace.getLeaf(true);
};

class HistoryMatchDataNode {
    query: string[1];
    next: HistoryMatchDataNode;
    itemIndex: Array<Item>;
    itemIndexByPath: Array<Item>;
    constructor(query: string[1]) {
        this.init(query);
    }
    push(query: string[1]) {
        let node = new HistoryMatchDataNode(query);
        this.next = node;
        return node;
    }
    index(index: number) {
        let node: HistoryMatchDataNode = this;
        for (let i = 0; i < index; i++) {
            if (node.next) node = node.next;
            else return;
        }
        return node;
    }
    init(query: string[1]) {
        this.query = query;
        this.next = null;
        this.itemIndex = [];
        this.itemIndexByPath = [];
    }
}

class Pinyin extends Array<PinyinChild> {
    query: string;
    usePath: boolean;
    constructor(query: string, usePath = false) {
        super();
        this.usePath = usePath;
        this.query = query.toLowerCase();
        this.query.split("").forEach((p) => {
            let index = PinyinValues.map((q, i) => (q.includes(p) ? i : null)).filter((p) => p);
            this.push({
                type: index.length == 0 ? "other" : "pinyin",
                character: p,
                pinyin: index.length == 0 ? p : PinyinKeys.filter((_, i) => index.includes(i)),
            });
        });
    }
    getScore(range: Array<[number, number]>) {
        let score = 0;
        score += 40 / (this.query.length - range.reduce((p, i) => p + i[1] - i[0] + 1, 0)); //覆盖越广分越高
        if (range[0][0] == 0) score += 8; //顶头加分
        score += 20 / range.length; //分割越少分越高
        return score;
    }
    getRange(query: Query): Array<[number, number]> | false {
        let index = 0,
            list: Array<number> = [],
            currentStr: string = query[index].query;
        for (let i = 0; i < this.length; i++) {
            let el = this[i],
                type = query[index].type;
            switch (type) {
                case "pinyin": {
                    if (el.type == "pinyin") {
                        let f = (<Array<string>>el.pinyin).map((pinyin) => currentStr.startsWith(pinyin) || pinyin.startsWith(currentStr));
                        if (f.some((p) => p)) {
                            list.push(i);
                            currentStr = currentStr.substring(el.pinyin[f.findIndex((p) => p)].length);
                        } else if ((<Array<string>>el.pinyin).some((pinyin) => pinyin.startsWith(currentStr[0]))) {
                            list.push(i);
                            currentStr = currentStr.substring(1);
                        }
                    } else if (el.character == currentStr[0]) {
                        list.push(i);
                        currentStr = currentStr.substring(1);
                    }
                    break;
                }
                case "chinese":
                case "punctuation": {
                    if (el.character == currentStr[0]) {
                        list.push(i);
                        currentStr = currentStr.substring(1);
                    }
                    break;
                }
            }
            if (currentStr.length == 0) {
                if (index == query.length - 1) break;
                index++;
                currentStr = query[index].query;
            }
        }
        return list.length == 0 || index != query.length - 1 || currentStr.length != 0 ? false : toRanges(list);
    }
    match(query: Query, item: Item): MatchData | false {
        let range = this.getRange(query);
        if (!range) return false;
        let data: MatchData = {
            item: item,
            score: this.getScore(range),
            range: range,
            usePath: this.usePath,
        };
        return data;
    }
}

type PinyinChild = {
    type: "pinyin" | "other";
    character: string[1];
    pinyin: string | string[]; // pinyin: pinyin of Chinese characters, only for cc type nodes. For ot, it is itself.
};

// 将一个有序的数字数组转换为一个由连续数字区间组成的数组
// console.log(toRanges([2, 3, 5, 7, 8])); // 输出: [[2,3],[5,5],[7,8]]
function toRanges(arr: Array<number>): Array<[number, number]> {
    const result = [];
    let start = arr[0];
    let end = arr[0];
    for (let i = 1; i < arr.length; i++) {
        if (arr[i] === end + 1) {
            end = arr[i];
        } else {
            result.push([start, end]);
            start = arr[i];
            end = arr[i];
        }
    }
    result.push([start, end]);
    return result;
}

class Query extends Array<QueryChild> {
    length: number;
    constructor(query: string) {
        super();
        this.splitQuery(query);
        this.length = this.length;
    }
    splitQuery(s: string) {
        let result = [];
        let types = [];
        let currentStr = "";
        for (let i = 0; i < s.length; i++) {
            let char = s[i];
            if (char === " ") {
                if (currentStr) {
                    this.push({ type: this.getType(currentStr), query: currentStr });
                    currentStr = "";
                }
            } else if (this.isPunctuation(char)) {
                if (currentStr) {
                    this.push({ type: this.getType(currentStr), query: currentStr });
                    currentStr = "";
                }
                result.push(char);
                types.push("punctuation");
            } else if (i > 0 && this.isChinese(char) !== this.isChinese(s[i - 1])) {
                if (currentStr) {
                    this.push({ type: this.getType(currentStr), query: currentStr });
                    currentStr = "";
                }
                currentStr += char;
            } else {
                currentStr += char;
            }
        }
        if (currentStr) {
            this.push({ type: this.getType(currentStr), query: currentStr });
        }
    }

    getType(s: string) {
        if (this.isChinese(s[0])) return "chinese";
        else return "pinyin";
        // } else if (this.isFullPinyin(s)) {
        //     return "full";
        // } else {
        //     return "first";
        // }
    }

    isChinese(char: string) {
        return /[\u4e00-\u9fa5]/.test(char);
    }

    isPunctuation(char: string) {
        return /[，。？！：；‘’“”【】（）《》,.?!:;"'(){}\[\]<>]/.test(char);
    }

    // isFullPinyin(s: string): boolean {
    //     if (s.length === 0) {
    //         return true;
    //     }
    //     for (let pinyin of PinyinKeys) {
    //         if (s.startsWith(pinyin)) {
    //             if (this.isFullPinyin(s.slice(pinyin.length))) {
    //                 return true;
    //             }
    //         }
    //     }
    //     if (PinyinKeys.some((p) => p.startsWith(s))) {
    //         return true;
    //     } else {
    //         return false;
    //     }
    // }
}

type QueryChild = {
    type: "chinese" | "pinyin" | "punctuation";
    query: string;
};

class PinyinIndex extends Component {
    vault: Vault;
    metadataCache: MetadataCache;
    plugin: Fuzyy_chinese;
    items: Array<Item>;
    constructor(app: App, plugin: Fuzyy_chinese) {
        super();
        this.plugin = plugin;
        this.vault = app.vault;
        this.metadataCache = app.metadataCache;
        this.initEvent();
        this.initIndex();
    }
    initIndex() {
        let files: Array<TFile>,
            startTime = Date.now();
        files = app.vault.getFiles().filter(f => this.isEffectiveFile(f))

        this.items = files.map((file) => TFile2Item(file));

        for (let file of files) {
            if (file.extension != "md") continue;
            this.items = this.items.concat(CachedMetadata2Item(file));
        }
        console.log(`Fuzzy Chinese Pinyin: Indexing completed, totaling ${files.length} files, taking ${(Date.now() - startTime) / 1000.0}s`);
    }
    initEvent() {
        this.registerEvent(
            this.metadataCache.on("changed", (file, data, cache) => {
                this.update("changed", file, { data, cache });
            })
        );
        this.registerEvent(this.vault.on("rename", (file, oldPath) => this.update("rename", file, { oldPath })));
        this.registerEvent(this.vault.on("create", (file) => this.update("create", file)));
        this.registerEvent(
            this.vault.on("delete", (file) => {
                this.update("delete", file);
            })
        );
    }
    update(type: string, f: TAbstractFile, keys?: { oldPath?: string; data?: string; cache?: CachedMetadata }) {
        if (!this.isEffectiveFile(f)) return;
        let file = f as TFile;
        switch (type) {
            case "changed": {
                this.items = this.items.filter((item) => !(item.path == file.path && item.type == "alias")).concat(CachedMetadata2Item(file, keys.cache));
                break;
            }
            case "create": {
                this.items.push(TFile2Item(file));
                break;
            }
            case "rename": {
                this.items = this.items.filter((item) => item.path != keys.oldPath).concat(CachedMetadata2Item(file));
                this.items.push(TFile2Item(file));
                break;
            }
            case "delete": {
                this.items = this.items.filter((item) => item.path != file.path);
                break;
            }
        }
    }

    isEffectiveFile(file: TAbstractFile) {
        if (!(file instanceof TFile)) return false;

        if (this.plugin.settings.showAllFileTypes) return true;
        else if (DOCUMENT_EXTENSIONS.includes(file.extension)) return true;
        else if (this.plugin.settings.showAttachments && this.plugin.settings.attachmentExtensions.includes(file.extension)) return true;
        else return false;
    }
}

function TFile2Item(file: TFile): Item {
    let name = file.extension != "md" ? file.name : file.basename;
    return { type: "file", file: file, name: name, pinyin: new Pinyin(name), path: file.path, pinyinOfPath: new Pinyin(file.path, true) };
}

function CachedMetadata2Item(file: TFile, cache?: CachedMetadata): Item[] {
    cache = cache ?? app.metadataCache.getFileCache(file);
    let alias = cache?.frontmatter?.alias || cache?.frontmatter?.aliases;
    if (alias) {
        alias = Array.isArray(alias) ? alias : String(alias).split(/, ?/);
        return alias.map((p: string) => {
            return {
                type: "alias",
                name: p,
                pinyin: new Pinyin(p),
                path: file.path,
                pinyinOfPath: new Pinyin(file.path, true),
                file: file,
            };
        });
    } else return [];
}
