import { TFile, App, WorkspaceLeaf, TAbstractFile, CachedMetadata, TextComponent } from "obsidian";
import { max, min } from "lodash";
import {
    Pinyin,
    PinyinIndex as PI,
    MatchData as uMatchData,
    Item as uItem,
    SuggestionRenderer,
    createFile,
    incrementalUpdate,
    PinyinSuggest,
} from "@/utils";
import ThePlugin from "@/main";
import FuzzyModal, { SpecialItemScore } from "./modal";

const DOCUMENT_EXTENSIONS = ["md", "canvas"];

type ItemType = "file" | "path" | "alias" | "unresolvedLink" | "link";
interface Item_<T extends ItemType> extends uItem {
    file: TFile;
    type: T;
    path: string;
}
interface FileItem extends Item_<"file"> {}
interface PathItem extends Item_<"path"> {}
interface AliasItem extends Item_<"alias"> {}
interface UnresolvedLinkItem extends Item_<"unresolvedLink"> {}
export interface LinkItem extends Item_<"link"> {
    link: string;
}
export type Item = FileItem | PathItem | AliasItem | UnresolvedLinkItem | LinkItem;

export interface MatchData<T = Item> extends uMatchData<T> {
    ignore?: boolean;
    history?: boolean;
}

export default class FileModal extends FuzzyModal<Item> {
    tags: string[] = [];
    tagInput: TagInput;
    declare index: PinyinIndex;
    constructor(app: App, plugin: ThePlugin) {
        super(app, plugin);
        this.useInput = true;
        this.index = this.plugin.addChild(new PinyinIndex(this.app, this.plugin));
        this.emptyStateText = "未发现该笔记，按下回车创建。";
        this.setPlaceholder("输入以切换或创建文件……");

        let i = {
            scope: this.scope,
            modifiers: null,
            key: "Enter",
            func: async (e: KeyboardEvent) => {
                e.preventDefault();
                const matchData = this.getChoosenMatchData();
                this.onChooseSuggestion(matchData, e);
            },
        };
        this.scope.keys.unshift(i);
        let prompt = [
            {
                command: "ctrl ↵",
                purpose: this.plugin.settings.file["keyCtrlEnter"],
            },
            {
                command: "ctrl alt ↵",
                purpose: this.plugin.settings.file["keyCtrlAltEnter"],
            },
            {
                command: "alt ↵",
                purpose: this.plugin.settings.file["keyAltEnter"],
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
        if (app.plugins.plugins["obsidian-hover-editor"]) {
            prompt.push({
                command: "ctrl o",
                purpose: "打开到新浮窗",
            });
            this.scope.register(["Mod"], "o", (event: KeyboardEvent) => {
                this.close();
                let item = this.getChoosenItem();
                const newLeaf = app.plugins.plugins["obsidian-hover-editor"].spawnPopover(
                    undefined,
                    () => this.app.workspace.setActiveLeaf(newLeaf)
                );
                openItem(newLeaf, item);
            });
        }
        this.setInstructions(prompt);
        this.addTagInput();
    }
    addTagInput(): void {
        let inputContainerEl = this.modalEl.querySelector(
            ".prompt-input-container"
        ) as HTMLInputElement;
        this.tagInput = new TagInput(inputContainerEl, this.plugin);
        this.tagInput.onChange((value) => {
            if (value == "") this.tags = [];
            else this.tags = value.split(",").map((t) => t.trim());
            this.onInput();
        });
    }
    onOpen(): void {
        super.onOpen();

        this.tags = [];
        this.tagInput.setValue("");
        let inputContainerEl = this.modalEl.querySelector(
            ".prompt-input-container"
        ) as HTMLInputElement;
        let clearButton = inputContainerEl.querySelector(
            ".search-input-clear-button"
        ) as HTMLDivElement;
        if (this.plugin.settings.file.searchWithTag) {
            this.tagInput.show();
            clearButton.style.marginRight = "25%";
        } else {
            this.tagInput.hide();
            clearButton.style.marginRight = "0";
        }
    }
    onClose(): void {
        super.onClose();
    }
    getEmptyInputSuggestions(): MatchData[] {
        let items: Item[];
        if (this.tags.length == 0) {
            items = this.app.workspace
                .getRecentFiles()
                .map((p) => this.index.items.find((q) => q.type == "file" && q.path == p));
        } else {
            items = this.index.items.filter((p) => this.filterWithTags(p));
        }
        return items
            .filter((p) => p && !isIgnore(p.path))
            .map((p) => ({
                item: p,
                score: SpecialItemScore.emptyInput,
                range: null,
                usePath: false,
                history: this.tags.length == 0,
            }));
    }

    getFirstInputSuggestions(query: string): MatchData[] {
        let matchData1: MatchData[] = [], // 使用标题、别名搜索的数据
            matchData2: MatchData[] = []; // 使用路径搜索的数据

        matchData1 = super.getFirstInputSuggestions(query);

        if (this.plugin.settings.file.usePathToSearch && matchData1.length <= 10) {
            const toMatchItem = this.index.pathItems.filter(
                (p) => !matchData1.find((q) => p.path == q.item.path)
            );
            matchData2 = super.getFirstInputSuggestions(query, toMatchItem);
        }

        this.currentNode = this.historyMatchData;
        this.historyMatchData.init(query);
        this.historyMatchData.itemIndex = matchData1.map((p) => p.item);
        this.historyMatchData.itemIndexByPath = matchData2.map((p) => p.item);

        const matchData = matchData1.concat(matchData2);

        matchData
            .filter((p) => isIgnore(p.item.path))
            .forEach((p) => {
                p.ignore = true;
                p.score -= 1000;
            });
        return matchData;
    }

    getNormalInputSuggestions(query: string): MatchData[] {
        let matchData1: MatchData[] = [], // 使用标题、别名搜索的数据
            matchData2: MatchData[] = []; // 使用路径搜索的数据

        const smathCase = /[A-Z]/.test(query) && this.plugin.settings.global.autoCaseSensitivity;
        let toMatchItem = this.getHistoryData(query);
        matchData1 = super.getNormalInputSuggestions(query, toMatchItem);

        if (this.plugin.settings.file.usePathToSearch && matchData1.length <= 10) {
            toMatchItem =
                this.currentNode.itemIndexByPath.length == 0
                    ? this.index.pathItems
                    : this.currentNode.itemIndexByPath;
            toMatchItem = toMatchItem.filter((p) => !matchData1.find((q) => q.item.path == p.path));
            matchData2 = super.getNormalInputSuggestions(query, toMatchItem);
        }
        this.currentNode.itemIndex = matchData1.map((p) => p.item);
        this.currentNode.itemIndexByPath = matchData2.map((p) => p.item);

        const matchData = matchData1.concat(matchData2);

        matchData
            .filter((p) => isIgnore(p.item.path))
            .forEach((p) => {
                p.ignore = true;
                p.score -= 1000;
            });
        return matchData;
    }

    getSuggestions(query: string): MatchData[] {
        if (query[0] == " " && this.plugin.settings.file.quicklySelectHistoryFiles) {
            let matchData = this.getEmptyInputSuggestions();
            switch (query.length) {
                case 1:
                    break;
                case 2:
                    let index = max([
                        "asdfjklgh".indexOf(query[1]),
                        "1234567890".indexOf(query[1]),
                    ]);
                    index = min([index, matchData.length - 1]);
                    if (index == -1) break;
                    this.selectSuggestion(matchData[index], new MouseEvent("click"));
                    return;
            }
        }
        let matchData = super.getSuggestions(query) as MatchData<Item>[];
        if (this.plugin.settings.file.searchWithTag && this.tags.length > 0) {
            matchData = matchData.filter((p) => this.filterWithTags(p.item));
        }
        return matchData;
    }

    renderSuggestion(matchData: MatchData, el: HTMLElement) {
        let renderer = new SuggestionRenderer(el);
        if (matchData.item.file) renderer.setNote(matchData.item.path);
        if (matchData.item.type == "path") {
            renderer.setTitle(matchData.item.file.basename);
            renderer.setToHighlightEl("note");
        }
        if (matchData.ignore) renderer.setIgnore();
        if (matchData.history && this.plugin.settings.file.quicklySelectHistoryFiles) {
            let auxEl = el.createEl("span", { cls: "fz-suggestion-aux" });
            auxEl.createEl("kbd", {
                cls: "suggestion-command",
                text: this.plugin.settings.file.quicklySelectHistoryFilesHint[
                    this.getEmptyInputSuggestions().findIndex(
                        (p) => p.item.path == matchData.item.path
                    )
                ],
            });
        }
        renderer.render(matchData);

        if (this.plugin.settings.file.showTags && matchData.item.file) {
            let tagArray = getFileTagArray(matchData.item.file);
            if (tagArray) {
                let tagEl = renderer.titleEl.createDiv({ cls: "fz-suggestion-tags" });
                tagArray.forEach((p) => tagEl.createEl("a", { cls: "tag", text: p }));
            }
        }
        let icon = { alias: "forward", link: "heading" };
        if (icon[matchData.item.type]) {
            renderer.addIcon(icon[matchData.item.type]);
            if (renderer.noteEl) renderer.noteEl.style.width = "calc(100% - 30px)";
        } else if (matchData.item.type == "unresolvedLink") renderer.addIcon("file-plus");
    }
    async onChooseSuggestion(matchData: MatchData, e: MouseEvent | KeyboardEvent) {
        const shiftKey = e.shiftKey;
        if (shiftKey && this.inputEl.value == "") return;
        this.close();
        const leaf = this.getLeaf(e);

        if (shiftKey) matchData.item.file = await createFile(this.inputEl.value);
        else if (
            matchData.score == SpecialItemScore.noFoundToCreate ||
            matchData.item.type == "unresolvedLink"
        )
            matchData.item.file = await createFile(matchData.item.name);

        if (this.resolve) {
            this.resolve(matchData.item);
            return;
        }

        openItem(leaf, matchData.item);
    }
    onNoSuggestion(): void {
        super.onNoSuggestion(<MatchData>{
            item: { type: "file", name: this.inputEl.value },
            score: SpecialItemScore.noFoundToCreate,
        });
    }
    getLeaf(e: MouseEvent | KeyboardEvent): WorkspaceLeaf {
        const modKey = e.ctrlKey || e.metaKey;
        const altKey = e.altKey;
        let leaf: WorkspaceLeaf;
        let getKey = (key: keyof typeof openFileKeyMap) =>
            openFileKeyMap[this.plugin.settings.file[key]];
        if (modKey && altKey) leaf = getKey("keyCtrlAltEnter")();
        else if (modKey) leaf = getKey("keyCtrlEnter")();
        else if (altKey) leaf = getKey("keyAltEnter")();
        else leaf = getKey("keyEnter")();
        return leaf;
    }
    filterWithTags(item: Item): boolean {
        if (!item.file) return false;
        const tagArray = getFileTagArray(item.file);
        return (
            tagArray &&
            tagArray.length != 0 &&
            this.tags.every((t) => tagArray.some((tt) => tt.startsWith(t)))
        );
    }
}

// If there is only one leaf, create a new split and return it.
// If there are two or more, return a leaf that is not the currently displayed leaf.
// It means returning another leaf but don't create a new split.
// This code is based on the work of zsviczian (https://github.com/zsviczian).
// Original code: https://github.com/zsviczian/obsidian-excalidraw-plugin.
const getNewOrAdjacentLeaf = (
    leaf: WorkspaceLeaf = app.workspace.getMostRecentLeaf()
): WorkspaceLeaf => {
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
    fileItems: FileItem[] = [];
    pathItems: PathItem[] = [];
    aliasItems: AliasItem[] = [];
    linkItems: LinkItem[] = [];
    unresolvedLinkItems: UnresolvedLinkItem[] = [];
    constructor(app: App, plugin: ThePlugin) {
        super(app, plugin);
        this.id = "file";
    }
    //@ts-ignore
    get items() {
        let items: Item[] = [];
        items = items.concat(this.fileItems, this.aliasItems, this.linkItems);
        if (this.plugin.settings.file.showUnresolvedLink)
            items = items.concat(this.unresolvedLinkItems);
        return items;
    }
    set items(value: Item[]) {
        this.fileItems = [];
        this.aliasItems = [];
        this.linkItems = [];
        this.unresolvedLinkItems = [];
        for (const item of value) {
            switch (item.type) {
                case "file":
                    this.fileItems.push(item);
                    break;
                case "alias":
                    this.aliasItems.push(item);
                    break;
                case "unresolvedLink":
                    this.unresolvedLinkItems.push(item);
                    break;
                case "link":
                    this.linkItems.push(item);
                    break;
            }
        }
    }
    initIndex() {
        let files = this.app.vault.getFiles().filter((f) => this.isEffectiveFile(f));

        const fp = files.map((f) => TFile2Item(f, this.plugin));
        this.fileItems = fp.map((f) => f.fileItem);
        this.pathItems = fp.map((f) => f.pathItem);
        this.aliasItems = [];
        this.linkItems = [];
        this.unresolvedLinkItems = [];

        for (let file of files) {
            if (file.extension != "md") continue;
            const { aliasItem, linkItem } = CachedMetadata2Item(file, this.plugin, this.pathItems);
            this.aliasItems.push(...aliasItem);
            this.linkItems.push(...linkItem);
        }

        this.updateUnresolvedLinkItems();
    }
    initEvent() {
        this.registerEvent(
            this.metadataCache.on("changed", (file, _, cache) =>
                this.update("changed", file, cache)
            )
        );
        this.registerEvent(
            this.metadataCache.on("resolved", () => this.updateUnresolvedLinkItems())
        );
        this.registerEvent(
            this.vault.on("rename", (file, oldPath) => this.update("rename", file, oldPath))
        );
        this.registerEvent(this.vault.on("create", (file) => this.update("create", file)));
        this.registerEvent(this.vault.on("delete", (file) => this.update("delete", file)));
    }
    update(type: "changed", file: TAbstractFile, cache: CachedMetadata): void;
    update(type: "create", file: TAbstractFile): void;
    update(type: "rename", file: TAbstractFile, oldPath: string): void;
    update(type: "delete", file: TAbstractFile): void;
    update(type: string, file: TAbstractFile, args?: any) {
        if (!this.isEffectiveFile(file)) return;
        switch (type) {
            case "changed": {
                const { aliasItem, linkItem } = CachedMetadata2Item(
                    file,
                    this.plugin,
                    this.pathItems,
                    args
                );
                this.aliasItems = this.aliasItems
                    .filter((item) => item.path != file.path)
                    .concat(aliasItem);
                this.linkItems = this.linkItems
                    .filter((item) => item.path != file.path)
                    .concat(linkItem);
                break;
            }
            case "create": {
                const { fileItem, pathItem } = TFile2Item(file, this.plugin);
                this.fileItems.push(fileItem);
                this.pathItems.push(pathItem);
                break;
            }
            case "rename": {
                this.fileItems = this.fileItems.filter((item) => item.path != args);
                this.pathItems = this.pathItems.filter((item) => item.path != args);
                this.aliasItems = this.aliasItems.filter((item) => item.path != args);
                this.linkItems = this.linkItems.filter((item) => item.path != args);
                const { fileItem, pathItem } = TFile2Item(file, this.plugin);
                const { aliasItem, linkItem } = CachedMetadata2Item(
                    file,
                    this.plugin,
                    this.pathItems
                );
                this.fileItems.push(fileItem);
                this.pathItems.push(pathItem);
                this.aliasItems.push(...aliasItem);
                this.linkItems.push(...linkItem);
                break;
            }
            case "delete": {
                this.fileItems = this.fileItems.filter((item) => item.path != file.path);
                this.pathItems = this.pathItems.filter((item) => item.path != file.path);
                this.aliasItems = this.aliasItems.filter((item) => item.path != file.path);
                this.linkItems = this.linkItems.filter((item) => item.path != file.path);
                break;
            }
        }
    }
    updateUnresolvedLinkItems() {
        this.unresolvedLinkItems = incrementalUpdate(
            this.unresolvedLinkItems,
            () => {
                let unresolvedLinks = new Set<string>();
                Object.values(this.metadataCache.unresolvedLinks)
                    .map((p) => Object.keys(p))
                    .filter((p) => p.length > 0)
                    .forEach((p) => p.forEach((q) => unresolvedLinks.add(q)));
                return Array.from(unresolvedLinks);
            },
            (name) => ({
                type: "unresolvedLink",
                name,
                pinyin: new Pinyin(name, this.plugin),
                path: null,
                pinyinOfPath: null,
                file: null,
            })
        );
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

function TFile2Item(file: TFile, plugin: ThePlugin): { fileItem: FileItem; pathItem: PathItem } {
    let name = file.extension != "md" ? file.name : file.basename;
    let folderIndex = plugin.folderModal.index.items;
    let fileNamePinyin = new Pinyin(name, plugin);
    let folderPathPinyin: Pinyin;
    let pathPinyin: Pinyin;
    if (file.parent.path == "/") {
        pathPinyin = fileNamePinyin;
    } else {
        folderPathPinyin = folderIndex.find(
            (folder) => folder.path == file.parent.path
        )?.pinyinOfPath;
        if (folderPathPinyin)
            pathPinyin = folderPathPinyin.concat(new Pinyin("/", plugin)).concat(fileNamePinyin);
        else pathPinyin = new Pinyin(file.path, plugin);
    }
    const fileItem: FileItem = {
        type: "file",
        file: file,
        name: name,
        pinyin: fileNamePinyin,
        path: file.path,
    };
    const pathItem: PathItem = {
        type: "path",
        file: file,
        name: file.path,
        pinyin: pathPinyin,
        path: file.path,
    };
    return {
        fileItem,
        pathItem,
    };
}

function CachedMetadata2Item(
    file: TFile,
    plugin: ThePlugin,
    items: Item[],
    cache?: CachedMetadata
): { aliasItem: AliasItem[]; linkItem: LinkItem[] } {
    cache = cache ?? plugin.app.metadataCache.getFileCache(file);
    let alias =
        cache?.frontmatter?.alias ||
        cache?.frontmatter?.aliases ||
        cache?.frontmatter?.Alias ||
        cache?.frontmatter?.Aliases;
    let linkText = cache?.frontmatter?.linkText;
    let item = items.find((item) => item.path == file.path);
    let pinyinOfPath = item?.pinyin ?? new Pinyin(file.path, plugin);
    let aliasItem: AliasItem[] = [],
        linkItem: LinkItem[] = [];
    if (alias) {
        alias = Array.isArray(alias) ? alias.map((p) => String(p)) : String(alias).split(/, ?/);
        aliasItem = alias.map((p: string) => ({
            type: "alias",
            name: p,
            pinyin: new Pinyin(p, plugin),
            path: file.path,
            pinyinOfPath: pinyinOfPath,
            file: file,
        }));
    }
    if (linkText) {
        let link = Array.isArray(linkText)
            ? linkText.map((p) => String(p))
            : String(linkText).split(/, ?/);
        linkItem = link.map((p: string) => {
            let [link, name] = p.split("|");
            name = name || link;
            // if (name[0] != "#") name = "#" + name;
            return {
                type: "link",
                name,
                pinyin: new Pinyin(name, plugin),
                path: file.path,
                pinyinOfPath: pinyinOfPath,
                file: file,
                link,
            };
        });
    }
    return {
        aliasItem,
        linkItem,
    };
}

class TagInput extends TextComponent {
    constructor(inputEl: HTMLInputElement | HTMLTextAreaElement, plugin: ThePlugin) {
        super(inputEl);
        this.hide();
        this.setPlaceholder("标签");
        this.inputEl.addClasses(["prompt-input", "fz-tag-input"]);

        this.inputEl.style.width = "30%";
        this.inputEl.style.borderLeft = "2px solid var(--background-primary)";
        let tagSuggest = new PinyinSuggest(this.inputEl, plugin);
        tagSuggest.getItemFunction = (query) =>
            plugin.tagEditorSuggest.getSuggestionsByString(query);
    }
    hide() {
        this.inputEl.style.display = "none";
    }
    show() {
        this.inputEl.style.display = "block";
    }
}

function openItem(leaf: WorkspaceLeaf, item: Item) {
    if (item.type == "link") {
        leaf.openLinkText(item.file.path + "#" + item.link, "");
    } else leaf.openFile(item.file);
}

function getFileTagArray(file: TFile): string[] | undefined {
    let tags: string | string[] | Object =
        app.metadataCache.getFileCache(file)?.frontmatter?.tags ||
        app.metadataCache.getFileCache(file)?.frontmatter?.tag;
    if (!tags) return undefined;

    if (Array.isArray(tags)) return tags;
    else if (typeof tags == "string")
        return tags
            .split(/[, ]/)
            .filter((p) => p)
            .map((p) => p.trim());
    else if (typeof tags == "object") return undefined;
}

export const openFileKeyMap: Record<string, () => WorkspaceLeaf> = {
    打开: () => {
        let leaf = app.workspace.getMostRecentLeaf();
        if (leaf.pinned) return app.workspace.getLeaf("tab");
        else return leaf;
    },
    打开到新标签页: () => app.workspace.getLeaf("tab"),
    打开到其他面板: () => getNewOrAdjacentLeaf(),
    打开到新面板: () => app.workspace.getLeaf("split"),
    打开到新窗口: () => app.workspace.getLeaf("window"),
};

function isIgnore(path: string): boolean {
    return app.metadataCache.userIgnoreFilterCache[path];
}
