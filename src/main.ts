import { App, SuggestModal, Plugin, PluginSettingTab, Setting, TFile, WorkspaceLeaf } from "obsidian";
import PinyinMatch from "pinyin-match";

let Re = ["bmp", "png", "jpg", "jpeg", "gif", "svg", "webp"],
    He = ["mp3", "wav", "m4a", "3gp", "flac", "ogg", "oga", "opus"],
    Ve = ["mp4", "webm", "ogv", "mov", "mkv"],
    ze = ["pdf"],
    qe = ["md"],
    Ue = ["json", "css", "js"],
    _e = [].concat(Re, He, Ve, ze, qe, ["canvas"]);

let extension = {
    attachment: _e,
    normal: ["md", "canvas"],
};

interface Fuzyy_chineseSettings {
    showAllFileTypes: boolean;
    showAttachments: boolean;
    usePathToSearch: boolean;
    showTags: boolean;
}

const DEFAULT_SETTINGS: Fuzyy_chineseSettings = {
    showAttachments: false,
    showAllFileTypes: false,
    usePathToSearch: false,
    showTags: false,
};

export default class Fuzyy_chinese extends Plugin {
    settings: Fuzyy_chineseSettings;
    api = { modal: new FuzzyModal(this.app, this), match: PinyinMatch.match };
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
        this.addRibbonIcon("search", "FuzzySearch", (e) => {
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
                command: "ctrl ???",
                purpose: "?????????????????????",
            },
            {
                command: "ctrl alt ???",
                purpose: "??????????????????",
            },
            {
                command: "alt ???",
                purpose: "?????????????????????",
            },
            {
                command: "shift ???",
                purpose: "???????????????",
            },
            {
                command: "ctrl shift ???",
                purpose: "??????????????????????????????",
            },
            {
                command: "shift alt ???",
                purpose: "??????????????????????????????",
            },
        ];
        if (app.plugins.plugins["obsidian-hover-editor"])
            prompt.push({
                command: "ctrl p",
                purpose: "??????????????????",
            });

        this.setInstructions(prompt);
        this.emptyStateText = "??????????????????";
        this.scope.register(["Mod"], "Enter", (e) => {
            this.close();
            let item = this.chooser.values[this.chooser.selectedItem];
            let nl = app.workspace.getLeaf("tab");
            nl.openFile(item.item.file);
            return false;
        });
        this.scope.register(["Mod", "Alt"], "Enter", (e) => {
            this.close();
            let item = this.chooser.values[this.chooser.selectedItem];
            let nl = app.workspace.getLeaf("split");
            nl.openFile(item.item.file);
            return false;
        });
        this.scope.register(["Shift"], "Enter", async (e) => {
            if (this.inputEl.value == "") return;
            this.close();
            let nf = await app.vault.create(app.vault.config.newFileFolderPath + "/" + this.inputEl.value + ".md", "");
            app.workspace.getMostRecentLeaf().openFile(nf);
            return false;
        });
        this.scope.register(["Mod", "Shift"], "Enter", async (e) => {
            if (this.inputEl.value == "") return;
            this.close();
            let nf = await app.vault.create(app.vault.config.newFileFolderPath + "/" + this.inputEl.value + ".md", "");
            app.workspace.getLeaf("tab").openFile(nf);
            return false;
        });
        this.scope.register(["Shift", "Alt"], "Enter", async (e) => {
            if (this.inputEl.value == "") return;
            this.close();
            let nf = await app.vault.create(app.vault.config.newFileFolderPath + "/" + this.inputEl.value + ".md", "");
            getNewOrAdjacentLeaf(app.workspace.getMostRecentLeaf()).openFile(nf);
            return false;
        });
        this.scope.register(["Alt"], "Enter", async (e) => {
            this.close();
            let item = this.chooser.values[this.chooser.selectedItem];
            let nl = getNewOrAdjacentLeaf(app.workspace.getMostRecentLeaf());
            nl.openFile(item.item.file);
            return false;
        });
        if (app.plugins.plugins["obsidian-hover-editor"])
            this.scope.register(["Mod"], "p", (event: KeyboardEvent) => {
                this.close();
                let item = this.chooser.values[this.chooser.selectedItem];
                const newLeaf = app.plugins.plugins["obsidian-hover-editor"].spawnPopover(undefined, () => this.app.workspace.setActiveLeaf(newLeaf));
                newLeaf.openFile(item.item.file);
                return false;
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
                alias = alias.split(", ");
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
            query2 = query.split("").filter((p) => p != " ");
        let matchData: MatchData[] = [];

        let node: lastMatchDataNode = this.lastMatchData,
            lastNode: lastMatchDataNode,
            index = 0,
            _f = true;
        for (let i of query) {
            if (!node || i != node.query) {
                if (node != this.lastMatchData) {
                    node = lastNode.push(
                        i,
                        matchData.map((p) => p.item.index)
                    );
                } else node.query = i;
                _f = false;
            }
            lastNode = node;
            node = node.next;
            if (_f) index++;
        }

        let indexNode = this.lastMatchData.index(index - 1),
            toMatchData = indexNode.itemIndex ? indexNode.itemIndex.map((p) => this.items[p]) : this.items;
        for (let p of toMatchData) {
            let d = this.getMatchData(p, query1, query2);
            if (d) matchData.push(d);
        }

        let matchData_: MatchData[] = [];
        if (this.plugin.settings.usePathToSearch) {
            toMatchData = indexNode.itemIndexByPath ? indexNode.itemIndexByPath.map((p) => this.items[p]) : this.items;
            for (let p of toMatchData.filter((p) => p.type == "file" && !matchData.map((p) => p.item.path).includes(p.path))) {
                let d = this.getMatchData(p, query1, query2, true);
                if (d) matchData_.push(d);
            }
            if (matchData.length <= 10) matchData = matchData.concat(matchData_);
        }
        matchData = matchData.sort((a, b) => b.score - a.score);
        if (!lastNode) lastNode = this.lastMatchData;
        lastNode.itemIndex = matchData.map((p) => p.item.index);
        lastNode.itemIndexByPath = matchData_.map((p) => p.item.index);
        return matchData;
    }

    getMatchData(item: Item, query1: string[], query2: string[], usePath = false) {
        let match: Array<[number, number]> = [],
            m: any = [-1, -1],
            text = usePath ? item.path : item.name;
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
                    }, 0)); //?????????????????????
        if (match[0][0] == 0) score += 8; //????????????
        score += 20 / match.length; //?????????????????????
        let data: MatchData = {
            item: item,
            score: score,
            match: match,
            usePath: usePath,
        };
        return data;
    }

    renderSuggestion(item: MatchData, el: HTMLElement) {
        let m = item.match,
            text: string,
            t = "";
        if (m[0][0] != -1) {
            if (item.usePath) text = item.item.path;
            else text = item.item.name;

            t += text.slice(0, m[0][0]);

            for (let i = 0; i < m.length; i++) {
                if (i > 0) {
                    t += text.slice(m[i - 1][1] + 1, m[i][0]);
                }
                t += `<span class="suggestion-highlight">${text.slice(m[i][0], m[i][1] + 1)}</span>`;
            }
            t += text.slice(m.slice(-1)[0][1] + 1);
        } else {
            t = item.item.path;
            item.usePath = true;
        }
        if (this.plugin.settings.showTags) {
            let tags: string = app.metadataCache.getFileCache(item.item.file).frontmatter?.["tags"],
                tagArray: string[];
            if (tags && tags != "") {
                tagArray = tags
                    .split(/(,| )/)
                    .filter((p) => p.replace(",", "").trim().length != 0)
                    .map((p) => p.trim());
                tagArray = tagArray.map((p) => `<a class="tag">#${p}</a>`);
                t += `<div class="fz-suggestion-tags">${tagArray.join("")}</div>`;
            }
        }
        let e1 = el.createEl("div", { cls: "fz-suggestion-content" });
        let e2 = e1.createEl("div", { cls: "fz-suggestion-title" });
        e2.innerHTML = t;
        if (!item.usePath)
            e1.createEl("div", {
                cls: "fz-suggestion-note",
                text: item.item.path,
            });
        if (item.item.type == "alias")
            el.innerHTML +=
                '<span class="fz-suggestion-flair" aria-label="??????"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-forward"><polyline points="15 17 20 12 15 7"></polyline><path d="M4 18v-2a4 4 0 0 1 4-4h12"></path></svg></span>';
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
        containerEl.createEl("h2", { text: "??????" });
        new Setting(containerEl)
            .setName("????????????")
            .setDesc("???????????????????????????PDF??????????????????")
            .addToggle((text) =>
                text.setValue(this.plugin.settings.showAttachments).onChange(async (value) => {
                    this.plugin.settings.showAttachments = value;
                    await this.plugin.saveSettings();
                })
            );
        new Setting(containerEl).setName("????????????????????????").addToggle((text) =>
            text.setValue(this.plugin.settings.showAllFileTypes).onChange(async (value) => {
                this.plugin.settings.showAllFileTypes = value;
                await this.plugin.saveSettings();
            })
        );
        new Setting(containerEl)
            .setName("??????????????????")
            .setDesc("?????????????????????10??????????????????")
            .addToggle((text) =>
                text.setValue(this.plugin.settings.usePathToSearch).onChange(async (value) => {
                    this.plugin.settings.usePathToSearch = value;
                    await this.plugin.saveSettings();
                })
            );
        new Setting(containerEl).setName("?????? Tag").addToggle((text) =>
            text.setValue(this.plugin.settings.showTags).onChange(async (value) => {
                this.plugin.settings.showTags = value;
                await this.plugin.saveSettings();
            })
        );
    }
}

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
        this.query = query;
        this.next = null;
    }
    push(query: string[1], index: number[]) {
        let node = new lastMatchDataNode(query);
        node.itemIndex = index;
        this.next = node;
        return node;
    }
    index(index: number) {
        let node: lastMatchDataNode = this;
        for (let i = 0; i < index; i++) {
            if (node.next) node = node.next;
            else return undefined;
        }
        return node;
    }
}
