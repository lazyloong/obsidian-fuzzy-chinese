import {
    Plugin,
    EditorSuggest,
    WorkspaceLeaf,
    Menu,
    TFile,
    TAbstractFile,
    Scope,
    App,
    KeymapEventHandler,
    View,
    Hotkey,
} from "obsidian";
import { fullPinyin2doublePinyin, Item, PinyinIndex, runOnLayoutReady } from "./utils";
import FuzzyModal from "./fuzzyModal";
import FuzzyFileModal from "./fuzzyFileModal";
import FuzzyFolderModal from "./fuzzyFolderModal";
import FuzzyCommandModal from "./fuzzyCommandModal";
import FileEditorSuggest from "./fileEditorSuggest";
import TagEditorSuggest from "./tagEditorSuggest";
import FuzzySuggestModal from "./fuzzySuggestModal";
// 以下两个字典来源于：https://github.com/xmflswood/pinyin-match
import SimplifiedDict from "./simplified_dict";
import TraditionalDict from "./traditional_dict";

import DoublePinyinDict from "./double_pinyin";
import { fuzzyPinyinSearch, stringArray2Items } from "./search";
import SettingTab, { DEFAULT_SETTINGS, FuzyyChinesePinyinSettings } from "./settingTab";

export default class FuzzyChinesePinyinPlugin extends Plugin {
    settings: FuzyyChinesePinyinSettings;
    pinyinDict: { originalKeys: any; keys: string[]; values: string[] };
    api: any;
    fileModal: FuzzyFileModal;
    folderModal: FuzzyFolderModal;
    commandModal: FuzzyCommandModal;
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
        this.fileEditorSuggest = new FileEditorSuggest(this.app, this);
        this.tagEditorSuggest = new TagEditorSuggest(this.app, this);

        this.indexManager = new IndexManager(this, [
            this.folderModal,
            this.fileModal,
            this.commandModal,
            this.tagEditorSuggest,
        ]);
        this.editorSuggests = [this.fileEditorSuggest, this.tagEditorSuggest];

        if (this.settings.file.useFileEditorSuggest) {
            this.app.workspace.editorSuggest.suggests.unshift(this.fileEditorSuggest);
        }
        if (this.settings.other.useTagEditorSuggest) {
            this.app.workspace.editorSuggest.suggests.unshift(this.tagEditorSuggest);
        }

        this.registerFileMenu();

        runOnLayoutReady(() => {
            if (this.settings.other.devMode) {
                this.indexManager.devLoad();
                globalThis.refreshFuzzyChineseIndex = () => {
                    globalThis.FuzzyChineseIndex = {};
                    this.indexManager.load();
                };
            } else {
                this.indexManager.load();
            }
            this.registerFileExplorer();
        });
        this.addCommand({
            id: "open-search",
            name: "Open Search",
            checkCallback: (checking: boolean) => {
                let leaf = this.app.workspace.getMostRecentLeaf();
                if (leaf) {
                    if (!checking) {
                        this.fileModal.open();
                    }
                    return true;
                }
                return false;
            },
        });
        this.addCommand({
            id: "move-file",
            name: "Move File",
            checkCallback: (checking: boolean) => {
                let files = this.fileExplorerHotkey.getFiles();
                let file = this.app.workspace.getActiveFile();
                if (this.fileExplorerHotkey.working && files.length > 0) {
                    if (!checking) {
                        this.folderModal.openWithFiles(files);
                    }
                    return true;
                } else if (file) {
                    if (!checking) {
                        this.folderModal.open();
                    }
                    return true;
                }
                return false;
            },
        });
        this.addCommand({
            id: "execute-command",
            name: "Execute Command",
            checkCallback: (checking: boolean) => {
                if (!checking) {
                    this.commandModal.open();
                }
                return true;
            },
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
    onunload() {
        this.editorSuggests.forEach((editorSuggest) =>
            this.app.workspace.editorSuggest.removeSuggest(editorSuggest)
        );
        if (this.settings.other.devMode) {
            this.indexManager.devUnload();
        }
    }
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }
    async saveSettings() {
        await this.saveData(this.settings);
    }
    loadPinyinDict() {
        let PinyinKeys_ = this.settings.global.traditionalChineseSupport
            ? Object.keys(TraditionalDict)
            : Object.keys(SimplifiedDict);
        let PinyinValues = this.settings.global.traditionalChineseSupport
            ? Object.values(TraditionalDict)
            : Object.values(SimplifiedDict);
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
        let modal = new FuzzySuggestModal(app, this, text_items, items);
        const promise: Promise<string> = new Promise((resolve: (value?: string) => void, reject) =>
            modal.openAndGetValue(resolve, reject)
        );
        return await promise;
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
        return Array.from(this.view.tree.selectedDoms).map((p) => p.file);
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
    }
    devUnload() {
        globalThis.FuzzyChineseIndex = {};
        this.forEach((index) => {
            globalThis.FuzzyChineseIndex[index.id] = index.items;
        });
    }
}
