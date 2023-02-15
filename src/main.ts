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

var Re = ["bmp", "png", "jpg", "jpeg", "gif", "svg", "webp"],
    He = ["mp3", "wav", "m4a", "3gp", "flac", "ogg", "oga", "opus"],
    Ve = ["mp4", "webm", "ogv", "mov", "mkv"],
    ze = ["pdf"],
    qe = ["md"],
    Ue = ["json", "css", "js"],
    _e = [].concat(Re, He, Ve, ze, qe, ["canvas"]);

interface Fuzyy_chineseSettings {
    showAllFileTypes: boolean;
    showAttachments: boolean;
    usePathToSeatch: boolean;
}

const DEFAULT_SETTINGS: Fuzyy_chineseSettings = {
    showAttachments: false,
    showAllFileTypes: false,
    usePathToSeatch: false,
};

export default class Fuzyy_chinese extends Plugin {
    settings: Fuzyy_chineseSettings;
    api = new SampleModal(this.app, this);
    async onload() {
        await this.loadSettings();
        this.addCommand({
            id: "open-search",
            name: "Open Search",
            checkCallback: (checking: boolean) => {
                let leaf = this.app.workspace.getMostRecentLeaf();
                if (leaf) {
                    if (!checking) {
                        new SampleModal(this.app, this).open();
                    }
                    return true;
                }
                return false;
            },
        });
        this.addSettingTab(new SampleSettingTab(this.app, this));
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

class SampleModal extends SuggestModal<TFile> {
    Files: TFile[];
    data: any;
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
            nl.openFile(item.file);
            return false;
        });
        this.scope.register(["Mod", "Alt"], "Enter", (e) => {
            this.close();
            let item = this.chooser.values[this.chooser.selectedItem];
            let nl = app.workspace.getLeaf("split");
            nl.openFile(item.file);
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
            nl.openFile(item.file);
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
                newLeaf.openFile(item.file);
                return false;
            });
    }
    onOpen() {
        if (this.plugin.settings.showAllFileTypes)
            this.Files = app.vault.getFiles();
        else if (this.plugin.settings.showAttachments)
            this.Files = app.vault
                .getFiles()
                .filter((f) => _e.includes(f.extension));
        else
            this.Files = app.vault
                .getMarkdownFiles()
                .concat(
                    app.vault.getFiles().filter((p) => p.extension == "canvas")
                );
        if (
            this.plugin.settings.showAttachments ||
            this.plugin.settings.showAllFileTypes
        )
            this.data = this.Files.map((file) => {
                if (file.extension != "md")
                    return {
                        type: "file",
                        name: file.name,
                        path: file.path,
                        file: file,
                    };
                else
                    return {
                        type: "file",
                        name: file.basename,
                        path: file.path,
                        file: file,
                    };
            });
        else
            this.data = this.Files.map((file) => {
                return {
                    type: "file",
                    name: file.basename,
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
                alias.map((p) =>
                    this.data.push({
                        type: "alias",
                        alias: p,
                        path: file.path,
                        file: file,
                    })
                );
            }
        }
        this.onInput();
    }

    getSuggestions(query: string): any[] {
        if (query == "") {
            let lastOpenFiles = app.workspace.getLastOpenFiles();
            lastOpenFiles = lastOpenFiles
                .map((p) =>
                    this.data.find((q) => q.type == "file" && q.path == p)
                )
                .filter((p) => p);
            return lastOpenFiles;
        }

        let query2 = query.split("").filter((p) => p != " ");
        let match_data = this.data.map((p) => {
            p = Object.assign({}, p);
            let match = [];
            let m: any = [-1, -1];
            let text = p.type == "file" ? p.name : p.alias;
            for (let i of query2) {
                text = text.slice(m[1] + 1);
                m = PinyinMatch.match(text, i);
                if (!m) return false;
                else match.push(m);
            }
            m = [match[0]];
            for (let i of match.slice(1)) {
                if (i[0] == 0) {
                    m[m.length - 1][1] += 1;
                } else {
                    let n = m[m.length - 1][1] + i[0] + 1;
                    m.push([n, n]);
                }
            }
            text = p.type == "file" ? p.name : p.alias;
            let score = 0;
            score += 40 / (text.length - match.length);
            if (m[0][0] == 0) score += 8;
            score += 20 / m.length;
            p.match = m;
            p.score = score;
            p.usePath = false;
            return p;
        });
        if (
            match_data.filter((p) => p).length < 10 &&
            this.plugin.settings.usePathToSeatch
        ) {
            match_data = match_data.concat(
                this.data
                    .filter(
                        (p) =>
                            !(
                                p.type == "file" &&
                                match_data.map((p) => p.path).includes(p.path)
                            )
                    )
                    .map((p) => {
                        p = Object.assign({}, p);
                        if (p.type == "alias") return false;
                        let match = [];
                        let m: any = [-1, -1];
                        let text = p.path;
                        for (let i of query2) {
                            text = text.slice(m[1] + 1);
                            m = PinyinMatch.match(text, i);
                            if (!m) return false;
                            else match.push(m);
                        }
                        m = [match[0]];
                        for (let i of match.slice(1)) {
                            if (i[0] == 0) {
                                m[m.length - 1][1] += 1;
                            } else {
                                let n = m[m.length - 1][1] + i[0] + 1;
                                m.push([n, n]);
                            }
                        }
                        text = p.path;
                        let score = 0;
                        score += 40 / (text.length - match.length);
                        if (m[0][0] == 0) score += 8;
                        score += 20 / m.length;
                        p.match = m;
                        p.score = score;
                        p.usePath = true;
                        return p;
                    })
            );
        }
        match_data = match_data
            .filter((p) => p)
            .sort((a, b) => b.score - a.score);
        return match_data;
    }
    renderSuggestion(item: any, el: HTMLElement) {
        let m = item?.match,
            text,
            t = "";
        if (m) {
            if (item.type == "file")
                if (item.usePath) text = item.path;
                else text = item.name;
            else text = item.alias;

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
            t = item.path;
            item.usePath = true;
        }
        let e1 = el.createEl("div", { cls: "fz-suggestion-content" });
        let e2 = e1.createEl("div", { cls: "fz-suggestion-title" });
        e2.innerHTML = t;
        if (!item.usePath)
            e1.createEl("div", { cls: "fz-suggestion-note", text: item.path });
        if (item.type == "alias")
            el.innerHTML +=
                '<span class="fz-suggestion-flair" aria-label="别名"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-forward"><polyline points="15 17 20 12 15 7"></polyline><path d="M4 18v-2a4 4 0 0 1 4-4h12"></path></svg></span>';
    }
    // Perform action on the selected suggestion.
    onChooseSuggestion(item: any, evt: MouseEvent | KeyboardEvent) {
        if (evt.ctrlKey) {
            let nl = app.workspace.getLeaf("tab");
            nl.openFile(item.file);
        } else if (evt.altKey) {
            let nl = getNewOrAdjacentLeaf(app.workspace.getMostRecentLeaf());
            nl.openFile(item.file);
        } else {
            app.workspace.getMostRecentLeaf().openFile(item.file);
        }
    }
    onClose() {
        let { contentEl } = this;
        contentEl.empty();
    }
}

class SampleSettingTab extends PluginSettingTab {
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
                    .setValue(this.plugin.settings.usePathToSeatch)
                    .onChange(async (value) => {
                        this.plugin.settings.usePathToSeatch = value;
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
