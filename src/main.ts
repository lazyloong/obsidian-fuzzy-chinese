import {
    Plugin,
    EditorSuggest,
    WorkspaceLeaf,
    Menu,
    TFile,
    TAbstractFile,
    App,
    View,
} from "obsidian";
import { merge } from "lodash";
import { fullPinyin2doublePinyin, Item, PinyinIndex, runOnLayoutReady } from "@/utils";
import FuzzyModal from "@/modal/modal";
import FuzzyFileModal from "@/modal/fileModal";
import FuzzyFolderModal from "@/modal/folderModal";
import FuzzyCommandModal from "@/modal/commandModal";
import FuzzySuggestModal from "@/modal/suggestModal";
import FuzzyHeadingModal from "@/modal/headingModal";
import FileEditorSuggest from "@/editorSuggest/fileEditorSuggest";
import TagEditorSuggest from "@/editorSuggest/tagEditorSuggest";
// 以下两个字典来源于：https://github.com/xmflswood/pinyin-match
import SimplifiedDict from "@/dict/simplified_dict";
import TraditionalDict from "@/dict/traditional_dict";

import DoublePinyinDict from "@/double_pinyin";
import { fuzzyPinyinSearch, stringArray2Items } from "@/search";
import SettingTab, { DEFAULT_SETTINGS, FuzyyChinesePinyinSettings } from "@/settingTab";
import {
    hijackingCanvasView,
    hijackingEmptyView,
    hijackingTagForMarkdownView,
} from "./viewEventHijacking";

export default class FuzzyChinesePinyinPlugin extends Plugin {
    settings: FuzyyChinesePinyinSettings;
    pinyinDict: { originalKeys: any; keys: string[]; values: string[] };
    api: any;
    fileModal: FuzzyFileModal;
    folderModal: FuzzyFolderModal;
    commandModal: FuzzyCommandModal;
    headingModal: FuzzyHeadingModal;
    fileEditorSuggest: FileEditorSuggest;
    tagEditorSuggest: TagEditorSuggest;
    indexManager: IndexManager;
    editorSuggests: EditorSuggest<any>[];
    fileExplorerHotkey: FileExplorerHotkey;

    async onload() {
        await this.loadSettings();

        this.loadPinyinDict();
        this.fileModal = new FuzzyFileModal(this.app, this);
        this.folderModal = new FuzzyFolderModal(this.app, this);
        this.commandModal = new FuzzyCommandModal(this.app, this);
        this.headingModal = new FuzzyHeadingModal(this.app, this);
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
            if (this.settings.other.devMode) {
                this.indexManager.devLoad();
            } else {
                this.indexManager.load();
            }
            this.registerFileExplorer();
            this.addCommands();
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
            suggester: this.suggester,
            search: (query: string, items: string[] | Item[]) =>
                fuzzyPinyinSearch(query, items, this),
            stringArray2Items: stringArray2Items,
        };
    }
    registerHijackingEvents() {
        hijackingCanvasView(this);
        hijackingEmptyView(this);
        hijackingTagForMarkdownView(this);
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
            name: "Open Search",
            callback: () => {
                this.fileModal.open();
            },
        });
        this.addCommand({
            id: "move-file",
            name: "Move File",
            checkCallback: (checking: boolean) => {
                let files = this.fileExplorerHotkey.getFiles();
                let file = this.app.workspace.getActiveFile();
                if (checking) return Boolean(file) || files.length > 0;
                if (this.fileExplorerHotkey.working && files.length > 0)
                    this.folderModal.openWithFiles(files);
                else if (file) this.folderModal.open();
            },
        });
        this.addCommand({
            id: "execute-command",
            name: "Execute Command",
            callback: () => {
                this.commandModal.open();
            },
        });
        this.addCommand({
            id: "search-heading",
            name: "Search Heading",
            checkCallback: (checking: boolean) => {
                const file = this.app.workspace.getActiveFile();
                if (checking) return Boolean(file);
                this.headingModal.setFile(file);
                this.headingModal.open();
            },
        });
    }
    onunload() {
        if (this.settings.other.devMode) {
            this.indexManager.devUnload();
        }
    }
    async loadSettings() {
        this.settings = merge({}, DEFAULT_SETTINGS, await this.loadData());
    }
    async saveSettings() {
        await this.saveData(this.settings);
    }
    loadPinyinDict() {
        let pinyinDict = this.settings.global.traditionalChineseSupport
            ? TraditionalDict
            : SimplifiedDict;
        let PinyinKeys_ = Object.keys(pinyinDict);
        let PinyinValues = Object.values(pinyinDict);
        let PinyinKeys =
            this.settings.global.doublePinyin == "全拼"
                ? PinyinKeys_
                : PinyinKeys_.map((p) =>
                      fullPinyin2doublePinyin(
                          p,
                          DoublePinyinDict[this.settings.global.doublePinyin]
                      )
                  );

        // originalKeys 永远是全拼的拼音，keys 是转换后的拼音（可能也是全拼或双拼）
        this.pinyinDict = { keys: PinyinKeys, values: PinyinValues, originalKeys: PinyinKeys_ };
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
    plugin: FuzzyChinesePinyinPlugin;
    app: App;
    leaf: WorkspaceLeaf;
    view: View;
    working = false;
    constructor(app: App, plugin: FuzzyChinesePinyinPlugin) {
        this.plugin = plugin;
        this.app = app;
        let leafs = this.app.workspace.getLeavesOfType("file-explorer");
        if (leafs.length == 0) return;
        this.leaf = leafs[0];
        this.working = true;
        this.view = this.leaf.view;
    }
    getFiles(): TFile[] {
        return Array.from((this.view as any).tree.selectedDoms).map((p: { file: TFile }) => p.file);
    }
}

class IndexManager extends Array<PinyinIndex<any>> {
    plugin: FuzzyChinesePinyinPlugin;
    constructor(
        plugin: FuzzyChinesePinyinPlugin,
        component: Array<FuzzyModal<any> | EditorSuggest<any>>
    ) {
        super();
        component.forEach((p: any) => this.push(p.index));
        this.plugin = plugin;
    }
    load() {
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
        globalThis.refreshFuzzyChineseIndex = () => {
            globalThis.FuzzyChineseIndex = {};
            this.load();
            this.devUnload();
        };
    }
    devUnload() {
        globalThis.FuzzyChineseIndex = {};
        this.forEach((index) => {
            globalThis.FuzzyChineseIndex[index.id] = index.items;
        });
    }
}
