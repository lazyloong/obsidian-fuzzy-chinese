import { App, Plugin, PluginSettingTab, Setting, SuggestModal, TFile, WorkspaceLeaf } from "obsidian";
import PinyinMatch from "pinyin-match";
import Chinese from "chinese-s2t";

let extension = {
    attachment: [
        "bmp",
        "png",
        "jpg",
        "jpeg",
        "gif",
        "svg",
        "webp",
        "mp3",
        "wav",
        "m4a",
        "3gp",
        "flac",
        "ogg",
        "oga",
        "opus",
        "mp4",
        "webm",
        "ogv",
        "mov",
        "mkv",
        "pdf",
        "md",
        "canvas",
    ],
    normal: ["md", "canvas"],
};

interface Fuzyy_chineseSettings {
    traditionalChineseSupport: boolean;
    showAllFileTypes: boolean;
    showAttachments: boolean;
    usePathToSearch: boolean;
    showPath: boolean;
    showTags: boolean;
}

const DEFAULT_SETTINGS: Fuzyy_chineseSettings = {
    traditionalChineseSupport: false,
    showAttachments: false,
    showAllFileTypes: false,
    usePathToSearch: false,
    showPath: true,
    showTags: false,
};

export default class Fuzyy_chinese extends Plugin {
    settings: Fuzyy_chineseSettings;
    api = { modal: new FuzzyModal(this.app, this), match: PinyinMatch.match, Chinese: Chinese };
    async onload() {
        await this.loadSettings();
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
    }
    onunload() {}
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }
    async saveSettings() {
        await this.saveData(this.settings);
    }
}

type Item = {
    index: number;
    file: TFile;
    type: "file" | "alias";
    name: string;
    path: string;
};

type MatchData = {
    item: Item;
    score: number;
    match: Array<[number, number]>;
    usePath?: boolean;
};

class FuzzyModal extends SuggestModal<MatchData> {
    Files: TFile[];
    items: Item[];
    lastMatchData: lastMatchDataNode;
    plugin: Fuzyy_chinese;
    chooser: any;
    constructor(app: App, plugin: Fuzyy_chinese) {
        super(app);
        this.plugin = plugin;
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
        this.emptyStateText = "未发现该笔记";
        this.scope.register(["Mod"], "Enter", (e) => {
            this.close();
            let item = this.chooser.values[this.chooser.selectedItem];
            let nl = app.workspace.getLeaf("tab");
            nl.openFile(item.item.file);
        });
        this.scope.register(["Mod", "Alt"], "Enter", (e) => {
            this.close();
            let item = this.chooser.values[this.chooser.selectedItem];
            let nl = app.workspace.getLeaf("split");
            nl.openFile(item.item.file);
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
            let item = this.chooser.values[this.chooser.selectedItem];
            let nl = getNewOrAdjacentLeaf(app.workspace.getMostRecentLeaf());
            nl.openFile(item.item.file);
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
        if (this.plugin.settings.showAllFileTypes) this.Files = app.vault.getFiles();
        else if (this.plugin.settings.showAttachments) this.Files = app.vault.getFiles().filter((f) => extension.attachment.includes(f.extension));
        else this.Files = app.vault.getFiles().filter((f) => extension.normal.includes(f.extension));

        let index = 0;
        this.items = this.Files.map((file) => {
            return {
                index: index++,
                type: "file",
                name: file.extension != "md" ? file.name : file.basename,
                path: file.path,
                file: file,
            };
        });

        for (let file of this.Files) {
            if (file.extension != "md") continue;
            let alias = app.metadataCache.getFileCache(file)?.frontmatter?.alias || app.metadataCache.getFileCache(file)?.frontmatter?.aliases;
            if (alias) {
                alias = typeof alias == "string" ? alias.split(", ") : String(alias).split(", ");
                alias.map((p: string) =>
                    this.items.push({
                        index: index++,
                        type: "alias",
                        name: p,
                        path: file.path,
                        file: file,
                    })
                );
            }
        }
        this.onInput();
    }

    getSuggestions(query: string): MatchData[] {
        if (query == "") {
            this.lastMatchData = new lastMatchDataNode("\0");
            // this.lastMatchData.itemIndex = this.items.map((p, i) => i);
            let lastOpenFiles: MatchData[] = app.workspace
                .getLastOpenFiles()
                .map((p) => this.items.find((q) => q.type == "file" && q.path == p))
                .filter((p) => p)
                .map((p) => {
                    return {
                        item: p,
                        score: 0,
                        match: [[-1, -1]],
                    };
                });
            return lastOpenFiles;
        }

        let query1 = query.split(" ").filter((p) => p.length != 0),
            query2 = query.split("").filter((p) => p != " "),
            matchData: MatchData[] = [],
            matchData1: MatchData[] = [],
            matchData2: MatchData[] = [];

        let node: lastMatchDataNode = this.lastMatchData,
            lastNode: lastMatchDataNode,
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

        let indexNode = this.lastMatchData.index(index - 1),
            toMatchData = indexNode.itemIndex.length == 0 ? this.items : indexNode.itemIndex.map((p) => this.items[p]);
        for (let p of toMatchData) {
            let d = this.getMatchData(p, query1, query2);
            if (d) matchData1.push(d);
        }

        if (this.plugin.settings.usePathToSearch && matchData1.length <= 10) {
            toMatchData = indexNode.itemIndexByPath.length == 0 ? indexNode.itemIndexByPath.map((p) => this.items[p]) : this.items;
            for (let p of toMatchData.filter((p) => p.type == "file" && !matchData1.map((p) => p.item.path).includes(p.path))) {
                let d = this.getMatchData(p, query1, query2, true);
                if (d) matchData2.push(d);
            }
        }
        matchData = matchData1.concat(matchData2);
        matchData = matchData.sort((a, b) => b.score - a.score);
        // 记录数据以便下次匹配可以使用
        if (!lastNode) lastNode = this.lastMatchData;
        lastNode.itemIndex = matchData1.map((p) => p.item.index);
        lastNode.itemIndexByPath = matchData2.map((p) => p.item.index);
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

    getMatchData(item: Item, query1: string[], query2: string[], usePath = false) {
        let match: Array<[number, number]> = [],
            m: any = [-1, -1],
            text = usePath ? item.path : item.name;
        text = this.plugin.settings.traditionalChineseSupport ? Chinese.t2s(text) : text;
        match = [];
        let t = text;
        for (let i of query1) {
            t = match.length == 0 ? text : text.slice(match.last()[1] + 1);
            m = PinyinMatch.match(t, i);
            if (!m) break;
            else {
                m = match.length == 0 ? m : m.map((p) => p + match.last()[1] + 1);
                match.push(m);
            }
        }
        if (!m) {
            match = [];
            let t = text;
            for (let i of query2) {
                t = t.slice(m[1] + 1);
                m = PinyinMatch.match(t, i);
                if (!m) return;
                else {
                    if (match.length == 0) match.push(m);
                    else {
                        if (m[0] == 0) match.last()[1] += 1;
                        else {
                            let n = match.last()[1] + m[0] + 1;
                            match.push([n, n]);
                        }
                    }
                }
            }
        }

        let score = 0;
        score +=
            40 /
            (text.length -
                match
                    .map((p) => p[1] - p[0])
                    .reduce((p, v) => {
                        return p + v;
                    }, 0)); //覆盖越广分越高
        if (match[0][0] == 0) score += 8; //顶头加分
        score += 20 / match.length; //分割越少分越高
        let data: MatchData = {
            item: item,
            score: score,
            match: match,
            usePath: usePath,
        };
        return data;
    }

    renderSuggestion(item: MatchData, el: HTMLElement) {
        el.addClass("fz-item");
        let m = item.match,
            text: string,
            e_content = el.createEl("div", { cls: "fz-suggestion-content" }),
            e_title = e_content.createEl("div", { cls: "fz-suggestion-title" });

        if (m[0][0] != -1) {
            if (item.usePath) text = item.item.path;
            else text = item.item.name;

            e_title.appendText(text.slice(0, m[0][0]));

            for (let i = 0; i < m.length; i++) {
                if (i > 0) {
                    e_title.appendText(text.slice(m[i - 1][1] + 1, m[i][0]));
                }
                e_title.createSpan({ cls: "suggestion-highlight", text: text.slice(m[i][0], m[i][1] + 1) });
            }
            e_title.appendText(text.slice(m.slice(-1)[0][1] + 1));
        } else {
            e_title.appendText(item.item.path);
            item.usePath = true;
        }
        if (this.plugin.settings.showTags) {
            let tags: any = app.metadataCache.getFileCache(item.item.file).frontmatter?.["tags"],
                tagArray: string[];
            if (tags) {
                if (typeof tags == "string" && tags != "")
                    tagArray = tags
                        .split(/(,| )/)
                        .filter((p) => p.replace(",", "").trim().length != 0)
                        .map((p) => p.trim());
                else if (tags instanceof Array) tagArray = tags;
                let tagEl = e_title.createDiv({ cls: "fz-suggestion-tags" });
                tagArray.forEach((p) => tagEl.createEl("a", { cls: "tag", text: p }));
            }
        }
        let e_note: HTMLDivElement;
        if (this.plugin.settings.showPath && !item.usePath)
            e_note = e_content.createEl("div", {
                cls: "fz-suggestion-note",
                text: item.item.path,
            });
        if (item.item.type == "alias") {
            let e_flair = el.createEl("span", {
                cls: "fz-suggestion-flair",
            });
            e_flair.innerHTML +=
                '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-forward"><polyline points="15 17 20 12 15 7"></polyline><path d="M4 18v-2a4 4 0 0 1 4-4h12"></path></svg>';
            if (!this.plugin.settings.showPath) e_flair.style.top = "9px";
            if (e_note) e_note.style.width = "calc(100% - 30px)";
        }
    }
    // Perform action on the selected suggestion.
    onChooseSuggestion(item: MatchData, evt: MouseEvent | KeyboardEvent) {
        if (evt.ctrlKey) {
            let nl = app.workspace.getLeaf("tab");
            nl.openFile(item.item.file);
        } else if (evt.altKey) {
            let nl = getNewOrAdjacentLeaf(app.workspace.getMostRecentLeaf());
            nl.openFile(item.item.file);
        } else {
            app.workspace.getMostRecentLeaf().openFile(item.item.file);
        }
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
            text.setValue(this.plugin.settings.showTags).onChange(async (value) => {
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

class lastMatchDataNode {
    query: string[1];
    next: lastMatchDataNode;
    itemIndex: number[];
    itemIndexByPath: number[];
    constructor(query: string[1]) {
        this.init(query);
    }
    push(query: string[1]) {
        let node = new lastMatchDataNode(query);
        this.next = node;
        return node;
    }
    index(index: number) {
        let node: lastMatchDataNode = this;
        for (let i = 0; i < index; i++) {
            if (node.next) node = node.next;
            else return null;
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
