import {
    App,
    SuggestModal,
    Plugin,
    PluginSettingTab,
    Setting,
    TFile,
    WorkspaceLeaf,
} from "obsidian";
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
}

const DEFAULT_SETTINGS: Fuzyy_chineseSettings = {
    showAttachments: false,
    showAllFileTypes: false,
    usePathToSearch: false,
};

export default class Fuzyy_chinese extends Plugin {
    settings: Fuzyy_chineseSettings;
    api = new FuzzyModal(this.app, this);
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
        this.addSettingTab(new FuzzySettingTab(this.app, this));
    }
    onunload() {}
    async loadSettings() {
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            await this.loadData()
        );
    }
    async saveSettings() {
        await this.saveData(this.settings);
    }
}

type Item = {
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
    lastMatchData: Item[];
    lastQuery: string;
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
                command: "shift ↵",
                purpose: "创建新文件",
            },
            {
                command: "alt ↵",
                purpose: "打开到其他面板",
            },
        ];
        if (app.plugins.plugins["obsidian-hover-editor"])
            prompt.push({
                command: "ctrl p",
                purpose: "打开到新浮窗",
            });

        this.setInstructions(prompt);
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
            let nf = await app.vault.create(
                app.vault.config.newFileFolderPath +
                    "/" +
                    this.inputEl.value +
                    ".md",
                ""
            );
            app.workspace.getMostRecentLeaf().openFile(nf);
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
                const newLeaf = app.plugins.plugins[
                    "obsidian-hover-editor"
                ].spawnPopover(undefined, () =>
                    this.app.workspace.setActiveLeaf(newLeaf)
                );
                newLeaf.openFile(item.item.file);
                return false;
            });
    }
    onOpen() {
        if (this.plugin.settings.showAllFileTypes)
            this.Files = app.vault.getFiles();
        else if (this.plugin.settings.showAttachments)
            this.Files = app.vault
                .getFiles()
                .filter((f) => extension.attachment.includes(f.extension));
        else
            this.Files = app.vault
                .getFiles()
                .filter((f) => extension.normal.includes(f.extension));

        this.items = this.Files.map((file) => {
            return {
                type: "file",
                name: file.extension != "md" ? file.name : file.basename,
                path: file.path,
                file: file,
            };
        });

        for (let file of this.Files) {
            if (file.extension != "md") continue;
            let alias =
                app.metadataCache.getFileCache(file)?.frontmatter?.alias ||
                app.metadataCache.getFileCache(file)?.frontmatter?.aliases;
            if (alias) {
                alias = alias.split(", ");
                alias.map((p: string) =>
                    this.items.push({
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
            this.lastQuery = "";
            this.lastMatchData = [];
            let lastOpenFiles: MatchData[] = app.workspace
                .getLastOpenFiles()
                .map((p) =>
                    this.items.find((q) => q.type == "file" && q.path == p)
                )
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
        let toMatchData =
            this.lastMatchData.length == 0 ? this.items : this.lastMatchData;
        for (let p of toMatchData) {
            let d = getMatchData(p, query1, query2);
            if (d) matchData.push(d);
        }
        if (matchData.length < 10 && this.plugin.settings.usePathToSearch) {
            toMatchData = this.items;
            for (let p of toMatchData.filter(
                (p) =>
                    !(
                        p.type == "file" &&
                        matchData.map((p) => p.item.path).includes(p.path)
                    )
            )) {
                if (p.type == "alias") continue;
                let d = getMatchData(p, query1, query2, true);
                if (d) matchData.push(d);
            }
        }
        matchData = matchData.sort((a, b) => b.score - a.score);
        if (query.startsWith(this.lastQuery))
            this.lastMatchData = matchData.map((p) => p.item);
        else this.lastMatchData = [];
        this.lastQuery = query;
        return matchData;
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
                t += `<span class="suggestion-highlight">${text.slice(
                    m[i][0],
                    m[i][1] + 1
                )}</span>`;
            }
            t += text.slice(m.slice(-1)[0][1] + 1);
        } else {
            t = item.item.path;
            item.usePath = true;
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
                '<span class="fz-suggestion-flair" aria-label="别名"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-forward"><polyline points="15 17 20 12 15 7"></polyline><path d="M4 18v-2a4 4 0 0 1 4-4h12"></path></svg></span>';
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
                text
                    .setValue(this.plugin.settings.showAttachments)
                    .onChange(async (value) => {
                        this.plugin.settings.showAttachments = value;
                        await this.plugin.saveSettings();
                    })
            );
        new Setting(containerEl).setName("显示所有类型文件").addToggle((text) =>
            text
                .setValue(this.plugin.settings.showAllFileTypes)
                .onChange(async (value) => {
                    this.plugin.settings.showAllFileTypes = value;
                    await this.plugin.saveSettings();
                })
        );
        new Setting(containerEl)
            .setName("使用路径搜索")
            .setDesc("当搜索结果少于10个时搜索路径")
            .addToggle((text) =>
                text
                    .setValue(this.plugin.settings.usePathToSearch)
                    .onChange(async (value) => {
                        this.plugin.settings.usePathToSearch = value;
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
            .concat(
                l.children
                    .filter((c: any) => c.type === "leaf")
                    .map((c: any) => c.id)
            );

    const mainLeavesIds = getLeaves(layout.main);

    const getMainLeaf = (): WorkspaceLeaf => {
        let mainLeaf = app.workspace.getMostRecentLeaf();
        if (
            mainLeaf &&
            mainLeaf !== leaf &&
            mainLeaf.view?.containerEl.ownerDocument === document
        ) {
            return mainLeaf;
        }

        mainLeavesIds.forEach((id: any) => {
            const l = app.workspace.getLeafById(id);
            if (
                (leaf.parent.id == l.parent.id && mainLeaf) ||
                !l.view?.navigation ||
                leaf === l
            )
                return;
            mainLeaf = l;
        });
        let newLeaf: WorkspaceLeaf;
        if (mainLeaf.parent.id == leaf.parent.id)
            newLeaf = app.workspace.getLeaf("split");
        else newLeaf = app.workspace.createLeafInTabGroup(mainLeaf.parent);
        return newLeaf;
    };

    const ml = getMainLeaf();
    return ml ?? app.workspace.getLeaf(true);
};

function getMatchData(
    item: Item,
    query1: string[],
    query2: string[],
    usePath = false
) {
    let match = [],
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
                        let n = match.last()[1] + i[0] + 1;
                        match.push([n, n]);
                    }
                }
            }
        }
    }

    let score = 0;
    score += 40 / (text.length - match.length);
    if (match[0][0] == 0) score += 8;
    score += 20 / match.length;
    let data: MatchData = {
        item: item,
        score: score,
        match: match,
        usePath: usePath,
    };
    return data;
}
