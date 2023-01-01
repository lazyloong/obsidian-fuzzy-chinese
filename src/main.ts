import {
    App,
    FuzzySuggestModal,
    Plugin,
    PluginSettingTab,
    Setting,
    TFile,
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
    async onload() {
        await this.loadSettings();
        this.addCommand({
            id: "open-search",
            name: "Open Search",
            // callback: () => {
            // 	console.log('Simple Callback');
            // },
            checkCallback: (checking: boolean) => {
                let leaf = this.app.workspace.activeLeaf;
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

class SampleModal extends FuzzySuggestModal<TFile> {
    Files: TFile[];
    pinyinEngine: any;
    data: any;
    plugin: Fuzyy_chinese;
    chooser: any;
    constructor(app: App, plugin: Fuzyy_chinese) {
        super(app, plugin);
        this.plugin = plugin;
        this.setInstructions([
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
                purpose: "打开到新面板",
            },
            {
                command: "ctrl p",
                purpose: "打开到新浮窗",
            },
        ]);
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
        this.scope.register(["Mod"], "p", (event: KeyboardEvent) => {
            this.close();
            let item = this.chooser.values[this.chooser.selectedItem];
            const newLeaf = app.plugins.plugins[
                "obsidian-hover-editor"
            ].spawnPopover(undefined, () =>
                this.app.workspace.setActiveLeaf(newLeaf, false, true)
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
    }
    getSuggestions(query: string): TFile[] {
        if (query == "") return;
        // let wb = workBreak(query);
        // console.log("w", wb);
        // wb = wb.map((p) => (Array.isArray(p) ? p[0].split(",") : p.split(",")));
        // console.log(wb);
        // wb = permutation_and_combination(wb);
        // console.log("wb", wb);

        // let query2 = wb;
        // // let query2 = [];
        // let temp1 = input_processing(query);
        // let temp2 = [];
        // // for (let i of temp1) {
        // //     if (i.length == 1 && i.charCodeAt(0) > 256) temp2.push(i);
        // //     else temp2 = temp2.concat(PinyinMatch.wordBreak(i, true));
        // // }
        // query2.push(query.split("").filter((p) => p != " "));
        // console.log(query2);
        // temp2 = temp2.reduce((a, p) => {
        //     if (Array.isArray(p)) a = a.concat(p);
        //     else a.push(p);
        //     return a;
        // }, []);
        // if (temp2.length != 0) query2.push(temp2);
        let query2 = query.split("").filter((p) => p != " ");
        let match_data = this.data.map((p) => {
            let match = [];
            let m = [-1, -1];
            let text = p.type == "file" ? p.name : p.alias;
            for (let i of query2) {
                text = text.slice(m[1] + 1);
                m = PinyinMatch.match(text, i);
                // if (p.path.includes("手把手"))
                //     console.log(query2, text, m, match);
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
                        if (p.type == "alias") return false;
                        let match = [];
                        let m = [-1, -1];
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
        let m = item.match,
            text;
        if (item.type == "file")
            if (item.usePath) text = item.path;
            else text = item.name;
        else text = item.alias;
        let t = "";
        t += text.slice(0, m[0][0]);
        for (let i in m) {
            if (i > 0) {
                t += text.slice(m[i - 1][1] + 1, m[i][0]);
            }
            t += `<span class="suggestion-highlight">${text.slice(
                m[i][0],
                m[i][1] + 1
            )}</span>`;
        }
        t += text.slice(m.slice(-1)[0][1] + 1);
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
    onChooseSuggestion(file: any, evt: MouseEvent | KeyboardEvent) {
        app.workspace.getMostRecentLeaf().openFile(file.file);
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
        containerEl.createEl("h2", { text: "Settings for my awesome plugin." });
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

function input_processing(input: string) {
    let i = 0,
        j = 0,
        o = [];
    for (i = 0; i < input.length; i++) {
        if (input.charCodeAt(i) > 256 && i != input.length - 1) {
            input.slice(j, i) == ""
                ? o.push(input.charAt(i))
                : o.push(input.slice(j, i), input.charAt(i));
            j = i + 1;
        } else if (input.charCodeAt(i) > 256 && i == input.length - 1) {
            input.slice(j, i) == ""
                ? o.push(input.charAt(i))
                : o.push(input.slice(j, i), input.charAt(i));
            break;
        }
        if (i == input.length - 1) o.push(input.slice(j));
    }
    return o;
}

function workBreak(s: string) {
    let sm = "bpmfdtnlgkhjqxrzcsyw",
        sp = "hng",
        t1 = [];
    for (let i of s) {
        if (sm.includes(i)) t1.push(i);
        else if (t1.length == 0) t1.push(i);
        else t1[t1.length - 1] += i;
    }
    for (let i = 0; i < t1.length; i++) {
        if (sp.includes(t1[i][0]) && i != 0) {
            t1.splice(i - 1, 2, t1[i - 1] + t1[i]);
            i -= 1;
        }
    }
    for (let i in t1) {
        if (t1[i].length > 1)
            if (PinyinMatch.wordBreak(t1[i], false).length == 0) continue;
            else t1 = PinyinMatch.wordBreak(t1[i], false);
    }
    return t1;
}

function permutation_and_combination(arr) {
    let t1 = [],
        t2 = [],
        n = 0;
    for (let i = 0; i < arr.length; i++) {
        if (Array.isArray(arr[i])) {
            n += 1;
            for (let j of arr[i]) {
                t2 = arr.slice();
                t2.splice(i, 1, j);
                t1 = t1.concat(permutation_and_combination(t2));
            }
        }
    }
    if (n == 0) t1 = [arr];
    let obj = {};
    t1.forEach((item) => (obj[item] = item));
    t1 = Object.values(obj);
    return t1;
}
