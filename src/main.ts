import {
    Plugin,
    EditorSuggest,
    WorkspaceLeaf,
    Menu,
    TFile,
    TAbstractFile,
    App,
    View,
    Notice,
} from "obsidian";
import { merge } from "lodash";
import { fullPinyin2doublePinyin, Item, PinyinIndex, runOnLayoutReady } from "@/utils";
import FuzzyModal from "@/modal/modal";
import FileModal from "@/modal/fileModal";
import FolderModal from "@/modal/folderModal";
import CommandModal from "@/modal/commandModal";
import FuzzySuggestModal from "@/modal/suggestModal";
import HeadingModal from "@/modal/headingModal";
import TemplatesModal from "@/modal/templatesModal";
import FileEditorSuggest from "@/editorSuggest/fileEditorSuggest";
import TagEditorSuggest from "@/editorSuggest/tagEditorSuggest";
// 以下两个字典来源于：https://github.com/xmflswood/pinyin-match
import SimplifiedDict from "@/dict/simplified_dict";
import TraditionalDict from "@/dict/traditional_dict";

import DoubleDict from "@/dict/double_pinyin";
import pinyinSearch, { stringArray2Items as strings2Items } from "@/search";
import SettingTab, { DEFAULT_SETTINGS, TheSettings } from "@/settingTab";
import {
    hijackingCanvasView,
    hijackingEmptyView,
    hijackingTagForMarkdownView,
} from "./viewEventHijacking";

export default class ThePlugin extends Plugin {
    settings: TheSettings;
    pinyinDict: Record<string, string[]>;
    api: any;
    fileModal: FileModal;
    folderModal: FolderModal;
    commandModal: CommandModal;
    headingModal: HeadingModal;
    templatesModal: TemplatesModal;
    fileEditorSuggest: FileEditorSuggest;
    tagEditorSuggest: TagEditorSuggest;
    indexManager: IndexManager;
    editorSuggests: EditorSuggest<any>[];
    fileExplorerHotkey: FileExplorerHotkey;

    async onload() {
        await this.loadSettings();

        this.loadPinyinDict();
        this.fileModal = new FileModal(this.app, this);
        this.folderModal = new FolderModal(this.app, this);
        this.commandModal = new CommandModal(this.app, this);
        this.headingModal = new HeadingModal(this.app, this);
        this.templatesModal = new TemplatesModal(this.app, this);

        this.fileEditorSuggest = new FileEditorSuggest(this.app, this);
        this.tagEditorSuggest = new TagEditorSuggest(this.app, this);

        this.indexManager = new IndexManager(this, [
            this.folderModal,
            this.fileModal,
            this.commandModal,
            this.tagEditorSuggest,
        ]);
        this.editorSuggests = [this.fileEditorSuggest, this.tagEditorSuggest];

        if (this.settings.file.useFileEditorSuggest)
            this.registerEditorSuggest(this.fileEditorSuggest);

        if (this.settings.other.useTagEditorSuggest)
            this.registerEditorSuggest(this.tagEditorSuggest);

        this.registerFileMenu();
        this.registerHijackingEvents();
        runOnLayoutReady(() => {
            this.indexManager.load();
            this.registerFileExplorer();
            this.addCommands();

            let leaf = this.app.workspace.getMostRecentLeaf();
            if (leaf.view.getViewType() === "empty") leaf.detach();
        });
        this.addRibbonIcon("search", "FuzzySearch", () => {
            let leaf = this.app.workspace.getMostRecentLeaf();
            if (leaf) {
                this.fileModal.open();
                return true;
            }
            return false;
        });
        this.addSettingTab(new SettingTab(this.app, this));
        this.api = {
            suggester: this.suggester.bind(this),
            search: (query: string, items: string[] | Item[]) => pinyinSearch(query, items, this),
            strings2Items: strings2Items,
        };
    }
    registerHijackingEvents() {
        hijackingCanvasView(this);
        hijackingEmptyView(this);
        // hijackingTagForMarkdownView(this); // 有问题，暂时不用
    }
    registerEditorSuggest(editorSuggest: EditorSuggest<any>): void {
        this.app.workspace.editorSuggest.suggests.unshift(editorSuggest);
        this.register(() => {
            return this.app.workspace.editorSuggest.removeSuggest(editorSuggest);
        });
    }
    addCommands() {
        this.addCommand({
            id: "open-search",
            name: "搜索文件",
            callback: () => {
                this.fileModal.open();
            },
        });
        this.addCommand({
            id: "move-file",
            name: "移动文件",
            checkCallback: (checking: boolean) => {
                let files = this.fileExplorerHotkey.getFiles();
                let file = this.app.workspace.getActiveFile();
                if (checking) return Boolean(file) || files.length > 0;
                if (files.length > 0) this.folderModal.openWithFiles(files);
                else if (file) this.folderModal.open();
            },
        });
        this.addCommand({
            id: "execute-command",
            name: "执行命令",
            callback: () => {
                this.commandModal.open();
            },
        });
        this.addCommand({
            id: "search-heading",
            name: "搜索标题",
            checkCallback: (checking: boolean) => {
                const file = this.app.workspace.getActiveFile();
                if (checking) return Boolean(file);
                this.headingModal.setFile(file);
                this.headingModal.open();
            },
        });
        this.addCommand({
            id: "insert-templates",
            name: "插入模板",
            callback: () => {
                this.templatesModal.open();
            },
        });
    }
    onunload() {
        this.indexManager.unload();
    }
    async loadSettings() {
        this.settings = merge({}, DEFAULT_SETTINGS, await this.loadData());
    }
    async saveSettings() {
        await this.saveData(this.settings);
    }
    loadPinyinDict() {
        const pinyinDict = this.settings.global.traditionalChineseSupport
            ? TraditionalDict
            : SimplifiedDict;

        if (this.settings.global.doublePinyin != "全拼") {
            for (const i in pinyinDict) {
                pinyinDict[i] = pinyinDict[i].map((p) =>
                    fullPinyin2doublePinyin(p, DoubleDict[this.settings.global.doublePinyin])
                );
            }
        }

        this.pinyinDict = pinyinDict;
    }
    async suggester(text_items: string[], items: any[]): Promise<string> {
        let modal = new FuzzySuggestModal(this.app, this, text_items, items);
        let item = await modal.openAndGetValue();
        return item.name;
    }
    registerFileMenu() {
        this.registerEvent(
            this.app.workspace.on("file-menu", (menu: Menu, file: TAbstractFile) => {
                let title = file instanceof TFile ? "文件" : "文件夹";
                menu.addItem((item) => {
                    item.setIcon("folder-tree")
                        .setTitle("FuzzyPinyin: 移动" + title)
                        .onClick(() => {
                            this.folderModal.openWithFiles(file);
                        });
                });
            })
        );
        this.registerEvent(
            this.app.workspace.on("files-menu", (menu: Menu, files: TFile[]) => {
                menu.addItem((item) => {
                    item.setIcon("folder-tree")
                        .setTitle(`FuzzyPinyin: 移动 ${files.length} 个文件`)
                        .onClick(() => {
                            this.folderModal.openWithFiles(files);
                        });
                });
            })
        );
    }
    registerFileExplorer() {
        this.fileExplorerHotkey = new FileExplorerHotkey(this.app, this);
    }
}

class FileExplorerHotkey {
    plugin: ThePlugin;
    app: App;
    leaf: WorkspaceLeaf;
    view: View;
    constructor(app: App, plugin: ThePlugin) {
        this.plugin = plugin;
        this.app = app;
        this.getView();
    }
    getFiles(): TFile[] {
        if (!this.viewIsWorkable()) {
            this.getView();
            if (!this.viewIsWorkable()) return [];
        }
        // @ts-ignore
        return Array.from(this.view.tree.selectedDoms).map((p: { file: TFile }) => p.file);
    }
    getView(): View | undefined {
        let leaf = this.app.workspace.getLeavesOfType("file-explorer");
        if (leaf.length != 0) {
            this.leaf = leaf[0];
            this.view = this.leaf.view;
        }
        return this.view;
    }
    viewIsWorkable(): boolean {
        // @ts-ignore
        return Boolean(this.view?.tree?.selectedDoms);
    }
}

class IndexManager extends Array<PinyinIndex<any>> {
    plugin: ThePlugin;
    constructor(plugin: ThePlugin, component: Array<FuzzyModal<any> | EditorSuggest<any>>) {
        super();
        component.forEach((p: any) => this.push(p.index));
        this.plugin = plugin;
    }
    load() {
        if (this.plugin.settings.other.devMode) {
            this.devLoad();
        } else {
            this.normalLoad();
        }
        globalThis.refreshFuzzyChineseIndex = () => {
            this.normalLoad();
            this.devUnload();
        };
    }

    unload() {
        if (this.plugin.settings.other.devMode) {
            this.devUnload();
        }
    }

    normalLoad() {
        this.forEach((index) => this.load_(index));
    }
    load_(index: PinyinIndex<any>) {
        let startTime = Date.now();
        index.initIndex();
        console.log(
            `Fuzzy Chinese Pinyin: ${index.id} indexing completed, totaling ${
                index.items.length
            } items, taking ${(Date.now() - startTime) / 1000.0}s`
        );
    }
    devLoad() {
        this.forEach((index) => {
            if (globalThis.FuzzyChineseIndex && globalThis.FuzzyChineseIndex[index.id]) {
                index.items = globalThis.FuzzyChineseIndex[index.id];
                console.log(`Fuzzy Chinese Pinyin: Use old ${index.id} index`);
            } else {
                this.load_(index);
            }
        });
    }
    devUnload() {
        globalThis.FuzzyChineseIndex = {};
        this.forEach((index) => {
            globalThis.FuzzyChineseIndex[index.id] = index.items;
        });
    }
    refresh() {
        const notice = new Notice("正在刷新索引中");
        setTimeout(() => {
            this.forEach((index) => this.load_(index));
            notice.hide();
            new Notice("索引刷新完成", 4000);
        }, 100);
    }
}
