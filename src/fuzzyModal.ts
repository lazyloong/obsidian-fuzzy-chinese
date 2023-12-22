import { SuggestModal, App } from "obsidian";
import FuzzyChinesePinyinPlugin from "./main";
import { HistoryMatchDataNode, PinyinIndex, MatchData, Item } from "./utils";

export default abstract class FuzzyModal<T extends Item> extends SuggestModal<MatchData<T>> {
    historyMatchData: HistoryMatchDataNode<T>;
    chooser: any;
    index: PinyinIndex<T>;
    plugin: FuzzyChinesePinyinPlugin;
    useInput: boolean;
    constructor(app: App, plugin: FuzzyChinesePinyinPlugin) {
        super(app);
        this.useInput = false;
        this.plugin = plugin;
        this.historyMatchData = new HistoryMatchDataNode("\0");

        this.scope.register([], "Backspace", async (e) => {
            if (this.plugin.settings.global.closeWithBackspace && this.inputEl.value === "") {
                this.close();
            }
        });
        this.scope.register(["Mod"], "N", async (e) => {
            if (this.chooser.selectedItem != this.chooser.values.length - 1) {
                this.chooser.setSelectedItem(this.chooser.selectedItem + 1);
                this.chooser.suggestions[this.chooser.selectedItem].scrollIntoView({ block: "center", behavior: "smooth" });
            } else {
                this.chooser.setSelectedItem(0);
                this.chooser.suggestions[this.chooser.selectedItem].scrollIntoView({ block: "center", behavior: "smooth" });
            }
        });
        this.scope.register(["Mod"], "P", async (e) => {
            if (this.chooser.selectedItem != 0) {
                this.chooser.setSelectedItem(this.chooser.selectedItem - 1);
                this.chooser.suggestions[this.chooser.selectedItem].scrollIntoView({ block: "center", behavior: "smooth" });
            } else {
                this.chooser.setSelectedItem(this.chooser.values.length - 1);
                this.chooser.suggestions[this.chooser.selectedItem].scrollIntoView({ block: "center", behavior: "smooth" });
            }
        });
    }
    onOpen() {
        this.inputEl.value = "";
        this.inputEl.focus();
        this.onInput(); // 无输入时触发历史记录
    }
    abstract getEmptyInputSuggestions(): MatchData<T>[];
    getSuggestions(query: string): MatchData<T>[] {
        if (query == "") {
            this.historyMatchData = new HistoryMatchDataNode("\0");
            return this.getEmptyInputSuggestions();
        }

        let matchData: MatchData<T>[] = [];
        let node = this.historyMatchData,
            lastNode: HistoryMatchDataNode<T>,
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
            if (d) matchData.push(d as MatchData<T>);
        }

        matchData = matchData.sort((a, b) => b.score - a.score);
        // 记录数据以便下次匹配可以使用
        if (!lastNode) lastNode = this.historyMatchData;
        lastNode.itemIndex = matchData.map((p) => p.item);
        return matchData;
    }

    renderSuggestion(matchData: MatchData<T>, el: HTMLElement) {
        el.addClass("fz-item");
        let e_content = el.createEl("div", { cls: "fz-suggestion-content" });
        let range = matchData.range,
            text = matchData.item.name,
            index = 0;
        if (range) {
            for (const r of range) {
                e_content.appendText(text.slice(index, r[0]));
                e_content.createSpan({ cls: "suggestion-highlight", text: text.slice(r[0], r[1] + 1) });
                index = r[1] + 1;
            }
        }
        e_content.appendText(text.slice(index));
    }
    onNoSuggestion(value?: any): void {
        this.chooser.setSuggestions(null);
        if (this.useInput) {
            value = value ?? <MatchData<Item>>{ item: { name: this.inputEl.value, pinyin: null }, score: -1, range: null };
            this.chooser.setSuggestions([value]);
        }
        this.chooser.addMessage(this.emptyStateText);
    }
    abstract onChooseSuggestion(matchData: MatchData<T>, evt: MouseEvent | KeyboardEvent): void;
    onClose() {
        this.contentEl.empty();
    }
    getChoosenItem() {
        return this.chooser.values[this.chooser.selectedItem];
    }
}
