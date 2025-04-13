import { SuggestModal, App } from "obsidian";
import ThePlugin from "@/main";
import { HistoryMatchDataNode, PinyinIndex, MatchData, Item, SuggestionRenderer } from "@/utils";

export default abstract class FuzzyModal<T extends Item> extends SuggestModal<MatchData<T>> {
    historyMatchData: HistoryMatchDataNode<T>;
    index: PinyinIndex<T>;
    plugin: ThePlugin;
    useInput: boolean;
    onInput: () => void;
    resolve: (value?: Item) => void;
    isPromiseCall: boolean = false;
    constructor(app: App, plugin: ThePlugin) {
        super(app);
        this.useInput = false;
        this.plugin = plugin;
        this.historyMatchData = new HistoryMatchDataNode("\0");
        this.containerEl.addClass("fz-modal");

        this.scope.register([], "Backspace", async (e) => {
            if (this.plugin.settings.global.closeWithBackspace && this.inputEl.value === "") {
                this.close();
            }
        });
        this.scope.register(["Mod"], "N", async (e) => {
            if (this.chooser.selectedItem != this.chooser.values.length - 1)
                this.chooser.setSelectedItem(this.chooser.selectedItem + 1, e);
            else this.chooser.setSelectedItem(0, e);
        });
        this.scope.register(["Mod"], "P", async (e) => {
            if (this.chooser.selectedItem != 0) {
                this.chooser.setSelectedItem(this.chooser.selectedItem - 1, e);
            } else this.chooser.setSelectedItem(this.chooser.values.length - 1, e);
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
        const smathCase = /[A-Z]/.test(query) && this.plugin.settings.global.autoCaseSensitivity;
        let { toMatchItem, currentNode } = this.getItemFromHistoryTree(query);
        let matchData: MatchData<T>[] = [];
        for (let p of toMatchItem) {
            let d = p.pinyin.match(query, p, smathCase);
            if (d) matchData.push(d as MatchData<T>);
        }

        matchData = matchData.sort((a, b) => b.score - a.score);
        // 记录数据以便下次匹配可以使用
        currentNode.itemIndex = matchData.map((p) => p.item);
        return matchData;
    }
    getItemFromHistoryTree(query: string) {
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
        const currentNode = this.historyMatchData.index(index - 1),
            toMatchItem =
                currentNode.itemIndex.length == 0 ? this.index.items : currentNode.itemIndex;
        return { toMatchItem, currentNode };
    }

    renderSuggestion(matchData: MatchData<T>, el: HTMLElement) {
        new SuggestionRenderer(el).render(matchData);
    }
    onNoSuggestion(value?: MatchData<T>): void {
        this.chooser.setSuggestions(null);
        if (this.useInput) {
            value = value ?? {
                item: { name: this.inputEl.value, pinyin: null } as T,
                score: -1,
                range: null,
            };
            this.chooser.setSuggestions([value]);
        }
        this.chooser.addMessage(this.emptyStateText);
    }
    abstract onChooseSuggestion(matchData: MatchData<T>, evt: MouseEvent | KeyboardEvent): void;
    onClose() {
        this.contentEl.empty();
    }
    getChoosenMatchData(): MatchData<T> {
        return this.chooser.values[this.chooser.selectedItem];
    }
    getChoosenItem(): T {
        return this.chooser.values[this.chooser.selectedItem].item;
    }
    async openAndGetValue(): Promise<T> {
        return await new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.isPromiseCall = true;
            this.open();
        }).then((v: T) => {
            this.resolve = null;
            this.isPromiseCall = false;
            return v;
        });
    }
}
