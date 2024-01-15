import {
    TFile,
    App,
    WorkspaceLeaf,
    TAbstractFile,
    CachedMetadata,
    getIcon,
    TextComponent,
} from "obsidian";
import {
    Pinyin,
    PinyinIndex as PI,
    HistoryMatchDataNode,
    MatchData as uMatchData,
    Item as uItem,
} from "./utils";
import FuzzyChinesePinyinPlugin from "./main";
import FuzzyModal from "./fuzzyModal";
import { TextInputSuggest } from "templater/src/settings/suggesters/suggest";

const DOCUMENT_EXTENSIONS = ["md", "canvas"];

export type Item = {
    file: TFile;
    type: "file" | "alias" | "heading";
    name: string;
    pinyin: Pinyin;
    path: string;
    pinyinOfPath: Pinyin;
};

export type MatchData = {
    item: Item;
    score: number;
    range: Array<[number, number]>;
    usePath?: boolean;
};

export default class FuzzyFileModal extends FuzzyModal<Item> {
    plugin: FuzzyChinesePinyinPlugin;
    tags: string[] = [];
    tagInput: TagInput;
    constructor(app: App, plugin: FuzzyChinesePinyinPlugin) {
        super(app, plugin);
        this.useInput = true;
        this.index = this.plugin.addChild(new PinyinIndex(this.app, this.plugin));
        this.emptyStateText = "未发现该笔记，按下回车创建。";
        this.setPlaceholder("输入以切换或创建文件……");
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
        if (this.app.plugins.plugins["obsidian-hover-editor"])
            prompt.push({
                command: "ctrl o",
                purpose: "打开到新浮窗",
            });

        this.setInstructions(prompt);
        this.scope.register(["Mod"], "Enter", async (e) => {
            this.close();
            let file = await this.getChoosenItemFile();
            app.workspace.getLeaf("tab").openFile(file);
        });
        this.scope.register(["Mod", "Alt"], "Enter", async (e) => {
            this.close();
            let file = await this.getChoosenItemFile();
            app.workspace.getLeaf("split").openFile(file);
        });
        this.scope.register(["Shift"], "Enter", async (e) => {
            if (this.inputEl.value == "") return;
            this.close();
            let nf = await app.vault.create(
                app.fileManager.getNewFileParent("").path + "/" + this.inputEl.value + ".md",
                ""
            );
            app.workspace.getMostRecentLeaf().openFile(nf);
        });
        this.scope.register(["Mod", "Shift"], "Enter", async (e) => {
            if (this.inputEl.value == "") return;
            this.close();
            let nf = await app.vault.create(
                app.fileManager.getNewFileParent("").path + "/" + this.inputEl.value + ".md",
                ""
            );
            app.workspace.getLeaf("tab").openFile(nf);
        });
        this.scope.register(["Shift", "Alt"], "Enter", async (e) => {
            if (this.inputEl.value == "") return;
            this.close();
            let nf = await app.vault.create(
                app.fileManager.getNewFileParent("").path + "/" + this.inputEl.value + ".md",
                ""
            );
            getNewOrAdjacentLeaf(app.workspace.getMostRecentLeaf()).openFile(nf);
        });
        this.scope.register(["Alt"], "Enter", async (e) => {
            this.close();
            let file = await this.getChoosenItemFile();
            getNewOrAdjacentLeaf(app.workspace.getMostRecentLeaf()).openFile(file);
        });
        if (app.plugins.plugins["obsidian-hover-editor"])
            this.scope.register(["Mod"], "o", (event: KeyboardEvent) => {
                this.close();
                let item = this.chooser.values[this.chooser.selectedItem];
                const newLeaf = app.plugins.plugins["obsidian-hover-editor"].spawnPopover(
                    undefined,
                    () => this.app.workspace.setActiveLeaf(newLeaf)
                );
                newLeaf.openFile(item.item.file);
            });

        let inputContainerEl = this.modalEl.querySelector(
            ".prompt-input-container"
        ) as HTMLInputElement;
        this.tagInput = new TagInput(inputContainerEl, this.plugin);
        this.tagInput.onChange((value) => {
            if (value == "") this.tags = [];
            else this.tags = value.split(",").map((t) => t.trim());
            this.onInput();
        });
        if (this.plugin.settings.file.searchWithTag) this.tagInput.show();
    }
    onOpen(): void {
        super.onOpen();
        this.tags = [];
        this.tagInput.setValue("");
    }
    getEmptyInputSuggestions(): MatchData[] {
        let fileHistoryDisplay = this.plugin.settings.file.historyDisplay == "使用完整路径";
        if (this.tags.length == 0) {
            this.historyMatchData = new HistoryMatchDataNode("\0");
            let items = this.index.items;
            let lastOpenFiles: MatchData[] = this.app.workspace
                .getLastOpenFiles()
                .map((p) => items.find((q) => q.type == "file" && q.path == p))
                .filter((p) => p)
                .map((p) => ({
                    item: p,
                    score: 0,
                    range: null,
                    usePath: fileHistoryDisplay,
                }));
            return lastOpenFiles;
        } else {
            return this.index.items
                .filter((item) => {
                    let tags: string | Array<string> =
                        this.app.metadataCache.getFileCache(item.file)?.frontmatter?.tags ||
                        this.app.metadataCache.getFileCache(item.file)?.frontmatter?.tag;
                    if (!tags) return;
                    let tagArray = Array.isArray(tags) ? tags : String(tags).split(/, ?/);
                    return tagArray.every((tag) => this.tags.some((t) => tag.startsWith(t)));
                })
                .map((p) => ({
                    item: p,
                    score: 0,
                    range: null,
                    usePath: fileHistoryDisplay,
                }));
        }
    }
    getSuggestions(query: string): MatchData[] {
        if (query == "") {
            return this.getEmptyInputSuggestions();
        }

        let matchData: MatchData[] = [],
            matchData1: MatchData[] = [] /*使用标题、别名搜索的数据*/,
            matchData2: MatchData[] = []; /*使用路径搜索的数据*/

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
            if (d) matchData1.push(d);
        }

        if (this.plugin.settings.file.usePathToSearch && matchData1.length <= 10) {
            toMatchData =
                indexNode.itemIndexByPath.length == 0
                    ? this.index.items
                    : indexNode.itemIndexByPath;
            for (let p of toMatchData.filter(
                (p) => p.type == "file" && !matchData1.map((p) => p.item.path).includes(p.path)
            )) {
                let d = <MatchData>p.pinyinOfPath.match(query, p, smathCase);
                if (d) {
                    d.usePath = true;
                    matchData2.push(d);
                }
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
        if (this.plugin.settings.file.searchWithTag && this.tags.length > 0) {
            result = result.filter((matchData) => {
                let tags: string | Array<string> =
                    this.app.metadataCache.getFileCache(matchData.item.file)?.frontmatter?.tags ||
                    this.app.metadataCache.getFileCache(matchData.item.file)?.frontmatter?.tag;
                if (!tags) return;
                let tagArray = Array.isArray(tags) ? tags : String(tags).split(/, ?/);
                return tagArray.every((tag) => this.tags.some((t) => tag.startsWith(t)));
            });
        }
        return result;
    }

    renderSuggestion(matchData: MatchData, el: HTMLElement) {
        el.addClass("fz-item");
        let range = matchData.range,
            text: string,
            e_content = el.createEl("div", { cls: "fz-suggestion-content" }),
            e_title = e_content.createEl("div", { cls: "fz-suggestion-title" });

        text = matchData.usePath ? matchData.item.path : matchData.item.name;

        let index = 0;
        if (range) {
            for (const r of range) {
                e_title.appendText(text.slice(index, r[0]));
                e_title.createSpan({
                    cls: "suggestion-highlight",
                    text: text.slice(r[0], r[1] + 1),
                });
                index = r[1] + 1;
            }
        }
        e_title.appendText(text.slice(index));

        if (!matchData.usePath) {
            if (this.plugin.settings.file.showTags) {
                let tags: string | Array<string> =
                        this.app.metadataCache.getFileCache(matchData.item.file)?.frontmatter
                            ?.tags ||
                        this.app.metadataCache.getFileCache(matchData.item.file)?.frontmatter?.tag,
                    tagArray: string[];
                if (tags) {
                    tagArray = Array.isArray(tags) ? tags : String(tags).split(/, ?/);
                    let tagEl = e_title.createDiv({ cls: "fz-suggestion-tags" });
                    tagArray.forEach((p) => tagEl.createEl("a", { cls: "tag", text: p }));
                }
            }

            let e_note: HTMLDivElement = null;
            if (this.plugin.settings.file.showPath && !matchData.usePath)
                e_note = e_content.createEl("div", {
                    cls: "fz-suggestion-note",
                    text: matchData.item.path,
                });

            if (matchData.item.type == "alias") {
                let e_flair = el.createEl("span", {
                    cls: "fz-suggestion-flair",
                });
                e_flair.appendChild(getIcon("forward"));
                if (!this.plugin.settings.file.showPath) e_flair.style.top = "9px";
                if (e_note) e_note.style.width = "calc(100% - 30px)";
            }
        }
    }
    async onChooseSuggestion(matchData: MatchData, evt: MouseEvent | KeyboardEvent) {
        let file = await this.getChoosenItemFile(matchData);
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
        super.onNoSuggestion(<MatchData>{
            item: { type: "file", path: this.inputEl.value },
            score: -1,
            usePath: true,
        });
    }
    async getChoosenItemFile(matchData?: MatchData): Promise<TFile> {
        matchData = matchData ?? this.chooser.values[this.chooser.selectedItem];
        let file =
            matchData.score == -1
                ? await app.vault.create(
                      app.fileManager.getNewFileParent("").path + "/" + matchData.item.path + ".md",
                      ""
                  )
                : matchData.item.file;
        return file;
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
        if (
            mainLeaf &&
            mainLeaf !== leaf &&
            mainLeaf.view?.containerEl.ownerDocument === document
        ) {
            return mainLeaf;
        }

        mainLeavesIds.forEach((id: any) => {
            const l = app.workspace.getLeafById(id);
            if ((leaf.parent.id == l.parent.id && mainLeaf) || !l.view?.navigation || leaf === l)
                return;
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

class PinyinIndex extends PI<Item> {
    constructor(app: App, plugin: FuzzyChinesePinyinPlugin) {
        super(app, plugin);
        this.id = "file";
    }
    initIndex() {
        let files = app.vault.getFiles().filter((f) => this.isEffectiveFile(f));

        this.items = files.map((file) => TFile2Item(file, this.plugin));

        for (let file of files) {
            if (file.extension != "md") continue;
            this.items = this.items.concat(CachedMetadata2Item(file, this.plugin, this.items));
        }
    }
    initEvent() {
        this.registerEvent(
            this.metadataCache.on("changed", (file, data, cache) =>
                this.update("changed", file, { data, cache })
            )
        );
        this.registerEvent(
            this.vault.on("rename", (file, oldPath) => this.update("rename", file, { oldPath }))
        );
        this.registerEvent(this.vault.on("create", (file) => this.update("create", file)));
        this.registerEvent(this.vault.on("delete", (file) => this.update("delete", file)));
    }
    update(
        type: string,
        file: TAbstractFile,
        keys?: { oldPath?: string; data?: string; cache?: CachedMetadata }
    ) {
        if (!this.isEffectiveFile(file)) return;
        switch (type) {
            case "changed": {
                this.items = this.items
                    .filter((item) => !(item.path == file.path && item.type == "alias"))
                    .concat(CachedMetadata2Item(file, this.plugin, this.items, keys.cache));
                break;
            }
            case "create": {
                this.items.push(TFile2Item(file, this.plugin));
                break;
            }
            case "rename": {
                this.items = this.items
                    .filter((item) => item.path != keys.oldPath)
                    .concat(CachedMetadata2Item(file, this.plugin, this.items));
                this.items.push(TFile2Item(file, this.plugin));
                break;
            }
            case "delete": {
                this.items = this.items.filter((item) => item.path != file.path);
                break;
            }
        }
    }

    isEffectiveFile(file: TAbstractFile): file is TFile {
        if (!(file instanceof TFile)) return false;

        if (this.plugin.settings.file.showAllFileTypes) return true;
        else if (DOCUMENT_EXTENSIONS.includes(file.extension)) return true;
        else if (
            this.plugin.settings.file.showAttachments &&
            this.plugin.settings.file.attachmentExtensions.includes(file.extension)
        )
            return true;
        else return false;
    }
}

function TFile2Item(file: TFile, plugin: FuzzyChinesePinyinPlugin): Item {
    let name = file.extension != "md" ? file.name : file.basename;
    let folderIndex = plugin.folderModal.index.items;
    let fileNamePinyin = new Pinyin(name, plugin);
    let folderPathPinyin: Pinyin;
    let pathPinyin: Pinyin;
    if (file.parent.path == "/") {
        pathPinyin = fileNamePinyin;
    } else {
        folderPathPinyin = folderIndex.find((folder) => folder.name == file.parent.path).pinyin;
        pathPinyin = folderPathPinyin.concat(new Pinyin("/", plugin)).concat(fileNamePinyin);
    }
    return {
        type: "file",
        file: file,
        name: name,
        pinyin: fileNamePinyin,
        path: file.path,
        pinyinOfPath: pathPinyin,
    };
}

function CachedMetadata2Item(
    file: TFile,
    plugin: FuzzyChinesePinyinPlugin,
    items: Item[],
    cache?: CachedMetadata
): Item[] {
    cache = cache ?? app.metadataCache.getFileCache(file);
    let alias = cache?.frontmatter?.alias || cache?.frontmatter?.aliases;
    let item = items.find((item) => item.path == file.path && item.type == "file");
    if (alias) {
        alias = Array.isArray(alias) ? alias.map((p) => String(p)) : String(alias).split(/, ?/);
        return alias.map((p: string) => {
            return {
                type: "alias",
                name: p,
                pinyin: new Pinyin(p, plugin),
                path: file.path,
                pinyinOfPath: item.pinyinOfPath,
                file: file,
            };
        });
    } else return [];
}

class TagInput extends TextComponent {
    constructor(inputEl: HTMLInputElement | HTMLTextAreaElement, plugin: FuzzyChinesePinyinPlugin) {
        super(inputEl);
        this.hide();
        this.setPlaceholder("标签");
        this.inputEl.classList.add("prompt-input");
        this.inputEl.style.width = "30%";
        this.inputEl.style.borderLeft = "2px solid var(--background-primary)";
        new TagSuggest(this.inputEl, plugin);
    }
    hide() {
        this.inputEl.style.display = "none";
    }
    show() {
        this.inputEl.style.display = "block";
    }
}

class TagSuggest extends TextInputSuggest<uMatchData<uItem>> {
    plugin: FuzzyChinesePinyinPlugin;
    constructor(inputEl: HTMLInputElement | HTMLTextAreaElement, plugin: FuzzyChinesePinyinPlugin) {
        super(inputEl);
        this.plugin = plugin;
    }
    getSuggestions(inputStr: string): uMatchData<uItem>[] {
        return this.plugin.tagEditorSuggest.getSuggestionsByString(inputStr);
    }

    renderSuggestion(matchData: uMatchData<uItem>, el: HTMLElement): void {
        el.addClass("fz-item");
        let e_content = el.createEl("div", { cls: "fz-suggestion-content" });
        let range = matchData.range,
            text = matchData.item.name,
            index = 0;
        if (range) {
            for (const r of range) {
                e_content.appendText(text.slice(index, r[0]));
                e_content.createSpan({
                    cls: "suggestion-highlight",
                    text: text.slice(r[0], r[1] + 1),
                });
                index = r[1] + 1;
            }
        }
        e_content.appendText(text.slice(index));
    }

    selectSuggestion(matchData: uMatchData<uItem>): void {
        this.inputEl.value = matchData.item.name;
        this.inputEl.trigger("input");
        this.close();
    }
}
