import { TFile, View } from "obsidian";
import FuzzyChinesePinyinPlugin from "@/main";
import { Item as fItem } from "@/modal/fileModal";
import { MatchData, Item, PinyinSuggest } from "@/utils";

interface MarkdownView extends View {
    file: TFile;
    metadataEditor: {
        rendered: Array<{
            valueEl: HTMLElement;
            containerEl: HTMLElement;
            entry: {
                key: string;
                type: string;
                value: any;
                _children: any[];
            };
        }>;
    };
}

interface CanvasView extends View {
    file: TFile;
    canvas: {
        dragTempNode(e: PointerEvent, n: any, arg2: (e: any) => void): unknown;
        config: any;
        posCenter(): any;
        createFileNode(arg0: { pos: any; file: TFile; size?: any }): unknown;
        cardMenuEl: HTMLElement;
    };
}

interface EmptyView extends View {
    actionListEl: HTMLElement;
}

export function hijackingCanvasView(plugin: FuzzyChinesePinyinPlugin) {
    let app = plugin.app;
    plugin.registerEvent(
        app.workspace.on("active-leaf-change", (leaf) => {
            if (!isCanvasView(leaf.view)) return;
            let canvas = leaf.view.canvas;
            let openBtl = canvas.cardMenuEl.children[1] as HTMLElement;
            const newBtnElement = openBtl.cloneNode(true) as HTMLElement;
            openBtl.replaceWith(newBtnElement);
            plugin.registerDomEvent(newBtnElement, "click", async (e) => {
                let item = (await plugin.fileModal.openAndGetValue()) as fItem;
                canvas.createFileNode({
                    pos: canvas.posCenter(),
                    file: item.file,
                });
            });
            plugin.registerDomEvent(newBtnElement, "pointerdown", async (e) => {
                let size = canvas.config.defaultFileNodeDimensions;
                canvas.dragTempNode(e, size, async function (e) {
                    let item = (await plugin.fileModal.openAndGetValue()) as fItem;
                    canvas.createFileNode({
                        pos: e,
                        file: item.file,
                        size,
                    });
                });
            });
        })
    );
}

export function hijackingEmptyView(plugin: FuzzyChinesePinyinPlugin) {
    let app = plugin.app;
    plugin.registerEvent(
        app.workspace.on("active-leaf-change", (leaf) => {
            if (!isEmptyView(leaf.view)) return;
            let actionListEl = leaf.view.actionListEl;
            let hotkey = app.hotkeyManager.printHotkeyForCommand(
                "fuzzy-chinese-pinyin:open-search"
            );
            let openBtl1 = actionListEl.children[1] as HTMLElement;
            let openBtl2 = actionListEl.children[2] as HTMLElement;
            for (let openBtl of [openBtl1, openBtl2]) {
                let newBtnElement = openBtl.cloneNode(true) as HTMLElement;
                let m = /^([^(]*)( \((.*)\))?$/.exec(openBtl.innerText);
                if (m) newBtnElement.innerText = m[1] + (hotkey != "" ? ` (${hotkey})` : "");
                openBtl.replaceWith(newBtnElement);
                plugin.registerDomEvent(newBtnElement, "click", async (e) => {
                    plugin.fileModal.open();
                });
            }
        })
    );
}

export function hijackingTagForMarkdownView(plugin: FuzzyChinesePinyinPlugin) {
    let app = plugin.app;
    plugin.registerEvent(
        app.workspace.on("active-leaf-change", (leaf) => {
            if (!isMarkdownView(leaf.view)) return;
            let rendered = leaf.view.metadataEditor.rendered.find(
                (p) => p.entry.key == "tags" || p.entry.key == "tag"
            );
            if (!rendered) return;
            let valueEl = rendered.valueEl;
            plugin.registerDomEvent(valueEl, "mouseup", async (e) => {
                let containerEl = valueEl.querySelector(".multi-select-container") as HTMLElement;
                let inputEl = valueEl.querySelector(".multi-select-input") as HTMLInputElement;
                let newInputEl = inputEl.cloneNode(true) as HTMLInputElement;
                inputEl.replaceWith(newInputEl);
                containerEl.addEventListener("click", (e) => {
                    if (
                        e.target instanceof HTMLElement &&
                        e.target.className == "multi-select-container"
                    )
                        newInputEl.focus();
                });
                let tagSuggest = new metadataEditorSuggest(newInputEl, plugin);
                tagSuggest.getItemFunction = (query) =>
                    plugin.tagEditorSuggest
                        .getSuggestionsByString(query ?? "")
                        .filter(
                            (p) =>
                                !rendered.entry.value ||
                                (rendered.entry.value &&
                                    !rendered.entry.value.includes(p.item.name))
                        );
                tagSuggest.selectSuggestion = function (matchData: MatchData<Item>) {
                    rendered["_children"][0].multiselect.addElement(matchData.item.name);
                }.bind(tagSuggest);
                newInputEl.addEventListener("focus", async (e) => {
                    tagSuggest.onInputChanged();
                });
                newInputEl.addEventListener("input", async (e) => {
                    tagSuggest.onInputChanged();
                });
                newInputEl.addEventListener("keydown", async (e) => {
                    if (!e.isComposing)
                        if ("Enter" === e.key && newInputEl.innerText.length > 0) {
                            e.preventDefault();
                            rendered["_children"][0].multiselect.addElement(newInputEl.innerText);
                            newInputEl.innerText = "";
                        }
                });
            });
        })
    );
}

function isMarkdownView(view: View): view is MarkdownView {
    return view.getViewType() === "markdown";
}

function isCanvasView(view: View): view is CanvasView {
    return view.getViewType() === "canvas";
}

function isEmptyView(view: View): view is EmptyView {
    return view.getViewType() === "empty";
}

class metadataEditorSuggest extends PinyinSuggest {
    constructor(inputEl: HTMLInputElement | HTMLTextAreaElement, plugin: FuzzyChinesePinyinPlugin) {
        super(inputEl, plugin);
        this.suggestEl.style.minWidth = "160px";
    }
    onInputChanged() {
        const inputStr = this.inputEl.innerText;
        const suggestions = this.getSuggestions(inputStr);

        if (!suggestions) {
            this.close();
            return;
        }

        if (suggestions.length > 0) {
            this.suggest.setSuggestions(suggestions);
            this.open(app.dom.appContainerEl, this.inputEl);
        } else {
            this.close();
        }
    }
}
